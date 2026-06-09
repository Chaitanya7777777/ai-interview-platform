/**
 * components/resume-analysis/history-item.tsx
 * --------------------------------------------
 * Single row in the resume history list.
 * Shows file name, status badge, score, date, and size.
 * Clicking the row expands the analysis inline.
 * A delete button (with confirmation) removes the entry.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalysisCard } from "./analysis-card";
import { ResumeHistoryItem as ResumeHistoryItemType, resumeService } from "@/services/resume.service";
import { getScoreTier, getScoreColor, formatBytes, formatDate } from "@/types/resume";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type HistoryItemProps = {
  item: ResumeHistoryItemType;
  /** Called after a successful delete so the parent can remove this row. */
  onDelete?: (id: string) => void;
};

export function HistoryItem({ item, onDelete }: HistoryItemProps) {
  const [expanded, setExpanded]       = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const score      = item.analysis_result?.overall_score ?? null;
  const tier       = score !== null ? getScoreTier(score) : null;
  const scoreColor = tier ? getScoreColor(tier) : "text-muted-foreground";

  const statusConfig: Record<string, { label: string; className: string }> = {
    analysed: { label: "Analysed", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    parsed:   { label: "Parsed",   className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    failed:   { label: "Failed",   className: "bg-red-500/10 text-red-700 border-red-500/20" },
  };

  const statusCfg = statusConfig[item.status] ?? statusConfig["parsed"];

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await resumeService.deleteResume(item.id);
      toast.success("Résumé deleted.");
      onDelete?.(item.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete résumé.");
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden transition-shadow hover:shadow-sm">
      {/* Row */}
      <div className="w-full flex items-center gap-4 p-4 bg-card">
        {/* Expand button — occupies the icon + info area */}
        <button
          id={`history-item-${item.id}`}
          aria-expanded={expanded}
          aria-controls={`history-details-${item.id}`}
          onClick={() => item.analysis_result && setExpanded((v) => !v)}
          disabled={!item.analysis_result}
          className={cn(
            "flex items-center gap-4 flex-1 min-w-0 text-left transition-colors rounded",
            item.analysis_result ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-70"
          )}
        >
          {/* Icon */}
          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{item.file_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(item.created_at)}
              {item.file_size_bytes && ` · ${formatBytes(item.file_size_bytes)}`}
              {item.text_length && ` · ${item.text_length.toLocaleString()} chars`}
            </p>
          </div>
        </button>

        {/* Status badge */}
        <Badge variant="outline" className={cn("text-xs shrink-0 hidden sm:inline-flex", statusCfg.className)}>
          {statusCfg.label}
        </Badge>

        {/* Score */}
        {score !== null && (
          <span className={cn("text-sm font-bold tabular-nums shrink-0 w-14 text-right", scoreColor)}>
            {score}/100
          </span>
        )}

        {/* Chevron (expand/collapse) */}
        {item.analysis_result && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse analysis" : "Expand analysis"}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            {expanded
              ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
              : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}

        {/* Delete button — shows confirm inline */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete this résumé"
            title="Delete"
            className="shrink-0 p-1.5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-destructive font-medium">Delete?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              No
            </Button>
          </div>
        )}
      </div>

      {/* Expandable analysis */}
      {expanded && item.analysis_result && (
        <div
          id={`history-details-${item.id}`}
          role="region"
          aria-labelledby={`history-item-${item.id}`}
          className="border-t p-4 md:p-6 bg-background animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <AnalysisCard
            result={item.analysis_result}
            filename={item.file_name}
          />
        </div>
      )}
    </div>
  );
}
