"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import type { Difficulty, ExerciseCategory, ExerciseType } from "@/lib/types/api";
import {
  buildTemplatePayload,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  emptyExercise,
  TYPE_LABELS,
  type ExerciseForm,
  type TemplateForm,
} from "@/lib/workouts";

const newForm = (): TemplateForm => ({
  name: "",
  description: "",
  difficulty: "CUSTOM",
  exercises: [emptyExercise(crypto.randomUUID())],
});

export function TemplateFormView({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<TemplateForm>(newForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateExercise = (key: string, changes: Partial<ExerciseForm>) =>
    setForm((current) => ({
      ...current,
      exercises: current.exercises.map((e) => (e.key === key ? { ...e, ...changes } : e)),
    }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildTemplatePayload(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/workouts/templates", { method: "POST", body: result.payload });
      setForm(newForm());
      onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a workout</CardTitle>
        <CardDescription>
          Home-friendly moves work best: bodyweight, cardio, mobility, stretching. No equipment needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <Label htmlFor="tpl-name">Name</Label>
              <Input id="tpl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tpl-difficulty">Difficulty</Label>
              <NativeSelect
                id="tpl-difficulty"
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
              >
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="tpl-desc">Description (optional)</Label>
            <Input
              id="tpl-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-3">
            {form.exercises.map((exercise, index) => {
              const id = (name: string) => `ex-${exercise.key}-${name}`;
              return (
                <fieldset key={exercise.key} className="flex flex-col gap-3 rounded-xl border p-3">
                  <legend className="px-1 text-sm font-medium">Exercise {index + 1}</legend>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex min-w-40 flex-1 flex-col gap-1">
                      <Label htmlFor={id("name")}>Name</Label>
                      <Input
                        id={id("name")}
                        value={exercise.name}
                        onChange={(e) => updateExercise(exercise.key, { name: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={id("type")}>Type</Label>
                      <NativeSelect
                        id={id("type")}
                        value={exercise.type}
                        onChange={(e) => updateExercise(exercise.key, { type: e.target.value as ExerciseType })}
                      >
                        {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={id("category")}>Focus</Label>
                      <NativeSelect
                        id={id("category")}
                        value={exercise.category}
                        onChange={(e) =>
                          updateExercise(exercise.key, { category: e.target.value as ExerciseCategory })
                        }
                      >
                        {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <NumberField label="Sets" id={id("sets")} value={exercise.sets} onChange={(v) => updateExercise(exercise.key, { sets: v })} />
                    {exercise.type !== "TIME" && (
                      <NumberField label="Reps" id={id("reps")} value={exercise.reps} onChange={(v) => updateExercise(exercise.key, { reps: v })} />
                    )}
                    {exercise.type !== "REPS" && (
                      <NumberField label="Seconds" id={id("seconds")} value={exercise.seconds} onChange={(v) => updateExercise(exercise.key, { seconds: v })} />
                    )}
                    <NumberField label="Rest (s)" id={id("rest")} value={exercise.rest} onChange={(v) => updateExercise(exercise.key, { rest: v })} />
                  </div>
                  {form.exercises.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="self-start"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          exercises: current.exercises.filter((e) => e.key !== exercise.key),
                        }))
                      }
                    >
                      Remove exercise
                    </Button>
                  )}
                </fieldset>
              );
            })}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  exercises: [...current.exercises, emptyExercise(crypto.randomUUID())],
                }))
              }
            >
              + Add another exercise
            </Button>
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

function NumberField({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="numeric" className="w-20" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
