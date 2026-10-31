"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildCustomItem,
  emptyCustomFood,
  type CustomFoodForm,
  type CustomItemPayload,
} from "@/lib/food";

const FIELDS: { key: keyof CustomFoodForm; label: string; optional?: boolean; numeric?: boolean }[] = [
  { key: "calories", label: "Calories (kcal)", numeric: true },
  { key: "protein", label: "Protein (g)", optional: true, numeric: true },
  { key: "carbs", label: "Carbohydrates (g)", optional: true, numeric: true },
  { key: "fat", label: "Fat (g)", optional: true, numeric: true },
  { key: "fiber", label: "Fibre (g)", optional: true, numeric: true },
];

export function CustomFoodFormView({
  onAdd,
}: {
  onAdd: (label: string, item: CustomItemPayload) => void;
}) {
  const [form, setForm] = useState<CustomFoodForm>(emptyCustomFood());
  const [errors, setErrors] = useState<Partial<Record<keyof CustomFoodForm, string>>>({});

  const set = (key: keyof CustomFoodForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildCustomItem(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onAdd(`${result.item.quantity} ${result.item.unit} · ${result.item.food_name}`, result.item);
    setForm(emptyCustomFood());
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <p className="text-sm text-muted-foreground">
        Add something home-cooked or not in the database. Enter the totals for the amount you ate;
        leave anything you don&apos;t know blank.
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="custom-name">Food</Label>
        <Input id="custom-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-quantity">Amount</Label>
          <Input
            id="custom-quantity"
            inputMode="decimal"
            className="w-24"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="custom-unit">In</Label>
          <Input
            id="custom-unit"
            placeholder="bowl, slice, g…"
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
          />
          {errors.unit && <p className="text-sm text-destructive">{errors.unit}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <Label htmlFor={`custom-${field.key}`}>
              {field.label}
              {field.optional && <span className="text-muted-foreground"> (optional)</span>}
            </Label>
            <Input
              id={`custom-${field.key}`}
              inputMode="decimal"
              value={form[field.key]}
              onChange={(e) => set(field.key, e.target.value)}
            />
            {errors[field.key] && <p className="text-sm text-destructive">{errors[field.key]}</p>}
          </div>
        ))}
      </div>
      <Button type="submit" className="self-start">
        Add to meal
      </Button>
    </form>
  );
}
