/**
 * resume.service.ts
 * -----------------
 * Frontend service for resume upload, AI analysis, and history fetching.
 *
 * Usage — upload (text only):
 *   const result = await resumeService.uploadResume(file);
 *
 * Usage — upload with AI analysis:
 *   const result = await resumeService.uploadResume(file, { analyse: true });
 *   console.log(result.analysis_result?.overall_score);
 *
 * Usage — fetch history:
 *   const history = await resumeService.getHistory({ page: 1, pageSize: 10 });
 *   console.log(history.items);
 */

import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Structured AI analysis result (matches backend ResumeAnalysisResponse). */
export type ResumeAnalysisResult = {
  overall_score: number;           // 0-100
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  recommended_roles: string[];
  improvement_suggestions: string[];
};

/**
 * Single resume record in the history list.
 * Full extracted_text is NOT included to keep the list lightweight.
 */
export type ResumeHistoryItem = {
  id: string;                          // UUID
  profile_id: string;                  // UUID
  file_name: string;
  file_url: string;                    // Storage object path (empty for legacy rows)
  file_size_bytes: number | null;
  status: "parsed" | "analysed" | "failed";
  text_length: number | null;
  analysis_result: ResumeAnalysisResult | null;
  created_at: string;                  // ISO 8601
  updated_at: string;                  // ISO 8601
};

/** Paginated response from GET /api/v1/resume/history. */
export type ResumeHistoryPage = {
  items: ResumeHistoryItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

/** Response from POST /api/v1/resume/upload. */
export type ResumeUploadResponse = {
  resume_id: string;                   // UUID of the persisted DB record
  filename: string;
  content_type: string;
  file_size_bytes: number;
  text_length: number;
  extracted_text: string;
  analysis_result: ResumeAnalysisResult | null;
  analysis_warning: string | null;
};

/** Upload options. */
export type UploadOptions = {
  /** Run AI analysis after extraction. Defaults to false. */
  analyse?: boolean;
};

/** History fetch options. */
export type HistoryOptions = {
  page?: number;      // default 1
  pageSize?: number;  // default 10
};

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const RESUME_BASE_URL = `${API_BASE_URL}/api/v1/resume`;

// ── Helper: get bearer token ──────────────────────────────────────────────────

async function getBearerToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in to perform this action.");
  }
  return data.session.access_token;
}

// ── Helper: throw on API error ────────────────────────────────────────────────

async function throwIfError(response: Response): Promise<void> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: response.statusText }));
    const detail =
      typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    throw new Error(detail);
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const resumeService = {
  /**
   * Upload a resume file, extract text, persist to DB, optionally analyse.
   *
   * @param file     File from an <input type="file"> element.
   * @param options  { analyse: boolean } — defaults to false.
   * @returns        ResumeUploadResponse including the new resume_id.
   *
   * @example
   *   const res = await resumeService.uploadResume(file, { analyse: true });
   *   console.log(res.resume_id, res.analysis_result?.overall_score);
   */
  async uploadResume(
    file: File,
    options: UploadOptions = {},
  ): Promise<ResumeUploadResponse> {
    const { analyse = false } = options;
    const token = await getBearerToken();

    const formData = new FormData();
    formData.append("file", file);

    const url = `${RESUME_BASE_URL}/upload${analyse ? "?analyse=true" : ""}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    await throwIfError(response);
    return response.json() as Promise<ResumeUploadResponse>;
  },

  /**
   * Fetch the authenticated user's paginated resume history.
   *
   * @param options  { page, pageSize } — both default to 1 / 10.
   * @returns        ResumeHistoryPage with items and pagination metadata.
   *
   * @example
   *   const history = await resumeService.getHistory({ page: 1, pageSize: 5 });
   *   history.items.forEach(item => console.log(item.file_name, item.status));
   */
  async getHistory(options: HistoryOptions = {}): Promise<ResumeHistoryPage> {
    const { page = 1, pageSize = 10 } = options;
    const token = await getBearerToken();

    const url = `${RESUME_BASE_URL}/history?page=${page}&page_size=${pageSize}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    await throwIfError(response);
    return response.json() as Promise<ResumeHistoryPage>;
  },

  /**
   * Delete a resume by ID.
   *
   * @param id  UUID of the resume to delete.
   */
  async deleteResume(id: string): Promise<void> {
    const token = await getBearerToken();

    const response = await fetch(`${RESUME_BASE_URL}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 204 || response.ok) return;
    const data = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    throw new Error(detail);
  },

  /**
   * Open the original resume file in a new browser tab.
   *
   * The backend returns HTTP 307 → Supabase signed URL (10 min expiry).
   * The browser follows the redirect automatically. The signed URL is never
   * exposed to JavaScript — it stays in the browser's request chain.
   *
   * @param resumeId  UUID of the resume to download.
   * @throws Error if the resume has no stored file (legacy row) or storage fails.
   */
  openResume(resumeId: string): void {
    // We can't attach the auth token to window.open() easily.
    // Instead, we fetch the redirect URL first, then open it.
    getBearerToken().then((token) => {
      fetch(`${RESUME_BASE_URL}/${resumeId}/download`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual", // capture the redirect, don't follow it
      })
        .then((res) => {
          if (res.type === "opaqueredirect" || res.status === 307 || res.status === 302) {
            // Get Location header from the redirect response
            const location = res.headers.get("location");
            if (location) {
              window.open(location, "_blank", "noopener,noreferrer");
              return;
            }
          }
          if (!res.ok) {
            res.json()
              .then((d) => { throw new Error(d?.detail ?? "Failed to open resume."); })
              .catch(() => { throw new Error("Failed to open resume."); });
          }
        })
        .catch((err) => {
          console.error("openResume error:", err);
          throw err;
        });
    });
  },
};
