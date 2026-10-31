import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSeconds } from "@/lib/format";
import type { DayOverview } from "@/lib/types/api";

export function WorkoutCard({ workout }: { workout: DayOverview["workout"] }) {
  const { planned, completed } = workout;

  let plan: string;
  if (!planned) plan = "Nothing planned for today.";
  else if (planned.is_rest_day) plan = "Rest day. Rest is part of growing. 🌿";
  else plan = `Planned: ${planned.template_name ?? "your workout"}. Ready whenever you are.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workout</CardTitle>
        <CardDescription>{plan}</CardDescription>
      </CardHeader>
      <CardContent>
        {completed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workout logged yet today.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1 text-sm">
              {completed.map((session) => (
                <li key={session.id}>
                  {session.template_name ?? "Workout"} · {formatSeconds(session.duration_seconds)}
                  {session.estimated_calories !== null && ` · about ${session.estimated_calories} kcal`}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Calorie figures are rough estimates and don&apos;t change your food goal.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
