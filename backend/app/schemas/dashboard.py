import uuid
from datetime import date

from pydantic import BaseModel

from app.enums import GrowthAction, Mood, Weekday
from app.schemas.food_log import NutritionTotalsOut
from app.schemas.protein import ProteinGuide


class CaloriesOverview(BaseModel):
    consumed: float | None
    target: int | None
    # Never negative: going over is not an error state (product spec §32).
    remaining: float | None


class ProteinOverview(BaseModel):
    consumed_g: float | None
    # A gentle reminder for this body weight, never a target.
    guide: ProteinGuide | None = None


class PlannedWorkout(BaseModel):
    weekday: Weekday
    is_rest_day: bool
    template_id: uuid.UUID | None
    template_name: str | None


class CompletedWorkout(BaseModel):
    id: uuid.UUID
    template_name: str | None
    duration_seconds: int
    estimated_calories: int | None


class WorkoutOverview(BaseModel):
    planned: PlannedWorkout | None
    completed: list[CompletedWorkout]


class GardenOverview(BaseModel):
    growth_points: int
    growth_stage: int
    bunny_stage: int
    points_earned: int
    actions: list[GrowthAction]


class DayOverview(BaseModel):
    """One local day across every tracker; also the end-of-day summary (product spec §28)."""

    date: date
    calories: CaloriesOverview
    protein: ProteinOverview
    nutrition: NutritionTotalsOut
    water_ml: int
    water_target_ml: int
    sleep_minutes: int | None
    steps: int | None
    mood: Mood | None
    weight_kg: float | None
    workout: WorkoutOverview
    garden: GardenOverview


class CalendarPlanned(BaseModel):
    is_rest_day: bool
    template_name: str | None


class CalendarDay(BaseModel):
    date: date
    planned_workout: CalendarPlanned | None
    workouts_completed: int
    calories: float | None
    food_items_logged: int
    weight_kg: float | None
    water_ml: int
    sleep_minutes: int | None
    mood: Mood | None
    steps: int | None
    has_activity: bool
