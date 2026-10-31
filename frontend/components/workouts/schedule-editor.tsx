"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import type { ScheduleDay, WorkoutTemplate } from "@/lib/types/api";
import {
  scheduleToPayload,
  selectionFromSchedule,
  WEEKDAYS,
  type ScheduleSelection,
} from "@/lib/workouts";

export function ScheduleEditor({
  schedule,
  templates,
  onSaved,
}: {
  schedule: ScheduleDay[];
  templates: WorkoutTemplate[];
  onSaved: () => void;
}) {
  const [selection, setSelection] = useState<ScheduleSelection>(() => selectionFromSchedule(schedule));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api("/workouts/schedule", { method: "PUT", body: { days: scheduleToPayload(selection) } });
      setSaved(true);
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly plan</CardTitle>
        <CardDescription>
          Choose a workout or a rest day for each weekday. You can change it whenever you like.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          {WEEKDAYS.map((day) => (
            <div key={day.value} className="grid grid-cols-[7rem_1fr] items-center gap-3">
              <Label htmlFor={`plan-${day.value}`}>{day.label}</Label>
              <NativeSelect
                id={`plan-${day.value}`}
                value={selection[day.value]}
                onChange={(e) => {
                  setSaved(false);
                  setSelection((current) => ({ ...current, [day.value]: e.target.value }));
                }}
              >
                <option value="">Nothing planned</option>
                <option value="REST">Rest day</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save plan"}
            </Button>
            {saved && <span className="text-sm text-muted-foreground">Saved 🌱</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
