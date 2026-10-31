/** Food logging rules: build the items the API expects, or say what's wrong. */

import { parseNumber } from "@/lib/onboarding";
import type { MealType } from "@/lib/types/api";

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

export const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

/** A sensible starting meal for the time of day. Always changeable. */
export function defaultMealType(hour: number): MealType {
  if (hour < 10) return "BREAKFAST";
  if (hour < 15) return "LUNCH";
  if (hour < 18) return "SNACK";
  return "DINNER";
}

// The same limits the backend enforces. The backend remains the authority.
const MAX_QUANTITY = 100_000;
const MAX_CALORIES = 20_000;
const MAX_NUTRIENT_G = 5_000;

export type UsdaItemPayload = { food_source: "USDA"; fdc_id: number; quantity: number; unit: string };

export type CustomItemPayload = {
  food_source: "CUSTOM";
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g?: number;
  carbohydrate_g?: number;
  fat_g?: number;
  fiber_g?: number;
};

export type FoodItemPayload = UsdaItemPayload | CustomItemPayload;

export type CustomFoodForm = {
  name: string;
  quantity: string;
  unit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
};

export const emptyCustomFood = (): CustomFoodForm => ({
  name: "",
  quantity: "1",
  unit: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
});

type Result<T, K extends string> = { ok: true; item: T } | { ok: false; errors: Partial<Record<K, string>> };

function checkQuantity(text: string): { value?: number; error?: string } {
  const value = parseNumber(text);
  if (value === null || value <= 0 || value > MAX_QUANTITY) {
    return { error: "Please enter an amount greater than zero." };
  }
  return { value };
}

export function buildUsdaItem(
  fdcId: number,
  quantityText: string,
  unit: string,
  allowedUnits: string[],
): Result<UsdaItemPayload, "quantity" | "unit"> {
  const errors: Partial<Record<"quantity" | "unit", string>> = {};
  const quantity = checkQuantity(quantityText);
  if (quantity.error) errors.quantity = quantity.error;
  if (!allowedUnits.includes(unit)) errors.unit = "Please choose a unit.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    item: { food_source: "USDA", fdc_id: fdcId, quantity: quantity.value as number, unit },
  };
}

/** Nutrients left blank stay unknown (omitted). Only a typed 0 is sent as zero. */
export function buildCustomItem(form: CustomFoodForm): Result<CustomItemPayload, keyof CustomFoodForm> {
  const errors: Partial<Record<keyof CustomFoodForm, string>> = {};

  const name = form.name.trim();
  if (!name || name.length > 200) errors.name = "Please give the food a name.";
  const unit = form.unit.trim();
  if (!unit || unit.length > 50) errors.unit = "Please say what the amount is in, like “bowl” or “g”.";
  const quantity = checkQuantity(form.quantity);
  if (quantity.error) errors.quantity = quantity.error;

  const calories = parseNumber(form.calories);
  if (calories === null || calories < 0 || calories > MAX_CALORIES) {
    errors.calories = `Please enter calories between 0 and ${MAX_CALORIES.toLocaleString("en-US")}.`;
  }

  const optional = (text: string, key: keyof CustomFoodForm): number | undefined => {
    if (text.trim() === "") return undefined;
    const value = parseNumber(text);
    if (value === null || value < 0 || value > MAX_NUTRIENT_G) {
      errors[key] = `Leave this blank if you don't know it, or enter 0 to ${MAX_NUTRIENT_G.toLocaleString("en-US")}.`;
      return undefined;
    }
    return value;
  };
  const protein = optional(form.protein, "protein");
  const carbs = optional(form.carbs, "carbs");
  const fat = optional(form.fat, "fat");
  const fiber = optional(form.fiber, "fiber");

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const item: CustomItemPayload = {
    food_source: "CUSTOM",
    food_name: name,
    quantity: quantity.value as number,
    unit,
    calories: calories as number,
  };
  if (protein !== undefined) item.protein_g = protein;
  if (carbs !== undefined) item.carbohydrate_g = carbs;
  if (fat !== undefined) item.fat_g = fat;
  if (fiber !== undefined) item.fiber_g = fiber;
  return { ok: true, item };
}

/** A total for display. `missing` is how many foods had no value, so the total is a minimum. */
export function describeTotal(value: number | null, missing: number, unit: string): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${missing > 0 ? "at least " : ""}${rounded} ${unit}`.trim();
}
