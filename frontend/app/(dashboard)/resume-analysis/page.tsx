/**
 * Resume Analysis page — redesigned for premium feel.
 * State machine unchanged; only UI layer rewritten.
 */

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  UploadCloud, Sparkles, CheckCircle2, Loader2, ArrowUpRight,
  FileText, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/resume-analysis/upload-zone";
import { AnalysisCard } from "@/components/resume-analysis/analysis-card";
import { AnalysisLoadingSkeleton } from "@/components/resume-analysis/loading-skeleton";
import { HistoryList } from "@/components/resume-analysis/history-list";
import { resumeService, ResumeUploadResponse } from "@/services/resume.service";
import { cn } from "@/lib/utils";

type Phase = "upload" | "loading" | "result" | "error";

const FEATURES = [
  { label: "Overall ATS score",         sub: "0 – 100 rating" },
  { label: "Strengths identified",      sub: "What's working" },
  { label: "Weaknesses flagged",        sub: "What to fix" },
  { label: "Missing ATS keywords",      sub: "Gap analysis" },
  { label: "Recommended job roles",     sub: "Best-fit titles" },
  { label: "Actionable improvement tips", sub: "Coaching steps" },
];

export default function ResumeAnalysisPage() {
  const [phase, setPhase]             = useState<Phase>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ResumeUploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("Uploading…");
  const [historyKey, setHistoryKey]   = useState(0);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadResult(null);
    setErrorMessage(null);
    if (phase === "result" || phase === "error") setPhase("upload");
  }, [phase]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) { toast.error("Please select a file first."); return; }
    setPhase("loading");
    setLoadingLabel("Uploading résumé…");
    const t = setTimeout(() => setLoadingLabel("Running AI analysis…"), 2500);
    try {
      const result = await resumeService.uploadResume(selectedFile, { analyse: true });
      setUploadResult(result);
      setPhase("result");
      setHistoryKey((k) => k + 1);
      toast.success("Analysis complete!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setErrorMessage(msg);
      setPhase("error");
      toast.error(msg);
    } finally {
      clearTimeout(t);
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage(null);
  }, []);

  const isLoading = phase === "loading";

  return (
    <div className="space-y-12 fade-in">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1>Resume Intelligence</h1>
          <p className="text-muted-foreground text-base max-w-md">
            Upload your résumé and get instant AI-powered feedback with ATS scoring.
          </p>
        </div>
        {phase === "result" && (
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 shrink-0 self-start mt-1">
            <UploadCloud size={14} /> Analyse another
          </Button>
        )}
      </div>

      {/* ── Upload phase ────────────────────────────────────────────────── */}
      {(phase === "upload" || phase === "error") && (
        <div className="grid lg:grid-cols-5 gap-8">

          {/* Upload hero — 3 columns */}
          <div className="lg:col-span-3 space-y-4">
            {/* Drop zone */}
            <div className="rounded-xl border border-border/50 bg-card p-1">
              {selectedFile ? (
                /* File selected state */
                <div className="flex items-center gap-4 px-5 py-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to analyse
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedFile(null); setErrorMessage(null); }}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <UploadZone onFileSelect={handleFileSelect} disabled={isLoading} />
              )}
            </div>

            {/* Error */}
            {phase === "error" && errorMessage && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* CTA */}
            <Button
              className="w-full h-11 gap-2 font-medium"
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              id="analyse-resume-btn"
            >
              <Sparkles size={15} />
              {phase === "error" ? "Retry Analysis" : "Analyse with AI"}
            </Button>
          </div>

          {/* Feature list — 2 columns */}
          <div className="lg:col-span-2 space-y-3">
            <p className="section-label">What you get</p>
            <div className="space-y-0">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0"
                >
                  <CheckCircle2 size={14} className="text-primary/60 shrink-0" />
                  <div>
                    <p className="text-sm font-medium leading-none">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading phase ────────────────────────────────────────────────── */}
      {phase === "loading" && (
        <div className="space-y-8">
          {/* Status pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
              <Loader2 size={14} className="animate-spin" />
              {loadingLabel}
            </div>
            <span className="text-xs text-muted-foreground">This takes 10 – 30 seconds</span>
          </div>
          <AnalysisLoadingSkeleton />
        </div>
      )}

      {/* ── Result phase ─────────────────────────────────────────────────── */}
      {phase === "result" && uploadResult?.analysis_result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
            <CheckCircle2 size={14} />
            Analysis saved — view in History
            <a href="/history" className="ml-1 inline-flex items-center gap-0.5 underline underline-offset-2 hover:opacity-70">
              <ArrowUpRight size={12} />
            </a>
          </div>
          <AnalysisCard
            result={uploadResult.analysis_result}
            filename={uploadResult.filename}
            warning={uploadResult.analysis_warning}
          />
        </div>
      )}

      {/* ── History (always visible) ──────────────────────────────────────── */}
      <div className="section-divide space-y-4">
        <div>
          <p className="section-label">Upload history</p>
          <h3 className="mt-1">Previous résumés</h3>
        </div>
        <HistoryList refreshKey={historyKey} />
      </div>
    </div>
  );
}
