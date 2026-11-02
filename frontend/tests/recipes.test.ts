import { describe, expect, it } from "vitest";
import {
  buildLogPayload,
  buildRecipePayload,
  describeRecipeNutrition,
  emptyRecipeForm,
  formFromRecipe,
  linesToList,
  recipeFromIdea,
  type RecipeForm,
} from "@/lib/recipes";
import type { MealRecommendation, Recipe } from "@/lib/types/api";

const form = (overrides: Partial<RecipeForm> = {}): RecipeForm => ({
  ...emptyRecipeForm(),
  name: "Peanut butter oats",
  ...overrides,
});

describe("linesToList", () => {
  it("splits on new lines, trims and drops blanks", () => {
    expect(linesToList("  1 cup oats \n\n 2 tbsp peanut butter\r\n   \nmilk")).toEqual([
      "1 cup oats",
      "2 tbsp peanut butter",
      "milk",
    ]);
    expect(linesToList("")).toEqual([]);
  });
});

describe("buildRecipePayload", () => {
  it("builds a complete recipe", () => {
    const result = buildRecipePayload(
      form({
        description: " Creamy ",
        servings: "2",
        servingSize: "1 bowl",
        calories: "400",
        protein: "20",
        carbs: "50",
        fat: "15",
        fiber: "8",
        ingredients: "oats\nmilk",
        alternatives: "almond butter",
        instructions: " Cook it. ",
      }),
    );
    expect(result).toEqual({
      ok: true,
      payload: {
        name: "Peanut butter oats",
        description: "Creamy",
        servings: 2,
        serving_size: "1 bowl",
        calories: 400,
        protein_g: 20,
        carbohydrate_g: 50,
        fat_g: 15,
        fiber_g: 8,
        ingredients: ["oats", "milk"],
        alternatives: ["almond butter"],
        instructions: "Cook it.",
      },
    });
  });

  it("leaves unknown nutrition out; a typed 0 is a real zero", () => {
    const blank = buildRecipePayload(form());
    if (!blank.ok) throw new Error(blank.error);
    for (const key of ["calories", "protein_g", "carbohydrate_g", "fat_g", "fiber_g", "description", "instructions"]) {
      expect(key in blank.payload).toBe(false);
    }
    const zero = buildRecipePayload(form({ protein: "0", fiber: "0,0" }));
    expect(zero.ok && zero.payload.protein_g).toBe(0);
    expect(zero.ok && zero.payload.fiber_g).toBe(0);
  });

  it("accepts decimal commas", () => {
    const result = buildRecipePayload(form({ calories: "350,5" }));
    expect(result.ok && result.payload.calories).toBe(350.5);
  });

  it.each([
    [{ name: "   " }, "name"],
    [{ name: "x".repeat(101) }, "name"],
    [{ description: "x".repeat(501) }, "description"],
    [{ servingSize: "x".repeat(101) }, "serving size"],
    [{ servings: "0" }, "servings"],
    [{ servings: "51" }, "servings"],
    [{ servings: "1.5" }, "servings"],
    [{ servings: "" }, "servings"],
    [{ calories: "-1" }, "Calories"],
    [{ calories: "2001" }, "Calories"],
    [{ calories: "lots" }, "Calories"],
    [{ protein: "501" }, "Protein"],
    [{ carbs: "x" }, "Carbohydrates"],
    [{ fat: "-2" }, "Fat"],
    [{ fiber: "501" }, "Fibre"],
    [{ ingredients: Array(51).fill("x").join("\n") }, "ingredients"],
    [{ alternatives: Array(11).fill("x").join("\n") }, "alternatives"],
    [{ ingredients: "x".repeat(201) }, "under 200"],
    [{ instructions: "x".repeat(5001) }, "instructions"],
  ])("rejects %j", (overrides, mention) => {
    const result = buildRecipePayload(form(overrides));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.toLowerCase()).toContain(String(mention).toLowerCase());
  });

  it("accepts every limit exactly", () => {
    const result = buildRecipePayload(
      form({
        name: "x".repeat(100),
        servings: "50",
        calories: "2000",
        protein: "500",
        ingredients: Array(50).fill("x".repeat(200)).join("\n"),
        alternatives: Array(10).fill("y").join("\n"),
        instructions: "z".repeat(5000),
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("formFromRecipe", () => {
  const recipe: Recipe = {
    id: "r1",
    name: "Dal",
    description: null,
    servings: 4,
    serving_size: "1 bowl",
    calories: 300,
    protein_g: null,
    carbohydrate_g: 40,
    fat_g: null,
    fiber_g: 0,
    ingredients: ["lentils", "rice"],
    alternatives: [],
    instructions: "Boil.",
  };

  it("fills the form from a saved recipe, with unknown values blank and zeros kept", () => {
    expect(formFromRecipe(recipe)).toMatchObject({
      name: "Dal",
      description: "",
      servings: "4",
      calories: "300",
      protein: "",
      carbs: "40",
      fiber: "0",
      ingredients: "lentils\nrice",
      alternatives: "",
    });
  });

  it("round-trips: editing and saving unchanged gives back the same recipe", () => {
    const result = buildRecipePayload(formFromRecipe(recipe));
    if (!result.ok) throw new Error(result.error);
    expect(result.payload).toEqual({
      name: "Dal",
      servings: 4,
      serving_size: "1 bowl",
      calories: 300,
      carbohydrate_g: 40,
      fiber_g: 0,
      ingredients: ["lentils", "rice"],
      alternatives: [],
      instructions: "Boil.",
    });
  });
});

describe("describeRecipeNutrition", () => {
  it("shows only what's known", () => {
    expect(describeRecipeNutrition({ calories: 400, protein_g: 20 })).toBe("About 400 kcal · 20 g protein per serving");
    expect(describeRecipeNutrition({ calories: 400, protein_g: null })).toBe("About 400 kcal per serving");
    expect(describeRecipeNutrition({ calories: null, protein_g: 12.4 })).toBe("About 12 g protein per serving");
    expect(describeRecipeNutrition({ calories: null, protein_g: null })).toBe("Nutrition not added yet");
    expect(describeRecipeNutrition({ calories: 0, protein_g: 0 })).toBe("About 0 kcal · 0 g protein per serving");
  });
});

describe("buildLogPayload", () => {
  it("accepts a sensible number of servings", () => {
    expect(buildLogPayload("1.5", "DINNER")).toEqual({ ok: true, payload: { servings: 1.5, meal_type: "DINNER" } });
    expect(buildLogPayload("0,5", "LUNCH")).toEqual({ ok: true, payload: { servings: 0.5, meal_type: "LUNCH" } });
    expect(buildLogPayload("0.25", "LUNCH").ok).toBe(true);
    expect(buildLogPayload("10", "LUNCH").ok).toBe(true);
  });
  it.each(["", "0", "-1", "0.2", "10.5", "abc"])("rejects %j", (text) => {
    expect(buildLogPayload(text, "LUNCH").ok).toBe(false);
  });
});

describe("recipeFromIdea", () => {
  const idea: MealRecommendation = {
    title: "  Peanut butter toast  ",
    description: "Two slices with peanut butter.",
    estimated_calories: 450,
    estimated_protein: 15,
    reasoning: "Easy and filling.",
    ingredients: ["bread", "  peanut butter ", ""],
    alternatives: ["almond butter"],
    confidence: 0.7,
  };

  it("turns an idea into a recipe, labelled as the fairy's rough estimate", () => {
    const recipe = recipeFromIdea(idea);
    expect(recipe).toMatchObject({
      name: "Peanut butter toast",
      servings: 1,
      calories: 450,
      protein_g: 15,
      ingredients: ["bread", "peanut butter"],
      alternatives: ["almond butter"],
    });
    expect(recipe.description).toContain("rough estimates");
    expect(recipe.description?.length).toBeLessThanOrEqual(500);
  });

  it("leaves out estimates a recipe can't hold instead of squashing them to fit", () => {
    const recipe = recipeFromIdea({ ...idea, estimated_calories: 2500, estimated_protein: 600 });
    expect("calories" in recipe).toBe(false);
    expect("protein_g" in recipe).toBe(false);
    expect("protein_g" in recipeFromIdea({ ...idea, estimated_protein: null })).toBe(false);
  });

  it("always fits what the API accepts", () => {
    const long = recipeFromIdea({
      ...idea,
      title: "t".repeat(300),
      description: "d".repeat(900),
      ingredients: Array(80).fill("i".repeat(300)),
      alternatives: Array(20).fill("a".repeat(300)),
    });
    expect(long.name.length).toBeLessThanOrEqual(100);
    expect(long.description!.length).toBeLessThanOrEqual(500);
    expect(long.ingredients).toHaveLength(50);
    expect(long.alternatives).toHaveLength(10);
    expect(long.ingredients.every((line) => line.length <= 200)).toBe(true);
  });

  it("gives an empty title a name", () => {
    expect(recipeFromIdea({ ...idea, title: "   " }).name).toBe("Meal idea");
  });
});
