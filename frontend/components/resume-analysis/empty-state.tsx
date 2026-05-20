/**
 * components/resume-analysis/empty-state.tsx
 * -------------------------------------------
 * Shown in the history list when the user has no resume uploads yet.
 */

import Link from "next/link";
import { FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export type EmptyStateProps = {
  title?: string;
  description?: string;
  /** If provided, renders a CTA link to this href. */
  ctaHref?: string;
  ctaLabel?: string;
};

export function EmptyState({
  title = "No resumes yet",
  description = "Upload your first resume to get AI-powered analysis and feedback.",
  ctaHref = "/resume-analysis",
  ctaLabel = "Upload Resume",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="status" aria-live="polite">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">{description}</p>
      {ctaHref && (
        <Link href={ctaHref} className={buttonVariants({ size: "sm" })}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
