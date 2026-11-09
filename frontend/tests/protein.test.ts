import { describe, expect, it } from "vitest";
import { dayBarPercent, guideShort, guideText, weekDetail, weekHeadline } from "@/lib/protein";
import type { ProteinGuide, ProteinWeek } from "@/lib/types/api";

const guide: ProteinGuide = {
  weight_kg: 40,
  low_g_per_day: 48,
  high_g_per_day: 64,
  low_g_per_week: 336,
  high_g_per_week: 448,
};

const day = (n: number, protein: number | null, missing = 0) => ({
  date: `2026-03-${String(n).padStart(2, "0")}`,
  protein_g: protein,
  foods_missing_protein: missing,
});

function week(over: Partial<ProteinWeek> = {}): ProteinWeek {
  return {
    start_date: "2026-03-04",
    end_date: "2026-03-10",
    days: [day(4, 20), day(5, null), day(6, 40), day(7, null), day(8, null), day(9, null), day(10, 60)],
    total_g: 120,
    days_with_protein: 3,
    average_g_per_day: 40,
    foods_missing_protein: 0,
    guide,
    ...over,
  };
}

describe("the gentle reminder", () => {
  it("says what many people aim for at this weight, and that it is not a goal", () => {
    expect(guideText(guide, "METRIC")).toBe(
      "A gentle reminder: at 40 kg, many people aim for roughly 48–64 g of protein a day. It's a guide, not a goal.",
    );
  });
  it("shows the weight in the person's own units", () => {
    expect(guideText(guide, "IMPERIAL")).toContain("88.2 lb");
  });
  it("has a short form for the dashboard", () => {
    expect(guideShort(guide)).toBe("a gentle guide for you: about 48–64 g a day");
  });
  it("never uses the word target", () => {
    expect(guideText(guide, "METRIC").toLowerCase()).not.toContain("target");
    expect(guideShort(guide).toLowerCase()).not.toContain("target");
  });
});

describe("the week's summary", () => {
  it("headlines the total", () => {
    expect(weekHeadline(week())).toBe("120 g of protein this week");
  });
  it("says nothing is logged rather than showing zero", () => {
    expect(weekHeadline(week({ total_g: null, average_g_per_day: null, days_with_protein: 0 }))).toBe(
      "No protein logged this week yet.",
    );
    expect(weekDetail(week({ total_g: null, average_g_per_day: null, days_with_protein: 0 }))).toBeNull();
  });
  it("reads as 'at least' when some foods have no protein data", () => {
    const partial = week({ foods_missing_protein: 2 });
    expect(weekHeadline(partial)).toBe("At least 120 g of protein this week");
    expect(weekDetail(partial)).toContain("2 foods have no protein data");
  });
  it("averages over the days that were logged", () => {
    expect(weekDetail(week())).toBe("About 40 g a day across the 3 days you logged.");
    expect(weekDetail(week({ days_with_protein: 1 }))).toContain("the 1 day you logged");
  });
});

describe("dayBarPercent", () => {
  it("leaves unlogged days empty", () => {
    expect(dayBarPercent(day(5, null), week())).toBe(0);
  });
  it("scales to the top of the week or the gentle range, whichever is larger", () => {
    expect(dayBarPercent(day(10, 60), week())).toBe(94); // 60 of 64 (top of the range)
    expect(dayBarPercent(day(10, 128), week({ days: [day(10, 128)] }))).toBe(100);
  });
  it("keeps a tiny day visible", () => {
    expect(dayBarPercent(day(4, 1), week())).toBe(4);
  });
  it("works without a guide", () => {
    expect(dayBarPercent(day(10, 60), week({ guide: null }))).toBe(100);
  });
});
