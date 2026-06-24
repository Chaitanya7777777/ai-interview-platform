"use client";

/**
 * connection-alert.tsx
 * --------------------
 * Global overlay that reflects real-time connection state from connection-store.ts.
 *
 * States rendered:
 *  - retrying  → amber toast-like banner ("Connection issue · Reconnecting… Attempt N of M")
 *  - recovered → green flash ("Connected") auto-hides after 2 s
 *  - offline   → persistent amber banner ("You're offline")
 *  - failed    → persistent red banner with Retry button
 *  - idle      → nothing rendered
 *
 * Mount once in app-layout.tsx — renders above the page content.
 */

import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscribe,
  type ConnectionState,
  type ConnectionStatus,
} from "@/services/connection-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusConfig(state: ConnectionState): {
  show: boolean;
  icon: React.ReactNode;
  message: string;
  submessage: string;
  colorClass: string;
  persistent: boolean;
  showRetry: boolean;
} | null {
  switch (state.status as ConnectionStatus) {
    case "retrying":
      return {
        show: true,
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />,
        message: "Connection issue",
        submessage: `Reconnecting… Attempt ${state.attempt} of ${state.maxAttempts}`,
        colorClass: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
        persistent: true,
        showRetry: false,
      };
    case "recovered":
      return {
        show: true,
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
        message: "Connected",
        submessage: "",
        colorClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        persistent: false,
        showRetry: false,
      };
    case "offline":
      return {
        show: true,
        icon: <WifiOff className="h-3.5 w-3.5 shrink-0" />,
        message: "You're offline",
        submessage: "Waiting for connection…",
        colorClass: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
        persistent: true,
        showRetry: false,
      };
    case "failed":
      return {
        show: true,
        icon: <XCircle className="h-3.5 w-3.5 shrink-0" />,
        message: state.reason || "Unable to connect",
        submessage: "",
        colorClass: "bg-destructive/10 border-destructive/30 text-destructive",
        persistent: true,
        showRetry: true,
      };
    default:
      return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConnectionAlert() {
  const [connState, setConnState] = useState<ConnectionState>({
    status: "idle",
    attempt: 0,
    maxAttempts: 4,
    reason: "",
  });

  // Subscribe to store updates
  useEffect(() => {
    const unsub = subscribe(setConnState);
    return unsub;
  }, []);

  // Visibility with fade-out delay
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (connState.status === "idle") {
      setLeaving(true);
      const t = setTimeout(() => {
        setVisible(false);
        setLeaving(false);
      }, 300);
      return () => clearTimeout(t);
    }
    setVisible(true);
    setLeaving(false);
  }, [connState.status]);

  const handleRetry = useCallback(() => {
    // Trigger a page reload — the retry-fetch layer will handle re-attempts
    window.location.reload();
  }, []);

  if (!visible) return null;

  const config = statusConfig(connState);
  if (!config || !config.show) return null;

  return (
    <div
      className={cn(
        "fixed bottom-5 left-1/2 z-[200] -translate-x-1/2",
        "transition-all duration-300",
        leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      )}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md",
          config.colorClass
        )}
      >
        {config.icon}

        <span className="flex items-center gap-1.5">
          {config.message}
          {config.submessage && (
            <span className="opacity-70">&middot; {config.submessage}</span>
          )}
        </span>

        {config.showRetry && (
          <button
            onClick={handleRetry}
            className="ml-1 flex items-center gap-1 rounded-full border border-current/30 px-2 py-0.5 text-[11px] opacity-80 hover:opacity-100 transition-opacity"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Retry
          </button>
        )}

        {connState.status === "offline" && (
          <Wifi className="h-3 w-3 opacity-40" />
        )}
      </div>
    </div>
  );
}
