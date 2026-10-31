import { describe, expect, it } from "vitest";
import {
  addDays,
  buildSleepPayload,
  emptySleepForm,
  stepsValue,
  waterAmountMl,
  zonedInstantIso,
  type SleepForm,
} from "@/lib/track";

describe("addDays", () => {
  it("moves dates across month and year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29"); // leap year
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-05-05", 0)).toBe("2026-05-05");
  });
});

describe("zonedInstantIso", () => {
  it("is the identity in UTC", () => {
    expect(zonedInstantIso("2026-03-10", "12:00", "UTC")).toBe("2026-03-10T12:00:00.000Z");
  });
  it("accounts for the time zone's offset", () => {
    expect(zonedInstantIso("2026-03-10", "07:00", "Asia/Kolkata")).toBe("2026-03-10T01:30:00.000Z");
    expect(zonedInstantIso("2026-03-10", "12:00", "Pacific/Kiritimati")).toBe("2026-03-09T22:00:00.000Z");
  });
  it("follows daylight saving time", () => {
    expect(zonedInstantIso("2026-07-01", "12:00", "America/New_York")).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedInstantIso("2026-01-15", "12:00", "America/New_York")).toBe("2026-01-15T17:00:00.000Z");
  });
  it("lands on the right local day for any zone", () => {
    for (const tz of ["Asia/Kolkata", "Pacific/Kiritimati", "America/Los_Angeles", "Europe/London"]) {
      const instant = zonedInstantIso("2026-03-10", "12:00", tz);
      const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(instant));
      expect(local).toBe("2026-03-10");
    }
  });
});

describe("waterAmountMl", () => {
  it("accepts millilitres as typed", () => {
    expect(waterAmountMl("330", "METRIC")).toEqual({ ok: true, ml: 330 });
    expect(waterAmountMl("250,5", "METRIC")).toEqual({ ok: true, ml: 251 });
  });
  it("converts fluid ounces to whole millilitres", () => {
    expect(waterAmountMl("8", "IMPERIAL")).toEqual({ ok: true, ml: 237 });
    expect(waterAmountMl("16", "IMPERIAL")).toEqual({ ok: true, ml: 473 });
  });
  it("rejects empty, zero, negative, text and too-large amounts", () => {
    for (const text of ["", "0", "-5", "abc", "5001"]) {
      expect(waterAmountMl(text, "METRIC").ok).toBe(false);
    }
    expect(waterAmountMl("170", "IMPERIAL").ok).toBe(false); // over 5000 ml
    expect(waterAmountMl("169", "IMPERIAL").ok).toBe(true);
  });
});

describe("stepsValue", () => {
  it("reads whole numbers, including thousands separators", () => {
    expect(stepsValue("2500")).toEqual({ ok: true, steps: 2500 });
    expect(stepsValue("2,500")).toEqual({ ok: true, steps: 2500 });
    expect(stepsValue(" 10 000 ")).toEqual({ ok: true, steps: 10000 });
    expect(stepsValue("0")).toEqual({ ok: true, steps: 0 });
  });
  it("rejects blanks, decimals, negatives, text and huge numbers", () => {
    for (const text of ["", "  ", "12.5", "-1", "many", "200001"]) {
      expect(stepsValue(text).ok).toBe(false);
    }
  });
});

