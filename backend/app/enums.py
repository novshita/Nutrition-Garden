from enum import Enum


class Sex(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class UnitSystem(str, Enum):
    METRIC = "METRIC"
    IMPERIAL = "IMPERIAL"


class ActivityLevel(str, Enum):
    SEDENTARY = "SEDENTARY"
    LIGHT = "LIGHT"
    MODERATE = "MODERATE"
    VERY_ACTIVE = "VERY_ACTIVE"
    EXTRA_ACTIVE = "EXTRA_ACTIVE"


class GoalType(str, Enum):
    """V1 supports gradual, sustainable weight gain only (product spec §9)."""

    GAIN_WEIGHT = "GAIN_WEIGHT"


class CalorieTargetSource(str, Enum):
    INITIAL_ESTIMATE = "INITIAL_ESTIMATE"
    USER_ADJUSTED = "USER_ADJUSTED"


class TrendState(str, Enum):
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    STABLE = "STABLE"
    INCREASING = "INCREASING"
    DECREASING = "DECREASING"
    INCREASING_FAST = "INCREASING_FAST"
    DECREASING_FAST = "DECREASING_FAST"


class Mood(str, Enum):
    GREAT = "GREAT"
    GOOD = "GOOD"
    OKAY = "OKAY"
    LOW = "LOW"
    ROUGH = "ROUGH"


class MealType(str, Enum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    DINNER = "DINNER"
    SNACK = "SNACK"


class FoodSource(str, Enum):
    """Where a logged item's nutrition came from (engineering spec §18)."""

    USDA = "USDA"
    CUSTOM = "CUSTOM"
    AI_INTERPRETED = "AI_INTERPRETED"


class LogSource(str, Enum):
    """How a food log was created."""

    MANUAL = "MANUAL"
    AI_INTERPRETED = "AI_INTERPRETED"


class Difficulty(str, Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    CUSTOM = "CUSTOM"


class ExerciseType(str, Enum):
    REPS = "REPS"
    TIME = "TIME"
    COMBINED = "COMBINED"


class ExerciseCategory(str, Enum):
    UPPER_BODY = "UPPER_BODY"
    LOWER_BODY = "LOWER_BODY"
    CORE = "CORE"
    FULL_BODY = "FULL_BODY"
    CARDIO = "CARDIO"
    HIIT = "HIIT"
    MOBILITY = "MOBILITY"
    STRETCHING = "STRETCHING"
    YOGA = "YOGA"


class Weekday(str, Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"


class GrowthAction(str, Enum):
    """Positive actions that grow the garden (engineering spec §38)."""

    FOOD_LOGGED = "FOOD_LOGGED"
    CALORIE_TARGET_MET = "CALORIE_TARGET_MET"
    WORKOUT_COMPLETED = "WORKOUT_COMPLETED"
    STEPS_LOGGED = "STEPS_LOGGED"
    WATER_LOGGED = "WATER_LOGGED"
    SLEEP_LOGGED = "SLEEP_LOGGED"
    MOOD_LOGGED = "MOOD_LOGGED"
    WEIGHT_LOGGED = "WEIGHT_LOGGED"


class MilestoneType(str, Enum):
    FIRST_LOG = "FIRST_LOG"
    FIRST_WEEK = "FIRST_WEEK"
    WORKOUT_STREAK = "WORKOUT_STREAK"
    HYDRATION_MILESTONE = "HYDRATION_MILESTONE"
    WEIGHT_MILESTONE = "WEIGHT_MILESTONE"
    GARDEN_STAGE = "GARDEN_STAGE"
