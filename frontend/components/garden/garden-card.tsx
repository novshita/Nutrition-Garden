import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Garden, GrowthAction } from "@/lib/types/api";

const ACTION_LABELS: Record<GrowthAction, string> = {
  FOOD_LOGGED: "Logged food",
  CALORIE_TARGET_MET: "Nourished well",
  WORKOUT_COMPLETED: "Moved your body",
  STEPS_LOGGED: "Counted steps",
  WATER_LOGGED: "Drank water",
  SLEEP_LOGGED: "Noted your sleep",
  MOOD_LOGGED: "Checked in with your mood",
  WEIGHT_LOGGED: "Logged your weight",
};

/** Placeholder garden view. The real garden and bunny artwork comes later. */
export function GardenCard({ garden }: { garden: Garden }) {
  const { growth_points, next_stage_at_points, points_to_next_stage } = garden;
  const previousThreshold = next_stage_at_points === null ? null : stageStart(garden);
  const progress =
    next_stage_at_points === null || previousThreshold === null
      ? 100
      : Math.round(
          ((growth_points - previousThreshold) / (next_stage_at_points - previousThreshold)) * 100,
        );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-diary text-3xl">{garden.name}</CardTitle>
        <CardDescription>Stage {garden.growth_stage} · {growth_points} growth points</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden className="text-6xl">🐰</span>
          <div className="flex-1">
            <div
              className="h-3 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Progress to the next garden stage"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {points_to_next_stage === null
                ? "Your garden is in full bloom."
                : `${points_to_next_stage} more to reach the next stage.`}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Today in your garden</p>
          {garden.today_actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet today, and that&apos;s perfectly fine. 🌱
            </p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-2">
              {garden.today_actions.map((action) => (
                <li key={action} className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
                  {ACTION_LABELS[action]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// The points where the current stage began, derived from the next threshold the API reports.
const STAGE_THRESHOLDS = [0, 50, 150, 300, 500];
function stageStart(garden: Garden): number {
  return STAGE_THRESHOLDS[Math.max(0, garden.growth_stage - 1)] ?? 0;
}
