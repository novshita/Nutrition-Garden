from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.enums import ActivityLevel

REPO_ROOT = Path(__file__).resolve().parents[2]


# Engineering spec §10: centralized, configurable activity multipliers.
ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.SEDENTARY: 1.20,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.VERY_ACTIVE: 1.725,
    ActivityLevel.EXTRA_ACTIVE: 1.90,
}


SESSION_COOKIE_NAME = "garden_session"
SESSION_LIFETIME_DAYS = 30

# Slowing down password guessing: after this many wrong passwords for one account within the window,
# further attempts are refused until the oldest of them ages out. A correct password resets the count.
LOGIN_MAX_FAILURES = 5
LOGIN_FAILURE_WINDOW_MINUTES = 15

# Bounds for a user-set calorie target (spec §42: no extreme restriction, no unsafe gain).
MIN_CALORIE_TARGET_KCAL = 1200
MAX_CALORIE_TARGET_KCAL = 6000
MIN_ONBOARDING_AGE = 18
MAX_ONBOARDING_AGE = 120

# Weight trend thresholds (spec §15: configurable). Change is kg/week, current 7 days vs previous 7.
TREND_STABLE_THRESHOLD_KG_PER_WEEK = 0.1
TREND_FAST_THRESHOLD_KG_PER_WEEK = 0.5
TREND_WINDOW_DAYS = 7
# Distinct days with a weigh-in needed across both windows before any trend is reported.
TREND_MIN_DAYS_WITH_DATA = 3

# Sanity limits for daily tracking input.
MAX_WATER_ENTRY_ML = 5000
# A simple daily goal for everyone: 2 litres, about 8 glasses of 250 ml. Shown as progress, never as a penalty.
WATER_TARGET_ML = 2000
MAX_STEPS_PER_DAY = 200_000
MAX_SLEEP_MINUTES = 24 * 60
SLEEP_QUALITY_MIN = 1
SLEEP_QUALITY_MAX = 5

# USDA FoodData Central (spec §19). The key is sent in a header and never reaches the frontend.
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
USDA_TIMEOUT_SECONDS = 10.0
USDA_CACHE_TTL_DAYS = 30

# Protein is counted and summarised, never a target: missing a number must not feel like failing. This
# only feeds a gentle "many people aim for roughly this much" reminder (grams per kg of body weight,
# a modest range for someone gaining weight). It never affects goals, the garden or any warning.
PROTEIN_GUIDE_G_PER_KG = (1.2, 1.6)
PROTEIN_SUMMARY_DAYS = 7

# Workout calorie estimates are informational only and never change the food target (spec §23, §30).
# Rough MET values for bodyweight/home exercise, adapted from the Compendium of Physical Activities.
# kcal = MET x body weight (kg) x hours.
WORKOUT_MET_BY_CATEGORY: dict[str, float] = {
    "UPPER_BODY": 3.8,
    "LOWER_BODY": 3.8,
    "CORE": 3.8,
    "FULL_BODY": 5.0,
    "CARDIO": 6.0,
    "HIIT": 8.0,
    "MOBILITY": 2.3,
    "STRETCHING": 2.3,
    "YOGA": 2.5,
}
MAX_WORKOUT_SESSION_SECONDS = 6 * 60 * 60

# Adaptive calorie suggestions (spec §12, §14). Suggestions are never applied automatically.
ADAPTIVE_WINDOW_DAYS = 28  # look at about 4 weeks of weight data
ADAPTIVE_MIN_DAYS = 21  # and never judge on less than 3 weeks since the last target change
ADAPTIVE_MIN_WEIGH_INS_PER_END_WINDOW = 2  # distinct days with a weigh-in at each end
ADAPTIVE_INCREASE_KCAL = 100

