"use client";

import { WeightChart } from "@/components/weight/weight-chart";
import { WeightForm } from "@/components/weight/weight-form";
import { WeightList } from "@/components/weight/weight-list";
import { WeightSummary } from "@/components/weight/weight-summary";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { addDays } from "@/lib/track";
import type { Bmi, UnitSystem, WeightEntry, WeightTrend } from "@/lib/types/api";
import { buildChartData, todayIn } from "@/lib/weight";

/** Everything on the weight page for one time range. Mount with key={range} for a fresh load. */
export function WeightPanel({
  rangeDays,
  unit,
  timeZone,
  goalKg,
}: {
  rangeDays: number;
  unit: UnitSystem;
  timeZone: string;
  goalKg: number;
}) {
  const start = addDays(todayIn(timeZone), -rangeDays);
  const entries = useApi<WeightEntry[]>(`/weight?start_date=${start}&limit=1000`);
  const trend = useApi<WeightTrend>(`/weight/trend?series_days=${rangeDays}`);
  const bmi = useApi<Bmi>("/bmi");

  const reload = () => {
    entries.reload();
    trend.reload();
    bmi.reload();
  };

  const points =
    entries.data && trend.data ? buildChartData(entries.data, trend.data.series, unit, timeZone) : null;
  const failure = entries.error ?? trend.error;

  return (
    <div className="flex flex-col gap-6">
      <WeightSummary bmi={bmi.data} trend={trend.data} goalKg={goalKg} unit={unit} />

      <Card>
        <CardContent className="pt-4">
          {failure ? (
            <p className="text-destructive">{failure.message}</p>
          ) : points === null ? (
            <p className="text-muted-foreground">Drawing your chart…</p>
          ) : points.length === 0 ? (
            <p className="text-muted-foreground">
              No weigh-ins in this time range yet. Log one below and your chart will begin.
            </p>
          ) : (
            <WeightChart points={points} goalKg={goalKg} unit={unit} />
          )}
        </CardContent>
      </Card>

      <WeightForm unit={unit} timeZone={timeZone} onSaved={reload} />
      {entries.data && (
        <WeightList entries={entries.data} unit={unit} timeZone={timeZone} onChanged={reload} />
      )}
    </div>
  );
}
