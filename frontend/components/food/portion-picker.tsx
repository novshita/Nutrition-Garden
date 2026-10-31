"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApi } from "@/hooks/use-api";
import { buildUsdaItem, type UsdaItemPayload } from "@/lib/food";
import type { FoodDetailResponse, FoodItem } from "@/lib/types/api";

/** Choose how much of a USDA food. Mount with key={fdc_id} so each food starts fresh. */
export function PortionPicker({
  food,
  onAdd,
  onCancel,
}: {
  food: FoodItem;
  onAdd: (label: string, item: UsdaItemPayload) => void;
  onCancel: () => void;
}) {
  const detail = useApi<FoodDetailResponse>(`/food/${food.fdc_id}`);
  const portions = detail.data?.food.portions ?? [];
  const units = ["g", ...portions.map((p) => p.description)];

  const [quantity, setQuantity] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start with a sensible amount: one of the first portion, or 100 g.
  const effectiveUnit = unit ?? (portions.length > 0 ? portions[0].description : "g");
  const effectiveQuantity = quantity ?? (portions.length > 0 ? "1" : "100");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildUsdaItem(food.fdc_id, effectiveQuantity, effectiveUnit, units);
    if (!result.ok) {
      setError(result.errors.quantity ?? result.errors.unit ?? "Please check the amount.");
      return;
    }
    setError(null);
    onAdd(`${effectiveQuantity} ${effectiveUnit} · ${food.name}`, result.item);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <p className="font-medium">{food.name}</p>

      {detail.loading && <p className="text-sm text-muted-foreground">Loading portions…</p>}
      {detail.error && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{detail.error.message}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={detail.reload}>
              Try again
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              Back
            </Button>
          </div>
        </div>
      )}

      {detail.data && (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          {detail.data.stale && (
            <p className="text-xs text-muted-foreground">
              Showing saved information; the food database can&apos;t be reached right now.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="portion-quantity">Amount</Label>
              <Input
                id="portion-quantity"
                inputMode="decimal"
                className="w-28"
                value={effectiveQuantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <Label htmlFor="portion-unit">Unit</Label>
              <NativeSelect
                id="portion-unit"
                value={effectiveUnit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u === "g" ? "grams (g)" : u}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <div className="flex gap-2">
            <Button type="submit">Add to meal</Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
