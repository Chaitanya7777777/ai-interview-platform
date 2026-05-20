/**
 * app/(dashboard)/history/page.tsx
 * ----------------------------------
 * Resume history page — shows all past uploads with analysis.
 * Delegates to HistoryList which handles fetching, pagination,
 * empty state, and error handling internally.
 */

"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HistoryList } from "@/components/resume-analysis/history-list";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">History</h2>
          <p className="text-muted-foreground mt-1">
            Your past resume uploads and AI analyses.
          </p>
        </div>
        <Link
          href="/resume-analysis"
          className={buttonVariants({ size: "sm" })}
          id="new-resume-link"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Resume
        </Link>
      </div>

      {/* History list — fully self-contained with pagination */}
      <HistoryList />
    </div>
  );
}
