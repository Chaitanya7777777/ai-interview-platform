/**
 * components/resume-analysis/weaknesses-list.tsx
 * ------------------------------------------------
 * Renders the AI-identified weaknesses as styled cards.
 */

import { AlertTriangle } from "lucide-react";

export type WeaknessesListProps = {
  items: string[];
};

export function WeaknessesList({ items }: WeaknessesListProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No weaknesses identified.</p>;
  }

  return (
    <ul className="space-y-2.5" role="list" aria-label="Resume weaknesses">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-3 text-sm"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-foreground leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  );
}
