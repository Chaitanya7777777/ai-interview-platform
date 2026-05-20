/**
 * components/resume-analysis/recommended-roles.tsx
 * --------------------------------------------------
 * Renders AI-recommended roles as styled pill badges.
 */

import { Briefcase } from "lucide-react";

export type RecommendedRolesProps = {
  items: string[];
};

export function RecommendedRoles({ items }: RecommendedRolesProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No role recommendations available.</p>;
  }

  return (
    <ul className="space-y-2" role="list" aria-label="Recommended roles">
      {items.map((role, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <Briefcase className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          {role}
        </li>
      ))}
    </ul>
  );
}
