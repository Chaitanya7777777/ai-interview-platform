/**
 * retry-fetch.ts
 * --------------
 * Production-grade fetch wrapper with:
 *
 *  - Exponential backoff + random jitter (up to 4 retries)
 *  - Per-call configurable timeouts via AbortController
 *  - Retryable status codes: 408, 429, 500, 502, 503, 504
 *  - Non-retryable: 400, 401, 403, 404, 409, 422
 *  - In-memory GET deduplication (2-second TTL per unique URL)
 *  - Idempotency key support for retry-safe mutations
 *  - Offline detection via navigator.onLine
 *  - Circuit breaker (5 failures / 60 s → 30 s cooldown)
 *  - Global connection state via connection-store.ts
 *  - File uploads (multipart/form-data) are explicitly NOT retried
 *
 * Usage:
 *   import { resilientFetch } from "@/services/retry-fetch";
 *
 *   const res = await resilientFetch(url, { method: "GET" }, { timeoutMs: 8_000 });
 *
 *   // Idempotent mutation (generates one key reused across retries):
 *   const res = await resilientFetch(url, { method: "POST", body }, { idempotent: true });
 */

import {
  markRetrying,
  markRecovered,
  markOffline,
  markFailed,
  markIdle,
  recordFailure,
  recordSuccess,
  isCircuitOpen,
  circuitCooldownMs,
} from "@/services/connection-store";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES = 4;

/** Backoff base delays in ms before jitter is applied. */
const BACKOFF_MS = [0, 300, 1_000, 2_500] as const;

/** Status codes that are safe to retry. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Status codes that are definitively NOT retryable. */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

/** Substrings in error messages that indicate a transient network failure. */
const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "econnreset",
  "econnrefused",
  "network request failed",
  "networkerror",
  "timeout",
  "aborted",
  "the internet connection appears to be offline",
  "load failed",       // Safari
  "fetch is aborted",
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResilientFetchOptions {
  /**
   * Request timeout in milliseconds.
   * Defaults: Dashboard 8s, History 10s, Interview 25s, PDF 45s, fallback 15s.
   */
  timeoutMs?: number;

  /**
   * When true, generates a stable x-idempotency-key UUID for the first call
   * and reuses it across all retries. Use for job match / interview generate /
   * PDF export — NOT for file uploads.
   */
  idempotent?: boolean;

  /**
   * Max number of retries (default MAX_RETRIES = 4).
   * Pass 0 to disable retries entirely.
   */
  maxRetries?: number;
}

// ── Dedup cache ───────────────────────────────────────────────────────────────

interface DedupEntry {
  promise: Promise<Response>;
  expiresAt: number;
}

const _dedupCache = new Map<string, DedupEntry>();
const DEDUP_TTL_MS = 2_000;

function _dedupKey(url: string, init?: RequestInit): string {
  return `${init?.method ?? "GET"}::${url}`;
}

function _cleanDedup(): void {
  const now = Date.now();
  _dedupCache.forEach((entry, key) => {
    if (now > entry.expiresAt) _dedupCache.delete(key);
  });
}

// ── UUID generation (browser-compatible) ─────────────────────────────────────

function _uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments that don't support randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Jitter helper ─────────────────────────────────────────────────────────────

function _withJitter(delayMs: number): number {
  // ±20% random jitter
  const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(delayMs + jitter));
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Error classification ──────────────────────────────────────────────────────

function _isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pat) => msg.includes(pat));
}

function _isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function _isNonRetryable(status: number): boolean {
  return NON_RETRYABLE_STATUSES.has(status);
}

function _isFileUpload(init?: RequestInit): boolean {
  if (!init?.body) return false;
  return init.body instanceof FormData;
}

// ── Observability ─────────────────────────────────────────────────────────────

interface RequestMetrics {
  url: string;
  method: string;
  retry_count: number;
  request_duration: number;
  failure_type?: string;
  timeout_count: number;
  offline_count: number;
  recovered: boolean;
}

