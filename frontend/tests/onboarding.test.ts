import { describe, expect, it } from "vitest";
import {
  ageOn,
  buildProfilePayload,
  convertFormUnits,
  emptyForm,
  parseNumber,
  type OnboardingForm,
} from "@/lib/onboarding";

const TODAY = new Date(2026, 9, 31); // 31 Oct 2026 (local)

function metricForm(overrides: Partial<OnboardingForm> = {}): OnboardingForm {
  return {
    ...emptyForm("Asia/Kolkata"),
    dateOfBirth: "2000-01-01",
    sex: "FEMALE",
    heightCm: "165",
    weight: "50",
    goalWeight: "56",
    activityLevel: "LIGHT",
    ...overrides,
  };
}

function imperialForm(overrides: Partial<OnboardingForm> = {}): OnboardingForm {
  return {
    ...metricForm(),
    unitSystem: "IMPERIAL",
    heightCm: "",
    heightFt: "5",
    heightIn: "5",
    weight: "110",
    goalWeight: "123.5",
    ...overrides,
  };
}

describe("parseNumber", () => {
  it("parses plain numbers, decimal commas and padded text", () => {
    expect(parseNumber("52.5")).toBe(52.5);
    expect(parseNumber("52,5")).toBe(52.5);
    expect(parseNumber("  60 ")).toBe(60);
  });
  it("returns null for empty or non-numeric text", () => {
    for (const text of ["", "  ", "abc", "5 ft", "Infinity", "NaN"]) {
      expect(parseNumber(text)).toBeNull();
    }
  });
});

describe("ageOn", () => {
  it("counts whole years and respects the birthday", () => {
    expect(ageOn("2000-10-31", TODAY)).toBe(26);
    expect(ageOn("2000-11-01", TODAY)).toBe(25);
    expect(ageOn("2000-10-30", TODAY)).toBe(26);
  });
  it("flags future dates and rejects impossible ones", () => {
    expect(ageOn("2026-11-01", TODAY)).toBe(-1);
    expect(ageOn("2000-02-31", TODAY)).toBeNull();
    expect(ageOn("2000-13-01", TODAY)).toBeNull();
    expect(ageOn("not-a-date", TODAY)).toBeNull();
    expect(ageOn("", TODAY)).toBeNull();
  });
});

describe("buildProfilePayload: metric", () => {
  it("builds the canonical payload", () => {
    expect(buildProfilePayload(metricForm(), TODAY)).toEqual({
      ok: true,
      payload: {
        date_of_birth: "2000-01-01",
        sex: "FEMALE",
        height_cm: 165,
        weight_kg: 50,
        goal_weight_kg: 56,
        preferred_unit_system: "METRIC",
        activity_level: "LIGHT",
        timezone: "Asia/Kolkata",
      },
    });
  });

  it("accepts decimal commas", () => {
    const result = buildProfilePayload(metricForm({ weight: "52,5" }), TODAY);
    expect(result.ok && result.payload.weight_kg).toBe(52.5);
  });
});

describe("buildProfilePayload: imperial", () => {
  it("converts feet/inches and pounds to centimetres and kilograms", () => {
    const result = buildProfilePayload(imperialForm(), TODAY);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.payload.preferred_unit_system).toBe("IMPERIAL");
    expect(result.payload.height_cm).toBeCloseTo(165.1, 1); // 5 ft 5 in
    expect(result.payload.weight_kg).toBeCloseTo(49.9, 1); // 110 lb
    expect(result.payload.goal_weight_kg).toBeCloseTo(56.02, 2); // 123.5 lb
  });

  it("treats blank inches as zero", () => {
    const result = buildProfilePayload(imperialForm({ heightFt: "5", heightIn: "" }), TODAY);
    expect(result.ok && result.payload.height_cm).toBe(152.4);
  });

  it("rejects bad inches", () => {
    for (const inches of ["12", "-1", "abc"]) {
      const result = buildProfilePayload(imperialForm({ heightIn: inches }), TODAY);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors.height).toContain("feet and inches");
    }
  });
});

