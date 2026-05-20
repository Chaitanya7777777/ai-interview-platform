/**
 * components/resume-analysis/missing-skills.tsx
 * -----------------------------------------------
 * Renders missing skills as badge chips.
 */

import { Badge } from "@/components/ui/badge";

export type MissingSkillsProps = {
  items: string[];
};

export function MissingSkills({ items }: MissingSkillsProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No missing skills found — great coverage!</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Missing skills">
      {items.map((skill, i) => (
        <Badge
          key={i}
          variant="outline"
          className="bg-red-500/5 text-red-600 border-red-500/25 hover:bg-red-500/10 cursor-default text-xs"
          role="listitem"
        >
          + {skill}
        </Badge>
      ))}
    </div>
  );
}
