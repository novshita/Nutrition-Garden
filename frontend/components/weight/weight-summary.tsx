import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeight } from "@/lib/format";
import type { Bmi, UnitSystem, WeightTrend } from "@/lib/types/api";
import { describeWeeklyChange, goalProgressText, TREND_COPY } from "@/lib/weight";

export function WeightSummary({
  bmi,
  trend,
  goalKg,
  unit,
}: {
  bmi: Bmi | null;
  trend: WeightTrend | null;
  goalKg: number;
  unit: UnitSystem;
}) {
  const copy = trend ? TREND_COPY[trend.state] : null;
  const change = trend ? describeWeeklyChange(trend.weekly_change_kg, unit) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{bmi ? formatWeight(bmi.weight_kg, unit) : "—"}</CardTitle>
          <CardDescription>Current weight · goal {formatWeight(goalKg, unit)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {bmi && <p>{goalProgressText(bmi.weight_kg, goalKg, unit)}</p>}
          {bmi && (
            <p className="text-muted-foreground">
              BMI {bmi.bmi.toFixed(1)}. Just one number to be curious about, not a verdict.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy?.title ?? "—"}</CardTitle>
          <CardDescription>7-day trend</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {copy && <p>{copy.detail}</p>}
          {change && <p className="text-muted-foreground">Change: {change}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
