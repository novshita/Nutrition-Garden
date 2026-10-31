/** Display formatting. Values are stored metric; people see their preferred unit system. */

import type { UnitSystem } from "@/lib/types/api";
import { flOzToMl, kgToLb, mlToFlOz, round } from "@/lib/units";

const numberFormat = new Intl.NumberFormat("en-US");

export const formatInt = (value: number): string => numberFormat.format(Math.round(value));

export function formatWeight(kg: number, unit: UnitSystem): string {
  return unit === "METRIC" ? `${round(kg, 1)} kg` : `${round(kgToLb(kg), 1)} lb`;
}

export function formatVolume(ml: number, unit: UnitSystem): string {
  if (unit === "IMPERIAL") return `${Math.round(mlToFlOz(ml))} fl oz`;
  return ml >= 1000 ? `${round(ml / 1000, 2)} L` : `${Math.round(ml)} ml`;
}

/** Whole minutes as "7 h 30 min", "45 min" or "8 h". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export const formatSeconds = (seconds: number): string => formatDuration(seconds / 60);

/** The quick-add buttons for water, in the person's own units (the API takes whole millilitres). */
export function waterQuickAmounts(unit: UnitSystem): { label: string; ml: number }[] {
  if (unit === "IMPERIAL") {
    return [8, 16].map((flOz) => ({ label: `${flOz} fl oz`, ml: Math.round(flOzToMl(flOz)) }));
  }
  return [250, 500].map((ml) => ({ label: `${ml} ml`, ml }));
}

/** Share of a target reached, capped at 100 so going over never looks like a problem. */
export function percentOf(value: number | null, target: number | null): number | null {
  if (value === null || target === null || target <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

/** "Saturday, October 31" from a YYYY-MM-DD string, without any time zone shifting. */
export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
