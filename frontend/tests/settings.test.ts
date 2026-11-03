import { describe, expect, it } from "vitest";
import { convertFormUnits } from "@/lib/onboarding";
import {
  buildProfileChanges,
  describeEstimateChange,
  formFromProfile,
  switchUnits,
  untouched,
  type Touched,
} from "@/lib/settings";
import type { ProfileSummary } from "@/lib/types/api";

const TODAY = new Date(2026, 10, 3);

function summary(overrides: Partial<ProfileSummary["profile"]> = {}, extra: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    profile: {
      date_of_birth: "2000-01-01",
      sex: "FEMALE",
      height_cm: 165,
      preferred_unit_system: "METRIC",
      activity_level: "LIGHT",
      goal_type: "GAIN_WEIGHT",
      goal_weight_kg: 56,
      timezone: "Asia/Kolkata",
      ...overrides,
    },
    current_weight_kg: 50,
    bmi: 18.4,
    bmr_kcal: 1295,
    tdee_kcal: 1781,
    calorie_target_kcal: 2031,
    ...extra,
  };
}

const edited = (over: Partial<Touched> = {}): Touched => ({ ...untouched(), ...over });

describe("formFromProfile", () => {
  it("shows a metric profile in kilograms and centimetres", () => {
    expect(formFromProfile(summary())).toMatchObject({
      unitSystem: "METRIC",
      heightCm: "165",
      weight: "50",
      goalWeight: "56",
      dateOfBirth: "2000-01-01",
      sex: "FEMALE",
      activityLevel: "LIGHT",
      timezone: "Asia/Kolkata",
    });
  });

  it("shows an imperial profile in pounds, feet and inches", () => {
    const form = formFromProfile(summary({ preferred_unit_system: "IMPERIAL" }));
    expect(form).toMatchObject({ unitSystem: "IMPERIAL", heightFt: "5", heightIn: "5", weight: "110.2", goalWeight: "123.5" });
    expect(form.heightCm).toBe("");
  });

  it("can show the same profile in the other units, straight from the stored values", () => {
    const form = formFromProfile(summary(), "IMPERIAL");
    expect(form.unitSystem).toBe("IMPERIAL");
    expect(form.heightFt).toBe("5");
  });
});

