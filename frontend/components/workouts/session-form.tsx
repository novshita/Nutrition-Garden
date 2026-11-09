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
import {
  addSetRow,
  buildSessionPayload,
  buildSetPayloads,
  setRowsForTemplate,
  type SetRow,
} from "@/lib/workouts";

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
  const [trackSets, setTrackSets] = useState(false);
  const [rows, setRows] = useState<SetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const template = templates.find((t) => t.id === templateId);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const chosen = templates.find((t) => t.id === id);
    setRows(chosen ? setRowsForTemplate(chosen) : []);
    if (!chosen) setTrackSets(false);
  }

  const updateRow = (key: string, changes: Partial<SetRow>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const setResult = trackSets ? buildSetPayloads(rows) : { ok: true as const, sets: [] };
    if (!setResult.ok) {
      setError(setResult.error);
      return;
    }
    const result = buildSessionPayload({
      templateId,
      date,
      startTime,
      minutes,
      notes,
      timeZone,
      sets: setResult.sets,
    });
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
      setTrackSets(false);
      setRows(template ? setRowsForTemplate(template) : []);
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
            <NativeSelect id="session-template" value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
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
          {template && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={trackSets}
                  onChange={(e) => setTrackSets(e.target.checked)}
                />
                Record each set (optional)
              </label>
              {trackSets && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Tick the sets you did. The numbers start from your plan; change them to what actually
                    happened. Sets you leave unticked aren&apos;t recorded.
                  </p>
                  {template.exercises.map((exercise) => (
                    <fieldset key={exercise.id} className="flex flex-col gap-2 rounded-xl border p-3">
                      <legend className="px-1 text-sm font-medium">{exercise.exercise_name}</legend>
                      {rows
                        .filter((row) => row.exerciseId === exercise.id)
                        .map((row) => (
                          <SetRowView key={row.key} row={row} onChange={(changes) => updateRow(row.key, changes)} />
                        ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="self-start"
                        onClick={() => setRows((current) => addSetRow(current, template, exercise.id) ?? current)}
                      >
                        + Add a set
                      </Button>
                    </fieldset>
                  ))}
                </div>
              )}
            </div>
          )}
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

function SetRowView({ row, onChange }: { row: SetRow; onChange: (changes: Partial<SetRow>) => void }) {
  const name = `${row.exerciseName}, set ${row.setNumber}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-w-24 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={row.done}
          aria-label={`${name} done`}
          onChange={(e) => onChange({ done: e.target.checked })}
        />
        Set {row.setNumber}
      </label>
      {row.type !== "TIME" && (
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Reps</span>
          <Input
            inputMode="numeric"
            className="w-20"
            aria-label={`${name} reps`}
            value={row.reps}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
        </label>
      )}
      {row.type !== "REPS" && (
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Seconds</span>
          <Input
            inputMode="numeric"
            className="w-20"
            aria-label={`${name} seconds`}
            value={row.seconds}
            onChange={(e) => onChange({ seconds: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
