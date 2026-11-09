/** Wording and shapes for the protein summary. Protein is counted and reminded about, never targeted. */

import { formatWeight } from "@/lib/format";
import type { ProteinDay, ProteinGuide, ProteinWeek, UnitSystem } from "@/lib/types/api";
import { round } from "@/lib/units";

/** "About 62–83 g a day" for this weight, framed as a reminder rather than a goal. */
export function guideText(guide: ProteinGuide, unit: UnitSystem): string {
  return (
    `A gentle reminder: at ${formatWeight(guide.weight_kg, unit)}, many people aim for roughly ` +
    `${guide.low_g_per_day}–${guide.high_g_per_day} g of protein a day. It's a guide, not a goal.`
  );
}

/** The short version for the dashboard's protein line. */
export function guideShort(guide: ProteinGuide): string {
  return `a gentle guide for you: about ${guide.low_g_per_day}–${guide.high_g_per_day} g a day`;
}

export function weekHeadline(week: ProteinWeek): string {
  if (week.total_g === null) return "No protein logged this week yet.";
  const prefix = week.foods_missing_protein > 0 ? "At least " : "";
  return `${prefix}${Math.round(week.total_g)} g of protein this week`;
}

export function weekDetail(week: ProteinWeek): string | null {
  if (week.average_g_per_day === null) return null;
  const days = week.days_with_protein;
  const parts = [`About ${round(week.average_g_per_day, 0)} g a day across the ${days} ${days === 1 ? "day" : "days"} you logged.`];
  if (week.foods_missing_protein > 0) {
    parts.push(
      `${week.foods_missing_protein} ${week.foods_missing_protein === 1 ? "food has" : "foods have"} no protein data, so the real number is a bit higher.`,
    );
  }
  return parts.join(" ");
}

/** Bar heights as a share of the biggest day (or the top of the gentle range), with no target line. */
export function dayBarPercent(day: ProteinDay, week: ProteinWeek): number {
  if (day.protein_g === null) return 0;
  const biggest = Math.max(day.protein_g, ...week.days.map((d) => d.protein_g ?? 0), week.guide?.high_g_per_day ?? 0);
  return biggest <= 0 ? 0 : Math.max(4, Math.round((day.protein_g / biggest) * 100));
}

export function weekdayLetter(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" });
}
