"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { resumeService, ResumeHistoryItem } from "@/services/resume.service";
import { interviewService } from "@/services/interview.service";
import {
  PlayCircle, FileText, Sparkles, Clock, CheckCircle2,
  ChevronRight, AlertCircle, Loader2,
} from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_INFO = {
  easy:   { label: "Easy",   color: "text-green-500",  bg: "bg-green-500/10",  desc: "Entry-level questions, straightforward answers" },
  medium: { label: "Medium", color: "text-amber-500",  bg: "bg-amber-500/10",  desc: "Mid-level depth, STAR method expected" },
  hard:   { label: "Hard",   color: "text-red-500",    bg: "bg-red-500/10",    desc: "Senior-level, deep technical + leadership questions" },
};

export default function MockInterviewPage() {
  const router = useRouter();

  // Form state
  const [role, setRole]             = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  // null = nothing selected; user must pick explicitly
  const [resumeId, setResumeId]     = useState<string | null>(null);

  // Data state
  const [resumes, setResumes]       = useState<ResumeHistoryItem[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [resumeError, setResumeError]       = useState<string | null>(null);

  // Submit state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Load analysed resumes — no auto-selection; user must pick explicitly
  useEffect(() => {
    setLoadingResumes(true);
    resumeService
      .getHistory({ page: 1, pageSize: 20 })
      .then((page) => {
        const analysed = page.items.filter((r) => r.status === "analysed");
        setResumes(analysed);
        // Intentionally NOT auto-selecting any resume.
        // resumeId stays null until the user makes an explicit choice.
      })
      .catch(() => setResumeError("Could not load your resumes."))
      .finally(() => setLoadingResumes(false));
  }, []);

  const handleStart = async () => {
    if (!resumeId || !role.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const session = await interviewService.generateInterview({
        resume_id: resumeId,
        role: role.trim(),
        difficulty,
      });
      router.push(`/mock-interview/${session.interview_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate interview.";
      setGenerateError(msg);
      setGenerating(false);
    }
  };

  const diffInfo = DIFFICULTY_INFO[difficulty];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Mock Interview</h2>
        <p className="mt-1 text-muted-foreground">
          AI-powered interview questions tailored to your resume and target role.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        {/* ── Setup Card ────────────────────────────────────────────────────── */}
        <Card className="md:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Interview Setup</CardTitle>
            <CardDescription>
              Choose your resume and target role to generate personalised questions.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Resume select */}
            <div className="space-y-2">
              <Label>Your Resume</Label>
              {loadingResumes ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading resumes…
                </div>
              ) : resumeError ? (
                <p className="text-sm text-destructive">{resumeError}</p>
              ) : resumes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground text-center">
                  No analysed resumes found.{" "}
                  <a href="/resume-analysis" className="text-primary underline underline-offset-2">
                    Upload one first →
                  </a>
                </div>
              ) : (
                <>
                  {/* Selected resume preview card — shown above the trigger only when a selection has been made */}
                  {resumeId && (() => {
                    const sel = resumes.find((r) => r.id === resumeId);
                    return sel ? (
                      <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate font-medium flex-1">{sel.file_name}</span>
                        {sel.analysis_result?.overall_score !== undefined && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {sel.analysis_result.overall_score}/100
                          </Badge>
                        )}
                      </div>
                    ) : null;
                  })()}
                  {/* Pass empty string when null so Radix shows the placeholder text */}
                  <Select value={resumeId ?? ""} onValueChange={(v) => v && setResumeId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a resume" />
                    </SelectTrigger>
                    <SelectContent>
                      {resumes.map((r) => (
                        /* Plain text child — required for SelectValue in trigger to show label */
                        <SelectItem key={r.id} value={r.id}>
                          {r.file_name}{r.analysis_result?.overall_score !== undefined ? ` · ${r.analysis_result.overall_score}/100` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Helper text — only visible before the user picks a resume */}
                  {!resumeId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose a resume to generate interview questions.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Target role */}
            <div className="space-y-2">
              <Label>Target Role</Label>
              <Input
                placeholder="e.g. Frontend Engineer, Data Scientist"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <div className="grid grid-cols-3 gap-3">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                  const info = DIFFICULTY_INFO[d];
                  const selected = difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selected
                          ? `border-primary bg-primary/5 ring-1 ring-primary`
                          : "border-border hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${info.color}`}>
                        {info.label}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground leading-tight">
                        {info.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error banner */}
            {generateError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {generateError}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              className="w-full h-12 text-base"
              disabled={!resumeId || !role.trim() || generating}
              onClick={handleStart}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating questions…
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Start Interview
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Info Sidebar ──────────────────────────────────────────────────── */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                What to expect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { icon: FileText, text: "7 questions tailored to your resume and target role" },
                { icon: Sparkles, text: "Mix of technical, behavioral, and situational questions" },
                { icon: CheckCircle2, text: "Instant AI feedback and score for each answer" },
                { icon: Clock, text: "Takes about 15–25 minutes to complete" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Tips for best results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {[
                "Use the STAR method for behavioral questions.",
                "Be specific — mention tech, tools, or metrics.",
                "It's okay to write 2-4 sentences per answer.",
                "Review the AI's ideal answers to learn after each question.",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
