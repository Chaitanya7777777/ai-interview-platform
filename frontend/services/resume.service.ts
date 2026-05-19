/**
 * resume.service.ts
 * -----------------
 * Frontend service for uploading a resume and (optionally) triggering
 * AI analysis via the FastAPI backend.
 *
 * Usage — extract text only (fast, no AI call):
 *   const result = await resumeService.uploadResume(file);
 *   console.log(result.extracted_text);
 *
 * Usage — extract text + run AI analysis:
 *   const result = await resumeService.uploadResume(file, { analyse: true });
 *   console.log(result.analysis_result?.overall_score);
 *   if (result.analysis_warning) console.warn(result.analysis_warning);
 */

import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Structured AI analysis returned when ?analyse=true is passed. */
export type ResumeAnalysisResult = {
  overall_score: number;           // 0-100
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  recommended_roles: string[];
  improvement_suggestions: string[];
};

/**
 * Shape of the JSON body returned by POST /api/v1/resume/upload.
 *
 * analysis_result is only present when the request was made with analyse=true.
 * analysis_warning is non-null when the AI returned malformed JSON and a
 * fallback was used — surface this message to the user.
 */
export type ResumeUploadResponse = {
  filename: string;
  content_type: string;
  file_size_bytes: number;
  text_length: number;
  extracted_text: string;
  analysis_result: ResumeAnalysisResult | null;
  analysis_warning: string | null;
};

/** Upload options */
export type UploadOptions = {
  /**
   * When true, the backend runs Gemini AI analysis after text extraction
   * and populates analysis_result in the response.
   * Defaults to false.
   */
  analyse?: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const RESUME_UPLOAD_URL = `${API_BASE_URL}/api/v1/resume/upload`;

// ── Helper: get bearer token from Supabase session ───────────────────────────

async function getBearerToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new Error("You must be signed in to upload a resume.");
  }

  return data.session.access_token;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const resumeService = {
  /**
   * Upload a resume file. Optionally trigger Gemini AI analysis.
   *
   * @param file     A File object from an <input type="file"> element.
   * @param options  { analyse: boolean } — defaults to { analyse: false }.
   * @returns        ResumeUploadResponse with text and (if requested) analysis.
   * @throws         Error with a human-readable message on failure.
   *
   * @example — text only
   *   const result = await resumeService.uploadResume(file);
   *
   * @example — with AI analysis
   *   const result = await resumeService.uploadResume(file, { analyse: true });
   *   const score = result.analysis_result?.overall_score;
   */
  async uploadResume(
    file: File,
    options: UploadOptions = {},
  ): Promise<ResumeUploadResponse> {
    const { analyse = false } = options;

    // 1. Get the Supabase JWT so the backend can authenticate the request
    const token = await getBearerToken();

    // 2. Build a multipart/form-data body
    //    FastAPI expects the file under the field name "file"
    const formData = new FormData();
    formData.append("file", file);

    // 3. Build the URL — append ?analyse=true when requested
    const url = analyse
      ? `${RESUME_UPLOAD_URL}?analyse=true`
      : RESUME_UPLOAD_URL;

    // 4. Send the request
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type — the browser must add the multipart boundary
      },
      body: formData,
    });

    // 5. Parse JSON (success or error)
    const data = await response.json();

    if (!response.ok) {
      const errorDetail =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);

      throw new Error(errorDetail);
    }

    return data as ResumeUploadResponse;
  },
};
