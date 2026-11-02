"use client";

import { useState } from "react";
import { RecipeFormView } from "@/components/recipes/recipe-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import { defaultMealType, MEAL_LABELS, MEAL_ORDER } from "@/lib/food";
import { formatInt } from "@/lib/format";
import { buildLogPayload, describeRecipeNutrition } from "@/lib/recipes";
import type { FoodLog, MealType, Recipe } from "@/lib/types/api";

export function RecipeCard({ recipe, onChanged }: { recipe: Recipe; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [servings, setServings] = useState("1");
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType(new Date().getHours()));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logServing() {
    const result = buildLogPayload(servings, mealType);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const log = await api<FoodLog>(`/recipes/${recipe.id}/log`, { method: "POST", body: result.payload });
      setMessage(`Logged 🌱 ${log.totals.calories === null ? "" : `${formatInt(log.totals.calories)} kcal added to today.`}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/recipes/${recipe.id}`, { method: "DELETE" });
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit {recipe.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipeFormView
            recipe={recipe}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{recipe.name}</CardTitle>
        <CardDescription>
          {describeRecipeNutrition(recipe)} · makes {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
          {recipe.serving_size && ` (${recipe.serving_size})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {recipe.description && <p className="text-sm">{recipe.description}</p>}

        {recipe.ingredients.length > 0 && (
          <div>
            <p className="text-sm font-medium">Ingredients</p>
            <ul className="list-disc pl-5 text-sm">
              {recipe.ingredients.map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {recipe.instructions && (
          <div>
            <p className="text-sm font-medium">Instructions</p>
            <p className="whitespace-pre-wrap text-sm">{recipe.instructions}</p>
          </div>
        )}
        {recipe.alternatives.length > 0 && (
          <p className="text-sm text-muted-foreground">Or try: {recipe.alternatives.join("; ")}</p>
        )}

        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-secondary p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`log-servings-${recipe.id}`}>Servings eaten</Label>
            <Input id={`log-servings-${recipe.id}`} inputMode="decimal" className="w-24" value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`log-meal-${recipe.id}`}>Meal</Label>
            <NativeSelect id={`log-meal-${recipe.id}`} value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              {MEAL_ORDER.map((meal) => (
                <option key={meal} value={meal}>
                  {MEAL_LABELS[meal]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="button" onClick={logServing} disabled={busy}>
            Log it
          </Button>
        </div>

        <p role="status" className="text-sm text-muted-foreground empty:hidden">
          {message}
        </p>
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirmingDelete ? (
            <>
              <span className="text-sm">Delete this recipe? Meals you&apos;ve already logged stay as they are.</span>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={remove}>
                Yes, delete
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
