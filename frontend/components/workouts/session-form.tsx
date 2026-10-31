"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import type { WorkoutSession, WorkoutTemplate } from "@/lib/types/api";
import { todayIn } from "@/lib/weight";
import { buildSessionPayload } from "@/lib/workouts";

export function SessionForm({
  templates,
  timeZone,
  onSaved,
}: {
  templates: WorkoutTemplate[];
  timeZone: string;
  onSaved: () => void;
}) {
  const today = todayIn(timeZone);
  const [templateId, setTemplateId] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildSessionPayload({ templateId, date, startTime, minutes, notes, timeZone });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<WorkoutSession>("/workouts/sessions", { method: "POST", body: result.payload });
      setStartTime("");
      setMinutes("");
      setNotes("");
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
        <CardTitle>Record a workout</CardTitle>
        <CardDescription>Finished one? Log it here. It helps your garden grow. 🌱</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor="session-template">Which workout?</Label>
            <NativeSelect id="session-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Something else</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="session-date">Day</Label>
              <Input id="session-date" type="date" className="w-44" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="session-start">Started at</Label>
              <Input id="session-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="session-minutes">Minutes</Label>
              <Input id="session-minutes" inputMode="numeric" className="w-24" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="session-notes">Notes (optional)</Label>
            <Input id="session-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : "Save workout"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
