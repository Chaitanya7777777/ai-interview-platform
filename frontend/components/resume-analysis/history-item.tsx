/**
 * components/resume-analysis/history-item.tsx
 * --------------------------------------------
 * Single row in the resume history list.
 * Shows file name, status badge, score, date, and size.
 * Clicking expands the analysis inline.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalysisCard } from "./analysis-card";
import { ResumeHistoryItem as ResumeHistoryItemType } from "@/services/resume.service";
import { getScoreTier, getScoreColor, formatBytes, formatDate } from "@/types/resume";
import { cn } from "@/lib/utils";

export type HistoryItemProps = {
  item: ResumeHistoryItemType;
};

export function HistoryItem({ item }: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  const score = item.analysis_result?.overall_score ?? null;
  const tier = score !== null ? getScoreTier(score) : null;
  const scoreColor = tier ? getScoreColor(tier) : "text-muted-foreground";

  const statusConfig: Record<string, { label: string; className: string }> = {
    analysed: { label: "Analysed", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    parsed:   { label: "Parsed",   className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    failed:   { label: "Failed",   className: "bg-red-500/10 text-red-700 border-red-500/20" },
  };

  const statusCfg = statusConfig[item.status] ?? statusConfig["parsed"];

  return (
    <div className="border rounded-lg overflow-hidden transition-shadow hover:shadow-sm">
      {/* Row */}
      <button
        id={`history-item-${item.id}`}
        aria-expanded={expanded}
        aria-controls={`history-details-${item.id}`}
        onClick={() => item.analysis_result && setExpanded((v) => !v)}
        disabled={!item.analysis_result}
        className={cn(
          "w-full flex items-center gap-4 p-4 text-left bg-card transition-colors",
          item.analysis_result ? "cursor-pointer hover:bg-muted/40" : "cursor-default opacity-70"
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

        {/* Status */}
        <Badge variant="outline" className={cn("text-xs shrink-0 hidden sm:inline-flex", statusCfg.className)}>
          {statusCfg.label}
        </Badge>

        {/* Score */}
        {score !== null && (
          <span className={cn("text-sm font-bold tabular-nums shrink-0 w-14 text-right", scoreColor)}>
            {score}/100
          </span>
        )}

        {/* Chevron */}
        {item.analysis_result && (
          <div className="shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
        )}
      </button>

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
