"use client";

import { useAnalytics } from "@/hooks/useAnalytics";
import { MissingSkillsChart } from "@/components/dashboard/MissingSkillsChart";
import { RecommendedRolesChart } from "@/components/dashboard/RecommendedRolesChart";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChartCardSkeleton, StatCardSkeleton } from "@/components/dashboard/AnalyticsSkeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Award, FileText, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">No analytics yet</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        No resume analytics available yet. Upload and analyse a resume to begin
        tracking your ATS scores, skill gaps, and recommended roles.
      </p>
      <Link
        href="/resume-analysis"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <FileText className="h-4 w-4" />
        Upload your first resume
      </Link>
    </div>
  );
}

// ── Error State ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center">
      <AlertCircle className="mb-3 h-10 w-10 text-destructive/70" />
      <h3 className="text-base font-semibold text-destructive">
        Failed to load analytics
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const state = useAnalytics();

  // Loading state
  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <ChartCardSkeleton height={280} />
          <ChartCardSkeleton height={280} />
        </div>
        <ChartCardSkeleton height={300} />
      </div>
    );
  }

  // Error state
  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ErrorState message={state.message} onRetry={state.refetch} />
      </div>
    );
  }

  const { data } = state;
  const hasAnalytics = data.analysed_resumes > 0;

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Empty state — has uploads but none analysed, or truly empty */}
      {!hasAnalytics ? (
        <EmptyState />
      ) : (
        <>
          {/* ── Stat Cards ─────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Resumes"
              value={data.total_resumes}
              subtext={`${data.analysed_resumes} analysed`}
              icon={FileText}
              iconBg="bg-primary/10"
              iconColor="text-primary"
            />
            <StatCard
              title="Average ATS Score"
              value={`${data.average_score}/100`}
              subtext="Across all analysed resumes"
              icon={TrendingUp}
              iconBg="bg-blue-500/10"
              iconColor="text-blue-500"
            />
            <StatCard
              title="Best ATS Score"
              value={`${data.best_score}/100`}
              subtext="Your highest score"
              icon={Award}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-500"
            />
            <StatCard
              title="Top Missing Skill"
              value={data.missing_skills[0]?.skill ?? "—"}
              subtext={
                data.missing_skills[0]
                  ? `Missing in ${data.missing_skills[0].count} resume${data.missing_skills[0].count !== 1 ? "s" : ""}`
                  : "No data yet"
              }
              icon={Sparkles}
              iconBg="bg-purple-500/10"
              iconColor="text-purple-500"
            />
          </div>

          {/* ── Score Trend + Missing Skills ───────────────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>ATS Score Trend</CardTitle>
                <CardDescription>
                  Your resume ATS score over time — most recent uploads on the right.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ScoreTrendChart data={data.score_trend} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>Top Missing Skills</CardTitle>
                <CardDescription>
                  Skills most frequently absent from your resumes.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <MissingSkillsChart data={data.missing_skills} />
              </CardContent>
            </Card>
          </div>

          {/* ── Recommended Roles ─────────────────────────────────────── */}
          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Recommended Roles</CardTitle>
              <CardDescription>
                Distribution of job roles the AI recommends based on your resume content.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <RecommendedRolesChart data={data.recommended_roles} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Resume Analytics</h2>
      <p className="mt-1 text-muted-foreground">
        Real-time insights powered by your resume analysis history.
      </p>
    </div>
  );
}
