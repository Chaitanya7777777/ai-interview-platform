"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { interviewService } from "@/services/interview.service";
import type { InterviewDetail } from "@/types/interview";
import {
  Loader2, AlertCircle, Trophy, TrendingUp,
  ChevronRight, RotateCcw, CheckCircle2, Target, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreClass(score: number) {
  if (score >= 80) return "score-great";
  if (score >= 60) return "score-good";
  return "score-poor";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs work";
  return "Keep practicing";
}

// ── Score circle ──────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const color  = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  const ring   = score >= 80 ? "border-emerald-400/30" : score >= 60 ? "border-amber-400/30" : "border-red-400/30";
  const label  = scoreLabel(score);
  const labelC = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn("flex h-28 w-28 items-center justify-center rounded-full border-4", ring)}>
        <div className="text-center">
          <p className={cn("text-4xl font-bold leading-none tabular-nums", color)}>{score}</p>
          <p className="text-xs text-muted-foreground mt-1">/100</p>
        </div>
      </div>
      <span className={cn("text-xs font-semibold uppercase tracking-widest", labelC)}>{label}</span>
    </div>
  );
}

// ── Question accordion ────────────────────────────────────────────────────────

function QuestionRow({
  question,
  index,
}: {
  question: InterviewDetail["questions"][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const score = question.ai_score ?? 0;
  const sc    = score >= 8 ? "score-great" : score >= 6 ? "score-good" : "score-poor";

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        className="w-full flex items-center gap-4 py-4 text-left hover:bg-muted/20 px-1 rounded transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold",
          question.user_answer !== null ? "bg-emerald-400/10" : "bg-muted"
        )}>
          {question.user_answer !== null
            ? <CheckCircle2 size={13} className="text-emerald-400" />
            : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">{question.question}</p>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {question.category} · {question.difficulty}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("text-sm font-bold tabular-nums", sc)}>
            {score > 0 ? `${score}/10` : "—"}
          </span>
          <ChevronRight
            size={14}
            className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
          />
        </div>
      </button>

      {open && (
        <div className="pb-4 px-1 space-y-3 fade-in">
          {question.user_answer && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">Your answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.user_answer}</p>
            </div>
          )}
          {question.ai_feedback && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">AI feedback</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.ai_feedback}</p>
            </div>
          )}
          {question.ideal_answer && (
            <div className="rounded-lg border border-border/30 bg-background/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/60 mb-1.5 flex items-center gap-1.5">
                <Target size={10} /> Ideal answer
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.ideal_answer}</p>
            </div>
          )}
          {question.improvement_suggestions && question.improvement_suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={10} /> Suggestions
              </p>
              <ul className="space-y-1">
                {question.improvement_suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight size={12} className="text-primary/40 mt-0.5 shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    interviewService
      .getDetail(params.id)
      .then(setInterview)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="flex h-80 items-center justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !interview) return (
    <div className="flex h-80 flex-col items-center justify-center gap-3">
      <AlertCircle size={32} className="text-destructive/60" />
      <p className="text-sm text-muted-foreground">{error ?? "Results not found."}</p>
      <Button variant="outline" size="sm" onClick={() => router.push("/mock-interview")}>
        Back to setup
      </Button>
    </div>
  );

  const scores     = interview.questions.map((q) => q.ai_score).filter((s): s is number => s !== null);
  const avgQ       = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const bestQ      = scores.length > 0 ? Math.max(...scores) : null;
  const overall    = interview.overall_score ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-10 fade-in">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1>Results</h1>
          <p className="text-muted-foreground text-sm">
            {interview.role} · <span className="capitalize">{interview.difficulty}</span> difficulty
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => router.push("/mock-interview")} className="gap-1.5">
            <RotateCcw size={12} /> New interview
          </Button>
        </div>
      </div>

      {/* ── Score hero ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Circle */}
          <div className="flex flex-col items-center gap-2">
            <Trophy size={16} className="text-amber-400" />
            <ScoreCircle score={overall} />
            <p className="text-xs text-muted-foreground">Overall score</p>
          </div>

          {/* Stats */}
          <div className="flex-1 grid grid-cols-3 gap-4 w-full">
            {[
              { label: "Questions",       value: interview.questions.length, icon: null },
              { label: "Avg / question",  value: avgQ,                       icon: TrendingUp },
              { label: "Best answer",     value: bestQ !== null ? `${bestQ}/10` : "—", icon: null },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {Icon ? (
                    <span className="flex items-center justify-center gap-1">
                      <Icon size={16} className="text-primary" /> {value}
                    </span>
                  ) : value}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Question breakdown ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="section-label">Question breakdown</p>
        <div>
          {interview.questions.map((q, i) => (
            <QuestionRow key={q.id} question={q} index={i} />
          ))}
        </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <Button className="flex-1 gap-1.5" onClick={() => router.push("/mock-interview")}>
          <RotateCcw size={13} /> Practice again
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => router.push("/resume-analysis")}>
          Improve résumé
        </Button>
      </div>
    </div>
  );
}
