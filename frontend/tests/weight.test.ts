import { describe, expect, it } from "vitest";
import {
  buildChartData,
  buildWeightPayload,
  chartDomain,
  describeWeeklyChange,
  goalProgressText,
  localDate,
  TREND_COPY,
  todayIn,
} from "@/lib/weight";
import type { TrendState, WeightEntry } from "@/lib/types/api";

const entry = (id: string, recorded_at: string, weight_kg: number): WeightEntry => ({
  id,
  recorded_at,
  weight_kg,
  note: null,
});

describe("localDate and todayIn", () => {
  it("gives the date in the given time zone, not UTC", () => {
    expect(localDate("2026-03-10T11:00:00Z", "UTC")).toBe("2026-03-10");
    expect(localDate("2026-03-10T11:00:00Z", "Pacific/Kiritimati")).toBe("2026-03-11"); // UTC+14
    expect(localDate("2026-03-10T03:00:00Z", "America/Los_Angeles")).toBe("2026-03-09");
  });
  it("finds today's date in a zone", () => {
    const now = new Date("2026-03-10T20:00:00Z");
    expect(todayIn("UTC", now)).toBe("2026-03-10");
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-03-11"); // already tomorrow in India
  });
});

describe("buildChartData", () => {
  const entries = [
    entry("a", "2026-03-08T07:00:00Z", 50),
    entry("b", "2026-03-10T07:00:00Z", 50.4),
    entry("c", "2026-03-10T19:00:00Z", 50.8), // a second weigh-in the same day
  ];
  const series = [
    { date: "2026-03-08", average_kg: 50 },
    { date: "2026-03-10", average_kg: 50.4 },
  ];

  it("merges weigh-ins and the trend into one point per day, oldest first", () => {
    const points = buildChartData(entries, series, "METRIC", "UTC");
    expect(points).toEqual([
      { date: "2026-03-08", weight: 50, trend: 50 },
      { date: "2026-03-10", weight: 50.8, trend: 50.4 }, // the day's last weigh-in wins
    ]);
  });

  it("keeps days that only have one of the two", () => {
    const points = buildChartData(
      [entry("a", "2026-03-08T07:00:00Z", 50)],
      [{ date: "2026-03-09", average_kg: 49.5 }],
      "METRIC",
      "UTC",
    );
    expect(points).toEqual([
      { date: "2026-03-08", weight: 50, trend: null },
      { date: "2026-03-09", weight: null, trend: 49.5 },
    ]);
  });

  it("sorts days even if the inputs arrive out of order", () => {
    const points = buildChartData(
      [entry("b", "2026-03-12T07:00:00Z", 51), entry("a", "2026-03-01T07:00:00Z", 50)],
      [],
      "METRIC",
      "UTC",
    );
    expect(points.map((p) => p.date)).toEqual(["2026-03-01", "2026-03-12"]);
  });

  it("converts to pounds for imperial users", () => {
    const points = buildChartData([entry("a", "2026-03-08T07:00:00Z", 50)], [{ date: "2026-03-08", average_kg: 50 }], "IMPERIAL", "UTC");
    expect(points[0]).toEqual({ date: "2026-03-08", weight: 110.2, trend: 110.2 });
  });

  it("puts a weigh-in on the user's local day", () => {
    const points = buildChartData([entry("a", "2026-03-10T11:00:00Z", 50)], [], "METRIC", "Pacific/Kiritimati");
    expect(points[0].date).toBe("2026-03-11");
  });

  it("handles no data", () => {
    expect(buildChartData([], [], "METRIC", "UTC")).toEqual([]);
  });
});

describe("chartDomain", () => {
  const points = [
    { date: "2026-03-08", weight: 50, trend: 50 },
    { date: "2026-03-10", weight: 52, trend: 51 },
  ];
  it("fits the data with a little room", () => {
    expect(chartDomain(points, null, "METRIC")).toEqual([49, 53]);
  });
  it("always includes the goal line, above or below the data", () => {
    expect(chartDomain(points, 58, "METRIC")).toEqual([49, 59]);
    expect(chartDomain(points, 40, "METRIC")).toEqual([39, 53]);
  });
  it("uses the goal alone when there is no data yet", () => {
    expect(chartDomain([], 56, "METRIC")).toEqual([55, 57]);
  });
  it("is null with nothing to show", () => {
    expect(chartDomain([], null, "METRIC")).toBeNull();
  });
  it("gives imperial charts more room", () => {
    const [low, high] = chartDomain([{ date: "d", weight: 110.2, trend: null }], null, "IMPERIAL")!;
    expect([low, high]).toEqual([108, 113]);
  });
});