describe("buildProfilePayload: validation", () => {
  const errorsFor = (overrides: Partial<OnboardingForm>) => {
    const result = buildProfilePayload(metricForm(overrides), TODAY);
    return result.ok ? null : result.errors;
  };

  it("reports every missing field at once", () => {
    const result = buildProfilePayload(emptyForm("UTC"), TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["activityLevel", "dateOfBirth", "goalWeight", "height", "sex", "weight"].sort(),
      );
    }
  });

  it("enforces the age range, including the boundaries", () => {
    expect(errorsFor({ dateOfBirth: "2008-10-31" })).toBeNull(); // exactly 18
    expect(errorsFor({ dateOfBirth: "2008-11-01" })?.dateOfBirth).toContain("18 to 120");
    expect(errorsFor({ dateOfBirth: "1906-10-31" })).toBeNull(); // turned 120 today
    expect(errorsFor({ dateOfBirth: "1905-11-01" })).toBeNull(); // still 120, turns 121 tomorrow
    expect(errorsFor({ dateOfBirth: "1905-10-31" })?.dateOfBirth).toContain("18 to 120"); // 121
  });

  it("rejects future and impossible birth dates with clear messages", () => {
    expect(errorsFor({ dateOfBirth: "2027-01-01" })?.dateOfBirth).toContain("future");
    expect(errorsFor({ dateOfBirth: "2000-02-31" })?.dateOfBirth).toContain("date of birth");
  });

  it("enforces height and weight limits (inclusive)", () => {
    expect(errorsFor({ heightCm: "50" })).toBeNull();
    expect(errorsFor({ heightCm: "260" })).toBeNull();
    expect(errorsFor({ heightCm: "49.9" })?.height).toContain("50 and 260 cm");
    expect(errorsFor({ heightCm: "260.1" })?.height).toBeDefined();
    expect(errorsFor({ weight: "20", goalWeight: "400" })).toBeNull();
    expect(errorsFor({ weight: "19.9" })?.weight).toContain("20 and 400 kg");
    expect(errorsFor({ goalWeight: "401" })?.goalWeight).toContain("20 and 400 kg");
    expect(errorsFor({ weight: "0" })?.weight).toBeDefined();
    expect(errorsFor({ weight: "-50" })?.weight).toBeDefined();
    expect(errorsFor({ weight: "abc" })?.weight).toBeDefined();
  });

  it("states weight limits in pounds for imperial users", () => {
    const result = buildProfilePayload(imperialForm({ weight: "10" }), TODAY);
    expect(!result.ok && result.errors.weight).toBe("Please enter a weight between 45 and 881 lb.");
  });

  it("requires a timezone", () => {
    expect(errorsFor({ timezone: "  " })?.timezone).toBeDefined();
  });
});

describe("convertFormUnits", () => {
  it("converts typed values to imperial and back without losing meaning", () => {
    const metric = metricForm({ heightCm: "170", weight: "60", goalWeight: "65" });
    const imperial = convertFormUnits(metric, "IMPERIAL");
    expect(imperial.unitSystem).toBe("IMPERIAL");
    expect(imperial.heightFt).toBe("5");
    expect(Number(imperial.heightIn)).toBeCloseTo(6.9, 1);
    expect(Number(imperial.weight)).toBeCloseTo(132.3, 1);

    const back = convertFormUnits(imperial, "METRIC");
    expect(Number(back.heightCm)).toBeCloseTo(170, 0);
    expect(Number(back.weight)).toBeCloseTo(60, 0);
    expect(Number(back.goalWeight)).toBeCloseTo(65, 0);
  });

  it("leaves empty or unreadable fields alone", () => {
    const converted = convertFormUnits(metricForm({ heightCm: "", weight: "abc", goalWeight: "" }), "IMPERIAL");
    expect(converted.weight).toBe("abc");
    expect(converted.goalWeight).toBe("");
    expect(converted.heightFt).toBe("");
  });

  it("does nothing when the system doesn't change", () => {
    const form = metricForm();
    expect(convertFormUnits(form, "METRIC")).toBe(form);
  });

  it("produces the same payload before and after a unit switch (within rounding)", () => {
    const before = buildProfilePayload(metricForm({ heightCm: "165", weight: "50", goalWeight: "56" }), TODAY);
    const after = buildProfilePayload(
      convertFormUnits(metricForm({ heightCm: "165", weight: "50", goalWeight: "56" }), "IMPERIAL"),
      TODAY,
    );
    if (!before.ok || !after.ok) throw new Error("expected both to be valid");
    expect(after.payload.height_cm).toBeCloseTo(before.payload.height_cm, 0);
    expect(after.payload.weight_kg).toBeCloseTo(before.payload.weight_kg, 0);
    expect(after.payload.goal_weight_kg).toBeCloseTo(before.payload.goal_weight_kg, 0);
  });
});
