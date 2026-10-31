/** Calendar rules: month ranges, a Monday-first grid, and the little markers on each day. */

import type { CalendarDay, Mood } from "@/lib/types/api";

export type YearMonth = { year: number; month: number }; // month is 1 to 12

const pad = (n: number) => String(n).padStart(2, "0");

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The first and last date of a month, as YYYY-MM-DD. */
export function monthRange(ym: YearMonth): { start: string; end: string } {
  return {
    start: `${ym.year}-${pad(ym.month)}-01`,
    end: `${ym.year}-${pad(ym.month)}-${pad(daysInMonth(ym))}`,
  };
}

export function monthOf(isoDate: string): YearMonth {
  const [year, month] = isoDate.split("-").map(Number);
  return { year, month };
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthTitle(ym: YearMonth): string {
  return new Date(ym.year, ym.month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export type GridCell = { date: string; dayOfMonth: number; data: CalendarDay | null };

/** Weeks of seven cells, Monday first. Cells outside the month are null. */
export function buildMonthGrid(ym: YearMonth, days: CalendarDay[]): (GridCell | null)[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const total = daysInMonth(ym);
  const sundayFirst = new Date(Date.UTC(ym.year, ym.month - 1, 1)).getUTCDay(); // 0 = Sunday
  const leading = (sundayFirst + 6) % 7; // blanks before the 1st when weeks start on Monday

  const cells: (GridCell | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= total; day++) {
    const date = `${ym.year}-${pad(ym.month)}-${pad(day)}`;
    cells.push({ date, dayOfMonth: day, data: byDate.get(date) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (GridCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const MOOD_EMOJI: Record<Mood, string> = { GREAT: "😄", GOOD: "🙂", OKAY: "😐", LOW: "😔", ROUGH: "😣" };

/** Small markers for a day: what happened, plus what's planned. Nothing for what didn't. */
export function cellMarks(day: CalendarDay): { emoji: string; label: string }[] {
  const marks: { emoji: string; label: string }[] = [];
  if (day.workouts_completed > 0) {
    marks.push({ emoji: "💪", label: `${day.workouts_completed} workout${day.workouts_completed === 1 ? "" : "s"}` });
  } else if (day.planned_workout) {
    marks.push(
      day.planned_workout.is_rest_day
        ? { emoji: "🌿", label: "rest day" }
        : { emoji: "📅", label: `planned: ${day.planned_workout.template_name ?? "workout"}` },
    );
  }
  if (day.food_items_logged > 0) marks.push({ emoji: "🍽️", label: "food logged" });
  if (day.water_ml > 0) marks.push({ emoji: "💧", label: "water logged" });
  if (day.sleep_minutes !== null) marks.push({ emoji: "😴", label: "sleep logged" });
  if (day.mood !== null) marks.push({ emoji: MOOD_EMOJI[day.mood], label: `mood ${day.mood.toLowerCase()}` });
  if (day.steps !== null) marks.push({ emoji: "👣", label: "steps logged" });
  if (day.weight_kg !== null) marks.push({ emoji: "⚖️", label: "weight logged" });
  return marks;
}
