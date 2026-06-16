/**
 * job-match.service.ts
 * --------------------
 * Frontend service for the Job Match Analyzer feature.
 *
 * Post-0006 storage upgrade additions:
 * - JobMatchResult and JobMatchHistoryItem now include job_title, company_name,
 *   job_description_preview, and has_stored_jd fields.
 * - viewJobDescription() fetches the full JD text from the backend
 *   (which reads from Storage or legacy column and returns JSON).
 */

import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobMatchRequest = {
  resume_id: string;       // UUID
  job_description: string; // 300–10,000 chars
};

export type JobMatchResult = {
  id: string;                      // UUID of persisted row
  resume_id: string;
  resume_filename: string;
  match_score: number;             // 0-100
  ats_score: number;               // 0-100
  strengths: string[];
  missing_keywords: string[];
  missing_skills: string[];
  recommendations: string[];
  role_fit: string;
  interview_readiness: string;
  summary: string;

  // Storage metadata (null for pre-0006 rows)
  job_title: string | null;
  company_name: string | null;
  job_description_preview: string | null;
  has_stored_jd: boolean;

  was_duplicate: boolean;          // true if a 24-hour dedup hit occurred
  analysis_warning: string | null;
  created_at: string;              // ISO 8601
};

export type JobMatchDetailResult = {
  id: string;
  resume_id: string;
  resume_filename: string;
  match_score: number;
  ats_score: number;
  job_title: string | null;
  company_name: string | null;
  created_at: string;
  summary: string;
  strengths: string[];
  missing_keywords: string[];
  missing_skills: string[];
  recommendations: string[];
  role_fit: string;
  interview_readiness: string;
  job_description_preview: string | null;
};

export type JobMatchHistoryItem = {
  id: string;
  resume_id: string;
  resume_filename: string;
  match_score: number;
  ats_score: number;
  role_fit: string;
  summary: string;

  // Storage metadata — null for pre-0006 rows
  job_title: string | null;
  company_name: string | null;
  job_description_preview: string | null;
  has_stored_jd: boolean;

  created_at: string;
};

export type JobMatchHistoryPage = {
  items: JobMatchHistoryItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type JobMatchDashboardStats = {
  total_matches: number;
  average_match_score: number;
  best_match_score: number;
  recent_matches: JobMatchHistoryItem[];
};

export type JobDescriptionView = {
  content: string;                 // Full job description text
  job_title: string | null;
  company_name: string | null;
  source: "storage" | "legacy";   // Where the text came from
};

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const JOB_MATCH_URL = `${API_BASE_URL}/api/v1/job-match`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in to use the Job Match feature.");
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

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getBearerToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

// ── Service ───────────────────────────────────────────────────────────────────

export const jobMatchService = {
  /**
   * Run a job match analysis.
   *
   * The backend:
   * 1. Uploads the JD to Supabase Storage (job-descriptions bucket)
   * 2. Calls the AI service
   * 3. Persists the result with 24-hour dedup
   *
   * On a dedup hit within 24h, the existing storage object is reused.
   */
  async runMatch(payload: JobMatchRequest): Promise<JobMatchResult> {
    const response = await authFetch(JOB_MATCH_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await throwIfError(response);
    return response.json() as Promise<JobMatchResult>;
  },

  /**
   * Fetch paginated job match history.
   * History items use the DB preview column — no Storage fetches.
   */
  async getHistory(page = 1, pageSize = 10): Promise<JobMatchHistoryPage> {
    const response = await authFetch(
      `${JOB_MATCH_URL}/history?page=${page}&page_size=${pageSize}`
    );
    await throwIfError(response);
    return response.json() as Promise<JobMatchHistoryPage>;
  },

  /**
   * Fetch compact dashboard stats.
   */
  async getDashboardStats(): Promise<JobMatchDashboardStats> {
    const response = await authFetch(`${JOB_MATCH_URL}/dashboard-stats`);
    await throwIfError(response);
    return response.json() as Promise<JobMatchDashboardStats>;
  },

  /**
   * View the full job description for a specific match.
   *
   * The backend fetches the text from Storage (new rows) or the legacy
   * DB column (pre-0006 rows) and returns it as JSON.
   *
   * Use this to render the JD inline in the UI — no redirect needed.
   *
   * @param matchId  UUID of the job match row
   */
  async viewJobDescription(matchId: string): Promise<JobDescriptionView> {
    const response = await authFetch(
      `${JOB_MATCH_URL}/${matchId}/job-description`
    );
    await throwIfError(response);
    return response.json() as Promise<JobDescriptionView>;
  },

  /**
   * Fetch complete details of a specific job match.
   */
  async getJobMatchDetail(matchId: string): Promise<JobMatchDetailResult> {
    const response = await authFetch(`${JOB_MATCH_URL}/${matchId}`);
    await throwIfError(response);
    return response.json() as Promise<JobMatchDetailResult>;
  },

  /**
   * Trigger PDF report generation.
   */
  async exportPDF(matchId: string): Promise<{ report_ready: boolean }> {
    const response = await authFetch(`${JOB_MATCH_URL}/${matchId}/export`, {
      method: "POST",
    });
    await throwIfError(response);
    return response.json() as Promise<{ report_ready: boolean }>;
  },

  /**
   * Download generated report PDF.
   */
  async downloadReport(matchId: string, filename = "Job_Match_Report.pdf"): Promise<void> {
    const response = await authFetch(`${JOB_MATCH_URL}/${matchId}/report`);
    await throwIfError(response);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
