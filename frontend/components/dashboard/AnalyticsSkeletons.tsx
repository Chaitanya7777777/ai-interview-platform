"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ── Skeleton primitive ────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60",
        className
      )}
      style={style}
    />
  );
}

// ── Stat card skeleton ────────────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

// ── Chart card skeleton ────────────────────────────────────────────────────────

export function ChartCardSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className={`w-full rounded-lg`} style={{ height }} />
    </div>
  );
}
