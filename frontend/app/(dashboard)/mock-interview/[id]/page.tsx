"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { interviewService } from "@/services/interview.service";
import type { InterviewDetail, InterviewQuestion, QuestionEvaluation } from "@/types/interview";
import {
  Loader2, ChevronRight, CheckCircle2, AlertCircle,
  Star, ArrowRight, Target, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{answered} of {total} answered</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Category pill ─────────────────────────────────────────────────────────────

function CategoryPill({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
      {category}
    </span>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 8 ? "text-emerald-400" : score >= 6 ? "text-amber-400" : "text-red-400";
  const ring  = score >= 8 ? "border-emerald-400/30" : score >= 6 ? "border-amber-400/30" : "border-red-400/30";
  return (
    <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2", ring)}>
      <span className={cn("text-lg font-bold leading-none tabular-nums", color)}>{score}</span>
    </div>
  );
}

// ── Feedback panel ────────────────────────────────────────────────────────────

function FeedbackPanel({ ev }: { ev: QuestionEvaluation }) {
  return (
    <div className="mt-5 space-y-4 rounded-xl border border-border/40 bg-muted/10 p-5 fade-in">
      <div className="flex items-start gap-4">
        <ScoreRing score={ev.score} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">AI Feedback</p>
          <p className="text-sm leading-relaxed">{ev.feedback}</p>
        </div>
      </div>

      {ev.ideal_answer && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 flex items-center gap-1.5">
            <Target size={11} /> Ideal answer
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed rounded-lg border border-border/30 bg-background/40 px-4 py-3">
            {ev.ideal_answer}
          </p>
        </div>
      )}

      {ev.improvement_suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 flex items-center gap-1.5">
            <Lightbulb size={11} /> Suggestions
          </p>
          <ul className="space-y-1.5">
            {ev.improvement_suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight size={13} className="text-primary/50 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function InterviewSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer,     setAnswer]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState<string | null>(null);
  const [lastEval,   setLastEval]   = useState<QuestionEvaluation | null>(null);

  useEffect(() => {
    if (!params.id) return;
    interviewService
      .getDetail(params.id)
      .then((d) => {
        setInterview(d);
        const first = d.questions.findIndex((q) => q.user_answer === null);
        setCurrentIdx(first >= 0 ? first : 0);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="flex h-80 items-center justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !interview) return (
    <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
      <AlertCircle size={32} className="text-destructive/60" />
      <p className="text-sm text-muted-foreground">{error ?? "Interview not found."}</p>
      <Button variant="outline" size="sm" onClick={() => router.push("/mock-interview")}>
        Back to setup
      </Button>
    </div>
  );

  const questions = interview.questions;
  const answeredCount = questions.filter((q) => q.user_answer !== null).length;
  const currentQ: InterviewQuestion | undefined = questions[currentIdx];
  const allAnswered = answeredCount === questions.length;
  const isAnswered = currentQ?.user_answer !== null;

  const handleSubmit = async () => {
    if (!answer.trim() || !currentQ) return;
    setSubmitting(true);
    setSubmitErr(null);
    setLastEval(null);
    try {
      const ev = await interviewService.evaluateAnswer(interview.id, {
        question_id: currentQ.id,
        answer: answer.trim(),
      });
      setLastEval(ev);
      setInterview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === currentQ.id ? { ...q, user_answer: answer.trim() } : q
          ),
        };
      });
      if (ev.interview_complete) {
        setTimeout(() => router.push(`/mock-interview/${interview.id}/results`), 2400);
      }
    } catch (err: unknown) {
      setSubmitErr(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    const next = questions.findIndex((q, i) => i > currentIdx && q.user_answer === null);
    if (next >= 0) { setCurrentIdx(next); setAnswer(""); setLastEval(null); setSubmitErr(null); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 fade-in">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{interview.role}</h2>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            interview.status === "completed"
              ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-400"
              : "border-primary/30 bg-primary/5 text-primary"
          )}>
            {interview.status === "completed" ? "Completed" : "In progress"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{interview.difficulty} difficulty</p>
      </div>

      <ProgressBar answered={answeredCount} total={questions.length} />

      {/* ── All answered ─────────────────────────────────────────────────── */}
      {allAnswered ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/40 bg-card py-14 text-center fade-in">
          <CheckCircle2 size={40} className="text-emerald-400" />
          <div>
            <p className="text-lg font-semibold">Interview complete</p>
            <p className="text-sm text-muted-foreground mt-1">
              You answered all {questions.length} questions.
            </p>
          </div>
          <Button onClick={() => router.push(`/mock-interview/${interview.id}/results`)} className="gap-1.5">
            View your results <ArrowRight size={14} />
          </Button>
        </div>
      ) : currentQ ? (
        /* ── Question ──────────────────────────────────────────────────── */
        <div className="space-y-5">
          {/* Question card */}
          <div className="rounded-2xl border border-border/40 bg-card px-6 py-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {currentIdx + 1}
              </div>
              <CategoryPill category={currentQ.category} />
              {currentQ.focus && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                  <Target size={9} />
                  {currentQ.focus}
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground capitalize">{currentQ.difficulty}</span>
            </div>
            <p className="text-base font-medium leading-snug">{currentQ.question}</p>
          </div>

          {/* Answer area */}
          {isAnswered ? (
            <div className="rounded-xl border border-border/30 bg-muted/10 px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">Your answer</p>
              <p className="text-muted-foreground leading-relaxed">{currentQ.user_answer}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="Write your answer here…"
                className="min-h-[140px] resize-none border-border/40 bg-card focus-visible:ring-primary/30 text-sm"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={submitting}
              />
              {submitErr && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {submitErr}
                </div>
              )}
              <Button
                className="w-full h-11 gap-2 font-medium"
                disabled={!answer.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Evaluating…</>
                  : <><Star size={14} /> Submit answer</>}
              </Button>
            </div>
          )}

          {/* Live feedback */}
          {lastEval && <FeedbackPanel ev={lastEval} />}

          {lastEval && !lastEval.interview_complete && (
            <Button variant="outline" className="w-full gap-1.5" onClick={handleNext}>
              Next question <ChevronRight size={14} />
            </Button>
          )}
          {lastEval?.interview_complete && (
            <p className="text-center text-xs text-muted-foreground animate-pulse pt-2">
              Redirecting to results…
            </p>
          )}
        </div>
      ) : null}

      {/* ── Question nav pills ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-2">
        {questions.map((q, i) => {
          const done   = q.user_answer !== null;
          const active = i === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => { if (!done) { setCurrentIdx(i); setAnswer(""); setLastEval(null); setSubmitErr(null); } }}
              className={cn(
                "h-7 w-7 rounded-full text-[11px] font-medium transition-all border",
                done
                  ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400 cursor-default"
                  : active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {done ? "✓" : i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
