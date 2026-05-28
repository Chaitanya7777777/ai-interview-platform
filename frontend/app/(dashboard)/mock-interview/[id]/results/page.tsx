"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { interviewService } from "@/services/interview.service";
import type { InterviewDetail } from "@/types/interview";
import {
  Loader2, AlertCircle, Trophy, TrendingUp, Target,
  Lightbulb, ChevronRight, RotateCcw, CheckCircle2,
} from "lucide-react";

// ── Score display ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-500 border-green-400" :
    score >= 60 ? "text-amber-500 border-amber-400" :
    "text-red-500 border-red-400";
  const label =
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs Work" : "Keep Practicing";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex h-28 w-28 items-center justify-center rounded-full border-4 ${color}`}>
        <div className="text-center">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs text-muted-foreground">/100</div>
        </div>
      </div>
      <Badge
        className={
          score >= 80 ? "bg-green-500/10 text-green-600 border-green-200" :
          score >= 60 ? "bg-amber-500/10 text-amber-600 border-amber-200" :
          "bg-red-500/10 text-red-600 border-red-200"
        }
        variant="outline"
      >
        {label}
      </Badge>
    </div>
  );
}

// ── Per-question result card ──────────────────────────────────────────────────

function QuestionResult({
  question,
  index,
}: {
  question: InterviewDetail["questions"][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const score = question.ai_score ?? 0;
  const scoreColor =
    score >= 8 ? "text-green-500" : score >= 6 ? "text-amber-500" : "text-red-500";

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
            {question.user_answer !== null ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              index + 1
            )}
          </div>
          <div>
            <p className="text-sm font-medium line-clamp-1">{question.question}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {question.category} · {question.difficulty}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span className={`text-lg font-bold ${scoreColor}`}>
            {score > 0 ? `${score}/10` : "—"}
          </span>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t px-4 py-4 space-y-3 bg-muted/10">
          {question.user_answer && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Your Answer
              </p>
              <p className="text-sm">{question.user_answer}</p>
            </div>
          )}
          {question.ai_feedback && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                AI Feedback
              </p>
              <p className="text-sm text-muted-foreground">{question.ai_feedback}</p>
            </div>
          )}
          {question.ideal_answer && (
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                <Target className="h-3.5 w-3.5" />
                Ideal Answer
              </div>
              <p className="text-sm text-muted-foreground">{question.ideal_answer}</p>
            </div>
          )}
          {question.improvement_suggestions && question.improvement_suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 mb-2">
                <Lightbulb className="h-3.5 w-3.5" />
                Suggestions
              </div>
              <ul className="space-y-1">
                {question.improvement_suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {s}
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

// ── Main Results Page ─────────────────────────────────────────────────────────

export default function InterviewResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    interviewService
      .getDetail(params.id)
      .then(setInterview)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load results.")
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-destructive/70" />
        <p className="text-sm text-muted-foreground">{error ?? "Results not found."}</p>
        <Button variant="outline" onClick={() => router.push("/mock-interview")}>
          Back to Setup
        </Button>
      </div>
    );
  }

  const scores = interview.questions
    .map((q) => q.ai_score)
    .filter((s): s is number => s !== null);

  const avgQ = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const bestQ = scores.length > 0 ? Math.max(...scores) : null;

  const overallScore = interview.overall_score ?? 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Results</h2>
          <p className="mt-1 text-muted-foreground">
            {interview.role} · <span className="capitalize">{interview.difficulty}</span> difficulty
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/mock-interview")}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            New Interview
          </Button>
          <Button size="sm" onClick={() => router.push("/history")}>
            View History
          </Button>
        </div>
      </div>

      {/* ── Score summary ────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Overall score circle */}
            <div className="flex flex-col items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <ScoreCircle score={overallScore} />
              <p className="text-xs text-muted-foreground">Overall Score</p>
            </div>

            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              <div className="rounded-xl bg-muted/30 border p-3 text-center">
                <div className="text-2xl font-bold">{interview.questions.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Questions</div>
              </div>
              <div className="rounded-xl bg-muted/30 border p-3 text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {avgQ}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Avg / Question</div>
              </div>
              <div className="rounded-xl bg-muted/30 border p-3 text-center col-span-2 sm:col-span-1">
                <div className="text-2xl font-bold text-green-500">
                  {bestQ !== null ? `${bestQ}/10` : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Best Answer</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Per-question breakdown ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Question Breakdown</h3>
        <div className="space-y-3">
          {interview.questions.map((q, i) => (
            <QuestionResult key={q.id} question={q} index={i} />
          ))}
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <Button className="flex-1" onClick={() => router.push("/mock-interview")}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Practice Again
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => router.push("/resume-analysis")}>
          Improve Resume
        </Button>
      </div>
    </div>
  );
}