describe("buildProfileChanges", () => {
  const s = summary();
  const base = () => formFromProfile(s);

  it("reports nothing to save when nothing was touched", () => {
    expect(buildProfileChanges(base(), s, untouched(), TODAY)).toEqual({ ok: true, changes: {} });
  });

  it("sends only the details that changed", () => {
    const form = { ...base(), activityLevel: "MODERATE" as const, timezone: "UTC" };
    expect(buildProfileChanges(form, s, untouched(), TODAY)).toEqual({
      ok: true,
      changes: { activity_level: "MODERATE", timezone: "UTC" },
    });
  });

  it("sends a typed height and goal weight in metric, converted from the person's units", () => {
    const metric = { ...base(), heightCm: "170.5", goalWeight: "60" };
    expect(buildProfileChanges(metric, s, edited({ height: true, goalWeight: true }), TODAY)).toEqual({
      ok: true,
      changes: { height_cm: 170.5, goal_weight_kg: 60 },
    });

    const imperialProfile = summary({ preferred_unit_system: "IMPERIAL" });
    const form = { ...formFromProfile(imperialProfile), heightFt: "6", heightIn: "0", goalWeight: "130" };
    const result = buildProfileChanges(form, imperialProfile, edited({ height: true, goalWeight: true }), TODAY);
    if (!result.ok) throw new Error("expected valid");
    expect(result.changes.height_cm).toBeCloseTo(182.9, 1);
    expect(result.changes.goal_weight_kg).toBeCloseTo(58.97, 2);
  });

  it("changing only the units sends only the unit, never the height or weights", () => {
    const form = switchUnits(base(), s, untouched(), "IMPERIAL");
    expect(buildProfileChanges(form, s, untouched(), TODAY)).toEqual({
      ok: true,
      changes: { preferred_unit_system: "IMPERIAL" },
    });
  });

  it("switching units back and forth never drifts the stored values", () => {
    let form = base();
    for (let i = 0; i < 6; i++) {
      form = switchUnits(form, s, untouched(), i % 2 === 0 ? "IMPERIAL" : "METRIC");
    }
    expect(form).toEqual(base()); // exactly where it started, not nudged by rounding
    expect(buildProfileChanges(form, s, untouched(), TODAY)).toEqual({ ok: true, changes: {} });
  });

  it("keeps what was typed when switching units, and converts it", () => {
    let form = { ...base(), goalWeight: "60" };
    form = switchUnits(form, s, edited({ goalWeight: true }), "IMPERIAL");
    expect(Number(form.goalWeight)).toBeCloseTo(132.3, 1);
    // while the height, which wasn't touched, is shown fresh from the stored value
    expect(form.heightFt).toBe("5");
    expect(form.heightIn).toBe("5");
    const result = buildProfileChanges(form, s, edited({ goalWeight: true }), TODAY);
    if (!result.ok) throw new Error("expected valid");
    expect(result.changes.goal_weight_kg).toBeCloseTo(60, 0);
    expect("height_cm" in result.changes).toBe(false);
  });

  it("does nothing when the units don't change", () => {
    const form = base();
    expect(switchUnits(form, s, untouched(), "METRIC")).toBe(form);
  });

  it("reports problems with the form, but never blames the read-only weight", () => {
    const bad = { ...base(), heightCm: "10", goalWeight: "abc", dateOfBirth: "2020-01-01", timezone: " " };
    const result = buildProfileChanges(bad, s, edited({ height: true, goalWeight: true }), TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["dateOfBirth", "goalWeight", "height", "timezone"].sort());
      expect("weight" in result.errors).toBe(false);
    }
  });

  it("applies the same age limits as onboarding", () => {
    const ok = { ...base(), dateOfBirth: "2008-11-03" }; // exactly 18 on TODAY
    expect(buildProfileChanges(ok, s, untouched(), TODAY).ok).toBe(true);
    const tooYoung = { ...base(), dateOfBirth: "2008-11-04" };
    expect(buildProfileChanges(tooYoung, s, untouched(), TODAY).ok).toBe(false);
  });

  it("trims the time zone", () => {
    const form = { ...base(), timezone: "  Asia/Kolkata  " };
    expect(buildProfileChanges(form, s, untouched(), TODAY)).toEqual({ ok: true, changes: {} });
  });
});

describe("describeEstimateChange", () => {
  const before = summary();
  it("explains a changed estimate and reassures that the goal stayed put", () => {
    const after = summary({ activity_level: "VERY_ACTIVE" }, { tdee_kcal: 2205 });
    const note = describeEstimateChange(before, after);
    expect(note).toContain("2,205");
    expect(note).toContain("1,781");
    expect(note).toContain("goal stays at 2,031");
  });
  it("says nothing when the estimate didn't change", () => {
    expect(describeEstimateChange(before, summary({ preferred_unit_system: "IMPERIAL" }))).toBeNull();
    expect(describeEstimateChange(before, summary({}, { tdee_kcal: 1781.4 }))).toBeNull();
  });
  it("never pushes", () => {
    const note = describeEstimateChange(before, summary({}, { tdee_kcal: 2300 }))!;
    expect(note).not.toMatch(/should|must|need to|fail|too/i);
  });
});

describe("convertFormUnits baseline", () => {
  it("is the reason switchUnits exists: a plain round trip would have drifted", () => {
    const form = formFromProfile(summary());
    const roundTrip = convertFormUnits(convertFormUnits(form, "IMPERIAL"), "METRIC");
    expect(roundTrip.heightCm).not.toBe(form.heightCm); // 165 -> 165.1
  });
});
