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
MAX_STEPS_PER_DAY = 200_000
MAX_SLEEP_MINUTES = 24 * 60
SLEEP_QUALITY_MIN = 1
SLEEP_QUALITY_MAX = 5

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
