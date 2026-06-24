/**
 * connection-store.ts
 * -------------------
 * Global, framework-agnostic observable store for connection state.
 * Used by retry-fetch.ts to publish state changes and by
 * connection-alert.tsx to subscribe and render UI.
 *
 * No CustomEvents. No React context. No external libraries.
 * Pure module-level publish/subscribe.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "idle"       // Normal — no retries in flight
  | "retrying"   // Active retry in progress
  | "recovered"  // Last retry succeeded
  | "offline"    // navigator.onLine === false
  | "failed";    // Retries exhausted / circuit open

export interface ConnectionState {
  status: ConnectionStatus;
  /** Current attempt number (1-based). Only relevant when status==="retrying". */
  attempt: number;
  /** Max retries for the current operation. */
  maxAttempts: number;
  /** Human-readable reason for the failure (last error message). */
  reason: string;
}

type Listener = (state: ConnectionState) => void;

// ── Internal state ────────────────────────────────────────────────────────────

let _state: ConnectionState = {
  status: "idle",
  attempt: 0,
  maxAttempts: 4,
  reason: "",
};

const _listeners = new Set<Listener>();

// ── Circuit Breaker ───────────────────────────────────────────────────────────

interface CircuitBreakerState {
  failures: number;
  windowStart: number;
  openUntil: number;
}

const _circuit: CircuitBreakerState = {
  failures: 0,
  windowStart: Date.now(),
  openUntil: 0,
};

const CIRCUIT_FAILURE_THRESHOLD = 5;   // failures before opening
const CIRCUIT_WINDOW_MS = 60_000;      // 60-second rolling window
const CIRCUIT_COOLDOWN_MS = 30_000;    // 30-second cooldown

// ── Public API ────────────────────────────────────────────────────────────────

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  // Immediately emit current state to new subscriber
  listener({ ..._state });
  return () => _listeners.delete(listener);
}

/** Read current state without subscribing. */
export function getState(): ConnectionState {
  return { ..._state };
}

/** Internal — update state and notify all listeners. */
function _emit(partial: Partial<ConnectionState>): void {
  _state = { ..._state, ...partial };
  _listeners.forEach((fn) => fn({ ..._state }));
}

// ── State transitions ─────────────────────────────────────────────────────────

export function markRetrying(attempt: number, maxAttempts: number, reason: string): void {
  _emit({ status: "retrying", attempt, maxAttempts, reason });
}

export function markRecovered(): void {
  _emit({ status: "recovered", attempt: 0, reason: "" });
  // Auto-reset to idle after 2.5 seconds so the banner can fade out
  setTimeout(() => {
    if (_state.status === "recovered") {
      _emit({ status: "idle", attempt: 0, reason: "" });
    }
  }, 2_500);
}

export function markOffline(): void {
  _emit({ status: "offline", attempt: 0, reason: "No internet connection" });
}

export function markFailed(reason: string): void {
  _emit({ status: "failed", attempt: 0, reason });
}

export function markIdle(): void {
  _emit({ status: "idle", attempt: 0, reason: "" });
}

// ── Circuit Breaker API ───────────────────────────────────────────────────────

/** Record a failure. Returns true if the circuit is now open. */
export function recordFailure(): boolean {
  const now = Date.now();

  // Reset window if expired
  if (now - _circuit.windowStart > CIRCUIT_WINDOW_MS) {
    _circuit.failures = 0;
    _circuit.windowStart = now;
  }

  _circuit.failures += 1;

  if (_circuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    _circuit.openUntil = now + CIRCUIT_COOLDOWN_MS;
    return true; // circuit is open
  }

  return false;
}

/** Reset failure count after a successful request. */
export function recordSuccess(): void {
  _circuit.failures = 0;
  _circuit.windowStart = Date.now();
}

/** Returns true if the circuit breaker is currently open (block requests). */
export function isCircuitOpen(): boolean {
  if (_circuit.openUntil === 0) return false;
  if (Date.now() < _circuit.openUntil) return true;
  // Cooldown elapsed — half-open, allow one probe
  _circuit.openUntil = 0;
  _circuit.failures = 0;
  return false;
}

/** Remaining cooldown ms. 0 if circuit is closed. */
export function circuitCooldownMs(): number {
  if (_circuit.openUntil === 0) return 0;
  return Math.max(0, _circuit.openUntil - Date.now());
}