describe("buildSleepPayload", () => {
  const times = (overrides: Partial<SleepForm> = {}): SleepForm => ({
    ...emptySleepForm(),
    bedtime: "23:00",
    wakeTime: "07:00",
    ...overrides,
  });

  it("puts a late bedtime on the evening before the wake-up date", () => {
    const result = buildSleepPayload(times(), "2026-03-11", "UTC");
    expect(result).toEqual({
      ok: true,
      payload: { bedtime: "2026-03-10T23:00:00.000Z", wake_time: "2026-03-11T07:00:00.000Z" },
    });
  });

  it("keeps an after-midnight bedtime on the same day", () => {
    const result = buildSleepPayload(times({ bedtime: "01:00", wakeTime: "08:30" }), "2026-03-11", "UTC");
    expect(result.ok && result.payload).toEqual({
      bedtime: "2026-03-11T01:00:00.000Z",
      wake_time: "2026-03-11T08:30:00.000Z",
    });
  });

  it("works across a month boundary and in other time zones", () => {
    const result = buildSleepPayload(times(), "2026-03-01", "Asia/Kolkata");
    expect(result.ok && result.payload).toEqual({
      bedtime: "2026-02-28T17:30:00.000Z", // 23:00 IST on 28 Feb
      wake_time: "2026-03-01T01:30:00.000Z", // 07:00 IST on 1 Mar
    });
  });

  it("sleep length is always under 24 hours by construction", () => {
    const result = buildSleepPayload(times({ bedtime: "07:01", wakeTime: "07:00" }), "2026-03-11", "UTC");
    if (!result.ok) throw new Error(result.error);
    const hours = (Date.parse(result.payload.wake_time!) - Date.parse(result.payload.bedtime!)) / 3.6e6;
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThan(24);
  });

  it("rejects missing, malformed or identical times", () => {
    for (const overrides of [
      { bedtime: "" },
      { wakeTime: "" },
      { bedtime: "25:00" },
      { wakeTime: "7am" },
      { bedtime: "07:00", wakeTime: "07:00" },
    ]) {
      expect(buildSleepPayload(times(overrides), "2026-03-11", "UTC").ok).toBe(false);
    }
  });

  it("supports a total duration instead of times", () => {
    const form = { ...emptySleepForm(), mode: "total" as const, hours: "7", minutes: "30" };
    expect(buildSleepPayload(form, "2026-03-11", "UTC")).toEqual({
      ok: true,
      payload: { duration_minutes: 450 },
    });
    const minutesOnly = { ...form, hours: "", minutes: "45" };
    expect(buildSleepPayload(minutesOnly, "2026-03-11", "UTC")).toEqual({
      ok: true,
      payload: { duration_minutes: 45 },
    });
  });

  it.each([
    ["0", "0"],
    ["", ""],
    ["25", "0"],
    ["24", "1"],
    ["7", "60"],
    ["-1", "30"],
    ["1.5", "0"],
    ["abc", "0"],
  ])("rejects a total of %s h %s min", (hours, minutes) => {
    const form = { ...emptySleepForm(), mode: "total" as const, hours, minutes };
    expect(buildSleepPayload(form, "2026-03-11", "UTC").ok).toBe(false);
  });

  it("allows exactly 24 hours", () => {
    const form = { ...emptySleepForm(), mode: "total" as const, hours: "24", minutes: "0" };
    expect(buildSleepPayload(form, "2026-03-11", "UTC").ok).toBe(true);
  });

  it("adds quality and notes only when given", () => {
    const base = times();
    const plain = buildSleepPayload(base, "2026-03-11", "UTC");
    expect(plain.ok && "quality" in plain.payload).toBe(false);
    expect(plain.ok && "notes" in plain.payload).toBe(false);
    const full = buildSleepPayload({ ...base, quality: "4", notes: "  woke once  " }, "2026-03-11", "UTC");
    expect(full.ok && full.payload.quality).toBe(4);
    expect(full.ok && full.payload.notes).toBe("woke once");
  });

  it("rejects quality outside 1 to 5 and overlong notes", () => {
    expect(buildSleepPayload({ ...times(), quality: "0" }, "2026-03-11", "UTC").ok).toBe(false);
    expect(buildSleepPayload({ ...times(), quality: "6" }, "2026-03-11", "UTC").ok).toBe(false);
    expect(buildSleepPayload({ ...times(), notes: "x".repeat(501) }, "2026-03-11", "UTC").ok).toBe(false);
  });
});
