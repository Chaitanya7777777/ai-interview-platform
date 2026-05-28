"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Target, CheckCircle2, TrendingUp, Plus, Award, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { dashboardService, DashboardAnalytics } from "@/services/dashboard.service";
import { resumeService, ResumeHistoryItem } from "@/services/resume.service";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/60 ${className ?? ""}`} />;
}

function StatSkeleton() {
  return (
    <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Score label colour helper ─────────────────────────────────────────────────

function scoreColour(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

// ── Main page ─────────────────────────────────────────────────────────────────

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; analytics: DashboardAnalytics; recent: ResumeHistoryItem[] };

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<PageState>({ status: "loading" });

  const displayName = user?.user_metadata?.full_name?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "there";

  const load = () => {
    setState({ status: "loading" });
    Promise.all([
      dashboardService.getAnalytics(),
      resumeService.getHistory({ page: 1, pageSize: 5 }),
    ])
      .then(([analytics, history]) => {
        setState({ status: "success", analytics, recent: history.items });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load data.";
        setState({ status: "error", message });
      });
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render helpers ──────────────────────────────────────────────────────────

  const isLoading = state.status === "loading";
  const analytics = state.status === "success" ? state.analytics : null;
  const recent    = state.status === "success" ? state.recent    : [];

  // Format chart data from score_trend
  const chartData = analytics?.score_trend.map((p) => ({
    name: (() => {
      const d = new Date(p.date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    })(),
    score: p.score,
  })) ?? [];

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome back, {displayName}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Here&apos;s a live summary of your resume analysis activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/resume-analysis" className={buttonVariants({})}>
            <Plus className="mr-2 h-4 w-4" /> New Resume
          </Link>
          <Link href="/mock-interview" className={buttonVariants({ variant: "secondary" })}>
            <Target className="mr-2 h-4 w-4" /> Mock Interview
          </Link>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {state.status === "error" && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{state.message}</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:opacity-80"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            {/* Best ATS Score */}
            <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Best ATS Score</CardTitle>
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                  <Award className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analytics && analytics.best_score > 0
                    ? `${analytics.best_score}/100`
                    : "—"}
                </div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  {analytics && analytics.analysed_resumes > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                      <span className="text-green-500 font-medium">
                        {analytics.analysed_resumes} resume{analytics.analysed_resumes !== 1 ? "s" : ""} analysed
                      </span>
                    </>
                  ) : "No analysed resumes yet"}
                </p>
              </CardContent>
            </Card>

            {/* Total Resumes */}
            <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Resumes</CardTitle>
                <div className="h-8 w-8 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 transition-transform group-hover:scale-110">
                  <FileText className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics?.total_resumes ?? "—"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics
                    ? `${analytics.analysed_resumes} with AI analysis`
                    : "Uploads tracked"}
                </p>
              </CardContent>
            </Card>

            {/* Average ATS Score */}
            <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. ATS Score</CardTitle>
                <div className="h-8 w-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 transition-transform group-hover:scale-110">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analytics && analytics.average_score > 0
                    ? `${analytics.average_score}/100`
                    : "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics?.missing_skills[0]
                    ? `Top gap: ${analytics.missing_skills[0].skill}`
                    : "Across all resumes"}
                </p>
              </CardContent>
            </Card>

            {/* Top Recommended Role */}
            <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Role Match</CardTitle>
                <div className="h-8 w-8 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500 transition-transform group-hover:scale-110">
                  <Target className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold mt-1 truncate">
                  {analytics?.recommended_roles[0]?.role ?? "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-purple-600 font-medium truncate">
                  {analytics?.recommended_roles[0]
                    ? `Recommended ${analytics.recommended_roles[0].count}× by AI`
                    : "No data yet"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Chart + Recent Activity ──────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-7">

        {/* Score Trend Chart */}
        <Card className="col-span-1 md:col-span-4 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>ATS Score History</CardTitle>
            <CardDescription>
              Your resume ATS scores over time — from your analysed uploads
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-muted/60" />
            ) : chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">
                  No score history yet.
                </p>
                <Link
                  href="/resume-analysis"
                  className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Upload and analyse a resume to start tracking →
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    dy={10}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(v) => [`${v ?? 0}/100`, "ATS Score"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1 md:col-span-3 shadow-sm border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>Your latest resume submissions</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoading ? (
              <div className="space-y-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-3.5 w-12" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No resumes uploaded yet.</p>
                <Link
                  href="/resume-analysis"
                  className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Upload your first resume →
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  {recent.map((item) => {
                    const score = item.analysis_result?.overall_score;
                    return (
                      <div key={item.id} className="flex items-center group">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-4 transition-transform group-hover:scale-110 shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-medium leading-none truncate" title={item.file_name}>
                            {item.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.status === "analysed" ? "Analysed" : "Uploaded"} &bull;{" "}
                            {relativeTime(item.created_at)}
                          </p>
                        </div>
                        <div className={`font-semibold text-sm ml-2 shrink-0 ${score !== undefined ? scoreColour(score) : "text-muted-foreground"}`}>
                          {score !== undefined ? `${score}/100` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-5 border-t">
                  <Link
                    href="/history"
                    className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full text-xs text-muted-foreground"}
                  >
                    View all uploads
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
