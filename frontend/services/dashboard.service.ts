/**
 * dashboard.service.ts
 * --------------------
 * Frontend service for fetching analytics from GET /api/v1/dashboard/analytics.
 *
 * Follows the same conventions as resume.service.ts:
 * - Supabase JWT injected via getBearerToken()
 * - throwIfError() for consistent API error handling
 * - Named export `dashboardService` with typed methods
 *
 * Usage:
 *   const analytics = await dashboardService.getAnalytics();
 *   console.log(analytics.total_resumes, analytics.average_score);
 */

import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

/** One data point on the ATS score trend chart. */
export type ScoreTrendPoint = {
  date: string;    // "YYYY-MM-DD"
  score: number;   // 0-100
};

/** Frequency of a missing skill across all analysed resumes. */
export type MissingSkillCount = {
  skill: string;
  count: number;
};

/** Frequency of a recommended role across all analysed resumes. */
export type RecommendedRoleCount = {
  role: string;
  count: number;
};

/** Full analytics payload from GET /api/v1/dashboard/analytics. */
export type DashboardAnalytics = {
  total_resumes: number;
  analysed_resumes: number;
  average_score: number;
  best_score: number;
  score_trend: ScoreTrendPoint[];
  missing_skills: MissingSkillCount[];
  recommended_roles: RecommendedRoleCount[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DASHBOARD_URL = `${API_BASE_URL}/api/v1/dashboard/analytics`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in to view analytics.");
  }
  return data.session.access_token;
}

async function throwIfError(response: Response): Promise<void> {
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail);
    throw new Error(detail);
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const dashboardService = {
  /**
   * Fetch analytics for the authenticated user's resume history.
   *
   * Throws a meaningful Error if:
   * - The user is not signed in (no session)
   * - The API returns a non-2xx status
   *
   * @returns DashboardAnalytics — safe empty-state values when no data exists.
   *
   * @example
   *   const analytics = await dashboardService.getAnalytics();
   *   console.log(`Best score: ${analytics.best_score}`);
   */
  async getAnalytics(): Promise<DashboardAnalytics> {
    const token = await getBearerToken();

    const response = await fetch(DASHBOARD_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    await throwIfError(response);
    return response.json() as Promise<DashboardAnalytics>;
  },
};
