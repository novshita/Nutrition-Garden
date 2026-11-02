"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import { MEAL_LABELS, MEAL_ORDER } from "@/lib/food";
import type { MealRecommendationResponse, MealType } from "@/lib/types/api";

export function MealIdeas() {
  const [note, setNote] = useState("");
  const [mealType, setMealType] = useState<MealType | "">("");
  const [result, setResult] = useState<MealRecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.length > 300) {
      setError("Please keep the note under 300 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<MealRecommendationResponse>("/ai/meal-recommendation", {
          method: "POST",
          body: { ...(note.trim() ? { note: note.trim() } : {}), ...(mealType ? { meal_type: mealType } : {}) },
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meal ideas</CardTitle>
        <CardDescription>Easy ideas that fit what&apos;s left of your day. Only suggestions, never rules.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={ask} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ideas-meal">Which meal? (optional)</Label>
              <NativeSelect id="ideas-meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType | "")}>
                <option value="">Any</option>
                {MEAL_ORDER.map((meal) => (
                  <option key={meal} value={meal}>
                    {MEAL_LABELS[meal]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <Label htmlFor="ideas-note">Anything in mind? (optional)</Label>
              <Input id="ideas-note" value={note} placeholder="something quick, no cooking…" onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Thinking…" : "Give me ideas"}
          </Button>
        </form>

        {result && (
          <div className="flex flex-col gap-3">
            {result.recommendations.map((idea) => (
              <section key={idea.title} className="flex flex-col gap-1 rounded-xl border p-3">
                <h3 className="font-medium">{idea.title}</h3>
                <p className="text-sm">{idea.description}</p>
                <p className="text-sm text-muted-foreground">
                  About {idea.estimated_calories} kcal
                  {idea.estimated_protein !== null && ` · about ${Math.round(idea.estimated_protein)} g protein`}
                </p>
                <p className="text-sm text-muted-foreground">{idea.reasoning}</p>
                {idea.ingredients.length > 0 && (
                  <p className="text-sm">
                    <span className="font-medium">You&apos;ll need: </span>
                    {idea.ingredients.join(", ")}
                  </p>
                )}
                {idea.alternatives.length > 0 && (
                  <p className="text-sm text-muted-foreground">Or try: {idea.alternatives.join("; ")}</p>
                )}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">{result.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
