"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resumeService, type ResumeHistoryItem } from "@/services/resume.service";
import { jobMatchService, type JobMatchResult } from "@/services/job-match.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreClass(score: number) {
  if (score >= 75) return "score-great";
  if (score >= 50) return "score-good";
  return "score-poor";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  return "Low";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const JD_MIN = 300;
const JD_MAX = 10000;

// ── Animated score ring ───────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  size = 140,
  strokeWidth = 10,
  colorClass,
}: {
  score: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  colorClass: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 900;
    const animate = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplayed(Math.round(eased * score));
      if (elapsed < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const strokeColor =
    colorClass === "score-great"
      ? "oklch(0.72 0.17 160)"
      : colorClass === "score-good"
      ? "oklch(0.78 0.16 75)"
      : "oklch(0.65 0.21 25)";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(1 0 0 / 6%)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: -(size / 2 + 20) }}>
        <span className={cn("stat-number tabular-nums", colorClass)}>{displayed}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ text, variant }: { text: string; variant: "match" | "missing" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "match"
          ? "bg-emerald-400/10 text-emerald-400"
          : "bg-red-400/10 text-red-400"
      )}
    >
      {variant === "match" ? (
        <CheckCircle2 size={10} />
      ) : (
        <XCircle size={10} />
      )}
      {text}
    </span>
  );
}

// ── Action card ───────────────────────────────────────────────────────────────

