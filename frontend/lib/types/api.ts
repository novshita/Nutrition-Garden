/** Shapes returned by the backend. Kept in step with the Pydantic schemas. */

export type User = {
  id: string;
  email: string;
  display_name: string;
};

export type GrowthAction =
  | "FOOD_LOGGED"
  | "CALORIE_TARGET_MET"
  | "WORKOUT_COMPLETED"
  | "STEPS_LOGGED"
  | "WATER_LOGGED"
  | "SLEEP_LOGGED"
  | "MOOD_LOGGED"
  | "WEIGHT_LOGGED";

export type Garden = {
  id: string;
  name: string;
  growth_points: number;
  growth_stage: number;
  bunny_stage: number;
  next_stage_at_points: number | null;
  points_to_next_stage: number | null;
  today_actions: GrowthAction[];
};

export type Sex = "MALE" | "FEMALE";
export type UnitSystem = "METRIC" | "IMPERIAL";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "VERY_ACTIVE" | "EXTRA_ACTIVE";

export type Profile = {
  date_of_birth: string;
  sex: Sex;
  height_cm: number;
  preferred_unit_system: UnitSystem;
  activity_level: ActivityLevel;
  goal_type: "GAIN_WEIGHT";
  goal_weight_kg: number;
  timezone: string;
};

/** The profile plus values the backend calculates. BMI is informational only (product spec §8). */
export type ProfileSummary = {
  profile: Profile;
  current_weight_kg: number;
  bmi: number;
  bmr_kcal: number;
  tdee_kcal: number;
  calorie_target_kcal: number;
};
