import { describe, expect, it } from "vitest";
import {
  buildConfirmPayload,
  buildReviewItems,
  chosenFood,
  combineClarification,
  confidenceLabel,
  mealFromContext,
  suggestUnit,
  trimHistory,
  unitAfterChoosing,
  unitOptions,
  validateMessage,
  type ChatTurn,
  type ReviewItem,
} from "@/lib/ai";
import type { FoodInterpretationResponse, FoodItem } from "@/lib/types/api";

const egg: FoodItem = {
  fdc_id: 171287,
  name: "Egg, whole, raw, fresh",
  data_type: "SR Legacy",
  brand: null,
  portions: [
    { description: "1 large", gram_weight: 50 },
    { description: "1 cup", gram_weight: 243 },
  ],
  nutrition_per_100g: { calories: 143, protein_g: 12.6, carbohydrate_g: 0.7, fat_g: 9.5, fiber_g: 0, micronutrients: {} },
};

const toast: FoodItem = {
  fdc_id: 174000,
  name: "Bread, white, toasted",
  data_type: "SR Legacy",
  brand: null,
  portions: [{ description: "1 slice (28 g)", gram_weight: 28 }],
  nutrition_per_100g: { calories: 270, protein_g: 9, carbohydrate_g: 50, fat_g: 3, fiber_g: 2, micronutrients: {} },
};

const response: FoodInterpretationResponse = {
  interpretation: {
    items: [
      { food_name: "egg", quantity: 2, unit: "egg", preparation_method: "boiled", confidence: 0.95 },
      { food_name: "toast", quantity: 1, unit: "slice", preparation_method: null, confidence: 0.6 },
      { food_name: "rice", quantity: null, unit: null, preparation_method: null, confidence: 0.3 },
    ],
    meal_context: "breakfast",
    assumptions: [],
    needs_clarification: true,
    clarification_question: "How much rice?",
  },
  lookups: [
    { food_name: "egg", source: "usda", matches: [egg] },
    { food_name: "toast", source: "usda", matches: [toast] },
    { food_name: "rice", source: "cache", matches: [] },
  ],
};

describe("confidenceLabel", () => {
  it.each([
    [1, "High"],
    [0.8, "High"],
    [0.79, "Medium"],
    [0.5, "Medium"],
    [0.49, "Low"],
    [0, "Low"],
  ])("%s is %s", (value, label) => expect(confidenceLabel(value)).toBe(label));
});

describe("suggestUnit", () => {
  const portions = egg.portions;
  it("maps grams in all their spellings", () => {
    for (const word of ["g", "G", "gram", "grams", " gm "]) expect(suggestUnit(word, portions)).toBe("g");
  });
  it("finds the portion that contains the unit word", () => {
    expect(suggestUnit("cup", portions)).toBe("1 cup");
    expect(suggestUnit("cups", portions)).toBe("1 cup");
    expect(suggestUnit("slice", toast.portions)).toBe("1 slice (28 g)");
  });
  it("leaves it blank when nothing fits, rather than guessing", () => {
    expect(suggestUnit("bowl", portions)).toBe("");
    expect(suggestUnit("egg", portions)).toBe(""); // no portion says "egg"
    expect(suggestUnit(null, portions)).toBe("");
    expect(suggestUnit("", portions)).toBe("");
  });
  it("does not match part of a longer word", () => {
    expect(suggestUnit("cu", portions)).toBe("");
  });
  it("copes with unusual text", () => {
    expect(suggestUnit("(", portions)).toBe("");
    expect(suggestUnit("a.b", portions)).toBe("");
  });
});

describe("buildReviewItems", () => {
  const items = buildReviewItems(response);

  it("makes one row per food with the AI's reading, and chooses nothing for the person", () => {
    expect(items.map((i) => i.name)).toEqual(["egg", "toast", "rice"]);
    expect(items.every((i) => i.choice === "")).toBe(true);
    expect(items[0]).toMatchObject({ quantity: "2", unit: "egg", preparation: "boiled", confidence: 0.95 });
  });

  it("keeps unknown amounts blank instead of inventing them", () => {
    expect(items[2].quantity).toBe("");
    expect(items[2].unit).toBe("");
  });

  it("attaches the database matches found for each food", () => {
    expect(items[0].matches.map((m) => m.fdc_id)).toEqual([171287]);
    expect(items[2].matches).toEqual([]);
  });
});

describe("choosing a match", () => {
  const item = (overrides: Partial<ReviewItem> = {}): ReviewItem => ({
    ...buildReviewItems(response)[0],
    ...overrides,
  });

  it("offers grams plus the food's own portions", () => {
    expect(unitOptions(egg)).toEqual(["g", "1 large", "1 cup"]);
    expect(unitOptions(undefined)).toEqual(["g"]);
  });

  it("finds the chosen food", () => {
    expect(chosenFood(item({ choice: "usda:171287" }))?.name).toContain("Egg");
    expect(chosenFood(item({ choice: "usda:1" }))).toBeUndefined();
    expect(chosenFood(item({ choice: "custom" }))).toBeUndefined();
  });

  it("keeps a unit that fits and otherwise asks again", () => {
    expect(unitAfterChoosing(item({ unit: "g" }), egg)).toBe("g");
    expect(unitAfterChoosing(item({ unit: "cup" }), egg)).toBe("1 cup");
    expect(unitAfterChoosing(item({ unit: "egg" }), egg)).toBe("");
  });
});

