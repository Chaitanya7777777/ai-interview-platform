"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: "up" | "down" | "neutral";
};

/**
 * StatCard
 * --------
 * Reusable metric card for the analytics dashboard.
 * Matches the exact visual language of the existing dashboard page cards.
 */
export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50",
        "p-5 shadow-sm transition-shadow hover:shadow-md"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between pb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "transition-transform group-hover:scale-110",
            iconBg,
            iconColor
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Value */}
      <div className="text-3xl font-bold tracking-tight">{value}</div>

      {/* Subtext */}
      {subtext && (
        <p className="mt-1.5 text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}
