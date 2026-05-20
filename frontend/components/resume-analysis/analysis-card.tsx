/**
 * components/resume-analysis/analysis-card.tsx
 * ---------------------------------------------
 * The full AI analysis result display.
 * Receives a ResumeAnalysisResult and renders all sections in a structured grid.
 * Uses Tabs for the upper panel (Strengths/Weaknesses) and a 2-col grid below.
 */

"use client";

import { ResumeAnalysisResult } from "@/services/resume.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreCard } from "./score-card";
import { StrengthsList } from "./strengths-list";
import { WeaknessesList } from "./weaknesses-list";
import { MissingSkills } from "./missing-skills";
import { RecommendedRoles } from "./recommended-roles";
import { ImprovementSuggestions } from "./improvement-suggestions";
import { AlertTriangle } from "lucide-react";

export type AnalysisCardProps = {
  result: ResumeAnalysisResult;
  filename: string;
  /** Non-null when AI returned a partial/fallback result */
  warning?: string | null;
};

export function AnalysisCard({ result, filename, warning }: AnalysisCardProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Fallback warning banner */}
      {warning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm" role="alert">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-amber-700 dark:text-amber-400">{warning}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-lg shrink-0">
          📄
        </div>
        <div>
          <p className="font-semibold text-foreground truncate max-w-xs" title={filename}>{filename}</p>
          <p className="text-xs text-muted-foreground">AI analysis complete</p>
        </div>
      </div>

      {/* Top section: Score + Strengths/Weaknesses tabs */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score */}
        <Card className="lg:col-span-1 shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overall Score</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <ScoreCard score={result.overall_score} />
          </CardContent>
        </Card>

        {/* Strengths / Weaknesses tabs */}
        <Card className="lg:col-span-2 shadow-sm border-border/60">
          <CardContent className="pt-4">
            <Tabs defaultValue="strengths">
              <TabsList className="mb-4">
                <TabsTrigger value="strengths">
                  ✓ Strengths ({result.strengths.length})
                </TabsTrigger>
                <TabsTrigger value="weaknesses">
                  ⚠ Weaknesses ({result.weaknesses.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="strengths" className="mt-0">
                <StrengthsList items={result.strengths} />
              </TabsContent>

              <TabsContent value="weaknesses" className="mt-0">
                <WeaknessesList items={result.weaknesses} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid: Missing Skills, Recommended Roles, Suggestions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Missing Skills</CardTitle>
            <CardDescription>Add these to improve ATS match rate</CardDescription>
          </CardHeader>
          <CardContent>
            <MissingSkills items={result.missing_skills} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommended Roles</CardTitle>
            <CardDescription>Based on your current experience</CardDescription>
          </CardHeader>
          <CardContent>
            <RecommendedRoles items={result.recommended_roles} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Improvement Suggestions</CardTitle>
            <CardDescription>Actionable steps to strengthen your resume</CardDescription>
          </CardHeader>
          <CardContent>
            <ImprovementSuggestions items={result.improvement_suggestions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