function ActionCard({ index, text }: { index: number; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
        {index + 1}
      </span>
      <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageState = "idle" | "loading" | "result" | "error";

export default function JobMatchPage() {
  // Form state
  const [resumes, setResumes] = useState<ResumeHistoryItem[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [selectedResume, setSelectedResume] = useState<ResumeHistoryItem | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [jd, setJd] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Page state machine
  const [pageState, setPageState] = useState<PageState>("idle");
  const [result, setResult] = useState<JobMatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load resume list
  useEffect(() => {
    resumeService
      .getHistory({ page: 1, pageSize: 50 })
      .then((data) => {
        // Only show resumes that have parsed text (status is parsed or analysed)
        const parsed = data.items.filter(
          (r) => r.status === "parsed" || r.status === "analysed"
        );
        setResumes(parsed);
      })
      .catch(() => {
        toast.error("Failed to load your resumes.");
      })
      .finally(() => setResumesLoading(false));
  }, []);

  const jdLength = jd.trim().length;
  const canSubmit =
    selectedResume !== null &&
    jdLength >= JD_MIN &&
    jdLength <= JD_MAX &&
    pageState !== "loading";

  const handleGenerate = useCallback(async () => {
    if (!selectedResume) return;
    setPageState("loading");
    setErrorMsg("");
    setResult(null);

    try {
      const data = await jobMatchService.runMatch({
        resume_id: selectedResume.id,
        job_description: jd.trim(),
      });
      setResult(data);
      setPageState("result");
      toast.success("Saved to history", {
        description: data.was_duplicate
          ? "Existing match updated (same resume & JD within 24h)."
          : "Your job match report has been saved.",
        duration: 4000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setErrorMsg(msg);
      setPageState("error");
      toast.error("Analysis failed", { description: msg });
    }
  }, [selectedResume, jd]);

  const handleReset = () => {
    setPageState("idle");
    setResult(null);
    setErrorMsg("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container fade-in">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label mb-1">AI Career Tools</p>
          <h1 className="tracking-tight">Job Match Analyzer</h1>
          <p className="mt-1.5 text-muted-foreground text-sm max-w-xl">
            Select a resume, paste a job description, and get a full
            AI-powered compatibility report — score, keyword gaps, skill gaps,
            and actionable recommendations.
          </p>
        </div>
        <Link
          href="/job-match/history"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border/50 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <History size={15} />
          History
        </Link>
      </div>

      {/* ── Input Form ─────────────────────────────────────────────────── */}
      {pageState !== "result" && (
        <div className="card-surface p-6 space-y-6 section-divide">
          {/* Resume selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Select Resume
            </label>
            <p className="text-xs text-muted-foreground">
              Only parsed resumes are shown. Upload and analyse a resume first if your list is empty.
            </p>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                disabled={resumesLoading}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-border focus-ring",
                  !selectedResume && "text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {resumesLoading ? (
                    <Loader2 size={15} className="animate-spin shrink-0" />
                  ) : (
                    <FileText size={15} className="shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {resumesLoading
                      ? "Loading resumes…"
                      : selectedResume
                      ? selectedResume.file_name
                      : "Choose a resume"}
                  </span>
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {selectedResume?.analysis_result && (
                    <span className={cn("score-pill text-[11px]", scoreClass(selectedResume.analysis_result.overall_score))}>
                      {selectedResume.analysis_result.overall_score}
                    </span>
                  )}
                  <ChevronDown size={15} className={cn("text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
                </div>
              </button>

              {dropdownOpen && !resumesLoading && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/60 bg-popover shadow-xl overflow-hidden">
                  {resumes.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                      <FileText size={24} className="text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No parsed resumes found.</p>
                      <Link
                        href="/resume-analysis"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Upload a resume →
                      </Link>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-auto py-1">
                      {resumes.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setSelectedResume(r);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50",
                            selectedResume?.id === r.id && "bg-primary/8 text-primary"
                          )}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <FileText size={14} className="shrink-0 text-muted-foreground" />
                            <span className="truncate">{r.file_name}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0 ml-2 text-xs text-muted-foreground">
                            <Clock size={11} />
                            {relativeTime(r.created_at)}
                            {r.analysis_result && (
                              <span className={cn("score-pill ml-1", scoreClass(r.analysis_result.overall_score))}>
                                {r.analysis_result.overall_score}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Job description textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Job Description
            </label>
            <div className="relative">
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job description here — including responsibilities, requirements, and preferred qualifications…"
                rows={10}
                maxLength={JD_MAX}
                className={cn(
                  "w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus-ring focus:outline-none transition-colors",
                  jdLength > 0 && jdLength < JD_MIN && "border-amber-500/50 focus:border-amber-500/70",
                  jdLength >= JD_MIN && "border-emerald-500/30 focus:border-emerald-500/50"
                )}
              />
              <div className={cn(
                "absolute bottom-3 right-3 text-[11px] tabular-nums",
                jdLength > JD_MAX * 0.9 ? "text-amber-400" : "text-muted-foreground/40"
              )}>
                {jdLength.toLocaleString()} / {JD_MAX.toLocaleString()}
              </div>
            </div>
            {jdLength > 0 && jdLength < JD_MIN && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle size={11} />
                Minimum {JD_MIN} characters required ({JD_MIN - jdLength} more needed)
              </p>
            )}
          </div>

          {/* Error state */}
          {pageState === "error" && (
            <div className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3">
              <AlertCircle size={15} className="shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-400">Analysis failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canSubmit}
            className={cn(
              "flex w-full items-center justify-center gap-2.5 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200",
              canSubmit
                ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {pageState === "loading" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Match Report
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────────── */}
      {pageState === "loading" && (
        <div className="space-y-6 section-divide">
          <div className="card-surface p-6 flex flex-col items-center gap-4">
            <div className="skeleton h-36 w-36 rounded-full" />
            <div className="skeleton h-4 w-32" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-surface p-6 space-y-3">
              <div className="skeleton h-4 w-1/4" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="skeleton h-6 w-20 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Result report ───────────────────────────────────────────────── */}
      {pageState === "result" && result && (
        <div className="space-y-6 section-divide fade-in">
          {/* Reset button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label mb-0.5">Match Report</p>
              <p className="text-sm text-muted-foreground">{selectedResume?.file_name}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-border/50 px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <RefreshCw size={14} />
              New Analysis
            </button>
          </div>

          {/* ── Section 1: Hero Score ─────────────────────────────────── */}
          <div className="card-surface p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* Match score ring */}
              <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
                <ScoreRing
                  score={result.match_score}
                  label="Match"
                  colorClass={scoreClass(result.match_score)}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={cn("stat-number tabular-nums", scoreClass(result.match_score))}>
                    {result.match_score}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium -mt-1">Match</span>
                </div>
              </div>

              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <h2 className="text-xl font-semibold">{scoreLabel(result.match_score)} Match</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-md">
                    {result.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <span className="text-xs text-muted-foreground">ATS Score</span>
                    <span className={cn("text-sm font-bold tabular-nums", scoreClass(result.ats_score))}>
                      {result.ats_score}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span className="text-xs text-muted-foreground">
                      {result.strengths.length} strengths identified
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <XCircle size={14} className="text-red-400" />
                    <span className="text-xs text-muted-foreground">
                      {result.missing_keywords.length} missing keywords
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Keyword Match ──────────────────────────────── */}
          <div className="card-surface p-6 space-y-4">
            <div>
              <p className="section-label mb-1">Keyword Match</p>
              <h3>ATS Keyword Analysis</h3>
            </div>
            <div className="space-y-3">
              {result.strengths.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Matching signals</p>
                  <div className="flex flex-wrap gap-2">
                    {result.strengths.slice(0, 6).map((s, i) => (
                      <Chip key={i} text={s.length > 40 ? s.slice(0, 38) + "…" : s} variant="match" />
                    ))}
                  </div>
                </div>
              )}
              {result.missing_keywords.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Missing keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {result.missing_keywords.map((kw, i) => (
                      <Chip key={i} text={kw} variant="missing" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 3: Skill Gaps ─────────────────────────────────── */}
          <div className="card-surface p-6 space-y-4">
            <div>
              <p className="section-label mb-1">Skill Gaps</p>
              <h3>Missing Capabilities</h3>
            </div>
            <div className="space-y-2">
              {result.missing_skills.map((skill, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors">
                  <XCircle size={15} className="shrink-0 text-red-400 mt-0.5" />
                  <p className="text-sm text-foreground/80">{skill}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 4: Recommendations ────────────────────────────── */}
          <div className="card-surface p-6 space-y-4">
            <div>
              <p className="section-label mb-1">Action Plan</p>
              <h3>AI Recommendations</h3>
            </div>
            <div className="space-y-2.5">
              {result.recommendations.map((rec, i) => (
                <ActionCard key={i} index={i} text={rec} />
              ))}
            </div>
          </div>

          {/* ── Section 5: Interview Readiness ────────────────────────── */}
          <div className="card-surface p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="section-label mb-1">Interview Readiness</p>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {result.interview_readiness}
                </p>
              </div>
            </div>
          </div>

          {/* ── Section 6: Role Fit ───────────────────────────────────── */}
          <div className="card-surface p-6 space-y-3">
            <div>
              <p className="section-label mb-1">Role Fit</p>
              <h3>Overall Assessment</h3>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{result.role_fit}</p>
          </div>

          {/* Analysis warning (fallback) */}
          {result.analysis_warning && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <AlertCircle size={15} className="shrink-0 text-amber-400 mt-0.5" />
              <p className="text-xs text-amber-400/80">{result.analysis_warning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
