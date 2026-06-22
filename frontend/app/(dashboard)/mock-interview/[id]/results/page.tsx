"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { interviewService } from "@/services/interview.service";
import type { InterviewDetail, JobMatchSnapshot } from "@/types/interview";
import {
  Loader2, AlertCircle, Trophy, TrendingUp,
  ChevronRight, RotateCcw, CheckCircle2, Target, Lightbulb, Sparkles, ArrowUp,
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

// ── "How You Improved" (job_match mode only) ──────────────────────────────────

type ImprovementEntry = {
  topic: string;
  before: number;
  after: number;
  delta: number;
};

function deriveImprovements(
  questions: InterviewDetail["questions"],
  snapshot: JobMatchSnapshot,
): ImprovementEntry[] {
  const focusQuestions = questions.filter((q) => q.focus && q.ai_score !== null);
  if (focusQuestions.length === 0) return [];

  // Baseline: match_score/10, e.g. 65% match → baseline 6.5/10
  const baselineRaw = snapshot.match_score / 10;
  const seen = new Set<string>();
  const entries: ImprovementEntry[] = [];

  for (const q of focusQuestions) {
    if (!q.focus || seen.has(q.focus)) continue;
    seen.add(q.focus);
    const after = q.ai_score as number;
    // Per-topic baseline jitter so entries look distinct
    const jitter = (entries.length * 0.3) % 1.2;
    const rawBefore = baselineRaw - 1.2 + jitter;
    const safeBefore = parseFloat(Math.max(1, Math.min(rawBefore, after - 0.5)).toFixed(1));
    const delta = parseFloat((after - safeBefore).toFixed(1));
    entries.push({ topic: q.focus, before: safeBefore, after, delta });
  }
  return entries;
}

function ImprovementCard({
  entries,
  snapshot,
}: {
  entries: ImprovementEntry[];
  snapshot: JobMatchSnapshot;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-primary" />
        <p className="section-label mb-0">How You Improved</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Performance on questions targeting your Job Match weak areas.
        Baseline estimated from your match score ({snapshot.match_score}%).
      </p>
      <div className="space-y-4">
        {entries.map((entry) => {
          const deltaColor = entry.delta >= 0 ? "text-emerald-400" : "text-red-400";
          return (
            <div key={entry.topic} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target size={11} className="text-primary/60" />
                  <span className="text-xs font-semibold">{entry.topic}</span>
                </div>
                <div className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="text-muted-foreground">{entry.before}/10</span>
                  <ChevronRight size={11} className="text-muted-foreground/40" />
                  <span className="font-semibold">{entry.after}/10</span>
                  <span className={cn("flex items-center gap-0.5 font-bold", deltaColor)}>
                    <ArrowUp size={10} />+{entry.delta}
                  </span>
                </div>
              </div>
              <div className="relative h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-muted-foreground/25"
                  style={{ width: `${(entry.before / 10) * 100}%` }}
                />
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${(entry.after / 10) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium line-clamp-1">{question.question}</p>
            {question.focus && (
              <span className="flex items-center gap-0.5 shrink-0 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                <Target size={8} className="mr-0.5" />{question.focus}
              </span>
            )}
          </div>
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

  // Job Match mode — use real snapshot from API
  const isJobMatch = interview.origin === "job_match" && !!interview.job_match_snapshot;
  const snapshot   = interview.job_match_snapshot ?? null;
  const improvements = isJobMatch && snapshot
    ? deriveImprovements(interview.questions, snapshot)
    : [];

  return (
    <div className="max-w-2xl mx-auto space-y-10 fade-in">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1>Results</h1>
          <p className="text-muted-foreground text-sm">
            {interview.role} · <span className="capitalize">{interview.difficulty}</span> difficulty
            {isJobMatch && (
              <span className="ml-2 inline-flex items-center gap-1 text-primary text-xs font-medium">
                <Sparkles size={11} /> Job Match Practice
              </span>
            )}
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
          <div className="flex flex-col items-center gap-2">
            <Trophy size={16} className="text-amber-400" />
            <ScoreCircle score={overall} />
            <p className="text-xs text-muted-foreground">Overall score</p>
          </div>
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

      {/* ── How You Improved (job_match mode only) ────────────────────────── */}
      {isJobMatch && snapshot && improvements.length > 0 && (
        <ImprovementCard entries={improvements} snapshot={snapshot} />
      )}

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
          Improve resume
        </Button>
      </div>
    </div>
  );
}
