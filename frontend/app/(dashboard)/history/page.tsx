"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Target, Trophy, Clock, CheckCircle2, AlertCircle,
  Loader2, RotateCcw, ChevronDown, ChevronUp, Trash2,
} from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { HistoryList } from "@/components/resume-analysis/history-list";
import { interviewService } from "@/services/interview.service";
import type { InterviewHistoryItem, InterviewHistoryPage } from "@/types/interview";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

// ── Delete confirmation inline ────────────────────────────────────────────────

function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        aria-label="Delete interview"
        title="Delete"
        className="shrink-0 p-1.5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      <span className="text-xs text-destructive font-medium">Delete?</span>
      <Button
        size="sm"
        variant="destructive"
        className="h-6 px-2 text-xs"
        onClick={handleConfirm}
        disabled={deleting}
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
        disabled={deleting}
      >
        No
      </Button>
    </div>
  );
}

// ── Interview history section ─────────────────────────────────────────────────

function InterviewHistorySection() {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<"loading" | "error" | "success">("loading");
  const [historyData, setHistoryData] = useState<InterviewHistoryPage | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isStale, setIsStale] = useState(false);
  const [page, setPage]         = useState(1);
  const [collapsed, setCollapsed] = useState(false);

  const load = (p = 1, isRefresh = false) => {
    if (!isRefresh) setLoadStatus("loading");
    interviewService
      .getHistory(p, 10)
      .then((data) => {
        setHistoryData(data);
        setLoadStatus("success");
        setIsStale(false);
        setErrorMsg("");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load.";
        setErrorMsg(msg);
        if (historyData) {
          setIsStale(true);
          setLoadStatus("success");
        } else {
          setLoadStatus("error");
        }
      });
  };

  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Optimistically remove a deleted interview from local state. */
  const handleDeleteInterview = async (id: string) => {
    try {
      await interviewService.deleteInterview(id);
      toast.success("Interview deleted.");
      setHistoryData((prev) => {
        if (!prev) return prev;
        const items = prev.items.filter((it) => it.id !== id);
        return {
          ...prev,
          items,
          total_count: Math.max(0, (prev.total_count ?? 1) - 1),
        };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete interview.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Mock interviews</p>
          <h3 className="mt-0.5">Interview sessions</h3>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/mock-interview" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
            <Target size={13} /> New session
          </Link>
          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={collapsed ? "Expand interviews" : "Collapse interviews"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <>
          {loadStatus === "loading" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {isStale && (
            <div className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-2.5">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Showing last available data &mdash; {errorMsg}
              </p>
              <Button size="sm" variant="outline" onClick={() => load(page, true)}>
                <RotateCcw size={12} className="mr-1" /> Refresh
              </Button>
            </div>
          )}

          {loadStatus === "error" && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
              <AlertCircle size={14} className="text-destructive shrink-0" />
              <p className="text-sm text-destructive flex-1">{errorMsg}</p>
              <Button size="sm" variant="outline" onClick={() => load(page)}>
                <RotateCcw size={12} className="mr-1" /> Retry
              </Button>
            </div>
          )}

          {loadStatus === "success" && historyData && historyData.items.length === 0 && (
            <div className="empty-state border border-dashed border-border/40 rounded-xl">
              <Target size={24} className="text-muted-foreground/30" />
              <p className="text-sm font-medium">No interviews yet</p>
              <p className="text-xs text-muted-foreground">Practice for your next role with AI-powered questions.</p>
              <Link href="/mock-interview" className={cn(buttonVariants({ size: "sm" }), "mt-1")}>
                Start your first interview →
              </Link>
            </div>
          )}

          {loadStatus === "success" && historyData && historyData.items.length > 0 && (
            <>
              <div className="divide-y divide-border/30">
                {historyData.items.map((item: InterviewHistoryItem) => (
                  <div
                    key={item.id}
                    className="hover-row flex items-center gap-4 -mx-3"
                  >
                    {/* Clickable area → navigate */}
                    <button
                      className="flex items-center gap-4 flex-1 min-w-0 text-left"
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
                    </button>

                    {/* Right — score + progress + delete */}
                    <div className="flex items-center gap-3 shrink-0">
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
                      {/* Delete */}
                      <DeleteButton onConfirm={() => handleDeleteInterview(item.id)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyData && (historyData.has_prev || historyData.has_next) && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={!historyData.has_prev} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {historyData.page} / {historyData.total_pages}
                  </span>
                  <Button variant="outline" size="sm" disabled={!historyData.has_next} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
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
