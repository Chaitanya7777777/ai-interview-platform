/**
 * interview.ts
 * ------------
 * Shared TypeScript types for the interview system.
 * Mirror the backend Pydantic schemas exactly.
 */

// ── Question ──────────────────────────────────────────────────────────────────

export type InterviewQuestion = {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expected_answer_points: string[];
  order_index: number;
  // Populated after answer submission
  user_answer: string | null;
  ai_feedback: string | null;
  ai_score: number | null; // 1-10
  ideal_answer: string | null;
  improvement_suggestions: string[];
};

// ── Session (from generate endpoint) ─────────────────────────────────────────

export type InterviewSession = {
  interview_id: string;
  role: string;
  difficulty: string;
  status: string;
  questions: InterviewQuestion[];
  created_at: string;
};

// ── Evaluation (from evaluate endpoint) ──────────────────────────────────────

export type QuestionEvaluation = {
  question_id: string;
  score: number; // 1-10
  feedback: string;
  ideal_answer: string;
  improvement_suggestions: string[];
  is_last_question: boolean;
  interview_complete: boolean;
  overall_score: number | null; // 0-100, set when complete
};

// ── History ───────────────────────────────────────────────────────────────────

export type InterviewHistoryItem = {
  id: string;
  role: string | null;
  difficulty: string | null;
  status: string;
  overall_score: number | null;
  question_count: number;
  answered_count: number;
  created_at: string;
  updated_at: string;
};

export type InterviewHistoryPage = {
  items: InterviewHistoryItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

// ── Detail ────────────────────────────────────────────────────────────────────

export type InterviewDetail = {
  id: string;
  role: string | null;
  difficulty: string | null;
  status: string;
  overall_score: number | null;
  summary: string | null;
  questions: InterviewQuestion[];
  created_at: string;
  updated_at: string;
};

// ── Request payloads ──────────────────────────────────────────────────────────

export type GenerateInterviewPayload = {
  resume_id: string;
  role: string;
  difficulty: "easy" | "medium" | "hard";
};

export type EvaluateAnswerPayload = {
  question_id: string;
  answer: string;
};