# Garden growth (spec §38-40). Everything here is configuration, not UI logic.
# A given action earns its points at most once per local day, and points never decrease (§39).
GROWTH_POINTS_PER_ACTION = 1
GROWTH_STAGE_THRESHOLDS = (0, 50, 150, 300, 500)  # stage 1..5 (spec §40)
CALORIE_TARGET_MET_RATIO = 0.9  # "reasonably met": at least 90% of the target; going over is fine
FIRST_WEEK_ACTIVE_DAYS = 7
WORKOUT_DAY_MILESTONES = (3, 7, 14, 30)  # days with a completed workout (not consecutive)
HYDRATION_DAY_MILESTONES = (7, 30)  # days with water logged
CONSISTENT_DAY_MILESTONES = (14, 30, 60, 100)  # days with anything logged (not consecutive)
WEIGHT_PROGRESS_MILESTONES_PERCENT = (25, 50, 75, 100)  # of the way from first weight to goal
DEFAULT_GARDEN_NAME = "My Nutrition Garden"

# (unlock stage, item_type, item_key). Art for each key is a frontend/design decision.
GARDEN_ITEM_CATALOG: tuple[tuple[int, str, str], ...] = (
    (1, "FLOWER", "tulip"),
    (1, "FLOWER", "daisy"),
    (1, "HABITAT", "bunny_burrow"),
    (2, "FLOWER", "sunflower"),
    (2, "PATH", "stepping_stones"),
    (2, "DECORATION", "lantern"),
    (3, "TREE", "apple_tree"),
    (3, "DECORATION", "pond"),
    (3, "MAGICAL", "butterflies"),
    (4, "TREE", "cherry_blossom_tree"),
    (4, "DECORATION", "arch_gate"),
    (4, "MAGICAL", "fairy_lights"),
    (5, "MAGICAL", "rainbow"),
    (5, "DECORATION", "crystal_fountain"),
    (5, "SEASONAL", "moon_garden"),
)

# AI (engineering spec §20, §43-48). AI is an enhancement layer: the core app never depends on it.
AI_DEFAULT_MODEL = "gpt-4o-mini"  # override with the AI_MODEL environment variable
AI_TIMEOUT_SECONDS = 30.0
AI_DAILY_CALL_LIMIT = 200  # per user per day, so an open signup can't run up the bill
AI_MAX_FOOD_TEXT = 1000
AI_MAX_CHAT_MESSAGE = 2000
AI_MAX_CHAT_HISTORY = 10  # earlier messages the client may send back
AI_FOOD_LOOKUP_ITEMS = 10  # how many interpreted foods get database matches
AI_FOOD_MATCHES_PER_ITEM = 3

# Memory: a limited amount, only ever with the person's approval (product spec §41).
MAX_APPROVED_MEMORIES = 50
MAX_PENDING_MEMORIES = 20
MAX_MEMORY_TEXT = 200
AI_CONTEXT_MEMORY_LIMIT = 20  # approved memories shared with the model
AI_MAX_MEMORY_SUGGESTIONS_PER_REPLY = 3

# The gentle evening reminder: at most one a day (engineering spec §48, product spec §38).
NUDGE_AFTER_HOUR = 18  # local time
NUDGE_BELOW_RATIO = 0.6  # of today's calorie target

# Recipes (product spec §18): your own, approximate, and easy to log.
MAX_RECIPES_PER_USER = 200
RECIPE_MAX_SERVINGS_MADE = 50
RECIPE_MAX_SERVING_CALORIES = 2000
RECIPE_MAX_SERVING_NUTRIENT_G = 500
MAX_RECIPE_LOG_SERVINGS = 10  # so a logged serving stays within the food log's own limits

# Engineering spec §12: initial default target is TDEE + 250 kcal/day.
INITIAL_SURPLUS_KCAL = 250


class Settings(BaseSettings):
    """Environment settings (engineering spec §53). Secrets never live in code."""

    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    # Required
    openai_api_key: str
    usda_api_key: str
    database_url: str
    auth_secret: str
    app_env: str

    # Optional
    ai_model: str | None = None
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
