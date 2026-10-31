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

export type WeightEntry = { id: string; recorded_at: string; weight_kg: number; note: string | null };

export type TrendState =
  | "INSUFFICIENT_DATA"
  | "STABLE"
  | "INCREASING"
  | "DECREASING"
  | "INCREASING_FAST"
  | "DECREASING_FAST";

export type WeightTrend = {
  state: TrendState;
  current_average_kg: number | null;
  previous_average_kg: number | null;
  weekly_change_kg: number | null;
  days_with_data: number;
  /** 7-day rolling average for each day with a weigh-in. */
  series: { date: string; average_kg: number }[];
};

/** Informational only; never a diagnosis (product spec §8). */
export type Bmi = { bmi: number; weight_kg: number; height_cm: number };

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "CUSTOM";
export type ExerciseType = "REPS" | "TIME" | "COMBINED";
export type ExerciseCategory =
  | "UPPER_BODY"
  | "LOWER_BODY"
  | "CORE"
  | "FULL_BODY"
  | "CARDIO"
  | "HIIT"
  | "MOBILITY"
  | "STRETCHING"
  | "YOGA";

export type WorkoutExercise = {
  id: string;
  exercise_name: string;
  exercise_type: ExerciseType;
  category: ExerciseCategory;
  order_index: number;
  default_sets: number;
  default_reps: number | null;
  default_duration_seconds: number | null;
  rest_seconds: number;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string | null;
  difficulty: Difficulty;
  exercises: WorkoutExercise[];
};

export type ScheduleDay = {
  weekday: Weekday;
  is_rest_day: boolean;
  template_id: string | null;
  template_name: string | null;
};

export type WorkoutSession = {
  id: string;
  template_id: string | null;
  template_name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  /** A rough estimate for information only; it never changes the food goal. */
  estimated_calories: number | null;
  notes: string | null;
  sets: {
    exercise_id: string | null;
    set_number: number;
    repetitions: number | null;
    duration_seconds: number | null;
    completed: boolean;
  }[];
};

export type GardenItem = {
  id: string;
  item_type: string;
  item_key: string;
  placed: boolean;
  position: { x: number; y: number } | null;
  rotation: number | null;
  unlocked_at: string;
};

export type MilestoneType =
  | "FIRST_LOG"
  | "FIRST_WEEK"
  | "WORKOUT_STREAK"
  | "HYDRATION_MILESTONE"
  | "WEIGHT_MILESTONE"
  | "GARDEN_STAGE";

export type Milestone = { milestone_type: MilestoneType; trigger_value: number; unlocked_at: string };

export type CalendarDay = {
  date: string;
  planned_workout: { is_rest_day: boolean; template_name: string | null } | null;
  workouts_completed: number;
  calories: number | null;
  food_items_logged: number;
  weight_kg: number | null;
  water_ml: number;
  sleep_minutes: number | null;
  mood: Mood | null;
  steps: number | null;
  has_activity: boolean;
};

export type CalorieTargetSource = "INITIAL_ESTIMATE" | "USER_ADJUSTED" | "ACCEPTED_SUGGESTION";

export type CalorieTarget = {
  target_kcal: number;
  source: CalorieTargetSource;
  reason: string | null;
  effective_from: string;
  effective_until: string | null;
};

export type CalorieTargetHistory = { current: CalorieTarget | null; history: CalorieTarget[] };

/** A suggestion to review the goal. It is only ever applied when the person accepts it. */
export type CalorieSuggestion = {
  status: "INSUFFICIENT_DATA" | "NO_CHANGE_SUGGESTED" | "REVIEW_SUGGESTED";
  reason: "STABLE_WEIGHT" | "WEIGHT_RISING_FAST" | null;
  trend_state: TrendState;
  weekly_change_kg: number | null;
  evaluated_from: string;
  evaluated_to: string;
  weigh_in_days: number;
  current_target_kcal: number;
  suggested_target_kcal: number | null;
  days_until_evaluation: number | null;
};
