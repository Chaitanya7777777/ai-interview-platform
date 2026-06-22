"use client";

import React, { useEffect, useState, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  HelpCircle,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  jobMatchService,
  type JobMatchDetailResult,
  type JobDescriptionView,
} from "@/services/job-match.service";

// ── Score Ring Component ──────────────────────────────────────────────────────
function ScoreRing({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const colorClass = score >= 75 ? "stroke-emerald-400" : score >= 50 ? "stroke-amber-400" : "stroke-red-400";
  const bgClass = score >= 75 ? "stroke-emerald-950/30" : score >= 50 ? "stroke-amber-950/30" : "stroke-red-950/30";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90">
          {/* Background Track */}
          <circle
            className={cn("fill-transparent", bgClass)}
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Animated Value Indicator */}
          <circle
            className={cn("fill-transparent transition-all duration-1000 ease-out", colorClass)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        {/* Score Value Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{score}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
    </div>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="page-container animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 bg-muted/60 rounded-md mb-6" />

      {/* Hero Skeleton */}
      <div className="card-surface p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-4 flex-1">
          <div className="h-4 w-32 bg-muted/60 rounded-md" />
          <div className="h-8 w-2/3 bg-muted/60 rounded-md" />
          <div className="h-4 w-1/2 bg-muted/60 rounded-md" />
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="h-4 w-24 bg-muted/60 rounded-md" />
            <div className="h-4 w-32 bg-muted/60 rounded-md" />
          </div>
        </div>
        <div className="flex gap-6 shrink-0 justify-center md:justify-end">
          <div className="h-28 w-28 rounded-full bg-muted/60" />
          <div className="h-28 w-28 rounded-full bg-muted/60" />
        </div>
      </div>

      {/* Button Row Skeleton */}
      <div className="flex flex-wrap gap-3 mt-4">
        <div className="h-10 w-28 bg-muted/60 rounded-lg" />
        <div className="h-10 w-32 bg-muted/60 rounded-lg" />
        <div className="h-10 w-36 bg-muted/60 rounded-lg" />
        <div className="h-10 w-32 bg-muted/60 rounded-lg" />
      </div>

      {/* Main layout skeleton grids */}
      <div className="grid gap-8 md:grid-cols-3 section-divide mt-8">
        <div className="md:col-span-2 space-y-8">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-muted/60 rounded-md" />
            <div className="h-32 bg-muted/60 rounded-xl" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-32 bg-muted/60 rounded-md" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-40 bg-muted/60 rounded-xl" />
              <div className="h-40 bg-muted/60 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-muted/60 rounded-md" />
            <div className="h-40 bg-muted/60 rounded-xl" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-28 bg-muted/60 rounded-md" />
            <div className="h-40 bg-muted/60 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function JobMatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<JobMatchDetailResult | null>(null);

  // Animated scores
  const [animatedMatch, setAnimatedMatch] = useState(0);
  const [animatedAts, setAnimatedAts] = useState(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [jdLoading, setJdLoading] = useState(false);
  const [jdData, setJdData] = useState<JobDescriptionView | null>(null);
  const [jdError, setJdError] = useState("");

  // Expanded state for recommendation cards
  const [expandedRecs, setExpandedRecs] = useState<Record<number, boolean>>({});

  // PDF Export state
  const [exportState, setExportState] = useState<"idle" | "generating" | "downloading" | "error">("idle");

  const handleExportPDF = async () => {
    if (exportState !== "idle") return;
    setExportState("generating");
    const toastId = toast.loading("Generating report PDF...");
    try {
      await jobMatchService.exportPDF(id);
      setExportState("downloading");
      toast.loading("Downloading report PDF...", { id: toastId });

      const filename = `${data?.job_title ? data.job_title.replace(/\s+/g, "_") : "Job_Match"}_Report.pdf`;
      await jobMatchService.downloadReport(id, filename);

      setExportState("idle");
      toast.success("Report PDF downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      setExportState("error");
      toast.error(err instanceof Error ? err.message : "Failed to generate report PDF.", { id: toastId });
      setTimeout(() => setExportState("idle"), 3000);
    }
  };

  // Load Main Job Match report details
  const loadDetail = async (matchId: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await jobMatchService.getJobMatchDetail(matchId);
      setData(result);
      setLoading(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load report.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDetail(id);
    }
  }, [id]);

  // Handle Score Counting Animations
  useEffect(() => {
    if (!data) return;

    let startTimestamp: number | null = null;
    const duration = 1000; // 1s animation

    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      setAnimatedMatch(Math.floor(progress * data.match_score));
      setAnimatedAts(Math.floor(progress * data.ats_score));

      if (progress < 1) {
        window.requestAnimationFrame(animate);
      }
    };

    window.requestAnimationFrame(animate);
  }, [data]);

  // Lazy load JD for Right Drawer
  const openJdDrawer = async () => {
    setDrawerOpen(true);
    if (jdData || jdLoading) return; // cache locally, avoid duplicate request

    setJdLoading(true);
    setJdError("");
    try {
      const result = await jobMatchService.viewJobDescription(id);
      setJdData(result);
      setJdLoading(false);
    } catch (err) {
      setJdError(err instanceof Error ? err.message : "Could not load job description.");
      setJdLoading(false);
    }
  };

  const closeJdDrawer = () => {
    setDrawerOpen(false);
  };

  // Heuristic-based impact allocator for recommendation cards
  const getImpact = (index: number) => {
    if (index === 0) {
      return { label: "High Impact", style: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
    }
    if (index === 1) {
      return { label: "Medium Impact", style: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    }
    return { label: "Low Impact", style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  };

  // Format dates nicely
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  // Calculate relative date for source metadata
  const getRelativeDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (errorMsg || !data) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[400px]">
        <div className="card-surface p-8 max-w-md w-full text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mx-auto">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load report</h3>
          <p className="text-sm text-muted-foreground">
            {errorMsg || "The requested Job Match report does not exist or you do not have permission to view it."}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => router.push("/job-match/history")}
              className="px-4 py-2 border border-border/50 text-sm font-semibold rounded-lg hover:bg-muted/40 transition-colors"
            >
              Back to History
            </button>
            {id && (
              <button
                onClick={() => loadDetail(id)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in relative min-h-screen">
      {/* ── Header Back Navigation ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/job-match/history")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to history
        </button>

        {/* Previous / Next Match Navigation placeholder */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground/40 select-none">
          <span className="flex items-center gap-1">
            <ChevronLeft size={14} /> Previous Match
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            Next Match <ChevronRight size={14} />
          </span>
        </div>
      </div>

      {/* ── SECTION 1 — HERO ─────────────────────────────────────────── */}
      <div className="card-surface p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-card to-card">
        {/* Editorial Title & Context */}
        <div className="space-y-4 flex-1">
          <div>
            <span className="section-label mb-1.5 block">Job Match Analysis</span>
            <h1 className="tracking-tight text-3xl font-extrabold text-foreground">
              {data.job_title || "Target Role Analysis"}
            </h1>
            <p className="text-muted-foreground text-base mt-1">
              {data.company_name ? `@ ${data.company_name}` : "Matching against target company parameters"}
            </p>
          </div>

          {/* Metadata Row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/70 pt-1">
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-primary/70" />
              <span>Resume: </span>
              <span className="font-semibold text-foreground truncate max-w-[200px]" title={data.resume_filename}>
                {data.resume_filename}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-primary/70" />
              <span>Analyzed: </span>
              <span className="font-semibold text-foreground">
                {formatDate(data.created_at)} ({getRelativeDate(data.created_at)})
              </span>
            </div>
          </div>
        </div>

        {/* Match Metric Rings */}
        <div className="flex gap-8 shrink-0 justify-center">
          <ScoreRing score={animatedMatch} label="Job Match" size={110} />
          <ScoreRing score={animatedAts} label="ATS Score" size={110} />
        </div>
      </div>

      {/* ── SECTION 4 — HERO CTA BUTTONS ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={openJdDrawer}
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <Briefcase size={14} className="text-primary" />
          View Job Description
        </button>

        <button
          onClick={handleExportPDF}
          disabled={exportState !== "idle"}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors cursor-pointer",
            exportState !== "idle" && "opacity-60 cursor-not-allowed"
          )}
        >
          {exportState === "generating" ? (
            <>
              <RefreshCw size={14} className="animate-spin text-primary" />
              <span>Generating PDF...</span>
            </>
          ) : exportState === "downloading" ? (
            <>
              <RefreshCw size={14} className="animate-spin text-primary" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download size={14} className="text-primary" />
              <span>Export PDF</span>
            </>
          )}
        </button>

        <button
          onClick={() => {
            startTransition(() => {
              router.push(`/mock-interview?jobMatch=${params.id}`);
            });
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Play size={14} fill="currentColor" />
          Practice Interview
        </button>

        <Link
          href={`/job-match?resume=${data.resume_id}`}
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <RefreshCw size={13} />
          <span>Generate Again</span>
        </Link>
      </div>

      {/* ── MAIN REPORT CONTENTS ────────────────────────────────────────── */}
      <div className="grid gap-10 md:grid-cols-3 section-divide">
        {/* Main Columns: Summary, Keywords, Recommendations */}
        <div className="md:col-span-2 space-y-10">
          
          {/* SECTION 2 — SUMMARY */}
          <div className="space-y-4">
            <h3 className="section-label">Executive Match Summary</h3>
            <div className="text-base sm:text-lg leading-relaxed font-normal text-muted-foreground/90 font-serif border-l-2 border-primary/20 pl-4">
              {data.summary}
            </div>
          </div>

          {/* SECTION 3 — KEYWORD MATCH */}
          <div className="space-y-4">
            <h3 className="section-label">Keyword Compatibility</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Matched Keywords */}
              <div className="card-surface p-5 space-y-3 bg-emerald-500/[0.01]">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 size={16} />
                  <span>Matched Keywords ({data.strengths?.length || 0})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.strengths && data.strengths.length > 0 ? (
                    data.strengths.map((kw, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-400 font-medium"
                      >
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">No matching keywords parsed.</span>
                  )}
                </div>
              </div>

              {/* Missing Keywords */}
              <div className="card-surface p-5 space-y-3 bg-rose-500/[0.01]">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <AlertCircle size={16} />
                  <span>Missing Keywords ({data.missing_keywords?.length || 0})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.missing_keywords && data.missing_keywords.length > 0 ? (
                    data.missing_keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-dashed border-rose-500/25 bg-rose-500/5 px-2.5 py-1 text-xs text-rose-400 font-medium"
                      >
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium">All target keywords found!</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5 — RECOMMENDATIONS */}
          <div className="space-y-4">
            <h3 className="section-label">Actionable Resume Improvements</h3>
            <div className="space-y-3">
              {data.recommendations && data.recommendations.length > 0 ? (
                data.recommendations.map((rec, i) => {
                  const impact = getImpact(i);
                  // Dynamic extraction heuristic for title vs description
                  const dotIdx = rec.indexOf(".");
                  const titleText = dotIdx !== -1 ? rec.slice(0, dotIdx).trim() : `Action Item ${i + 1}`;
                  const descText = dotIdx !== -1 ? rec.slice(dotIdx + 1).trim() : rec;

                  return (
                    <div
                      key={i}
                      onClick={() => setExpandedRecs((prev) => ({ ...prev, [i]: !prev[i] }))}
                      className="card-surface p-5 flex items-start gap-4 hover:border-border hover:bg-muted/10 transition-colors duration-150 cursor-pointer select-none"
                      title="Click to expand/collapse"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary text-xs font-bold font-mono">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <p className={cn("text-sm font-semibold text-foreground transition-all duration-150 flex-1 min-w-0", !expandedRecs[i] ? "line-clamp-1" : "whitespace-normal")}>
                            {titleText}
                          </p>
                          <span
                            className={cn(
                              "border text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 leading-none",
                              impact.style
                            )}
                          >
                            {impact.label}
                          </span>
                        </div>
                        {descText && (
                          <p className={cn("text-xs leading-relaxed text-muted-foreground/80 transition-all duration-150", !expandedRecs[i] ? "line-clamp-1" : "whitespace-normal")}>
                            {descText}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state card-surface border-dashed">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                  <p className="text-sm text-muted-foreground">Your resume matches this job description perfectly!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Columns: Readiness, Skills, Role Fit */}
        <div className="space-y-10">
          
          {/* SECTION 6 — INTERVIEW READINESS */}
          <div className="space-y-4">
            <h3 className="section-label">Interview Readiness</h3>
            <div className="card-surface p-5 space-y-3 relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-foreground">Preparation Focus</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {data.interview_readiness}
              </p>
            </div>
          </div>

          {/* SECTION 4 — SKILL GAPS */}
          <div className="space-y-4">
            <h3 className="section-label">Key Missing Skills</h3>
            <div className="card-surface p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {data.missing_skills && data.missing_skills.length > 0 ? (
                  data.missing_skills.map((skill, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-foreground/90 font-medium"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <div className="text-center w-full py-4 space-y-1 text-muted-foreground/60">
                    <CheckCircle2 size={16} className="text-emerald-400 mx-auto" />
                    <p className="text-xs">No missing skills detected.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 7 — ROLE FIT */}
          <div className="space-y-4">
            <h3 className="section-label">Role Fit Narrative</h3>
            <div className="card-surface p-5 space-y-2">
              <p className="text-xs leading-relaxed text-muted-foreground/90 whitespace-pre-line">
                {data.role_fit}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 — LAZY JOB DESCRIPTION DRAWER ─────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={closeJdDrawer}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
          />

          {/* Slide Panel */}
          <div className="relative w-full max-w-xl bg-card border-l border-border/40 p-6 flex flex-col h-full shadow-2xl z-10 transition-transform duration-300 transform translate-x-0">
            {/* Close trigger */}
            <button
              onClick={closeJdDrawer}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-8">
              <span className="section-label">Job Description</span>
              <h3 className="text-lg font-bold text-foreground">
                {data.job_title || "Target Job Parameters"}
              </h3>
              {data.company_name && (
                <p className="text-xs text-muted-foreground">@ {data.company_name}</p>
              )}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto mt-6 pr-1 text-xs border-t border-border/30 pt-4 scrollbar-thin">
              {jdLoading && (
                <div className="space-y-4 py-8">
                  <div className="skeleton h-4 w-1/3 rounded-md" />
                  <div className="skeleton h-3 w-full rounded-md" />
                  <div className="skeleton h-3 w-full rounded-md" />
                  <div className="skeleton h-3 w-3/4 rounded-md" />
                  <div className="skeleton h-3 w-full rounded-md" />
                  <div className="skeleton h-3 w-1/2 rounded-md" />
                </div>
              )}

              {jdError && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <AlertCircle size={20} className="text-rose-400" />
                  <p className="text-xs text-muted-foreground">{jdError}</p>
                  <button
                    onClick={() => {
                      setJdLoading(true);
                      setJdError("");
                      jobMatchService
                        .viewJobDescription(id)
                        .then((res) => {
                          setJdData(res);
                          setJdLoading(false);
                        })
                        .catch((err) => {
                          setJdError(err instanceof Error ? err.message : "Error loading JD.");
                          setJdLoading(false);
                        });
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!jdLoading && !jdError && jdData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 pb-2 border-b border-border/10">
                    <span>Source: {jdData.source === "storage" ? "Supabase Storage File" : "PostgreSQL Database Column"}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground/80 leading-relaxed">
                    {jdData.content || "Job description is empty."}
                  </pre>
                </div>
              )}

              {/* Legacy safety - Fallback if JD retrieval succeeds but returns blank/null */}
              {!jdLoading && !jdError && !jdData && !data.job_description_preview && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <HelpCircle size={20} className="text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Job description unavailable</p>
                </div>
              )}

              {!jdLoading && !jdError && !jdData && data.job_description_preview && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 pb-2 border-b border-border/10">
                    <span>Source: Legacy Preview Fallback</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground/80 leading-relaxed">
                    {data.job_description_preview}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
