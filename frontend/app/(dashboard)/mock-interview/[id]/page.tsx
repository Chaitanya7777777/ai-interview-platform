"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { interviewService } from "@/services/interview.service";
import type { InterviewDetail, InterviewQuestion, QuestionEvaluation } from "@/types/interview";
import {
  Loader2, ChevronRight, CheckCircle2, AlertCircle,
  Brain, Star, Lightbulb, Target,
} from "lucide-react";

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Question {Math.min(current + 1, total)} of {total}</span>
        <span>{pct}% complete</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  technical:   "bg-blue-500/10 text-blue-600 border-blue-200",
  behavioral:  "bg-purple-500/10 text-purple-600 border-purple-200",
  situational: "bg-amber-500/10 text-amber-600 border-amber-200",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category.toLowerCase()] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {category}
    </span>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-green-500" : score >= 6 ? "text-amber-500" : "text-red-500";
  return (
    <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${
      score >= 8 ? "border-green-500/30" : score >= 6 ? "border-amber-500/30" : "border-red-500/30"
    }`}>
      <span className={`text-xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-muted-foreground">/10</span>
    </div>
  );
}

// ── Feedback Panel ────────────────────────────────────────────────────────────

function FeedbackPanel({ evaluation }: { evaluation: QuestionEvaluation }) {
  return (
    <div className="mt-5 space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={evaluation.score} />
        <div>
          <p className="font-semibold">AI Feedback</p>
          <p className="text-sm text-muted-foreground">{evaluation.feedback}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" />
          Ideal Answer
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed bg-background rounded-lg border p-3">
          {evaluation.ideal_answer}
        </p>
      </div>

      {evaluation.improvement_suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Improvement Suggestions
          </div>
          <ul className="space-y-1.5">
            {evaluation.improvement_suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Session Page ─────────────────────────────────────────────────────────

export default function InterviewSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [interview, setInterview]   = useState<InterviewDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Current question index (among unanswered)
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastEval, setLastEval]     = useState<QuestionEvaluation | null>(null);

  useEffect(() => {
    if (!params.id) return;
    interviewService
      .getDetail(params.id)
      .then((d) => {
        setInterview(d);
        // Start from first unanswered question
        const firstUnanswered = d.questions.findIndex((q) => q.user_answer === null);
        setCurrentIdx(firstUnanswered >= 0 ? firstUnanswered : 0);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load interview.");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your interview…</p>
        </div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-destructive/70" />
        <p className="text-sm text-muted-foreground">{error ?? "Interview not found."}</p>
        <Button variant="outline" onClick={() => router.push("/mock-interview")}>
          Back to Setup
        </Button>
      </div>
    );
  }

  const questions = interview.questions;
  const answeredCount = questions.filter((q) => q.user_answer !== null).length;
  const currentQ: InterviewQuestion | undefined = questions[currentIdx];

  const handleSubmit = async () => {
    if (!answer.trim() || !currentQ) return;
    setSubmitting(true);
    setSubmitError(null);
    setLastEval(null);
    try {
      const evaluation = await interviewService.evaluateAnswer(interview.id, {
        question_id: currentQ.id,
        answer: answer.trim(),
      });
      setLastEval(evaluation);

      // Update local state so answered count is correct
      setInterview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === currentQ.id ? { ...q, user_answer: answer.trim() } : q
          ),
        };
      });

      if (evaluation.interview_complete) {
        // Small delay to let user read the last feedback
        setTimeout(() => router.push(`/mock-interview/${interview.id}/results`), 2500);
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    const nextIdx = questions.findIndex(
      (q, i) => i > currentIdx && q.user_answer === null
    );
    if (nextIdx >= 0) {
      setCurrentIdx(nextIdx);
      setAnswer("");
      setLastEval(null);
      setSubmitError(null);
    }
  };

  const isAnswered = currentQ?.user_answer !== null;
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{interview.role}</h2>
          <p className="text-sm text-muted-foreground capitalize">
            {interview.difficulty} difficulty
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            interview.status === "completed"
              ? "border-green-200 bg-green-500/10 text-green-600"
              : "border-primary/20 bg-primary/5 text-primary"
          }
        >
          {interview.status === "completed" ? "Completed" : "In Progress"}
        </Badge>
      </div>

      {/* ── Progress ─────────────────────────────────────────────────────────── */}
      <ProgressBar current={answeredCount} total={questions.length} />

      {/* ── Completed state ───────────────────────────────────────────────────── */}
      {allAnswered ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-bold">Interview Complete!</h3>
            <p className="text-muted-foreground">
              You answered all {questions.length} questions. Redirecting to your results…
            </p>
            <Button onClick={() => router.push(`/mock-interview/${interview.id}/results`)}>
              View Results →
            </Button>
          </CardContent>
        </Card>
      ) : currentQ ? (
        /* ── Active question card ──────────────────────────────────────────── */
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {currentIdx + 1}
                </div>
                <CategoryBadge category={currentQ.category} />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Brain className="h-3.5 w-3.5" />
                <span className="capitalize">{currentQ.difficulty}</span>
              </div>
            </div>
            <CardTitle className="text-lg mt-3 leading-snug font-medium">
              {currentQ.question}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {isAnswered ? (
              /* Already answered — show existing feedback if available */
              <div className="rounded-lg bg-muted/30 border p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Your answer:</strong>{" "}
                {currentQ.user_answer}
              </div>
            ) : (
              <>
                <Textarea
                  placeholder="Type your answer here…"
                  className="min-h-[140px] resize-none focus-visible:ring-primary"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={submitting}
                />

                {submitError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!answer.trim() || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Evaluating…
                    </>
                  ) : (
                    <>
                      <Star className="mr-2 h-4 w-4" />
                      Submit Answer
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Live feedback after submission */}
            {lastEval && <FeedbackPanel evaluation={lastEval} />}

            {/* Next button (shown after submission, if not last question) */}
            {lastEval && !lastEval.interview_complete && (
              <Button variant="outline" className="w-full" onClick={handleNext}>
                Next Question <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {lastEval?.interview_complete && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Redirecting to your results…
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Question navigator pills ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-2">
        {questions.map((q, i) => {
          const answered = q.user_answer !== null;
          const active = i === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => {
                if (!answered) {
                  setCurrentIdx(i);
                  setAnswer("");
                  setLastEval(null);
                  setSubmitError(null);
                }
              }}
              className={`h-8 w-8 rounded-full text-xs font-medium transition-all border ${
                answered
                  ? "bg-green-500/10 border-green-200 text-green-600 cursor-default"
                  : active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/40 text-muted-foreground"
              }`}
            >
              {answered ? "✓" : i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
