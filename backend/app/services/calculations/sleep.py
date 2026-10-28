from datetime import datetime

from app.config import MAX_SLEEP_MINUTES


def duration_minutes(bedtime: datetime, wake_time: datetime) -> int:
    """Whole minutes asleep, calculated from timestamps (spec §33)."""
    minutes = int((wake_time - bedtime).total_seconds() // 60)
    if minutes <= 0:
        raise ValueError("wake_time must be after bedtime")
    if minutes > MAX_SLEEP_MINUTES:
        raise ValueError("Sleep cannot be longer than 24 hours")
    return minutes
