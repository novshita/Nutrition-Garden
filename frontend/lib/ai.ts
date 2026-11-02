/**
 * AI screens: turning the AI's proposal into something the person reviews, and back into the exact
 * items the API expects. The AI never saves anything; the person confirms (engineering spec §21).
 */

import { buildCustomItem, buildUsdaItem, emptyCustomFood, type FoodItemPayload } from "@/lib/food";
import type {
  FoodInterpretationResponse,
  FoodItem,
  MealType,
  MemoryCategory,
  Portion,
} from "@/lib/types/api";

// Reviewing a proposal -----------------------------------------------------------------------

export type ReviewItem = {
  key: string;
  name: string;
  preparation: string | null;
  confidence: number;
  quantity: string;
  unit: string;
  /** "" nothing chosen yet, "usda:<fdc_id>", or "custom" (the person types the calories). */
  choice: string;
  customCalories: string;
  matches: FoodItem[];
};

export function confidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

const GRAM_WORDS = new Set(["g", "gm", "gram", "grams"]);

/**
 * The portion that best matches a unit the AI used ("cup" -> "1 cup"), "g" for grams, or "" when
 * nothing fits, so the person chooses instead of the app guessing.
 */
export function suggestUnit(aiUnit: string | null, portions: Portion[]): string {
  const unit = (aiUnit ?? "").trim().toLowerCase().replace(/s$/, "");
  if (!unit) return "";
  if (GRAM_WORDS.has(unit) || GRAM_WORDS.has(`${unit}s`)) return "g";
  const word = new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i");
  return portions.find((portion) => word.test(portion.description))?.description ?? "";
}

/** One review row per interpreted food. Nothing is chosen for the person. */
export function buildReviewItems(response: FoodInterpretationResponse): ReviewItem[] {
  return response.interpretation.items.map((item, index) => {
    const matches = response.lookups.find((l) => l.food_name === item.food_name)?.matches ?? [];
    return {
      key: `${index}-${item.food_name}`,
      name: item.food_name,
      preparation: item.preparation_method,
      confidence: item.confidence,
      quantity: item.quantity === null ? "" : String(item.quantity),
      unit: item.unit ?? "",
      choice: "",
      customCalories: "",
      matches,
    };
  });
}

/** Unit choices for a chosen database food: grams, plus the food's own portions. */
export function unitOptions(food: FoodItem | undefined): string[] {
  return ["g", ...(food?.portions.map((p) => p.description) ?? [])];
}

export function chosenFood(item: ReviewItem): FoodItem | undefined {
  if (!item.choice.startsWith("usda:")) return undefined;
  const id = Number(item.choice.slice(5));
  return item.matches.find((m) => m.fdc_id === id);
}

/** What happens to the unit when a database match is picked: keep it if valid, else suggest one. */
export function unitAfterChoosing(item: ReviewItem, food: FoodItem): string {
  const options = unitOptions(food);
  return options.includes(item.unit) ? item.unit : suggestUnit(item.unit, food.portions);
}

export function buildConfirmPayload(
  items: ReviewItem[],
  mealType: MealType,
  originalText: string,
): { ok: true; body: ConfirmBody } | { ok: false; error: string } {
  if (items.length === 0) return { ok: false, error: "There's nothing to save yet." };

  const payload: FoodItemPayload[] = [];
  for (const item of items) {
    if (item.choice === "") {
      return { ok: false, error: `Please choose what “${item.name}” was, or enter its calories yourself.` };
    }
    if (item.choice === "custom") {
      const result = buildCustomItem({
        ...emptyCustomFood(),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.customCalories,
      });
      if (!result.ok) {
        const message = Object.values(result.errors)[0] ?? "Please check the details.";
        return { ok: false, error: `${item.name}: ${message}` };
      }
      payload.push({ ...result.item, confidence: item.confidence });
      continue;
    }
    const food = chosenFood(item);
    if (!food) return { ok: false, error: `Please choose what “${item.name}” was.` };
    const result = buildUsdaItem(food.fdc_id, item.quantity, item.unit, unitOptions(food));
    if (!result.ok) {
      const message = result.errors.quantity ?? result.errors.unit ?? "Please check the amount.";
      return { ok: false, error: `${item.name}: ${message}` };
    }
    payload.push({ ...result.item, confidence: item.confidence });
  }

  const text = originalText.trim();
  return {
    ok: true,
    body: {
      confirmed: true,
      meal_type: mealType,
      ...(text ? { original_text: text.slice(0, 1000) } : {}),
      items: payload,
    },
  };
}

export type ConfirmBody = {
  confirmed: true;
  meal_type: MealType;
  original_text?: string;
  items: FoodItemPayload[];
};

/** The AI keeps no memory between requests, so a follow-up answer goes back with the first text. */
export function combineClarification(original: string, answer: string): string {
  const a = original.trim().replace(/[.!?]*$/, "");
  const b = answer.trim();
  return b ? `${a}. ${b}` : a;
}

/** A meal type from the AI's loose hint ("breakfast", "a late snack"), or null if it isn't clear. */
export function mealFromContext(context: string | null): MealType | null {
  const text = (context ?? "").toLowerCase();
  const found = (["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const).filter((meal) =>
    text.includes(meal.toLowerCase()),
  );
  return found.length === 1 ? found[0] : null; // two hints at once means we don't guess
}

// Chat ----------------------------------------------------------------------------------------

export const MAX_CHAT_MESSAGE = 2000;
export const MAX_CHAT_HISTORY = 10;
export const MAX_FOOD_TEXT = 1000;

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** The most recent turns the API accepts, with any empty ones dropped. */
export function trimHistory(turns: ChatTurn[]): ChatTurn[] {
  return turns
    .filter((turn) => turn.content.trim() !== "")
    .slice(-MAX_CHAT_HISTORY)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_CHAT_MESSAGE) }));
}

export function validateMessage(text: string, limit: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Please write something first.";
  if (trimmed.length > limit) return `Please keep it under ${limit.toLocaleString("en-US")} characters.`;
  return null;
}

// Memories ------------------------------------------------------------------------------------

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  FOOD_LIKE: "Foods I like",
  FOOD_DISLIKE: "Foods I don't like",
  MEAL_PREFERENCE: "Meal preferences",
  ROUTINE: "Routines",
  OTHER: "Other",
};
export const MAX_MEMORY_TEXT = 200;
