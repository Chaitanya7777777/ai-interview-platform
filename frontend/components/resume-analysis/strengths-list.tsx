/**
 * components/resume-analysis/strengths-list.tsx
 * -----------------------------------------------
 * Renders the AI-identified strengths as styled cards.
 */

import { CheckCircle2 } from "lucide-react";

export type StrengthsListProps = {
  items: string[];
};

export function StrengthsList({ items }: StrengthsListProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No strengths identified.</p>;
  }

  return (
    <ul className="space-y-2.5" role="list" aria-label="Resume strengths">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 text-sm"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-foreground leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  );
}
