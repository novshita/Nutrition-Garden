"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateFormView } from "@/components/workouts/template-form";
import { api, ApiError } from "@/lib/api/client";
import type { WorkoutTemplate } from "@/lib/types/api";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, describeExercise, formFromTemplate } from "@/lib/workouts";

export function TemplateList({
  templates,
  onChanged,
}: {
  templates: WorkoutTemplate[];
  /** Called after an edit or delete, so the plan and history can refresh too. */
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(template: WorkoutTemplate) {
    setBusy(true);
    setError(null);
    try {
      await api(`/workouts/templates/${template.id}`, { method: "DELETE" });
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
        <CardTitle>Your workouts</CardTitle>
        <CardDescription>
          {templates.length === 0
            ? "No workouts yet. Create your first one below."
            : "Pick these in your weekly plan or when you record a session."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
        {templates.map((template) =>
          editingId === template.id ? (
            <TemplateFormView
              key={template.id}
              editing={{ id: template.id, form: formFromTemplate(template) }}
              onSaved={() => {
                setEditingId(null);
                onChanged();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <section key={template.id} className="flex flex-col gap-1" aria-label={template.name}>
              <h3 className="font-medium">
                {template.name}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {DIFFICULTY_LABELS[template.difficulty]}
                </span>
              </h3>
              {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
              <ul className="flex flex-col gap-1 text-sm">
                {template.exercises.map((exercise) => (
                  <li key={exercise.id} className="rounded-lg bg-secondary px-3 py-1.5">
                    {exercise.exercise_name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {describeExercise(exercise)} · {CATEGORY_LABELS[exercise.category]}
                    </span>
                  </li>
                ))}
              </ul>
              {confirmingId === template.id ? (
                <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                  <p>
                    Delete &ldquo;{template.name}&rdquo;? It will also leave your weekly plan. Workouts you&apos;ve
                    already recorded stay in your history.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => remove(template)}
                    >
                      {busy ? "Deleting…" : "Yes, delete it"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmingId(null)}>
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Edit ${template.name}`}
                    onClick={() => {
                      setEditingId(template.id);
                      setConfirmingId(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${template.name}`}
                    onClick={() => {
                      setConfirmingId(template.id);
                      setEditingId(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </section>
          ),
        )}
      </CardContent>
    </Card>
  );
}
