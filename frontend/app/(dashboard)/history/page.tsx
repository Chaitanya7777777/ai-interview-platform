"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, Trophy, Clock, CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HistoryList } from "@/components/resume-analysis/history-list";
import { interviewService } from "@/services/interview.service";
import type { InterviewHistoryItem, InterviewHistoryPage } from "@/types/interview";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function statusBadge(status: string) {
  if (status === "completed")
    return <Badge variant="outline" className="border-green-200 bg-green-500/10 text-green-600 text-xs">Completed</Badge>;
  if (status === "active")
    return <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-xs">In Progress</Badge>;
  return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
}

// ── Interview History Section ─────────────────────────────────────────────────

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
          message: err instanceof Error ? err.message : "Failed to load interview history.",
        })
      );
  };

  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Mock Interviews</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Your AI-powered interview sessions.</p>
        </div>
        <Link href="/mock-interview" className={buttonVariants({ size: "sm" })}>
          <Target className="mr-2 h-4 w-4" />
          New Interview
        </Link>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{state.message}</p>
          <Button size="sm" variant="outline" onClick={() => load(page)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {state.status === "success" && state.data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium">No interviews yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Start a mock interview to practice for your next role.
          </p>
          <Link href="/mock-interview" className={buttonVariants({ size: "sm" })}>
            Start your first interview →
          </Link>
        </div>
      )}

      {state.status === "success" && state.data.items.length > 0 && (
        <>
          <div className="space-y-3">
            {state.data.items.map((item: InterviewHistoryItem) => (
              <div
                key={item.id}
                className="group flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 transition-shadow hover:shadow-sm cursor-pointer"
                onClick={() =>
                  item.status === "completed"
                    ? router.push(`/mock-interview/${item.id}/results`)
                    : router.push(`/mock-interview/${item.id}`)
                }
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110 shrink-0">
                    {item.status === "completed"
                      ? <Trophy className="h-5 w-5" />
                      : <Target className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.role ?? "Mock Interview"}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {statusBadge(item.status)}
                      <span className="text-xs text-muted-foreground capitalize">
                        {item.difficulty ?? "medium"} difficulty
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {relativeTime(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-2">
                  {/* Progress */}
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-muted-foreground">
                      {item.answered_count}/{item.question_count} answered
                    </p>
                    <div className="h-1 w-20 rounded-full bg-muted mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: item.question_count > 0
                            ? `${(item.answered_count / item.question_count) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`text-xl font-bold ${scoreColor(item.overall_score)}`}>
                    {item.overall_score !== null ? `${item.overall_score}` : "—"}
                    {item.overall_score !== null && (
                      <span className="text-xs text-muted-foreground font-normal">/100</span>
                    )}
                  </div>

                  <CheckCircle2
                    className={`h-5 w-5 ${
                      item.status === "completed" ? "text-green-500" : "text-muted-foreground/30"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(state.data.has_prev || state.data.has_next) && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!state.data.has_prev}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {state.data.page} of {state.data.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!state.data.has_next}
                onClick={() => setPage((p) => p + 1)}
              >
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
    <div className="space-y-10">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">History</h2>
          <p className="text-muted-foreground mt-1">
            Your past resume uploads, analyses, and interview sessions.
          </p>
        </div>
        <Link
          href="/resume-analysis"
          className={buttonVariants({ size: "sm" })}
          id="new-resume-link"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Resume
        </Link>
      </div>

      {/* ── Resume history ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Resume Uploads</h3>
          <p className="text-sm text-muted-foreground mt-0.5">All your uploaded resumes and AI analyses.</p>
        </div>
        <HistoryList />
      </div>

      {/* ── Interview history ────────────────────────────────────────────────── */}
      <InterviewHistorySection />
    </div>
  );
}
