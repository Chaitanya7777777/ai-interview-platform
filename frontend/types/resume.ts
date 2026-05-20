/**
 * types/resume.ts
 * ---------------
 * Shared TypeScript interfaces for the Resume Analysis feature.
 * These are re-exported from resume.service.ts for convenience so
 * components import from one place.
 */

export type {
  ResumeAnalysisResult,
  ResumeHistoryItem,
  ResumeHistoryPage,
  ResumeUploadResponse,
  UploadOptions,
  HistoryOptions,
} from "@/services/resume.service";

/** Upload phase state machine for the UploadZone component. */
export type UploadPhase = "idle" | "uploading" | "analysing" | "done" | "error";

/** Score tier derived from overall_score for colour-coded UI. */
export type ScoreTier = "excellent" | "good" | "fair" | "poor";

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

export function getScoreColor(tier: ScoreTier): string {
  switch (tier) {
    case "excellent": return "text-emerald-500";
    case "good":      return "text-blue-500";
    case "fair":      return "text-amber-500";
    case "poor":      return "text-red-500";
  }
}

export function getScoreBg(tier: ScoreTier): string {
  switch (tier) {
    case "excellent": return "bg-emerald-500";
    case "good":      return "bg-blue-500";
    case "fair":      return "bg-amber-500";
    case "poor":      return "bg-red-500";
  }
}

export function getScoreLabel(tier: ScoreTier): string {
  switch (tier) {
    case "excellent": return "Excellent";
    case "good":      return "Good";
    case "fair":      return "Needs Work";
    case "poor":      return "Weak";
  }
}

/** Format bytes to human-readable string. */
export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format ISO 8601 date to locale date string. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
