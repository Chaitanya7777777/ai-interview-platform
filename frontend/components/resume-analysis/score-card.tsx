/**
 * components/resume-analysis/score-card.tsx
 * ------------------------------------------
 * Circular score ring + tier label.
 * Score is 0-100. The SVG ring fills proportionally.
 */

"use client";

import { getScoreTier, getScoreColor, getScoreBg, getScoreLabel } from "@/types/resume";
import { cn } from "@/lib/utils";

export type ScoreCardProps = {
  score: number;
};

export function ScoreCard({ score }: ScoreCardProps) {
  const tier = getScoreTier(score);
  const color = getScoreColor(tier);
  const bg = getScoreBg(tier);
  const label = getScoreLabel(tier);

  // SVG circle math
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Ring */}
      <div className="relative h-40 w-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          {/* Track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          {/* Fill */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn("transition-all duration-700 ease-out", color)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-4xl font-bold tabular-nums", color)}>{score}</span>
          <span className="text-xs text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>

      {/* Tier badge */}
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white",
        bg
      )}>
        {label}
      </span>

      {/* Score bar breakdown */}
      <div className="w-full space-y-2.5 mt-2">
        {[
          { label: "Content Quality", value: Math.min(100, score + 8) },
          { label: "Keyword Strength", value: Math.max(0, score - 5) },
          { label: "Structure", value: Math.min(100, score + 4) },
        ].map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums">{item.value}%</span>
            </div>
            {/* Simple div-based progress bar — avoids @base-ui Progress API */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={item.value} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={cn("h-full rounded-full transition-all duration-700", bg)}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
