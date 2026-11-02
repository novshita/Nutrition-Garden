/** Recipe rules: build the payloads the API expects, or say what's wrong. */

import { parseNumber } from "@/lib/onboarding";
import type { MealRecommendation, MealType, Recipe } from "@/lib/types/api";

// The same limits the backend enforces. The backend remains the authority.
export const LIMITS = {
  name: 100,
  description: 500,
  servings: { min: 1, max: 50 },
  servingSize: 100,
  calories: 2000,
  nutrientG: 500,
  ingredients: 50,
  alternatives: 10,
  line: 200,
  instructions: 5000,
  logServings: { min: 0.25, max: 10 },
} as const;

export type RecipeForm = {
  name: string;
  description: string;
  servings: string;
  servingSize: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  ingredients: string; // one per line
  alternatives: string; // one per line
  instructions: string;
};

export const emptyRecipeForm = (): RecipeForm => ({
  name: "",
  description: "",
  servings: "1",
  servingSize: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  ingredients: "",
  alternatives: "",
  instructions: "",
});

export type RecipePayload = {
  name: string;
  description?: string;
  servings: number;
  serving_size?: string;
  calories?: number;
  protein_g?: number;
  carbohydrate_g?: number;
  fat_g?: number;
  fiber_g?: number;
  ingredients: string[];
  alternatives: string[];
  instructions?: string;
};

export const linesToList = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const listToLines = (list: string[]): string => list.join("\n");

const text = (value: number | null): string => (value === null ? "" : String(value));

export function formFromRecipe(recipe: Recipe): RecipeForm {
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    servings: String(recipe.servings),
    servingSize: recipe.serving_size ?? "",
    calories: text(recipe.calories),
    protein: text(recipe.protein_g),
    carbs: text(recipe.carbohydrate_g),
    fat: text(recipe.fat_g),
    fiber: text(recipe.fiber_g),
    ingredients: listToLines(recipe.ingredients),
    alternatives: listToLines(recipe.alternatives),
    instructions: recipe.instructions ?? "",
  };
}

/** Nutrition left blank stays unknown (omitted); a typed 0 is a real zero. */
export function buildRecipePayload(
  form: RecipeForm,
): { ok: true; payload: RecipePayload } | { ok: false; error: string } {
  const name = form.name.trim();
  if (!name) return { ok: false, error: "Please give the recipe a name." };
  if (name.length > LIMITS.name) return { ok: false, error: `Keep the name under ${LIMITS.name} characters.` };
  if (form.description.trim().length > LIMITS.description) {
    return { ok: false, error: `Keep the description under ${LIMITS.description} characters.` };
  }
  if (form.servingSize.trim().length > LIMITS.servingSize) {
    return { ok: false, error: `Keep the serving size under ${LIMITS.servingSize} characters.` };
  }

  const servings = parseNumber(form.servings);
  if (servings === null || !Number.isInteger(servings) || servings < LIMITS.servings.min || servings > LIMITS.servings.max) {
    return { ok: false, error: `How many servings it makes should be a whole number from ${LIMITS.servings.min} to ${LIMITS.servings.max}.` };
  }

  const optional = (value: string, label: string, max: number): { value?: number; error?: string } => {
    if (value.trim() === "") return {};
    const n = parseNumber(value);
    if (n === null || n < 0 || n > max) {
      return { error: `${label} should be between 0 and ${max}, or left blank if you're not sure.` };
    }
    return { value: n };
  };
  const calories = optional(form.calories, "Calories", LIMITS.calories);
  const protein = optional(form.protein, "Protein", LIMITS.nutrientG);
  const carbs = optional(form.carbs, "Carbohydrates", LIMITS.nutrientG);
  const fat = optional(form.fat, "Fat", LIMITS.nutrientG);
  const fiber = optional(form.fiber, "Fibre", LIMITS.nutrientG);
  const failed = [calories, protein, carbs, fat, fiber].find((r) => r.error);
  if (failed) return { ok: false, error: failed.error as string };

  const ingredients = linesToList(form.ingredients);
  const alternatives = linesToList(form.alternatives);
  if (ingredients.length > LIMITS.ingredients) return { ok: false, error: `Up to ${LIMITS.ingredients} ingredients, please.` };
  if (alternatives.length > LIMITS.alternatives) return { ok: false, error: `Up to ${LIMITS.alternatives} alternatives, please.` };
  if ([...ingredients, ...alternatives].some((line) => line.length > LIMITS.line)) {
    return { ok: false, error: `Keep each ingredient or alternative under ${LIMITS.line} characters.` };
  }
  if (form.instructions.trim().length > LIMITS.instructions) {
    return { ok: false, error: `Keep the instructions under ${LIMITS.instructions} characters.` };
  }

  const payload: RecipePayload = { name, servings, ingredients, alternatives };
  if (form.description.trim()) payload.description = form.description.trim();
  if (form.servingSize.trim()) payload.serving_size = form.servingSize.trim();
  if (calories.value !== undefined) payload.calories = calories.value;
  if (protein.value !== undefined) payload.protein_g = protein.value;
  if (carbs.value !== undefined) payload.carbohydrate_g = carbs.value;
  if (fat.value !== undefined) payload.fat_g = fat.value;
  if (fiber.value !== undefined) payload.fiber_g = fiber.value;
  if (form.instructions.trim()) payload.instructions = form.instructions.trim();
  return { ok: true, payload };
}

