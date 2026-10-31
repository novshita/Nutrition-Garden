import { describe, expect, it } from "vitest";
import {
  buildCustomItem,
  buildUsdaItem,
  defaultMealType,
  describeTotal,
  emptyCustomFood,
  type CustomFoodForm,
} from "@/lib/food";

const form = (overrides: Partial<CustomFoodForm> = {}): CustomFoodForm => ({
  ...emptyCustomFood(),
  name: "Mum's dal",
  unit: "bowl",
  calories: "200",
  ...overrides,
});

describe("defaultMealType", () => {
  it.each([
    [6, "BREAKFAST"],
    [9, "BREAKFAST"],
    [10, "LUNCH"],
    [14, "LUNCH"],
    [15, "SNACK"],
    [17, "SNACK"],
    [18, "DINNER"],
    [23, "DINNER"],
    [2, "BREAKFAST"],
  ])("at %s o'clock suggests %s", (hour, meal) => {
    expect(defaultMealType(hour)).toBe(meal);
  });
});

describe("buildCustomItem", () => {
  it("sends only what was filled in; blank nutrients stay unknown, not zero", () => {
    const result = buildCustomItem(form());
    expect(result).toEqual({
      ok: true,
      item: { food_source: "CUSTOM", food_name: "Mum's dal", quantity: 1, unit: "bowl", calories: 200 },
    });
    if (result.ok) {
      for (const key of ["protein_g", "carbohydrate_g", "fat_g", "fiber_g"]) {
        expect(key in result.item).toBe(false);
      }
    }
  });

  it("sends a typed 0 as a real zero", () => {
    const result = buildCustomItem(form({ protein: "0", fiber: "0" }));
    expect(result.ok && result.item.protein_g).toBe(0);
    expect(result.ok && result.item.fiber_g).toBe(0);
  });

  it("maps every nutrient field and accepts decimal commas", () => {
    const result = buildCustomItem(
      form({ quantity: "1,5", protein: "8", carbs: "30,5", fat: "4", fiber: "6" }),
    );
    expect(result.ok && result.item).toMatchObject({
      quantity: 1.5,
      protein_g: 8,
      carbohydrate_g: 30.5,
      fat_g: 4,
      fiber_g: 6,
    });
  });

  it("allows zero calories (it's a real value) but requires the field", () => {
    expect(buildCustomItem(form({ calories: "0" })).ok).toBe(true);
    const missing = buildCustomItem(form({ calories: "" }));
    expect(!missing.ok && missing.errors.calories).toBeDefined();
  });

  it("reports every problem at once", () => {
    const result = buildCustomItem(
      form({ name: " ", unit: "", quantity: "0", calories: "-5", protein: "-1", fat: "abc" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["calories", "fat", "name", "protein", "quantity", "unit"].sort(),
      );
    }
  });

  it.each([
    ["calories", "20001"],
    ["calories", "lots"],
    ["quantity", "100001"],
    ["quantity", "-1"],
    ["protein", "5001"],
    ["carbs", "x"],
  ])("rejects %s = %s", (field, value) => {
    const result = buildCustomItem(form({ [field]: value } as Partial<CustomFoodForm>));
    expect(result.ok).toBe(false);
  });

  it("trims the name and unit", () => {
    const result = buildCustomItem(form({ name: "  Toast ", unit: " slice " }));
    expect(result.ok && result.item.food_name).toBe("Toast");
    expect(result.ok && result.item.unit).toBe("slice");
  });
});

describe("buildUsdaItem", () => {
  const units = ["g", "1 cup", "1/2 cup"];

  it("builds the item the API expects", () => {
    expect(buildUsdaItem(168878, "1.5", "1 cup", units)).toEqual({
      ok: true,
      item: { food_source: "USDA", fdc_id: 168878, quantity: 1.5, unit: "1 cup" },
    });
  });

  it("only allows units the food actually offers", () => {
    const result = buildUsdaItem(168878, "1", "handful", units);
    expect(!result.ok && result.errors.unit).toBeDefined();
  });

  it.each(["", "0", "-2", "abc", "100001"])("rejects the amount %j", (quantity) => {
    const result = buildUsdaItem(168878, quantity, "g", units);
    expect(!result.ok && result.errors.quantity).toBeDefined();
  });
});

describe("describeTotal", () => {
  it("shows a dash when nothing is known", () => {
    expect(describeTotal(null, 3, "g")).toBe("—");
  });
  it("says 'at least' when some foods had no value", () => {
    expect(describeTotal(15.25, 1, "g")).toBe("at least 15.3 g");
  });
  it("shows a plain number when everything was known, and keeps a real zero", () => {
    expect(describeTotal(15, 0, "g")).toBe("15 g");
    expect(describeTotal(0, 0, "g")).toBe("0 g");
  });
});
