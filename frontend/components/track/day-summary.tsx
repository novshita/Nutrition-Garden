import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatInt, formatLongDate, formatSeconds, formatVolume, formatWeight } from "@/lib/format";
import type { DayOverview, Mood, UnitSystem } from "@/lib/types/api";
import { round } from "@/lib/units";

const MOOD_WORDS: Record<Mood, string> = {
  GREAT: "great",
  GOOD: "good",
  OKAY: "okay",
  LOW: "low",
  ROUGH: "rough",
};

/** A gentle look back at the day: what happened, never what was missed. */
export function DaySummary({ day, unit }: { day: DayOverview; unit: UnitSystem }) {
  const lines: string[] = [];

  if (day.calories.consumed !== null) {
    const protein =
      day.protein.consumed_g === null
        ? ""
        : `, with ${(day.nutrition.items_missing.protein_g ?? 0) > 0 ? "at least " : ""}${round(day.protein.consumed_g, 1)} g of protein`;
    lines.push(`You ate about ${formatInt(day.calories.consumed)} kcal${protein}.`);
  }
  if (day.water_ml > 0) lines.push(`You drank ${formatVolume(day.water_ml, unit)} of water.`);
  if (day.sleep_minutes !== null) lines.push(`You slept ${formatDuration(day.sleep_minutes)}.`);
  if (day.steps !== null) lines.push(`You took ${formatInt(day.steps)} steps.`);
  if (day.mood !== null) lines.push(`You were feeling ${MOOD_WORDS[day.mood]}.`);
  if (day.weight_kg !== null) lines.push(`You weighed in at ${formatWeight(day.weight_kg, unit)}.`);
  for (const session of day.workout.completed) {
    lines.push(`You did ${session.template_name ?? "a workout"} for ${formatSeconds(session.duration_seconds)}.`);
  }

  const growth = day.garden.points_earned;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-diary text-3xl">{formatLongDate(day.date)}</CardTitle>
        <CardDescription>
          {lines.length === 0
            ? "Nothing logged yet, and that's perfectly fine."
            : "Here's how the day looks so far."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {lines.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          {growth > 0
            ? `Your garden grew by ${growth} ${growth === 1 ? "point" : "points"} on this day. 🌱`
            : "Resting is part of growing. Your garden will be here."}
        </p>
      </CardContent>
    </Card>
  );
}