describe("buildConfirmPayload", () => {
  const base = buildReviewItems(response);
  const ready = (): ReviewItem[] => [
    { ...base[0], choice: "usda:171287", unit: "1 large", quantity: "2" },
    { ...base[1], choice: "usda:174000", unit: "1 slice (28 g)", quantity: "1" },
    { ...base[2], choice: "custom", quantity: "1", unit: "bowl", customCalories: "200" },
  ];

  it("builds exactly what the confirm endpoint expects", () => {
    const result = buildConfirmPayload(ready(), "BREAKFAST", "  two eggs, toast and rice  ");
    expect(result).toEqual({
      ok: true,
      body: {
        confirmed: true,
        meal_type: "BREAKFAST",
        original_text: "two eggs, toast and rice",
        items: [
          { food_source: "USDA", fdc_id: 171287, quantity: 2, unit: "1 large", confidence: 0.95 },
          { food_source: "USDA", fdc_id: 174000, quantity: 1, unit: "1 slice (28 g)", confidence: 0.6 },
          { food_source: "CUSTOM", food_name: "rice", quantity: 1, unit: "bowl", calories: 200, confidence: 0.3 },
        ],
      },
    });
  });

  it("never sends a nutrition number for a database food; the backend calculates it", () => {
    const result = buildConfirmPayload(ready(), "LUNCH", "");
    if (!result.ok) throw new Error(result.error);
    const [first] = result.body.items;
    expect("calories" in first).toBe(false);
    expect("original_text" in result.body).toBe(false);
  });

  it("makes the person choose for every food", () => {
    const items = ready();
    items[1].choice = "";
    const result = buildConfirmPayload(items, "LUNCH", "");
    expect(!result.ok && result.error).toContain("toast");
  });

  it("won't save an amount or unit the person hasn't filled in", () => {
    const noAmount = ready();
    noAmount[0].quantity = "";
    expect(buildConfirmPayload(noAmount, "LUNCH", "").ok).toBe(false);
    const noUnit = ready();
    noUnit[0].unit = "";
    const result = buildConfirmPayload(noUnit, "LUNCH", "");
    expect(!result.ok && result.error).toContain("egg");
  });

  it("rejects a unit the chosen food doesn't offer", () => {
    const items = ready();
    items[0].unit = "handful";
    expect(buildConfirmPayload(items, "LUNCH", "").ok).toBe(false);
  });

  it("needs calories for a food entered by hand, and allows zero", () => {
    const items = ready();
    items[2].customCalories = "";
    expect(buildConfirmPayload(items, "LUNCH", "").ok).toBe(false);
    items[2].customCalories = "0";
    expect(buildConfirmPayload(items, "LUNCH", "").ok).toBe(true);
  });

  it("has nothing to save when there are no foods", () => {
    expect(buildConfirmPayload([], "LUNCH", "").ok).toBe(false);
  });

  it("trims very long original text to what the API accepts", () => {
    const result = buildConfirmPayload(ready(), "LUNCH", "x".repeat(1500));
    expect(result.ok && result.body.original_text?.length).toBe(1000);
  });
});

describe("combineClarification", () => {
  it("joins the answer to the first description so nothing is lost", () => {
    expect(combineClarification("I had a bowl of rice.", "A medium one")).toBe(
      "I had a bowl of rice. A medium one",
    );
    expect(combineClarification("I had a bowl of rice", "Medium")).toBe("I had a bowl of rice. Medium");
  });
  it("returns the original when there is no answer", () => {
    expect(combineClarification("  toast ", "  ")).toBe("toast");
  });
});

describe("chat history", () => {
  const turns = (n: number): ChatTurn[] =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` }));

  it("keeps only the latest turns the API accepts", () => {
    const trimmed = trimHistory(turns(15));
    expect(trimmed).toHaveLength(10);
    expect(trimmed[0].content).toBe("m5");
    expect(trimmed.at(-1)?.content).toBe("m14");
  });
  it("drops empty turns and trims overlong ones", () => {
    const trimmed = trimHistory([
      { role: "user", content: "   " },
      { role: "assistant", content: "x".repeat(2500) },
    ]);
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0].content).toHaveLength(2000);
  });
  it("validates a message", () => {
    expect(validateMessage("hello", 2000)).toBeNull();
    expect(validateMessage("   ", 2000)).toContain("something");
    expect(validateMessage("x".repeat(2001), 2000)).toContain("2,000");
    expect(validateMessage("x".repeat(2000), 2000)).toBeNull();
  });
});

describe("mealFromContext", () => {
  it("reads a clear hint", () => {
    expect(mealFromContext("breakfast")).toBe("BREAKFAST");
    expect(mealFromContext("A late Snack")).toBe("SNACK");
    expect(mealFromContext("dinner with friends")).toBe("DINNER");
  });
  it("doesn't guess when it's unclear", () => {
    expect(mealFromContext("lunch or dinner")).toBeNull();
    expect(mealFromContext("brunch")).toBeNull();
    expect(mealFromContext(null)).toBeNull();
    expect(mealFromContext("")).toBeNull();
  });
});
