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
