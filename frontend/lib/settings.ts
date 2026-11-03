/**
 * Profile settings rules. Reuses onboarding's validation, and only ever sends the details the person
 * actually changed, so a unit switch alone can never drift a stored height or weight.
 */

import {
  buildProfilePayload,
  convertFormUnits,
  type FieldKey,
  type OnboardingForm,
} from "@/lib/onboarding";
import type { ActivityLevel, ProfileSummary, Sex, UnitSystem } from "@/lib/types/api";
import { cmToFtIn, kgToLb, round } from "@/lib/units";

/** Which numeric fields the person has typed in. Switching units doesn't count as editing. */
export type Touched = { height: boolean; goalWeight: boolean };
export const untouched = (): Touched => ({ height: false, goalWeight: false });

export type ProfileChanges = {
  date_of_birth?: string;
  sex?: Sex;
  height_cm?: number;
  goal_weight_kg?: number;
  preferred_unit_system?: UnitSystem;
  activity_level?: ActivityLevel;
  timezone?: string;
};

/** The form as the saved profile looks in `unit`, built straight from the stored metric values. */
export function formFromProfile(
  summary: ProfileSummary,
  unit: UnitSystem = summary.profile.preferred_unit_system,
): OnboardingForm {
  const { profile } = summary;
  const metric = unit === "METRIC";
  const shown = (kg: number) => String(round(metric ? kg : kgToLb(kg), 1));
  const feet = cmToFtIn(profile.height_cm);
  return {
    dateOfBirth: profile.date_of_birth,
    sex: profile.sex,
    unitSystem: unit,
    heightCm: metric ? String(round(profile.height_cm, 1)) : "",
    heightFt: metric ? "" : String(feet.feet),
    heightIn: metric ? "" : String(feet.inches),
    weight: shown(summary.current_weight_kg),
    goalWeight: shown(profile.goal_weight_kg),
    activityLevel: profile.activity_level,
    timezone: profile.timezone,
  };
}

/**
 * Switch the display units. What the person typed is converted; everything else is shown fresh from
 * the stored values, so toggling back and forth never changes anything that was left alone.
 */
export function switchUnits(
  form: OnboardingForm,
  summary: ProfileSummary,
  touched: Touched,
  to: UnitSystem,
): OnboardingForm {
  if (form.unitSystem === to) return form;
  const converted = convertFormUnits(form, to);
  const fresh = formFromProfile(summary, to);
  return {
    ...converted,
    heightCm: touched.height ? converted.heightCm : fresh.heightCm,
    heightFt: touched.height ? converted.heightFt : fresh.heightFt,
    heightIn: touched.height ? converted.heightIn : fresh.heightIn,
    goalWeight: touched.goalWeight ? converted.goalWeight : fresh.goalWeight,
    weight: fresh.weight,
  };
}

export type ChangesResult =
  | { ok: true; changes: ProfileChanges }
  | { ok: false; errors: Partial<Record<FieldKey, string>> };

/** Validate the form and work out exactly what changed. An empty `changes` means nothing to save. */
export function buildProfileChanges(
  form: OnboardingForm,
  summary: ProfileSummary,
  touched: Touched,
  today: Date = new Date(),
): ChangesResult {
  const built = buildProfilePayload(form, today);
  if (!built.ok) {
    // The current weight is shown but isn't editable here, so it can't be what's wrong.
    const errors = { ...built.errors };
    delete errors.weight;
    return { ok: false, errors };
  }

  const saved = summary.profile;
  const next = built.payload;
  const changes: ProfileChanges = {};
  if (next.date_of_birth !== saved.date_of_birth) changes.date_of_birth = next.date_of_birth;
  if (next.sex !== saved.sex) changes.sex = next.sex;
  if (next.activity_level !== saved.activity_level) changes.activity_level = next.activity_level;
  if (next.timezone !== saved.timezone) changes.timezone = next.timezone;
  if (next.preferred_unit_system !== saved.preferred_unit_system) {
    changes.preferred_unit_system = next.preferred_unit_system;
  }
  if (touched.height) changes.height_cm = next.height_cm;
  if (touched.goalWeight) changes.goal_weight_kg = next.goal_weight_kg;
  return { ok: true, changes };
}

/** A calm note about what a change did to the estimate. The goal itself never moves on its own. */
export function describeEstimateChange(before: ProfileSummary, after: ProfileSummary): string | null {
  const was = Math.round(before.tdee_kcal);
  const now = Math.round(after.tdee_kcal);
  if (was === now) return null;
  return (
    `Your estimated daily energy use is now about ${now.toLocaleString("en-US")} kcal ` +
    `(it was ${was.toLocaleString("en-US")}). Your daily goal stays at ` +
    `${after.calorie_target_kcal.toLocaleString("en-US")} kcal. You can review it on the Calorie goal page whenever you like.`
  );
}
