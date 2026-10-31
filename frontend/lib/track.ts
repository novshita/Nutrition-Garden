/** Rules for the daily check-in: water, sleep, mood and steps. */

import { parseNumber } from "@/lib/onboarding";
import type { UnitSystem } from "@/lib/types/api";
import { flOzToMl } from "@/lib/units";

// The same limits the backend enforces. The backend remains the authority.
export const MAX_WATER_ENTRY_ML = 5000;
export const MAX_STEPS = 200_000;
export const MAX_SLEEP_MINUTES = 24 * 60;
export const SLEEP_QUALITY_RANGE = { min: 1, max: 5 } as const;

// Dates and times ---------------------------------------------------------------------------

/** A YYYY-MM-DD string moved by whole days, with no time zone surprises. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** How far a time zone is ahead of UTC at a moment, in minutes. */
function offsetMinutes(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMillis));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMillis / 1000) * 1000) / 60000);
}

/** The exact moment (as an ISO string) of a local date and HH:MM in an IANA time zone. */
export function zonedInstantIso(isoDate: string, time: string, timeZone: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let instant = guess - offsetMinutes(guess, timeZone) * 60000;
  const corrected = guess - offsetMinutes(instant, timeZone) * 60000; // across a DST change
  if (corrected !== instant) instant = corrected;
  return new Date(instant).toISOString();
}

// Water -------------------------------------------------------------------------------------

/** Whole millilitres from what was typed in the person's units, or an error message. */
export function waterAmountMl(
  text: string,
  unit: UnitSystem,
): { ok: true; ml: number } | { ok: false; error: string } {
  const value = parseNumber(text);
  if (value === null || value <= 0) return { ok: false, error: "Please enter an amount greater than zero." };
  const ml = Math.round(unit === "METRIC" ? value : flOzToMl(value));
  if (ml < 1 || ml > MAX_WATER_ENTRY_ML) {
    const max = unit === "METRIC" ? `${MAX_WATER_ENTRY_ML} ml` : "169 fl oz";
    return { ok: false, error: `Please enter an amount up to ${max}.` };
  }
  return { ok: true, ml };
}

// Steps -------------------------------------------------------------------------------------

export function stepsValue(text: string): { ok: true; steps: number } | { ok: false; error: string } {
  const cleaned = text.replace(/[,\s]/g, ""); // "2,500" means two thousand five hundred
  const value = cleaned === "" ? null : Number(cleaned);
  if (value === null || !Number.isInteger(value) || value < 0 || value > MAX_STEPS) {
    return { ok: false, error: `Please enter a whole number of steps, from 0 to ${MAX_STEPS.toLocaleString("en-US")}.` };
  }
  return { ok: true, steps: value };
}

// Sleep -------------------------------------------------------------------------------------

export type SleepForm = {
  mode: "times" | "total";
  bedtime: string; // HH:MM
  wakeTime: string; // HH:MM
  hours: string;
  minutes: string;
  quality: string; // "" or "1".."5"
  notes: string;
};

export const emptySleepForm = (): SleepForm => ({
  mode: "times",
  bedtime: "",
  wakeTime: "",
  hours: "",
  minutes: "",
  quality: "",
  notes: "",
});

export type SleepPayload = {
  bedtime?: string;
  wake_time?: string;
  duration_minutes?: number;
  quality?: number;
  notes?: string;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Sleep belongs to the night that ended on `date`. Bedtime is the evening before when it's later in
 * the day than the wake time (23:00 then 07:00), and the same day otherwise (01:00 then 08:00).
 */
export function buildSleepPayload(
  form: SleepForm,
  date: string,
  timeZone: string,
): { ok: true; payload: SleepPayload } | { ok: false; error: string } {
  const payload: SleepPayload = {};

  if (form.mode === "times") {
    if (!TIME.test(form.bedtime) || !TIME.test(form.wakeTime)) {
      return { ok: false, error: "Please enter both your bedtime and your wake-up time." };
    }
    if (form.bedtime === form.wakeTime) {
      return { ok: false, error: "Your bedtime and wake-up time can't be the same." };
    }
    const bedDate = form.bedtime > form.wakeTime ? addDays(date, -1) : date;
    payload.bedtime = zonedInstantIso(bedDate, form.bedtime, timeZone);
    payload.wake_time = zonedInstantIso(date, form.wakeTime, timeZone);
  } else {
    const hours = form.hours.trim() === "" ? 0 : parseNumber(form.hours);
    const minutes = form.minutes.trim() === "" ? 0 : parseNumber(form.minutes);
    if (hours === null || minutes === null || !Number.isInteger(hours) || !Number.isInteger(minutes)) {
      return { ok: false, error: "Please enter whole hours and minutes." };
    }
    const total = hours * 60 + minutes;
    if (hours < 0 || minutes < 0 || minutes >= 60 || total < 1 || total > MAX_SLEEP_MINUTES) {
      return { ok: false, error: "Please enter between 1 minute and 24 hours (minutes from 0 to 59)." };
    }
    payload.duration_minutes = total;
  }

  if (form.quality !== "") {
    const quality = Number(form.quality);
    if (!Number.isInteger(quality) || quality < SLEEP_QUALITY_RANGE.min || quality > SLEEP_QUALITY_RANGE.max) {
      return { ok: false, error: "Sleep quality should be from 1 to 5." };
    }
    payload.quality = quality;
  }
  const notes = form.notes.trim();
  if (notes.length > 500) return { ok: false, error: "Please keep notes under 500 characters." };
  if (notes) payload.notes = notes;
  return { ok: true, payload };
}