function _logMetrics(metrics: RequestMetrics): void {
  if (metrics.retry_count > 0) {
    const emoji = metrics.recovered ? "✅" : "❌";
    console.log(
      `[RetryFetch] ${emoji} ${metrics.method} ${metrics.url}\n` +
      `  retries=${metrics.retry_count} ` +
      `duration=${metrics.request_duration}ms ` +
      `timeouts=${metrics.timeout_count} ` +
      `offline_waits=${metrics.offline_count}` +
      (metrics.failure_type ? ` reason="${metrics.failure_type}"` : "") +
      (metrics.recovered ? " → recovered" : " → exhausted")
    );
  }
}

// ── Offline wait ──────────────────────────────────────────────────────────────

/**
 * If offline, mark state and wait until navigator.onLine becomes true.
 * Resolves within 30 seconds maximum, then gives up.
 */
function _waitForOnline(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof navigator === "undefined" || navigator.onLine) {
      resolve();
      return;
    }

    markOffline();
    const timeout = setTimeout(() => {
      window.removeEventListener("online", handler);
      resolve(); // Give up waiting — let the retry fail naturally
    }, 30_000);

    function handler() {
      clearTimeout(timeout);
      window.removeEventListener("online", handler);
      markIdle();
      resolve();
    }

    window.addEventListener("online", handler);
  });
}

// ── Core fetch implementation ─────────────────────────────────────────────────

async function _attemptFetch(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    // Re-wrap abort as a recognisable timeout error
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timeout — server took too long to respond");
    }
    throw err;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * A resilient drop-in replacement for `fetch`.
 *
 * @param url      Full request URL
 * @param init     Standard RequestInit (method, headers, body, …)
 * @param options  ResilientFetchOptions (timeoutMs, idempotent, maxRetries)
 * @returns        Resolved Response on success
 * @throws         Error after all retries exhausted, or on non-retryable failure
 */
export async function resilientFetch(
  url: string,
  init?: RequestInit,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 15_000,
    idempotent = false,
    maxRetries = MAX_RETRIES,
  } = options;

  const method = (init?.method ?? "GET").toUpperCase();

  // ── Reject file uploads immediately — no retry ────────────────────────────
  if (_isFileUpload(init)) {
    return fetch(url, init);
  }

  // ── GET deduplication ─────────────────────────────────────────────────────
  if (method === "GET") {
    _cleanDedup();
    const key = _dedupKey(url, init);
    const cached = _dedupCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.promise.then((r) => r.clone());
    }

    const promise = _resilientFetchInternal(url, init, options, method, timeoutMs, maxRetries, idempotent);
    _dedupCache.set(key, {
      promise,
      expiresAt: Date.now() + DEDUP_TTL_MS,
    });
    return promise.then((r) => r.clone());
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  return _resilientFetchInternal(url, init, options, method, timeoutMs, maxRetries, idempotent);
}

