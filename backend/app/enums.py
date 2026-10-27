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
