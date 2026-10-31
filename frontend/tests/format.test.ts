import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatInt,
  formatLongDate,
  formatShortDate,
  formatSeconds,
  formatVolume,
  formatWeight,
  percentOf,
  waterQuickAmounts,
} from "@/lib/format";
import { flOzToMl, mlToFlOz } from "@/lib/units";

describe("formatWeight", () => {
  it("shows kilograms to one decimal, without a trailing .0", () => {
    expect(formatWeight(51.2, "METRIC")).toBe("51.2 kg");
    expect(formatWeight(50, "METRIC")).toBe("50 kg");
    expect(formatWeight(50.04, "METRIC")).toBe("50 kg");
  });
  it("converts to pounds for imperial users", () => {
    expect(formatWeight(50, "IMPERIAL")).toBe("110.2 lb");
    expect(formatWeight(45.359237, "IMPERIAL")).toBe("100 lb");
  });
});

describe("volume", () => {
  it("round-trips fluid ounces and millilitres", () => {
    for (const ml of [0, 250, 500, 2000]) {
      expect(flOzToMl(mlToFlOz(ml))).toBeCloseTo(ml, 9);
    }
  });
  it("formats millilitres, switching to litres from 1000", () => {
    expect(formatVolume(0, "METRIC")).toBe("0 ml");
    expect(formatVolume(750, "METRIC")).toBe("750 ml");
    expect(formatVolume(1000, "METRIC")).toBe("1 L");
    expect(formatVolume(1750, "METRIC")).toBe("1.75 L");
  });
  it("formats fluid ounces for imperial users", () => {
    expect(formatVolume(237, "IMPERIAL")).toBe("8 fl oz");
    expect(formatVolume(0, "IMPERIAL")).toBe("0 fl oz");
  });
  it("offers quick-add amounts in the person's units, as whole millilitres", () => {
    expect(waterQuickAmounts("METRIC")).toEqual([
      { label: "250 ml", ml: 250 },
      { label: "500 ml", ml: 500 },
    ]);
    const imperial = waterQuickAmounts("IMPERIAL");
    expect(imperial.map((a) => a.label)).toEqual(["8 fl oz", "16 fl oz"]);
    expect(imperial.map((a) => a.ml)).toEqual([237, 473]);
    expect(imperial.every((a) => Number.isInteger(a.ml))).toBe(true);
  });
});

describe("durations", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [59.6, "1 h"],
    [60, "1 h"],
    [450, "7 h 30 min"],
    [495, "8 h 15 min"],
  ])("formats %s minutes as %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
  it("formats seconds as minutes", () => {
    expect(formatSeconds(1800)).toBe("30 min");
    expect(formatSeconds(3600)).toBe("1 h");
    expect(formatSeconds(90)).toBe("2 min");
  });
});

describe("percentOf", () => {
  it("gives the share of a target, capped at 100", () => {
    expect(percentOf(1000, 2000)).toBe(50);
    expect(percentOf(2000, 2000)).toBe(100);
    expect(percentOf(3500, 2000)).toBe(100); // going over is not an error state
    expect(percentOf(0, 2000)).toBe(0);
  });
  it("is null when there is nothing to compare", () => {
    expect(percentOf(null, 2000)).toBeNull();
    expect(percentOf(500, null)).toBeNull();
    expect(percentOf(500, 0)).toBeNull();
  });
});

describe("formatInt", () => {
  it("adds thousands separators and rounds", () => {
    expect(formatInt(12345)).toBe("12,345");
    expect(formatInt(1999.6)).toBe("2,000");
    expect(formatInt(0)).toBe("0");
  });
});

describe("formatLongDate", () => {
  it("shows the weekday and date for the exact day given", () => {
    expect(formatLongDate("2026-10-31")).toBe("Saturday, October 31");
    expect(formatLongDate("2026-01-01")).toBe("Thursday, January 1");
  });
});

describe("formatShortDate", () => {
  it("shows the month and day for the exact day given", () => {
    expect(formatShortDate("2026-03-10")).toBe("Mar 10");
    expect(formatShortDate("2026-12-01")).toBe("Dec 1");
  });
});
