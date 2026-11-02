"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api/client";
import { buildRecipePayload, emptyRecipeForm, formFromRecipe, type RecipeForm } from "@/lib/recipes";
import type { Recipe } from "@/lib/types/api";

const NUTRIENTS: { key: keyof RecipeForm; label: string }[] = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "protein", label: "Protein (g)" },
  { key: "carbs", label: "Carbohydrates (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "fiber", label: "Fibre (g)" },
];

/** Create a recipe, or edit one (pass `recipe`). */
export function RecipeFormView({
  recipe,
  onSaved,
  onCancel,
}: {
  recipe?: Recipe;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<RecipeForm>(() => (recipe ? formFromRecipe(recipe) : emptyRecipeForm()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof RecipeForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildRecipePayload(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (recipe) await api(`/recipes/${recipe.id}`, { method: "PUT", body: result.payload });
      else await api("/recipes", { method: "POST", body: result.payload });
      if (!recipe) setForm(emptyRecipeForm());
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const id = (name: string) => `recipe-${recipe?.id ?? "new"}-${name}`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id("name")}>Name</Label>
        <Input id={id("name")} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id("description")}>Description (optional)</Label>
        <Input id={id("description")} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={id("servings")}>Makes (servings)</Label>
          <Input id={id("servings")} inputMode="numeric" className="w-28" value={form.servings} onChange={(e) => set("servings", e.target.value)} />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor={id("size")}>What one serving is (optional)</Label>
          <Input id={id("size")} placeholder="1 bowl, about 300 g" value={form.servingSize} onChange={(e) => set("servingSize", e.target.value)} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Approximate nutrition per serving</legend>
        <p className="text-xs text-muted-foreground">
          Leave anything you&apos;re not sure about blank. Calories are needed to log a serving.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {NUTRIENTS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <Label htmlFor={id(field.key)}>{field.label}</Label>
              <Input id={id(field.key)} inputMode="decimal" value={form[field.key]} onChange={(e) => set(field.key, e.target.value)} />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor={id("ingredients")}>Ingredients (one per line)</Label>
        <Textarea id={id("ingredients")} value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id("instructions")}>Instructions (optional)</Label>
        <Textarea id={id("instructions")} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id("alternatives")}>Easy swaps or alternatives (one per line, optional)</Label>
        <Textarea id={id("alternatives")} value={form.alternatives} onChange={(e) => set("alternatives", e.target.value)} />
      </div>

      <p role="alert" className="min-h-5 text-sm text-destructive">
        {error}
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : recipe ? "Save changes" : "Save recipe"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