describe("wording", () => {
  it("has neutral copy for every trend state", () => {
    const states: TrendState[] = [
      "INSUFFICIENT_DATA",
      "STABLE",
      "INCREASING",
      "DECREASING",
      "INCREASING_FAST",
      "DECREASING_FAST",
    ];
    for (const state of states) {
      const copy = TREND_COPY[state];
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.detail).not.toMatch(/bad|fail|wrong|good job|too much|too little/i);
    }
  });

  it("describes the weekly change with a sign and the right unit", () => {
    expect(describeWeeklyChange(0.3, "METRIC")).toBe("+0.3 kg a week");
    expect(describeWeeklyChange(-0.6, "METRIC")).toBe("-0.6 kg a week");
    expect(describeWeeklyChange(0.5, "IMPERIAL")).toBe("+1.1 lb a week");
    expect(describeWeeklyChange(0.01, "METRIC")).toBe("about the same");
    expect(describeWeeklyChange(-0.04, "METRIC")).toBe("about the same");
    expect(describeWeeklyChange(null, "METRIC")).toBeNull();
  });

  it("describes progress toward the goal kindly", () => {
    expect(goalProgressText(52, 56, "METRIC")).toBe("4 kg to go. There's no rush; gradual is the aim.");
    expect(goalProgressText(56, 56, "METRIC")).toContain("at or past your goal");
    expect(goalProgressText(58, 56, "METRIC")).toContain("at or past your goal");
  });
});

describe("buildWeightPayload", () => {
  const base = { unit: "METRIC" as const, note: "", date: "2026-03-10", today: "2026-03-10", timeZone: "UTC" };

  it("sends today's weight with no timestamp, so the server uses now", () => {
    expect(buildWeightPayload({ ...base, text: "52,5" })).toEqual({ ok: true, payload: { weight_kg: 52.5 } });
  });

  it("stamps an earlier day at local midday in the user's zone", () => {
    const result = buildWeightPayload({
      ...base,
      text: "52",
      date: "2026-03-08",
      timeZone: "Asia/Kolkata",
    });
    expect(result).toEqual({
      ok: true,
      payload: { weight_kg: 52, recorded_at: "2026-03-08T06:30:00.000Z" },
    });
  });

  it("converts pounds to kilograms", () => {
    const result = buildWeightPayload({ ...base, text: "110", unit: "IMPERIAL" });
    expect(result.ok && result.payload.weight_kg).toBeCloseTo(49.9, 1);
  });

  it("includes a trimmed note only when given", () => {
    const withNote = buildWeightPayload({ ...base, text: "52", note: "  after breakfast " });
    expect(withNote.ok && withNote.payload.note).toBe("after breakfast");
    const without = buildWeightPayload({ ...base, text: "52", note: "   " });
    expect(without.ok && "note" in without.payload).toBe(false);
  });

  it.each(["", "abc", "0", "-50", "19.9", "400.1"])("rejects the weight %j", (text) => {
    const result = buildWeightPayload({ ...base, text });
    expect(result.ok).toBe(false);
  });

  it("states the allowed range in the person's units", () => {
    const metric = buildWeightPayload({ ...base, text: "5" });
    expect(!metric.ok && metric.error).toContain("20 and 400 kg");
    const imperial = buildWeightPayload({ ...base, text: "5", unit: "IMPERIAL" });
    expect(!imperial.ok && imperial.error).toContain("lb");
  });

  it("accepts the limits themselves", () => {
    expect(buildWeightPayload({ ...base, text: "20" }).ok).toBe(true);
    expect(buildWeightPayload({ ...base, text: "400" }).ok).toBe(true);
  });

  it("rejects future dates, missing dates and overlong notes", () => {
    expect(buildWeightPayload({ ...base, text: "52", date: "2026-03-11" }).ok).toBe(false);
    expect(buildWeightPayload({ ...base, text: "52", date: "" }).ok).toBe(false);
    expect(buildWeightPayload({ ...base, text: "52", note: "x".repeat(501) }).ok).toBe(false);
  });
});
