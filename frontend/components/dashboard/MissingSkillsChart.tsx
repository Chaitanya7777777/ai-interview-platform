"use client";

import { MissingSkillCount } from "@/services/dashboard.service";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MissingSkillsChartProps = {
  data: MissingSkillCount[];
};

// Gradient colours from high (red-ish) to low (primary) frequency
const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * MissingSkillsChart
 * ------------------
 * Horizontal bar chart showing the most common missing skills.
 * Sorted descending by count (backend already sorts, this is a safety pass).
 */
export function MissingSkillsChart({ data }: MissingSkillsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No missing skills data yet. Analyse a resume to begin.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="hsl(var(--border))"
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          type="category"
          dataKey="skill"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--card))",
            fontSize: "12px",
          }}
          formatter={(value) => [
            `${value ?? 0} resume${(value ?? 0) !== 1 ? "s" : ""}`,
            "Missing in",
          ]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {sorted.map((_, index) => (
            <Cell key={index} fill={getColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
