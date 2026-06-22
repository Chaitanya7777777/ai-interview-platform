"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resumeService, ResumeHistoryItem } from "@/services/resume.service";
import { interviewService } from "@/services/interview.service";
import { jobMatchService, type JobMatchInterviewContext } from "@/services/job-match.service";
import {
  PlayCircle, FileText, AlertCircle, Loader2, ChevronRight, CheckCircle2, X, Target, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY = {
  easy:   { label: "Easy",   note: "Entry-level, STAR basics",     accent: "text-emerald-400", border: "border-emerald-400/40", bg: "bg-emerald-400/5" },
  medium: { label: "Medium", note: "Mid-level, STAR expected",      accent: "text-amber-400",  border: "border-amber-400/40",  bg: "bg-amber-400/5" },
  hard:   { label: "Hard",   note: "Senior-level, deep technical", accent: "text-red-400",    border: "border-red-400/40",    bg: "bg-red-400/5" },
} as const;

const TIPS = [
  "Use the STAR method for behavioral questions.",
  "Mention specific tools, technologies, or metrics.",
  "2 – 4 sentences per answer is plenty.",
  "Review AI ideal answers to learn after each question.",
];

function Step({ n, done, label }: { n: number; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "h-5 w-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {done ? <CheckCircle2 size={12} /> : n}
      </div>
      <span className={cn("text-xs font-medium", done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

export default function MockInterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobMatchId = searchParams.get("jobMatch");

  const [role, setRole]             = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [resumeId, setResumeId]     = useState<string | null>(null);
  const [resumes, setResumes]       = useState<ResumeHistoryItem[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [resumeError, setResumeError]       = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [jobMatchContext, setJobMatchContext] = useState<JobMatchInterviewContext | null>(null);
  const [loadingContext, setLoadingContext]   = useState(false);
  const [focusTopics, setFocusTopics]         = useState<string[]>([]);

  useEffect(() => {
    setLoadingResumes(true);
    resumeService
      .getHistory({ page: 1, pageSize: 20 })
      .then((page) => {
        setResumes(page.items.filter((r) => r.status === "analysed"));
      })
      .catch(() => setResumeError("Could not load your resume."))
      .finally(() => setLoadingResumes(false));
  }, []);

  useEffect(() => {
    if (!jobMatchId) return;
    setLoadingContext(true);
    jobMatchService
      .getInterviewContext(jobMatchId)
      .then((ctx) => {
        setJobMatchContext(ctx);
        setFocusTopics(ctx.focus_topics);
        if (ctx.target_role) setRole(ctx.target_role);
        setDifficulty(ctx.recommended_difficulty);
        setResumeId(ctx.resume_id);
      })
      .catch(() => {
        toast.error("Job Match unavailable. Starting standard interview.");
      })
      .finally(() => setLoadingContext(false));
  }, [jobMatchId]);

  const removeFocusTopic = useCallback((topic: string) => {
    setFocusTopics((prev) => prev.filter((t) => t !== topic));
  }, []);

  const handleStart = async () => {
    if (!resumeId || !role.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const isJobMatch = !!jobMatchContext && focusTopics.length > 0;
      const session = await interviewService.generateInterview({
        resume_id: resumeId,
        role: role.trim(),
        difficulty,
        mode: isJobMatch ? "job_match" : "standard",
        job_match_context: isJobMatch ? { focus_topics: focusTopics } : undefined,
      });
      router.push(`/mock-interview/${session.interview_id}`);
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate interview.");
      setGenerating(false);
    }
  };

  const sel = resumes.find((r) => r.id === resumeId);
  const canStart = !!resumeId && role.trim().length > 0;
  const isJobMatchMode = !!jobMatchContext;

  return (
    <div className="space-y-10 fade-in">
      <div className="space-y-1.5 max-w-lg">
        <h1>Mock Interview</h1>
        <p className="text-muted-foreground text-base">
          {isJobMatchMode
            ? "Preparing a targeted interview based on your Job Match report."
            : "AI-powered questions tailored to your resume and target role."}
        </p>
      </div>

      {loadingContext && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <Loader2 size={14} className="animate-spin shrink-0" />
          Loading your Job Match context...
        </div>
      )}

      {isJobMatchMode && !loadingContext && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles size={14} />
            Job Match Practice Mode
          </div>
          <p className="text-xs text-muted-foreground">
            This interview will emphasize areas identified during your Job Match. Focus topics and difficulty have been pre-filled — you can edit them.
          </p>
          {jobMatchContext?.company_name && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Company: {jobMatchContext.company_name} · Match Score: {jobMatchContext.match_score}%
            </p>
          )}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center gap-6">
            <Step n={1} done={!!resumeId} label="Resume" />
            <div className="h-px flex-1 bg-border/40" />
            <Step n={2} done={role.trim().length > 0} label="Role" />
            <div className="h-px flex-1 bg-border/40" />
            <Step n={3} done={true} label="Difficulty" />
            <div className="h-px flex-1 bg-border/40" />
            <Step n={4} done={canStart} label="Launch" />
          </div>

          <div className="space-y-3">
            <div>
              <p className="section-label">Step 1</p>
              <h3 className="mt-0.5">Select your resume</h3>
            </div>
            {loadingResumes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                <Loader2 size={14} className="animate-spin" /> Loading resumes...
              </div>
            ) : resumeError ? (
              <p className="text-sm text-destructive">{resumeError}</p>
            ) : resumes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-5 text-center text-sm text-muted-foreground">
                No analysed resumes found.{" "}
                <a href="/resume-analysis" className="text-primary hover:opacity-80 underline underline-offset-2">
                  Upload one →
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <Select value={resumeId ?? ""} onValueChange={(v) => v && setResumeId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a resume" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.file_name}
                        {r.analysis_result?.overall_score !== undefined
                          ? ` · ${r.analysis_result.overall_score}/100`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sel && (
                  <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 text-sm">
                    <FileText size={14} className="text-primary shrink-0" />
                    <span className="flex-1 truncate font-medium text-xs">{sel.file_name}</span>
                    {sel.analysis_result?.overall_score !== undefined && (
                      <span className="text-xs font-semibold tabular-nums text-emerald-400">
                        {sel.analysis_result.overall_score}/100
                      </span>
                    )}
                  </div>
                )}
                {!resumeId && (
                  <p className="text-xs text-muted-foreground">
                    Choose a resume — interview questions will be tailored to it.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="section-label">Step 2</p>
              <h3 className="mt-0.5">Target role</h3>
            </div>
            <Input
              placeholder="e.g. Frontend Engineer, Data Scientist"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="section-label">Step 3</p>
              <h3 className="mt-0.5">Difficulty</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                const info = DIFFICULTY[d];
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? `${info.border} ${info.bg} ring-1 ring-inset ${info.border}`
                        : "border-border/50 hover:border-border hover:bg-muted/20"
                    )}
                  >
                    <p className={cn("text-sm font-semibold", active ? info.accent : "text-foreground")}>
                      {info.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">{info.note}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {isJobMatchMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-primary" />
                <p className="section-label mb-0">Interview Focus</p>
              </div>
              <p className="text-xs text-muted-foreground">
                These weak areas were identified in your Job Match. Click x to remove any topic.
              </p>
              {focusTopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {focusTopics.map((topic) => (
                    <span
                      key={topic}
                      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {topic}
                      <button
                        onClick={() => removeFocusTopic(topic)}
                        className="text-primary/60 hover:text-primary transition-colors"
                        aria-label={`Remove ${topic}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">
                  All focus topics removed — will run as a standard interview.
                </p>
              )}
            </div>
          )}

          {generateError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {generateError}
            </div>
          )}

          <Button
            className="w-full h-12 text-base font-medium gap-2"
            disabled={!canStart || generating}
            onClick={handleStart}
            id="start-interview-btn"
          >
            {generating ? (
              <><Loader2 size={16} className="animate-spin" /> Generating questions...</>
            ) : (
              <><PlayCircle size={16} /> Start Interview</>
            )}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-3">
            <p className="section-label">What to expect</p>
            <div className="space-y-0">
              {[
                isJobMatchMode ? "7 questions targeting your weak areas + role prep" : "7 questions tailored to your resume and role",
                "Mix of technical, behavioral, and situational",
                "Instant AI feedback and score per answer",
                "Takes about 15 - 25 minutes",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="section-label">Tips for best results</p>
            <div className="space-y-0">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
                  <ChevronRight size={13} className="text-primary/50 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
