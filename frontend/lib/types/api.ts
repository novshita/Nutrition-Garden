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

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export type Micronutrient = { amount: number; unit: string };

/** Nutrition per 100 g from USDA. null means unknown, never zero. */
export type NutritionPer100g = {
  calories: number | null;
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  micronutrients: Record<string, Micronutrient>;
};

export type Portion = { description: string; gram_weight: number };

export type FoodItem = {
  fdc_id: number;
  name: string;
  data_type: string;
  brand: string | null;
  portions: Portion[];
  nutrition_per_100g: NutritionPer100g;
};

export type FoodSearchResponse = {
  query: string;
  page: number;
  total_hits: number;
  total_pages: number;
  results: FoodItem[];
  /** "cache" means USDA couldn't be reached and only previously used foods are listed. */
  source: "usda" | "cache";
};

export type FoodDetailResponse = { food: FoodItem; source: "usda" | "cache"; stale: boolean };

export type FoodLogItem = {
  id: string;
  food_source: "USDA" | "CUSTOM" | "AI_INTERPRETED";
  external_food_id: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  serving_size: number | null;
  calories: number | null;
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  micronutrients: Record<string, Micronutrient>;
  confidence: number | null;
};

export type FoodLog = {
  id: string;
  consumed_at: string;
  meal_type: MealType;
  source: "MANUAL" | "AI_INTERPRETED";
  notes: string | null;
  items: FoodLogItem[];
  totals: NutritionTotals;
};

export type FoodLogDay = { date: string; logs: FoodLog[] };

export type DailyNutrition = {
  date: string;
  totals: NutritionTotals;
  calorie_target_kcal: number | null;
  calories_remaining: number | null;
};

export type WaterEntry = { id: string; consumed_at: string; amount_ml: number };
export type WaterDay = { date: string; total_ml: number; entries: WaterEntry[] };

export type SleepLog = {
  sleep_date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number;
  quality: number | null;
  notes: string | null;
};

export type MoodLog = { date: string; mood: Mood; note: string | null };
export type StepsLog = { date: string; steps: number };
