import { ProgressBar } from "@/components/ui/progress-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeTotal } from "@/lib/food";
import { formatInt, percentOf } from "@/lib/format";
import type { DailyNutrition } from "@/lib/types/api";

export function NutritionTotals({ daily }: { daily: DailyNutrition }) {
  const { totals, calorie_target_kcal: target, calories_remaining: remaining } = daily;
  const missing = (key: string) => totals.items_missing[key] ?? 0;
  const percent = percentOf(totals.calories ?? 0, target);

  const rows: { label: string; key: string; value: number | null }[] = [
    { label: "Protein", key: "protein_g", value: totals.protein_g },
    { label: "Carbohydrates", key: "carbohydrate_g", value: totals.carbohydrate_g },
    { label: "Fat", key: "fat_g", value: totals.fat_g },
    { label: "Fibre", key: "fiber_g", value: totals.fiber_g },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today so far</CardTitle>
        <CardDescription>
          {totals.calories === null ? "—" : formatInt(totals.calories)}
          {target !== null && ` of ${formatInt(target)}`} kcal
          {remaining !== null && remaining > 0 && ` · ${formatInt(remaining)} still to enjoy`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {percent !== null && <ProgressBar value={percent} label="Calories toward today's estimate" />}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {rows.map((row) => (
            <div key={row.key}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium">{describeTotal(row.value, missing(row.key), "g")}</dd>
            </div>
          ))}
        </dl>
        {Object.entries(totals.items_missing).some(([key, n]) => key !== "calories" && n > 0) && (
          <p className="text-xs text-muted-foreground">
            “At least” means some foods don&apos;t have that nutrient listed, so the real amount may be
            higher.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
