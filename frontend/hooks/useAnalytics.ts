"use client";

import { DashboardAnalytics, dashboardService } from "@/services/dashboard.service";
import { useEffect, useState } from "react";

export type AnalyticsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: DashboardAnalytics };

/**
 * useAnalytics
 * ------------
 * Client-side hook that fetches dashboard analytics on mount.
 *
 * Returns a discriminated union state so callers can render
 * loading skeletons, error states, or data cleanly.
 */
export function useAnalytics(): AnalyticsState & { refetch: () => void } {
  const [state, setState] = useState<AnalyticsState>({ status: "loading" });

  const fetch = () => {
    setState({ status: "loading" });
    dashboardService
      .getAnalytics()
      .then((data) => setState({ status: "success", data }))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load analytics.";
        setState({ status: "error", message });
      });
  };

  useEffect(() => {
    fetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, refetch: fetch };
}
