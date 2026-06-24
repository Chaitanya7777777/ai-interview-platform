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
 *
 * Reliability:
 * - GET calls (getHistory, getDetail) use resilientFetch with auto-retry.
 * - generateInterview attaches x-idempotency-key — retrying the same
 *   generation request will return the same session, not create a duplicate.
 * - evaluateAnswer uses resilientFetch with a generous interview timeout.
 *   (Answer evaluation is idempotent — re-evaluating the same question_id
 *   is handled safely by the backend.)
 * - deleteInterview is retried safely (DELETE is idempotent).
 */

import { supabase } from "@/lib/supabase";
import { resilientFetch, TIMEOUT } from "@/services/retry-fetch";
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

async function authGet(url: string, timeoutMs: number = TIMEOUT.DEFAULT): Promise<Response> {
  const token = await getBearerToken();
  return resilientFetch(
    url,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
    { timeoutMs },
  );
}

async function authPost(
  url: string,
  body: unknown,
  options: { timeoutMs?: number; idempotent?: boolean } = {},
): Promise<Response> {
  const token = await getBearerToken();
  return resilientFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    {
      timeoutMs: options.timeoutMs ?? TIMEOUT.DEFAULT,
      idempotent: options.idempotent ?? false,
    },
  );
}

// ── Service ───────────────────────────────────────────────────────────────────

export const interviewService = {
  /**
   * Generate a new interview session from a resume.
   *
   * Idempotent: attaches x-idempotency-key so a retry on network failure
   * returns the same session rather than creating a duplicate.
   *
   * @returns InterviewSession with interview_id and all questions.
   */
  async generateInterview(
    payload: GenerateInterviewPayload
  ): Promise<InterviewSession> {
    const response = await authPost(
      `${INTERVIEW_BASE_URL}/generate`,
      payload,
      {
        timeoutMs: TIMEOUT.INTERVIEW,
        idempotent: true, // safe: server deduplicates by x-idempotency-key
      },
    );
    await throwIfError(response);
    return response.json() as Promise<InterviewSession>;
  },

  /**
   * Submit and evaluate one answer.
   *
   * Uses a generous interview timeout (25 s) — AI evaluation involved.
   * Retried on transient failure; evaluation for the same question_id is
   * idempotent on the backend.
   *
   * @returns QuestionEvaluation including score, feedback, and completion status.
   */
  async evaluateAnswer(
    interviewId: string,
    payload: EvaluateAnswerPayload
  ): Promise<QuestionEvaluation> {
    const response = await authPost(
      `${INTERVIEW_BASE_URL}/${interviewId}/evaluate`,
      payload,
      { timeoutMs: TIMEOUT.INTERVIEW },
    );
    await throwIfError(response);
    return response.json() as Promise<QuestionEvaluation>;
  },

  /**
   * Fetch paginated interview history.
   * Retried automatically with a 10-second timeout.
   */
  async getHistory(
    page = 1,
    pageSize = 10
  ): Promise<InterviewHistoryPage> {
    const response = await authGet(
      `${INTERVIEW_BASE_URL}/history?page=${page}&page_size=${pageSize}`,
      TIMEOUT.HISTORY,
    );
    await throwIfError(response);
    return response.json() as Promise<InterviewHistoryPage>;
  },

  /**
   * Fetch full interview detail with all questions and evaluations.
   * Retried automatically with a 12-second detail timeout.
   */
  async getDetail(interviewId: string): Promise<InterviewDetail> {
    const response = await authGet(
      `${INTERVIEW_BASE_URL}/${interviewId}`,
      TIMEOUT.DETAIL,
    );
    await throwIfError(response);
    return response.json() as Promise<InterviewDetail>;
  },

  /**
   * Delete an interview session by ID.
   * DELETE is idempotent — safe to retry on transient failure.
   *
   * @param interviewId  UUID of the interview to delete.
   */
  async deleteInterview(interviewId: string): Promise<void> {
    const token = await getBearerToken();
    const response = await resilientFetch(
      `${INTERVIEW_BASE_URL}/${interviewId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
      { timeoutMs: TIMEOUT.DEFAULT },
    );
    // 204 No Content = success (no body to parse)
    if (response.status === 204 || response.ok) return;
    // Error — try to extract detail message
    const data = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    throw new Error(detail);
  },
};
