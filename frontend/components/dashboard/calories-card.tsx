import { ProgressBar } from "@/components/ui/progress-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInt, percentOf } from "@/lib/format";
import type { DayOverview } from "@/lib/types/api";
import { round } from "@/lib/units";

export function CaloriesCard({ day }: { day: DayOverview }) {
  const { consumed, target, remaining } = day.calories;
  const percent = percentOf(consumed ?? 0, target);
  const proteinGaps = day.nutrition.items_missing.protein_g ?? 0;

  let message: string;
  if (consumed === null) message = "Nothing logged yet. A meal or a snack is a lovely place to start.";
  else if (remaining === null) message = "Set your daily estimate to see how today is going.";
  else if (remaining > 0) message = `${formatInt(remaining)} kcal still to enjoy today.`;
  else message = "You've reached today's calorie goal. 🌷";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calories</CardTitle>
        <CardDescription>
          {consumed === null ? "—" : formatInt(consumed)}
          {target !== null && ` of ${formatInt(target)}`} kcal
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {percent !== null && <ProgressBar value={percent} label="Calories toward today's estimate" />}
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-sm">
          <span className="font-medium">Protein: </span>
          {day.protein.consumed_g === null
            ? "not tracked yet today"
            : `${proteinGaps > 0 ? "at least " : ""}${round(day.protein.consumed_g, 1)} g`}
          {proteinGaps > 0 && day.protein.consumed_g !== null && (
            <span className="text-muted-foreground"> (some foods have no protein data)</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
