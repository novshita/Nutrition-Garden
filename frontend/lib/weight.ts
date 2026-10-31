/** Weight page rules: chart data, trend wording and the payload for a new weigh-in. */

import { formatWeight } from "@/lib/format";
import { LIMITS, parseNumber, weightRangeText } from "@/lib/onboarding";
import { zonedInstantIso } from "@/lib/track";
import type { TrendState, UnitSystem, WeightEntry } from "@/lib/types/api";
import { kgToLb, lbToKg, round } from "@/lib/units";

// Dates -------------------------------------------------------------------------------------

/** The YYYY-MM-DD date of a moment in a time zone. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

export const todayIn = (timeZone: string, now: Date = new Date()): string =>
  localDate(now.toISOString(), timeZone);

// Chart -------------------------------------------------------------------------------------

export type ChartPoint = {
  date: string;
  /** The day's actual weigh-in (the last one if there were several). */
  weight: number | null;
  /** The 7-day rolling average, which is the line to watch. */
  trend: number | null;
};

export const toDisplayWeight = (kg: number, unit: UnitSystem): number =>
  round(unit === "METRIC" ? kg : kgToLb(kg), 1);

/** One point per day, oldest first, in the person's units. Entries arrive oldest first. */
export function buildChartData(
  entries: WeightEntry[],
  series: { date: string; average_kg: number }[],
  unit: UnitSystem,
  timeZone: string,
): ChartPoint[] {
  const points = new Map<string, ChartPoint>();
  const at = (date: string) => {
    if (!points.has(date)) points.set(date, { date, weight: null, trend: null });
    return points.get(date)!;
  };
  for (const entry of entries) {
    at(localDate(entry.recorded_at, timeZone)).weight = toDisplayWeight(entry.weight_kg, unit);
  }
  for (const item of series) at(item.date).trend = toDisplayWeight(item.average_kg, unit);
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** A y-axis range that fits every point and the goal line, with a little breathing room. */
export function chartDomain(
  points: ChartPoint[],
  goalKg: number | null,
  unit: UnitSystem,
): [number, number] | null {
  const values = points.flatMap((p) => [p.weight, p.trend]).filter((v): v is number => v !== null);
  if (goalKg !== null) values.push(toDisplayWeight(goalKg, unit));
  if (values.length === 0) return null;
  const pad = unit === "METRIC" ? 1 : 2;
  return [Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)];
}

// Wording -----------------------------------------------------------------------------------

/** Neutral words for the trend: it describes, it doesn't judge. */
export const TREND_COPY: Record<TrendState, { title: string; detail: string }> = {
  INSUFFICIENT_DATA: {
    title: "Still gathering your trend",
    detail: "Weigh in a few times over the next couple of weeks and your trend will appear here.",
  },
  STABLE: {
    title: "Holding steady",
    detail: "Your 7-day average is about the same as the week before.",
  },
  INCREASING: {
    title: "Gently rising",
    detail: "Your 7-day average is a little higher than the week before.",
  },
  DECREASING: {
    title: "Gently falling",
    detail: "Your 7-day average is a little lower than the week before.",
  },
  INCREASING_FAST: {
    title: "Rising quickly",
    detail: "Your 7-day average is noticeably higher than the week before. Gradual change is the aim.",
  },
  DECREASING_FAST: {
    title: "Falling quickly",
    detail: "Your 7-day average is noticeably lower than the week before.",
  },
};

/** "+0.3 kg a week", "-0.6 lb a week", or "about the same" when it's under the display precision. */
export function describeWeeklyChange(changeKg: number | null, unit: UnitSystem): string | null {
  if (changeKg === null) return null;
  const shown = round(unit === "METRIC" ? changeKg : kgToLb(changeKg), 1);
  if (shown === 0) return "about the same";
  const label = unit === "METRIC" ? "kg" : "lb";
  return `${shown > 0 ? "+" : "-"}${Math.abs(shown)} ${label} a week`;
}

export function goalProgressText(currentKg: number, goalKg: number, unit: UnitSystem): string {
  const remaining = goalKg - currentKg;
  if (remaining <= 0) return "You're at or past your goal weight. 🌷";
  return `${formatWeight(remaining, unit)} to go. There's no rush; gradual is the aim.`;
}

// New weigh-in ------------------------------------------------------------------------------

export type WeightPayload = { weight_kg: number; recorded_at?: string; note?: string };

export function buildWeightPayload(input: {
  text: string;
  unit: UnitSystem;
  note: string;
  date: string;
  today: string;
  timeZone: string;
}): { ok: true; payload: WeightPayload } | { ok: false; error: string } {
  const value = parseNumber(input.text);
  const kg = value === null ? null : input.unit === "METRIC" ? value : lbToKg(value);
  if (kg === null || kg < LIMITS.weightKg.min || kg > LIMITS.weightKg.max) {
    return { ok: false, error: `Please enter a weight between ${weightRangeText(input.unit)}.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "Please choose a date." };
  }
  if (input.date > input.today) return { ok: false, error: "That date is in the future." };
  const note = input.note.trim();
  if (note.length > 500) return { ok: false, error: "Please keep the note under 500 characters." };

  const payload: WeightPayload = { weight_kg: round(kg, 2) };
  // Today's weigh-in is stamped "now" by the server; an earlier day goes in at local midday.
  if (input.date !== input.today) payload.recorded_at = zonedInstantIso(input.date, "12:00", input.timeZone);
  if (note) payload.note = note;
  return { ok: true, payload };
}
