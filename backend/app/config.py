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
