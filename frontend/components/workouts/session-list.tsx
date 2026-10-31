import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSeconds } from "@/lib/format";
import type { WorkoutSession } from "@/lib/types/api";

const when = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function SessionList({ sessions, timeZone }: { sessions: WorkoutSession[]; timeZone: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent workouts</CardTitle>
        <CardDescription>
          {sessions.length === 0 ? "Nothing recorded yet, and that's fine." : "Your latest sessions."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-lg bg-secondary px-3 py-2 text-sm">
              <span className="font-medium">{session.template_name ?? "Workout"}</span>
              <span className="text-muted-foreground">
                {" "}
                · {when(session.started_at, timeZone)} · {formatSeconds(session.duration_seconds)}
                {session.estimated_calories !== null && ` · about ${session.estimated_calories} kcal`}
              </span>
              {session.notes && <p className="text-muted-foreground">{session.notes}</p>}
            </li>
          ))}
        </ul>
        {sessions.some((s) => s.estimated_calories !== null) && (
          <p className="text-xs text-muted-foreground">
            Calorie figures are rough estimates and don&apos;t change your food goal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
