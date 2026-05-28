"use client";

import { RecommendedRoleCount } from "@/services/dashboard.service";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type RecommendedRolesChartProps = {
  data: RecommendedRoleCount[];
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(220 70% 60%)",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
  "hsl(280 65% 60%)",
  "hsl(340 75% 55%)",
  "hsl(45 85% 55%)",
  "hsl(190 70% 50%)",
];

function getColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}

type PiePayloadEntry = {
  name: string;
  value: number;
  payload: { role: string; count: number };
};

function CustomLegend({
  payload,
}: {
  payload?: PiePayloadEntry[];
}) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
      {payload.map((entry, index) => (
        <li
          key={index}
          className="flex items-center gap-1.5 text-xs text-foreground"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.payload ? getColor(index) : "#999" }}
          />
          <span className="truncate max-w-[120px]" title={entry.name}>
            {entry.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * RecommendedRolesChart
 * ---------------------
 * Donut pie chart showing role distribution across analysed resumes.
 * Clean modern labels with a custom legend.
 */
export function RecommendedRolesChart({ data }: RecommendedRolesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No role data yet. Analyse a resume to begin.
      </div>
    );
  }

  const chartData = data.map((d) => ({ name: d.role, value: d.count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius="40%"
          outerRadius="68%"
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={getColor(index)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--card))",
            fontSize: "12px",
          }}
          formatter={(value, name) => [
            `${value ?? 0} resume${(value ?? 0) !== 1 ? "s" : ""}`,
            name,
          ]}
        />
        <Legend
          content={(props) => (
            <CustomLegend payload={props.payload as PiePayloadEntry[] | undefined} />
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
