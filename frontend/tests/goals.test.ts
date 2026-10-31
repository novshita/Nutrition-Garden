import { describe, expect, it } from "vitest";
import { buildTargetPayload, suggestionCopy } from "@/lib/goals";
import type { CalorieSuggestion } from "@/lib/types/api";

describe("buildTargetPayload", () => {
  it("accepts whole numbers, with thousands separators, inside the limits", () => {
    expect(buildTargetPayload("2300", "")).toEqual({ ok: true, payload: { target_kcal: 2300 } });
    expect(buildTargetPayload("2,300", "")).toEqual({ ok: true, payload: { target_kcal: 2300 } });
    expect(buildTargetPayload(" 1200 ", "").ok).toBe(true);
    expect(buildTargetPayload("6000", "").ok).toBe(true);
  });

  it("includes a trimmed reason only when given", () => {
    expect(buildTargetPayload("2300", "  felt hungrier ")).toEqual({
      ok: true,
      payload: { target_kcal: 2300, reason: "felt hungrier" },
    });
    const blank = buildTargetPayload("2300", "   ");
    expect(blank.ok && "reason" in blank.payload).toBe(false);
  });

  it.each(["", "abc", "1199", "6001", "0", "-2000", "2300.5", "1e3"])("rejects %j", (text) => {
    const result = buildTargetPayload(text, "");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("1,200 and 6,000");
  });

  it("rejects an overlong reason", () => {
    expect(buildTargetPayload("2300", "x".repeat(501)).ok).toBe(false);
  });
});

describe("suggestionCopy", () => {
  const base: CalorieSuggestion = {
    status: "NO_CHANGE_SUGGESTED",
    reason: null,
    trend_state: "INCREASING",
    weekly_change_kg: 0.3,
    evaluated_from: "2026-03-01",
    evaluated_to: "2026-03-28",
    weigh_in_days: 20,
    current_target_kcal: 2500,
    suggested_target_kcal: null,
    days_until_evaluation: null,
  };

  it("counts down the days when it's just too soon", () => {
    const copy = suggestionCopy({ ...base, status: "INSUFFICIENT_DATA", trend_state: "INSUFFICIENT_DATA", days_until_evaluation: 12 });
    expect(copy.body).toContain("12 more days");
    expect(copy.canAccept).toBe(false);
    expect(suggestionCopy({ ...base, status: "INSUFFICIENT_DATA", days_until_evaluation: 1 }).body).toContain("1 more day to go");
  });

  it("explains missing weigh-ins when time isn't the problem", () => {
    const copy = suggestionCopy({ ...base, status: "INSUFFICIENT_DATA", days_until_evaluation: null });
    expect(copy.body).toContain("more weigh-ins");
    expect(copy.canAccept).toBe(false);
  });

  it("offers the +100 suggestion and lets the person accept it", () => {
    const copy = suggestionCopy({
      ...base,
      status: "REVIEW_SUGGESTED",
      reason: "STABLE_WEIGHT",
      trend_state: "STABLE",
      suggested_target_kcal: 2600,
    });
    expect(copy.canAccept).toBe(true);
    expect(copy.body).toContain("2,600 kcal");
    expect(copy.body).toContain("+100");
    expect(copy.body).toContain("your call");
  });

  it("recommends a review without a number when weight is rising fast", () => {
    const copy = suggestionCopy({
      ...base,
      status: "REVIEW_SUGGESTED",
      reason: "WEIGHT_RISING_FAST",
      trend_state: "INCREASING_FAST",
    });
    expect(copy.canAccept).toBe(false);
    expect(copy.body).not.toMatch(/\d{3,}/); // no calorie figure is pushed
  });

  it("leaves things alone for steady progress and for a dip, without pressure", () => {
    expect(suggestionCopy(base).headline).toBe("Your goal looks fine for now");
    const dip = suggestionCopy({ ...base, trend_state: "DECREASING" });
    expect(dip.headline).toBe("Your goal is yours to adjust");
    expect(dip.canAccept).toBe(false);
  });

  it("never uses shaming words", () => {
    const states: CalorieSuggestion[] = [
      { ...base, status: "INSUFFICIENT_DATA", days_until_evaluation: 5 },
      { ...base, status: "REVIEW_SUGGESTED", reason: "STABLE_WEIGHT", suggested_target_kcal: 2600 },
      { ...base, status: "REVIEW_SUGGESTED", reason: "WEIGHT_RISING_FAST" },
      base,
      { ...base, trend_state: "DECREASING_FAST" },
    ];
    for (const s of states) {
      const { headline, body } = suggestionCopy(s);
      expect(`${headline} ${body}`).not.toMatch(/fail|bad|should have|too much|too little|lazy|behind/i);
    }
  });
});
