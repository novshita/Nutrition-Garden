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

export type Mood = "GREAT" | "GOOD" | "OKAY" | "LOW" | "ROUGH";
export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type NutritionTotals = {
  calories: number | null;
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  items_logged: number;
  /** For each nutrient, how many logged foods had no value. A total can then be read as "at least". */
  items_missing: Record<string, number>;
};

export type PlannedWorkout = {
  weekday: Weekday;
  is_rest_day: boolean;
  template_id: string | null;
  template_name: string | null;
};

export type CompletedWorkout = {
  id: string;
  template_name: string | null;
  duration_seconds: number;
  estimated_calories: number | null;
};

/** One local day across every tracker; this is also the end-of-day summary. */
export type DayOverview = {
  date: string;
  calories: { consumed: number | null; target: number | null; remaining: number | null };
  protein: { consumed_g: number | null; target_g: number | null };
  nutrition: NutritionTotals;
  water_ml: number;
  sleep_minutes: number | null;
  steps: number | null;
  mood: Mood | null;
  weight_kg: number | null;
  workout: { planned: PlannedWorkout | null; completed: CompletedWorkout[] };
  garden: {
    growth_points: number;
    growth_stage: number;
    bunny_stage: number;
    points_earned: number;
    actions: GrowthAction[];
  };
};
