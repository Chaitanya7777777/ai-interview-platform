/**
 * components/resume-analysis/history-list.tsx
 * --------------------------------------------
 * Fetches and renders the authenticated user's resume history.
 * Manages its own loading, error, and pagination state.
 * Uses HistoryItem for each row and EmptyState when no results.
 *
 * Features:
 * - Collapsible section (chevron toggle in header)
 * - Per-item delete with instant optimistic removal
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoryItem } from "./history-item";
import { EmptyState } from "./empty-state";
import { HistoryLoadingSkeleton } from "./loading-skeleton";
import { resumeService, ResumeHistoryPage } from "@/services/resume.service";

const PAGE_SIZE = 8;

export type HistoryListProps = {
  /** Key incremented by parent to trigger a re-fetch (e.g. after new upload). */
  refreshKey?: number;
};

export function HistoryList({ refreshKey = 0 }: HistoryListProps) {
  const [page, setPage]           = useState(1);
  const [data, setData]           = useState<ResumeHistoryPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  // Section collapse — expanded by default
  const [collapsed, setCollapsed] = useState(false);

  const fetchHistory = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await resumeService.getHistory({ page: pageNum, pageSize: PAGE_SIZE });
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load history.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount, page change, or when refreshKey changes (new upload)
  useEffect(() => {
    void fetchHistory(page);
  }, [fetchHistory, page, refreshKey]);

  const handlePrev = () => {
    if (data?.has_prev) setPage((p) => p - 1);
  };

  const handleNext = () => {
    if (data?.has_next) setPage((p) => p + 1);
  };

  /** Optimistically remove a deleted item from local state. */
  const handleItemDeleted = (id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((it) => it.id !== id);
      return {
        ...prev,
        items,
        total_count: Math.max(0, prev.total_count - 1),
      };
    });
  };

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Resume History</CardTitle>
            {data && (
              <CardDescription>
                {data.total_count} {data.total_count === 1 ? "upload" : "uploads"} total
              </CardDescription>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchHistory(page)}
              disabled={isLoading}
              aria-label="Refresh history"
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            {/* Collapse / expand toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand list" : "Collapse list"}
              aria-expanded={!collapsed}
              className="h-8 w-8"
            >
              {collapsed
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <CardContent>
          {isLoading ? (
            <HistoryLoadingSkeleton rows={PAGE_SIZE} />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchHistory(page)}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="space-y-2">
                {data.items.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    onDelete={handleItemDeleted}
                  />
                ))}
              </div>

              {/* Pagination */}
              {data.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Page {data.page} of {data.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrev}
                      disabled={!data.has_prev}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      disabled={!data.has_next}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
