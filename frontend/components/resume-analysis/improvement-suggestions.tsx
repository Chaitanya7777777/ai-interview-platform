/**
 * components/resume-analysis/improvement-suggestions.tsx
 * --------------------------------------------------------
 * Numbered list of AI improvement suggestions.
 */

import { Lightbulb } from "lucide-react";

export type ImprovementSuggestionsProps = {
  items: string[];
};

export function ImprovementSuggestions({ items }: ImprovementSuggestionsProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No suggestions at this time.</p>;
  }

  return (
    <ol className="space-y-3" role="list" aria-label="Improvement suggestions">
      {items.map((suggestion, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary mt-0.5">
            {i + 1}
          </span>
          <div className="flex items-start gap-2 flex-1">
            <Lightbulb className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-foreground leading-relaxed">{suggestion}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