/** "About 400 kcal · 20 g protein per serving", leaving out whatever isn't known. */
export function describeRecipeNutrition(recipe: Pick<Recipe, "calories" | "protein_g">): string {
  const parts: string[] = [];
  if (recipe.calories !== null) parts.push(`${Math.round(recipe.calories)} kcal`);
  if (recipe.protein_g !== null) parts.push(`${Math.round(recipe.protein_g)} g protein`);
  return parts.length === 0 ? "Nutrition not added yet" : `About ${parts.join(" · ")} per serving`;
}

// Logging a serving -------------------------------------------------------------------------

export function buildLogPayload(
  servingsText: string,
  mealType: MealType,
): { ok: true; payload: { servings: number; meal_type: MealType } } | { ok: false; error: string } {
  const servings = parseNumber(servingsText);
  const { min, max } = LIMITS.logServings;
  if (servings === null || servings < min || servings > max) {
    return { ok: false, error: `Please enter how many servings, from ${min} to ${max}.` };
  }
  return { ok: true, payload: { servings, meal_type: mealType } };
}

// A meal idea from the fairy, saved as a recipe ----------------------------------------------

const IDEA_NOTE = " (An idea from the fairy. The nutrition numbers are rough estimates.)";

/** A recipe to save from an idea. Estimates outside what a recipe allows are left out, not clamped. */
export function recipeFromIdea(idea: MealRecommendation): RecipePayload {
  const trimLine = (line: string) => line.trim().slice(0, LIMITS.line);
  const description = `${idea.description.trim().slice(0, LIMITS.description - IDEA_NOTE.length)}${IDEA_NOTE}`;
  const payload: RecipePayload = {
    name: idea.title.trim().slice(0, LIMITS.name) || "Meal idea",
    description,
    servings: 1,
    ingredients: idea.ingredients.map(trimLine).filter(Boolean).slice(0, LIMITS.ingredients),
    alternatives: idea.alternatives.map(trimLine).filter(Boolean).slice(0, LIMITS.alternatives),
  };
  if (idea.estimated_calories >= 0 && idea.estimated_calories <= LIMITS.calories) {
    payload.calories = idea.estimated_calories;
  }
  if (idea.estimated_protein !== null && idea.estimated_protein >= 0 && idea.estimated_protein <= LIMITS.nutrientG) {
    payload.protein_g = idea.estimated_protein;
  }
  return payload;
}
