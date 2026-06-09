/**
 * interview.service.ts
 * --------------------
 * Frontend service for all interview API calls.
 *
 * Follows the exact same conventions as resume.service.ts:
 * - getBearerToken() from Supabase session
 * - throwIfError() for consistent error handling
 * - Named export `interviewService`
 * - Full TypeScript types
 */

import { supabase } from "@/lib/supabase";
import type {
  EvaluateAnswerPayload,
  GenerateInterviewPayload,
  InterviewDetail,
  InterviewHistoryPage,
  InterviewSession,
  QuestionEvaluation,
} from "@/types/interview";

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INTERVIEW_BASE_URL = `${API_BASE_URL}/api/v1/interviews`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in to use the interview feature.");
  }
  return data.session.access_token;
}

async function throwIfError(response: Response): Promise<void> {
  if (!response.ok) {
    // 204 No Content has no body — don't try to parse it
    if (response.status === 204) return;
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

export const interviewService = {
  /**
   * Generate a new interview session from a resume.
   *
   * @returns InterviewSession with interview_id and all questions.
   */
  async generateInterview(
    payload: GenerateInterviewPayload
  ): Promise<InterviewSession> {
    const response = await authFetch(`${INTERVIEW_BASE_URL}/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await throwIfError(response);
    return response.json() as Promise<InterviewSession>;
  },

  /**
   * Submit and evaluate one answer.
   *
   * @returns QuestionEvaluation including score, feedback, and completion status.
   */
  async evaluateAnswer(
    interviewId: string,
    payload: EvaluateAnswerPayload
  ): Promise<QuestionEvaluation> {
    const response = await authFetch(
      `${INTERVIEW_BASE_URL}/${interviewId}/evaluate`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    await throwIfError(response);
    return response.json() as Promise<QuestionEvaluation>;
  },

  /**
   * Fetch paginated interview history.
   */
  async getHistory(
    page = 1,
    pageSize = 10
  ): Promise<InterviewHistoryPage> {
    const response = await authFetch(
      `${INTERVIEW_BASE_URL}/history?page=${page}&page_size=${pageSize}`
    );
    await throwIfError(response);
    return response.json() as Promise<InterviewHistoryPage>;
  },

  /**
   * Fetch full interview detail with all questions and evaluations.
   */
  async getDetail(interviewId: string): Promise<InterviewDetail> {
    const response = await authFetch(`${INTERVIEW_BASE_URL}/${interviewId}`);
    await throwIfError(response);
    return response.json() as Promise<InterviewDetail>;
  },

  /**
   * Delete an interview session by ID.
   *
   * @param interviewId  UUID of the interview to delete.
   */
  async deleteInterview(interviewId: string): Promise<void> {
    const response = await authFetch(`${INTERVIEW_BASE_URL}/${interviewId}`, {
      method: "DELETE",
    });
    // 204 No Content = success (no body to parse)
    if (response.status === 204 || response.ok) return;
    // Error — try to extract detail message
    const data = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    throw new Error(detail);
  },
};
