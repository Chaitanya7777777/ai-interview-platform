"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Briefcase, FileText, Target, Plus, RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { dashboardService, DashboardAnalytics } from "@/services/dashboard.service";
import { resumeService, ResumeHistoryItem } from "@/services/resume.service";
import { jobMatchService, type JobMatchDashboardStats } from "@/services/job-match.service";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 2)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return "yesterday";
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function scoreClass(score: number): string {
  if (score >= 80) return "score-great";
  if (score >= 60) return "score-good";
  return "score-poor";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />;
}

// ── Stat block ────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="section-label">{label}</p>
      {loading ? (
        <>
          <Pulse className="h-10 w-28" />
          <Pulse className="h-3 w-20" />
        </>
      ) : (
        <>
          <p className="stat-number">{value}</p>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
// Each data point carries a composite string key ("2026-05-28-3") as the
// XAxis dataKey. This guarantees uniqueness even when the backend stores
// dates without a time component (all same-day points get identical timestamps).
// The tooltip reads ts from payload[0].payload.ts and shows only the date.

type ChartPoint = {
  key: string;  // "YYYY-MM-DD-{index}"  — always unique, used as XAxis dataKey
  ts:  number;  // epoch ms  — used only for display in tooltip
  score: number;
};

function ChartTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const { ts, value } = { ts: payload[0].payload.ts, value: payload[0].value };
  // Show date only — no time (user preference)
  const dateStr = new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="text-muted-foreground text-xs mb-0.5">{dateStr}</p>
      <p className="font-semibold tabular-nums">{value}/100</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Data = {
  analytics: DashboardAnalytics;
  recent: ResumeHistoryItem[];
  matchStats: JobMatchDashboardStats | null;
};

type LoadStatus = "loading" | "error" | "success";

export default function DashboardPage() {
  const { user } = useAuth();

  // Separate data from load status so stale data survives a failed refresh
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [data, setData] = useState<Data | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isStale, setIsStale] = useState(false);

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "there";

  const load = (isRefresh = false) => {
    // On a background refresh, don't wipe existing data — just flag loading
    if (!isRefresh) setLoadStatus("loading");
    Promise.all([
      dashboardService.getAnalytics(),
      resumeService.getHistory({ page: 1, pageSize: 6 }),
      jobMatchService.getDashboardStats().catch(() => null),
    ])
      .then(([analytics, history, matchStats]) => {
        setData({ analytics, recent: history.items, matchStats });
        setLoadStatus("success");
        setIsStale(false);
        setErrorMsg("");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load.";
        if (data) {
          // Keep stale data visible — just show a badge
          setIsStale(true);
          setLoadStatus("success");
        } else {
          setLoadStatus("error");
        }
        setErrorMsg(msg);
      });
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loading    = loadStatus === "loading";
  const analytics  = data?.analytics ?? null;
  const recent     = data?.recent ?? [];
  const matchStats = data?.matchStats ?? null;

  // Build chart data sorted chronologically (day first, then submission order).
  // Key = "YYYY-MM-DD-{i}" — a composite string guaranteed to be unique per entry.
  // Recharts builds internal tick keys from the XAxis dataKey value; using a unique
  // string prevents the "duplicate key" React error even when multiple resumes
  // are submitted on the same day with identical timestamps (backend stores
  // date-only, giving all same-day uploads the same epoch ms).
  const chartData: ChartPoint[] = (
    analytics?.score_trend
      .slice()                                             // don't mutate original
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((p, i) => ({
        key:   `${new Date(p.date).toISOString().slice(0, 10)}-${i}`, // e.g. "2026-05-28-3"
        ts:    new Date(p.date).getTime(),
        score: p.score,
      })) ?? []
  );

  return (
    <div className="space-y-12 fade-in">

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div className="space-y-1.5">
          <h1>Good to see you,<br className="sm:hidden" /> {firstName}.</h1>
          <p className="text-muted-foreground text-base max-w-sm">
            Here&apos;s your resume performance at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Link
            href="/resume-analysis"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus size={14} /> Analyse resume
          </Link>
          <Link
            href="/mock-interview"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Target size={14} /> Practice
          </Link>
        </div>
      </div>

      {/* ── Stale data badge ────────────────────────────────────────── */}
      {isStale && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-2.5">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Showing last available data &mdash; {errorMsg}
          </p>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-600/80 dark:text-amber-400/80 hover:text-amber-600 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      )}

      {/* ── Error (only shown when no cached data exists) ────────────── */}
      {loadStatus === "error" && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{errorMsg}</p>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 text-xs font-medium text-destructive/80 hover:text-destructive transition-colors"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* ── Hero metrics ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-y-8 gap-x-6 sm:grid-cols-4 border-b border-border/30 pb-10">
        <Stat
          label="Best ATS score"
          value={analytics?.best_score ? `${analytics.best_score}` : "—"}
          sub={analytics?.analysed_resumes ? `across ${analytics.analysed_resumes} résumés` : undefined}
          loading={loading}
        />
        <Stat
          label="Average score"
          value={analytics?.average_score ? `${analytics.average_score}` : "—"}
          sub="out of 100"
          loading={loading}
        />
        <Stat
          label="Total uploads"
          value={analytics ? `${analytics.total_resumes}` : "—"}
          sub={analytics ? `${analytics.analysed_resumes} analysed` : undefined}
          loading={loading}
        />
        <Stat
          label="Top role match"
          value={analytics?.recommended_roles[0]?.role ?? "—"}
          sub={
            analytics?.recommended_roles[0]
              ? `${analytics.recommended_roles[0].count}× recommended`
              : undefined
          }
          loading={loading}
        />
      </div>

      {/* ── Chart + Activity ──────────────────────────────────────────────── */}
      <div className="grid gap-10 lg:grid-cols-5">

        {/* Score trend */}
        <div className="lg:col-span-3 space-y-4">
          <div>
            <p className="section-label">Score history</p>
            <h3 className="mt-1">ATS trend over time</h3>
          </div>

          <div className="h-[220px]">
            {loading ? (
              <Pulse className="h-full w-full rounded-xl" />
            ) : chartData.length === 0 ? (
              <div className="empty-state h-full border border-dashed border-border/40 rounded-xl">
                <FileText size={28} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No score history yet.</p>
                <Link
                  href="/resume-analysis"
                  className="text-xs text-primary hover:opacity-80 flex items-center gap-1"
                >
                  Analyse your first résumé <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="oklch(0.62 0.19 251)" stopOpacity={0.20} />
                      <stop offset="100%" stopColor="oklch(0.62 0.19 251)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="key"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "oklch(0.55 0 0)" }}
                    dy={8}
                    tickFormatter={(key: string) => {
                      // key = "2026-05-28-3" — parse just the date portion
                      const datePart = key.slice(0, 10); // "2026-05-28"
                      return new Date(datePart + "T12:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    domain={[40, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "oklch(0.55 0 0)" }}
                    tickCount={4}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="oklch(0.62 0.19 251)"
                    strokeWidth={2}
                    fill="url(#grad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "oklch(0.62 0.19 251)", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent uploads */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Recent uploads</p>
              <h3 className="mt-1">Latest résumés</h3>
            </div>
            <Link
              href="/history"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
            >
              See all <ArrowRight size={11} />
            </Link>
          </div>

          <div className="space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Pulse className="h-7 w-7 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Pulse className="h-3 w-3/4" />
                    <Pulse className="h-2.5 w-1/2" />
                  </div>
                  <Pulse className="h-3 w-8" />
                </div>
              ))
            ) : recent.length === 0 ? (
              <div className="empty-state py-10 rounded-xl border border-dashed border-border/40">
                <FileText size={24} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No résumés yet.</p>
              </div>
            ) : (
              recent.map((item) => {
                const score = item.analysis_result?.overall_score;
                return (
                  <div
                    key={item.id}
                    className="hover-row flex items-center gap-3"
                  >
                    <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                      <FileText size={13} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none">{item.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {relativeTime(item.created_at)}
                      </p>
                    </div>
                    {score !== undefined && (
                      <span className={cn("text-sm font-semibold tabular-nums shrink-0", scoreClass(score))}>
                        {score}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Top skill gaps ────────────────────────────────────────────────── */}
      {analytics?.missing_skills && analytics.missing_skills.length > 0 && (
        <div className="space-y-4 section-divide">
          <p className="section-label">Most common skill gaps</p>
          <div className="flex flex-wrap gap-2">
            {analytics.missing_skills.slice(0, 8).map((s) => (
              <span
                key={s.skill}
                className="rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground"
              >
                {s.skill}
                {s.count > 1 && (
                  <span className="ml-1.5 text-muted-foreground/50">×{s.count}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Job Match Stats ───────────────────────────────────────────────── */}
      {(loading || (matchStats && matchStats.total_matches > 0)) && (
        <div className="space-y-4 section-divide">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Job Match Analyzer</p>
              <h3 className="mt-1">Match performance</h3>
            </div>
            <Link
              href="/job-match"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
            >
              Analyze a job <ArrowRight size={11} />
            </Link>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <Stat
              label="Best match"
              value={matchStats ? `${matchStats.best_match_score}%` : "—"}
              loading={loading}
            />
            <Stat
              label="Average match"
              value={matchStats ? `${matchStats.average_match_score}%` : "—"}
              loading={loading}
            />
            <Stat
              label="Total analyses"
              value={matchStats ? `${matchStats.total_matches}` : "—"}
              loading={loading}
            />
          </div>

          {/* Recent matches mini-list */}
          {matchStats && matchStats.recent_matches.length > 0 && (
            <div className="space-y-1">
              {matchStats.recent_matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/job-match/${m.id}`}
                  className="hover-row flex items-center gap-3 text-foreground hover:text-foreground transition-colors"
                >
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Briefcase size={13} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-none">{m.resume_filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {m.role_fit ? m.role_fit.slice(0, 60) + (m.role_fit.length > 60 ? "…" : "") : ""}
                    </p>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums shrink-0", scoreClass(m.match_score))}>
                    {m.match_score}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
