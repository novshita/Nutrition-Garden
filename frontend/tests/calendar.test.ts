import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  cellMarks,
  daysInMonth,
  monthOf,
  monthRange,
  monthTitle,
  shiftMonth,
} from "@/lib/calendar";
import type { CalendarDay } from "@/lib/types/api";

const day = (date: string, overrides: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  planned_workout: null,
  workouts_completed: 0,
  calories: null,
  food_items_logged: 0,
  weight_kg: null,
  water_ml: 0,
  sleep_minutes: null,
  mood: null,
  steps: null,
  has_activity: false,
  ...overrides,
});

describe("months", () => {
  it("knows how long each month is, including leap years", () => {
    expect(daysInMonth({ year: 2026, month: 1 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
    expect(daysInMonth({ year: 1900, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2000, month: 2 })).toBe(29);
  });

  it("gives the first and last date to request", () => {
    expect(monthRange({ year: 2026, month: 3 })).toEqual({ start: "2026-03-01", end: "2026-03-31" });
    expect(monthRange({ year: 2024, month: 2 })).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("never asks for more days than the API allows (62)", () => {
    for (let month = 1; month <= 12; month++) expect(daysInMonth({ year: 2026, month })).toBeLessThanOrEqual(62);
  });

  it("shifts across year boundaries in both directions", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
    expect(shiftMonth({ year: 2026, month: 5 }, 14)).toEqual({ year: 2027, month: 7 });
    expect(shiftMonth({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 });
  });

  it("reads the month from a date and titles it", () => {
    expect(monthOf("2026-03-10")).toEqual({ year: 2026, month: 3 });
    expect(monthTitle({ year: 2026, month: 3 })).toBe("March 2026");
  });
});

describe("buildMonthGrid", () => {
  it("starts weeks on Monday and pads with empty cells", () => {
    // 1 March 2026 is a Sunday, so six empty cells come first.
    const weeks = buildMonthGrid({ year: 2026, month: 3 }, []);
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]?.date).toBe("2026-03-01");
    expect(weeks[1][0]?.date).toBe("2026-03-02"); // a Monday
  });

  it("starts on the right column when the 1st is a Monday", () => {
    // 1 June 2026 is a Monday.
    const weeks = buildMonthGrid({ year: 2026, month: 6 }, []);
    expect(weeks[0][0]?.date).toBe("2026-06-01");
  });

  it("always makes whole weeks that hold every day exactly once", () => {
    for (let month = 1; month <= 12; month++) {
      const weeks = buildMonthGrid({ year: 2026, month }, []);
      expect(weeks.every((w) => w.length === 7)).toBe(true);
      const dates = weeks.flat().filter((c) => c !== null).map((c) => c!.dayOfMonth);
      expect(dates).toEqual(Array.from({ length: daysInMonth({ year: 2026, month }) }, (_, i) => i + 1));
    }
  });

  it("handles a February that fits exactly four weeks", () => {
    // 1 Feb 2027 is a Monday and February 2027 has 28 days.
    const weeks = buildMonthGrid({ year: 2027, month: 2 }, []);
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c !== null)).toBe(true);
  });

  it("attaches each day's data, leaving the rest null", () => {
    const weeks = buildMonthGrid({ year: 2026, month: 3 }, [day("2026-03-10", { water_ml: 500 })]);
    const cells = weeks.flat().filter((c) => c !== null);
    expect(cells.find((c) => c!.date === "2026-03-10")!.data?.water_ml).toBe(500);
    expect(cells.find((c) => c!.date === "2026-03-11")!.data).toBeNull();
  });
});

describe("cellMarks", () => {
  it("shows nothing for an empty day", () => {
    expect(cellMarks(day("2026-03-10"))).toEqual([]);
  });

  it("shows what happened", () => {
    const marks = cellMarks(
      day("2026-03-10", {
        workouts_completed: 2,
        food_items_logged: 3,
        water_ml: 500,
        sleep_minutes: 420,
        mood: "GOOD",
        steps: 4000,
        weight_kg: 50,
      }),
    ).map((m) => m.emoji);
    expect(marks).toEqual(["💪", "🍽️", "💧", "😴", "🙂", "👣", "⚖️"]);
  });

  it("shows the plan only when the workout hasn't happened, and never marks what was missed", () => {
    const planned = cellMarks(day("2026-03-10", { planned_workout: { is_rest_day: false, template_name: "Upper Body" } }));
    expect(planned).toEqual([{ emoji: "📅", label: "planned: Upper Body" }]);
    const rest = cellMarks(day("2026-03-10", { planned_workout: { is_rest_day: true, template_name: null } }));
    expect(rest).toEqual([{ emoji: "🌿", label: "rest day" }]);
    const done = cellMarks(
      day("2026-03-10", { workouts_completed: 1, planned_workout: { is_rest_day: false, template_name: "Upper Body" } }),
    );
    expect(done).toEqual([{ emoji: "💪", label: "1 workout" }]);
  });

  it("counts workouts in plain language", () => {
    expect(cellMarks(day("d", { workouts_completed: 2 }))[0].label).toBe("2 workouts");
  });
});
