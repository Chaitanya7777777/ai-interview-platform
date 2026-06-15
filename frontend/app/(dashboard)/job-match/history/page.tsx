"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  jobMatchService,
  type JobMatchHistoryItem,
  type JobMatchHistoryPage,
} from "@/services/job-match.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreClass(score: number) {
  if (score >= 75) return "score-great";
  if (score >= 50) return "score-good";
  return "score-poor";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-3 py-3">
      <div className="skeleton h-9 w-9 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-1/2" />
        <div className="skeleton h-3 w-1/3" />
      </div>
      <div className="skeleton h-6 w-10 rounded-full" />
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ item }: { item: JobMatchHistoryItem }) {
  // Primary display: job_title if extracted, else fall back to resume filename
  const primaryText = item.job_title ?? item.resume_filename;

  // Secondary: company + resume filename (when we have a job title)
  const secondaryText = item.job_title
    ? [item.company_name, item.resume_filename].filter(Boolean).join(" · ")
    : item.company_name ?? null;

  // Tertiary preview line — use DB preview, then role_fit, then summary
  const previewText =
    item.job_description_preview ??
    (item.role_fit ? item.role_fit.slice(0, 100) + (item.role_fit.length > 100 ? "…" : "") : null) ??
    item.summary.slice(0, 100);

  return (
    <div className="hover-row flex items-center gap-4">
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Briefcase size={16} className="text-primary" />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{primaryText}</p>
        {secondaryText && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {secondaryText}
          </p>
        )}
        {previewText && (
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 line-clamp-1 hidden sm:block">
            {previewText}
          </p>
        )}
      </div>

      {/* Score + ATS + time */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("score-pill tabular-nums", scoreClass(item.match_score))}>
          {item.match_score}%
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
          <Clock size={10} />
          {relativeTime(item.created_at)}
        </span>
      </div>
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

type State = "loading" | "success" | "error";

export default function JobMatchHistoryPage() {
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<JobMatchHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async (p: number) => {
    setState("loading");
    try {
      const result = await jobMatchService.getHistory(p, 10);
      setData(result);
      setPage(p);
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load history.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="page-container fade-in">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label mb-1">Job Match Analyzer</p>
          <h1 className="tracking-tight">Match History</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            All your job match analyses, newest first.
          </p>
        </div>
        <Link
          href="/job-match"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Sparkles size={14} />
          New Match
        </Link>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="card-surface section-divide">
        {/* Loading */}
        {state === "loading" && (
          <div className="divide-y divide-border/30">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => load(page)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {state === "success" && data && data.items.length === 0 && (
          <div className="empty-state">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
              <Briefcase size={24} className="text-muted-foreground/60" />
            </div>
            <div>
              <p className="font-semibold">No job matches yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run your first analysis to see results here.
              </p>
            </div>
            <Link
              href="/job-match"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles size={14} />
              Analyze a Job
            </Link>
          </div>
        )}

        {/* List */}
        {state === "success" && data && data.items.length > 0 && (
          <>
            <div className="divide-y divide-border/20 px-2 py-2">
              {data.items.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {data.page} of {data.total_pages} &middot; {data.total_count} matches
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => load(page - 1)}
                    disabled={!data.has_prev}
                    className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={13} />
                    Prev
                  </button>
                  <button
                    onClick={() => load(page + 1)}
                    disabled={!data.has_next}
                    className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
