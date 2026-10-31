"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/format";
import type { UnitSystem } from "@/lib/types/api";
import { chartDomain, toDisplayWeight, type ChartPoint } from "@/lib/weight";

/**
 * The trend is the bold line; single weigh-ins are small dots, so everyday ups and downs stay in
 * the background (product spec §10).
 */
export function WeightChart({
  points,
  goalKg,
  unit,
}: {
  points: ChartPoint[];
  goalKg: number;
  unit: UnitSystem;
}) {
  const label = unit === "METRIC" ? "kg" : "lb";
  const domain = chartDomain(points, goalKg, unit) ?? undefined;

  return (
    <div role="img" aria-label="Weight over time, with your 7-day trend and your goal weight">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            minTickGap={24}
            tick={{ fontSize: 12 }}
          />
          <YAxis domain={domain} width={44} tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(date) => formatShortDate(String(date))}
            formatter={(value, name) => [`${value} ${label}`, String(name)]}
          />
          <ReferenceLine
            y={toDisplayWeight(goalKg, unit)}
            stroke="var(--accent-foreground)"
            strokeDasharray="6 4"
            label={{ value: "Goal", position: "insideTopRight", fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="7-day trend"
            stroke="var(--primary)"
            strokeWidth={3}
            dot={false}
            connectNulls
          />
          <Line
            dataKey="weight"
            name="Weigh-in"
            stroke="none"
            dot={{ r: 3, fill: "var(--muted-foreground)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
