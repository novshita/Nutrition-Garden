/** Onboarding form rules: turn what the person typed into the API payload, or say what's wrong. */

import type { ActivityLevel, Sex, UnitSystem } from "@/lib/types/api";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, round } from "@/lib/units";

// The same limits the backend enforces. The backend remains the authority.
export const LIMITS = {
  heightCm: { min: 50, max: 260 },
  weightKg: { min: 20, max: 400 },
  age: { min: 18, max: 120 },
} as const;

export type OnboardingForm = {
  dateOfBirth: string; // YYYY-MM-DD
  sex: Sex | "";
  unitSystem: UnitSystem;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string; // kg or lb, per unitSystem
  goalWeight: string;
  activityLevel: ActivityLevel | "";
  timezone: string;
};

export type FieldKey =
  | "dateOfBirth"
  | "sex"
  | "height"
  | "weight"
  | "goalWeight"
  | "activityLevel"
  | "timezone";

export type ProfilePayload = {
  date_of_birth: string;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg: number;
  preferred_unit_system: UnitSystem;
  activity_level: ActivityLevel;
  timezone: string;
};

export type BuildResult =
  | { ok: true; payload: ProfilePayload }
  | { ok: false; errors: Partial<Record<FieldKey, string>> };

export function emptyForm(timezone: string): OnboardingForm {
  return {
    dateOfBirth: "",
    sex: "",
    unitSystem: "METRIC",
    heightCm: "",
    heightFt: "",
    heightIn: "",
    weight: "",
    goalWeight: "",
    activityLevel: "",
    timezone,
  };
}

/** A typed number, or null if it's empty or not a number. Accepts a decimal comma. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Whole years between a YYYY-MM-DD birth date and `today`, or null if the date is invalid. */
export function ageOn(dateOfBirth: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null; // e.g. 2000-02-31
  }
  const [ty, tm, td] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
  if (year > ty || (year === ty && (month > tm || (month === tm && day > td)))) return -1; // future
  const hadBirthday = tm > month || (tm === month && td >= day);
  return ty - year - (hadBirthday ? 0 : 1);
}

function heightCmFromForm(form: OnboardingForm): number | null {
  if (form.unitSystem === "METRIC") return parseNumber(form.heightCm);
  const feet = parseNumber(form.heightFt);
  // Blank inches mean zero, but text that isn't a number is an error, not zero.
  const inches = form.heightIn.trim() === "" ? 0 : parseNumber(form.heightIn);
  if (feet === null || inches === null || feet < 0 || inches < 0 || inches >= 12) return null;
  return ftInToCm(feet, inches);
}

function weightKgFromText(text: string, unitSystem: UnitSystem): number | null {
  const value = parseNumber(text);
  if (value === null) return null;
  return unitSystem === "METRIC" ? value : lbToKg(value);
}

export function weightRangeText(unitSystem: UnitSystem): string {
  const { min, max } = LIMITS.weightKg;
  return unitSystem === "METRIC"
    ? `${min} and ${max} kg`
    : `${Math.ceil(kgToLb(min))} and ${Math.floor(kgToLb(max))} lb`;
}

export function buildProfilePayload(form: OnboardingForm, today: Date = new Date()): BuildResult {
  const errors: Partial<Record<FieldKey, string>> = {};

  const age = ageOn(form.dateOfBirth, today);
  if (age === null) errors.dateOfBirth = "Please enter your date of birth.";
  else if (age < 0) errors.dateOfBirth = "Your date of birth can't be in the future.";
  else if (age < LIMITS.age.min || age > LIMITS.age.max) {
    errors.dateOfBirth = `This app is for people aged ${LIMITS.age.min} to ${LIMITS.age.max}.`;
  }

  if (!form.sex) errors.sex = "Please choose one. It's used for the calorie estimate.";
  if (!form.activityLevel) errors.activityLevel = "Please choose your usual activity level.";
  if (!form.timezone.trim()) errors.timezone = "Please enter your time zone.";

  const heightCm = heightCmFromForm(form);
  if (heightCm === null || heightCm < LIMITS.heightCm.min || heightCm > LIMITS.heightCm.max) {
    errors.height =
      form.unitSystem === "METRIC"
        ? `Please enter a height between ${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm.`
        : "Please enter a height in feet and inches (inches from 0 to 11.9).";
  }

  const weightKg = weightKgFromText(form.weight, form.unitSystem);
  if (weightKg === null || weightKg < LIMITS.weightKg.min || weightKg > LIMITS.weightKg.max) {
    errors.weight = `Please enter a weight between ${weightRangeText(form.unitSystem)}.`;
  }

  const goalKg = weightKgFromText(form.goalWeight, form.unitSystem);
  if (goalKg === null || goalKg < LIMITS.weightKg.min || goalKg > LIMITS.weightKg.max) {
    errors.goalWeight = `Please enter a goal weight between ${weightRangeText(form.unitSystem)}.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      date_of_birth: form.dateOfBirth,
      sex: form.sex as Sex,
      height_cm: round(heightCm as number, 1),
      weight_kg: round(weightKg as number, 2),
      goal_weight_kg: round(goalKg as number, 2),
      preferred_unit_system: form.unitSystem,
      activity_level: form.activityLevel as ActivityLevel,
      timezone: form.timezone.trim(),
    },
  };
}

/** Switch metric/imperial and convert anything already typed, so the values keep their meaning. */
export function convertFormUnits(form: OnboardingForm, to: UnitSystem): OnboardingForm {
  if (form.unitSystem === to) return form;
  const next = { ...form, unitSystem: to };

  const convertWeight = (text: string): string => {
    const value = parseNumber(text);
    if (value === null) return text;
    return String(round(to === "IMPERIAL" ? kgToLb(value) : lbToKg(value), 1));
  };
  next.weight = convertWeight(form.weight);
  next.goalWeight = convertWeight(form.goalWeight);

  if (to === "IMPERIAL") {
    const cm = parseNumber(form.heightCm);
    if (cm !== null) {
      const { feet, inches } = cmToFtIn(cm);
      next.heightFt = String(feet);
      next.heightIn = String(inches);
    }
  } else {
    const cm = heightCmFromForm(form);
    if (cm !== null) next.heightCm = String(round(cm, 1));
  }
  return next;
}
