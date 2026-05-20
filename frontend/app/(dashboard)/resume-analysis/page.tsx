/**
 * app/(dashboard)/resume-analysis/page.tsx
 * -----------------------------------------
 * Resume Analysis page — orchestrates upload, AI analysis, and history.
 *
 * State machine:
 *   "upload"   → user sees upload card + history below
 *   "loading"  → file is being sent + AI is running
 *   "result"   → analysis complete, AnalysisCard shown above history
 *   "error"    → upload or analysis failed, error banner shown
 *
 * Data flow:
 *   UploadZone (selects file) → handleUpload (calls resumeService.uploadResume)
 *   → on success: set result state, increment refreshKey → HistoryList re-fetches
 *   → on failure: set error state, show toast
 */

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  UploadCloud,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { UploadZone } from "@/components/resume-analysis/upload-zone";
import { AnalysisCard } from "@/components/resume-analysis/analysis-card";
import { AnalysisLoadingSkeleton } from "@/components/resume-analysis/loading-skeleton";
import { HistoryList } from "@/components/resume-analysis/history-list";

import { resumeService, ResumeUploadResponse } from "@/services/resume.service";

// ── Types ─────────────────────────────────────────────────────────────────────

type PagePhase = "upload" | "loading" | "result" | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResumeAnalysisPage() {
  // Phase controls which section is shown
  const [phase, setPhase] = useState<PagePhase>("upload");

  // The selected file from the upload zone
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Last successful upload response
  const [uploadResult, setUploadResult] = useState<ResumeUploadResponse | null>(null);

  // Error message when phase === "error"
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loading progress label (upload → analysing)
  const [loadingLabel, setLoadingLabel] = useState("Uploading...");

  // Incrementing this key triggers HistoryList to re-fetch
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    // Clear previous results when a new file is picked
    setUploadResult(null);
    setErrorMessage(null);
    if (phase === "result" || phase === "error") {
      setPhase("upload");
    }
  }, [phase]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a resume file first.");
      return;
    }

    setPhase("loading");
    setLoadingLabel("Uploading resume...");

    // After a short delay, update label to reflect AI is running
    const labelTimer = setTimeout(() => setLoadingLabel("Running AI analysis..."), 2500);

    try {
      const result = await resumeService.uploadResume(selectedFile, { analyse: true });
      setUploadResult(result);
      setPhase("result");
      setHistoryRefreshKey((k) => k + 1); // trigger HistoryList re-fetch
      toast.success("Resume analysed successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setErrorMessage(message);
      setPhase("error");
      toast.error(message);
    } finally {
      clearTimeout(labelTimer);
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage(null);
  }, []);

  // Derived boolean — used in JSX so TS doesn't narrow the type away
  // inside conditional render blocks
  const isLoading = phase === "loading";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resume Intelligence</h2>
          <p className="text-muted-foreground mt-1">
            Upload your resume and get instant AI-powered feedback.
          </p>
        </div>
        {phase === "result" && (
          <Button variant="outline" onClick={handleReset}>
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload New
          </Button>
        )}
      </div>

      {/* ── Phase: upload ──────────────────────────────────────────────── */}
      {(phase === "upload" || phase === "error") && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Upload card — takes 3/5 columns on large screens */}
          <Card className="lg:col-span-3 shadow-sm border-border/60">
            <CardHeader>
              <CardTitle>Upload Resume</CardTitle>
              <CardDescription>
                Drag and drop or click to select your resume — PDF or DOCX, max 5 MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadZone
                onFileSelect={handleFileSelect}
                disabled={isLoading}
              />

              {/* Error banner */}
              {phase === "error" && errorMessage && (
                <div
                  className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                  role="alert"
                >
                  <span className="shrink-0">⚠</span>
                  <span>{errorMessage}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                className="flex-1 h-11"
                onClick={handleUpload}
                disabled={!selectedFile || isLoading}
                id="analyse-resume-btn"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {phase === "error" ? "Retry Analysis" : "Analyse with AI"}
              </Button>
            </CardFooter>
          </Card>

          {/* Tips card — takes 2/5 columns */}
          <Card className="lg:col-span-2 shadow-sm border-border/60 h-fit">
            <CardHeader>
              <CardTitle className="text-base">What you'll get</CardTitle>
              <CardDescription>From your AI analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { icon: "🎯", label: "Overall resume score (0–100)" },
                  { icon: "✅", label: "Identified strengths" },
                  { icon: "⚠️", label: "Weaknesses to address" },
                  { icon: "🔑", label: "Missing skills for ATS" },
                  { icon: "💼", label: "Recommended job roles" },
                  { icon: "💡", label: "Actionable improvement steps" },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-sm">
                    <span className="text-base shrink-0" aria-hidden="true">{item.icon}</span>
                    <span className="text-muted-foreground">{item.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Phase: loading ─────────────────────────────────────────────── */}
      {phase === "loading" && (
        <div className="space-y-6">
          {/* Loading banner */}
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Loader2 className="h-5 w-5 text-primary animate-spin" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm">{loadingLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This usually takes 10–30 seconds
                </p>
              </div>
            </CardContent>
          </Card>
          <AnalysisLoadingSkeleton />
        </div>
      )}

      {/* ── Phase: result ──────────────────────────────────────────────── */}
      {phase === "result" && uploadResult?.analysis_result && (
        <div className="space-y-2">
          {/* Quick stats row */}
          <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium mb-2">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Analysis saved to your history
          </div>

          <AnalysisCard
            result={uploadResult.analysis_result}
            filename={uploadResult.filename}
            warning={uploadResult.analysis_warning}
          />
        </div>
      )}

      {/* ── History (always visible, re-fetches after upload) ───────────── */}
      <HistoryList refreshKey={historyRefreshKey} />
    </div>
  );
}