async function _resilientFetchInternal(
  url: string,
  init: RequestInit | undefined,
  _options: ResilientFetchOptions,
  method: string,
  timeoutMs: number,
  maxRetries: number,
  idempotent: boolean,
): Promise<Response> {
  // Generate one idempotency key reused across all retries
  const idempotencyKey = idempotent ? _uuid() : null;

  // Build headers for idempotent mutations
  function buildInit(): RequestInit {
    if (!idempotencyKey) return init ?? {};
    const existingHeaders =
      init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init?.headers ?? {});
    return {
      ...(init ?? {}),
      headers: {
        ...existingHeaders,
        "x-idempotency-key": idempotencyKey,
      },
    };
  }

  const startTime = Date.now();
  const metrics: RequestMetrics = {
    url,
    method,
    retry_count: 0,
    request_duration: 0,
    timeout_count: 0,
    offline_count: 0,
    recovered: false,
  };

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // ── Circuit breaker check ───────────────────────────────────────────────
    if (isCircuitOpen()) {
      const cooldown = Math.ceil(circuitCooldownMs() / 1_000);
      const msg = `Server temporarily unavailable. Retry in ${cooldown}s.`;
      markFailed(msg);
      metrics.request_duration = Date.now() - startTime;
      _logMetrics({ ...metrics, failure_type: "circuit_open" });
      throw new Error(msg);
    }

    // ── Offline detection ───────────────────────────────────────────────────
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      metrics.offline_count += 1;
      await _waitForOnline();
    }

    // ── Backoff before retry (not before attempt 0) ─────────────────────────
    if (attempt > 0) {
      const baseDelay = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] as number;
      const delay = _withJitter(baseDelay);
      markRetrying(attempt, maxRetries, lastError.message);
      await _sleep(delay);
    }

    // ── Attempt the request ─────────────────────────────────────────────────
    try {
      const response = await _attemptFetch(url, buildInit(), timeoutMs);

      // Non-retryable status — throw immediately
      if (_isNonRetryable(response.status)) {
        markIdle();
        recordSuccess();
        metrics.request_duration = Date.now() - startTime;
        _logMetrics(metrics);
        return response;
      }

      // Success
      if (response.ok) {
        recordSuccess();
        if (attempt > 0) {
          markRecovered();
          metrics.recovered = true;
        } else {
          markIdle();
        }
        metrics.request_duration = Date.now() - startTime;
        _logMetrics(metrics);
        return response;
      }

      // Retryable HTTP status
      if (_isRetryableStatus(response.status) && attempt < maxRetries) {
        lastError = new Error(`Server error (${response.status})`);
        metrics.retry_count += 1;
        metrics.failure_type = `http_${response.status}`;
        const open = recordFailure();
        if (open) {
          markFailed("Server temporarily unavailable");
          metrics.request_duration = Date.now() - startTime;
          _logMetrics(metrics);
          throw new Error("Server temporarily unavailable. Please try again shortly.");
        }
        continue;
      }

      // Non-retryable or exhausted — return as-is (let callers handle body)
      markIdle();
      metrics.request_duration = Date.now() - startTime;
      _logMetrics(metrics);
      return response;

    } catch (err) {
      if (err instanceof Error) {
        lastError = err;

        // Non-retryable errors (explicit throws from above)
        if (err.message.startsWith("Server temporarily unavailable") || err.message.startsWith("Server error (")) {
          if (attempt >= maxRetries) break;
          metrics.retry_count += 1;
          continue;
        }

        // Network / timeout errors — retryable
        if (_isNetworkError(err)) {
          if (err.message.toLowerCase().includes("timeout")) {
            metrics.timeout_count += 1;
            metrics.failure_type = "timeout";
          } else {
            metrics.failure_type = "network";
          }

          if (attempt < maxRetries) {
            metrics.retry_count += 1;
            const open = recordFailure();
            if (open) {
              markFailed("Server temporarily unavailable");
              metrics.request_duration = Date.now() - startTime;
              _logMetrics(metrics);
              throw new Error("Server temporarily unavailable. Please try again shortly.");
            }
            continue;
          }
        }
      }

      // Unknown or non-network error — don't retry
      markIdle();
      metrics.request_duration = Date.now() - startTime;
      _logMetrics(metrics);
      throw err;
    }
  }

  // ── All retries exhausted ─────────────────────────────────────────────────
  const open = recordFailure();
  if (open) {
    markFailed("Server temporarily unavailable");
    metrics.request_duration = Date.now() - startTime;
    _logMetrics(metrics);
    throw new Error("Server temporarily unavailable. Please try again shortly.");
  }

  markFailed(lastError.message);
  metrics.request_duration = Date.now() - startTime;
  _logMetrics(metrics);
  throw lastError;
}

// ── Convenience timeout presets ───────────────────────────────────────────────
// Named exports so callers don't have to remember magic numbers.

export const TIMEOUT: Record<string, number> = {
  DASHBOARD: 8_000,
  HISTORY: 10_000,
  DETAIL: 12_000,
  INTERVIEW: 25_000,
  PDF_EXPORT: 45_000,
  DEFAULT: 15_000,
};
