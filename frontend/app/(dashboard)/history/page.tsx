"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, Trophy, Clock, CheckCircle2, AlertCircle, Loader2, RotateCcw, FileText } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { HistoryList } from "@/components/resume-analysis/history-list";
import { interviewService } from "@/services/interview.service";
import type { InterviewHistoryItem, InterviewHistoryPage } from "@/types/interview";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (hours < 1)  return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scoreClass(score: number | null) {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "score-great";
  if (score >= 60) return "score-good";
  return "score-poor";
}

// ── Interview history section ─────────────────────────────────────────────────

function InterviewHistorySection() {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "success"; data: InterviewHistoryPage }
  >({ status: "loading" });
  const [page, setPage] = useState(1);

  const load = (p = 1) => {
    setState({ status: "loading" });
    interviewService
      .getHistory(p, 10)
      .then((data) => setState({ status: "success", data }))
      .catch((err: unknown) =>
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load.",
        })
      );
  };

  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Mock interviews</p>
          <h3 className="mt-0.5">Interview sessions</h3>
        </div>
        <Link href="/mock-interview" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
          <Target size={13} /> New session
        </Link>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
          <AlertCircle size={14} className="text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{state.message}</p>
          <Button size="sm" variant="outline" onClick={() => load(page)}>
            <RotateCcw size={12} className="mr-1" /> Retry
          </Button>
        </div>
      )}

      {state.status === "success" && state.data.items.length === 0 && (
        <div className="empty-state border border-dashed border-border/40 rounded-xl">
          <Target size={24} className="text-muted-foreground/30" />
          <p className="text-sm font-medium">No interviews yet</p>
          <p className="text-xs text-muted-foreground">Practice for your next role with AI-powered questions.</p>
          <Link href="/mock-interview" className={cn(buttonVariants({ size: "sm" }), "mt-1")}>
            Start your first interview →
          </Link>
        </div>
      )}

      {state.status === "success" && state.data.items.length > 0 && (
        <>
          <div className="divide-y divide-border/30">
            {state.data.items.map((item: InterviewHistoryItem) => (
              <div
                key={item.id}
                className="hover-row flex items-center gap-4 -mx-3"
                onClick={() =>
                  item.status === "completed"
                    ? router.push(`/mock-interview/${item.id}/results`)
                    : router.push(`/mock-interview/${item.id}`)
                }
              >
                {/* Icon */}
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  item.status === "completed" ? "bg-emerald-400/10" : "bg-primary/10"
                )}>
                  {item.status === "completed"
                    ? <Trophy size={15} className="text-emerald-400" />
                    : <Target size={15} className="text-primary" />}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-none">{item.role ?? "Mock Interview"}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={cn(
                      "text-xs capitalize font-medium",
                      item.status === "completed" ? "text-emerald-400" : "text-primary"
                    )}>
                      {item.status === "completed" ? "Completed" : "In progress"}
                    </span>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground capitalize">{item.difficulty ?? "medium"}</span>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={10} /> {relativeTime(item.created_at)}
                    </span>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Progress bar (sm+) */}
                  <div className="hidden sm:block">
                    <p className="text-[10px] text-muted-foreground text-right mb-1">
                      {item.answered_count}/{item.question_count}
                    </p>
                    <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: item.question_count > 0 ? `${(item.answered_count / item.question_count) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                  {/* Score */}
                  <p className={cn("text-base font-bold tabular-nums", scoreClass(item.overall_score))}>
                    {item.overall_score !== null ? item.overall_score : "—"}
                  </p>
                  <CheckCircle2
                    size={14}
                    className={item.status === "completed" ? "text-emerald-400" : "text-muted-foreground/20"}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(state.data.has_prev || state.data.has_next) && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={!state.data.has_prev} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {state.data.page} / {state.data.total_pages}
              </span>
              <Button variant="outline" size="sm" disabled={!state.data.has_next} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  return (
    <div className="space-y-12 fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1>History</h1>
          <p className="text-muted-foreground text-base">
            All your résumé uploads, analyses, and interview sessions.
          </p>
        </div>
        <Link href="/resume-analysis" className={cn(buttonVariants({ size: "sm" }), "gap-1.5 shrink-0 self-start mt-1")}>
          <Plus size={13} /> New résumé
        </Link>
      </div>

      {/* Resume history */}
      <div className="space-y-5">
        <div>
          <p className="section-label">Résumé uploads</p>
          <h3 className="mt-0.5">Uploaded résumés</h3>
        </div>
        <HistoryList />
      </div>

      {/* Interview history */}
      <div className="section-divide">
        <InterviewHistorySection />
      </div>
    </div>
  );
}
