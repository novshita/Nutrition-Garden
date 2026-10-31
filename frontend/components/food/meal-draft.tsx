"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import { defaultMealType, MEAL_LABELS, MEAL_ORDER, type FoodItemPayload } from "@/lib/food";
import type { FoodLog, MealType } from "@/lib/types/api";

export type DraftItem = { key: string; label: string; item: FoodItemPayload };

/** The meal being put together. Nothing is saved until "Save meal". */
export function MealDraft({
  items,
  onRemove,
  onSaved,
}: {
  items: DraftItem[];
  onRemove: (key: string) => void;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType(new Date().getHours()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api<FoodLog>("/food/log", {
        method: "POST",
        body: { meal_type: mealType, items: items.map((i) => i.item) },
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your meal</CardTitle>
        <CardDescription>
          {items.length === 0
            ? "Foods you add will gather here. Nothing is saved until you save the meal."
            : `${items.length} ${items.length === 1 ? "food" : "foods"} ready to save.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length > 0 && (
          <>
            <ul className="flex flex-col gap-2">
              {items.map((entry) => (
                <li
                  key={entry.key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span>{entry.label}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(entry.key)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1">
              <Label htmlFor="meal-type">Which meal?</Label>
              <NativeSelect
                id="meal-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
              >
                {MEAL_ORDER.map((meal) => (
                  <option key={meal} value={meal}>
                    {MEAL_LABELS[meal]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <p role="alert" className="min-h-5 text-sm text-destructive">
              {error}
            </p>
            <Button type="button" onClick={save} disabled={saving} className="self-start">
              {saving ? "Saving…" : "Save meal"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
