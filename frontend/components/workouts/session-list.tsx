"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { formatSeconds } from "@/lib/format";
import type { WorkoutSession } from "@/lib/types/api";
import { summarizeSets } from "@/lib/workouts";

const when = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function SessionList({
  sessions,
  timeZone,
  onChanged,
}: {
  sessions: WorkoutSession[];
  timeZone: string;
  onChanged: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/workouts/sessions/${id}`, { method: "DELETE" });
      setConfirmingId(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent workouts</CardTitle>
        <CardDescription>
          {sessions.length === 0 ? "Nothing recorded yet, and that's fine." : "Your latest sessions."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
        <ul className="flex flex-col gap-1">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-lg bg-secondary px-3 py-2 text-sm">
              <span className="font-medium">{session.template_name ?? "Workout"}</span>
              <span className="text-muted-foreground">
                {" "}
                · {when(session.started_at, timeZone)} · {formatSeconds(session.duration_seconds)}
                {session.estimated_calories !== null && ` · about ${session.estimated_calories} kcal`}
              </span>
              {summarizeSets(session.sets).map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
              {session.notes && <p className="text-muted-foreground">{session.notes}</p>}
              {confirmingId === session.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span>Delete this workout?</span>
                  <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => remove(session.id)}>
                    {busy ? "Deleting…" : "Yes, delete it"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmingId(null)}>
                    Keep it
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1"
                  aria-label={`Delete workout ${session.template_name ?? ""} ${when(session.started_at, timeZone)}`}
                  onClick={() => setConfirmingId(session.id)}
                >
                  Delete
                </Button>
              )}
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
