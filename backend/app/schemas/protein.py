from datetime import date

from pydantic import BaseModel


class ProteinGuide(BaseModel):
    """A gentle reminder of what many people aim for at this weight. Not a target."""

    weight_kg: float
    low_g_per_day: int
    high_g_per_day: int
    low_g_per_week: int
    high_g_per_week: int


class ProteinDay(BaseModel):
    date: date
    # None when nothing with protein data was logged that day (not zero).
    protein_g: float | None
    foods_missing_protein: int


class ProteinWeek(BaseModel):
    start_date: date
    end_date: date
    days: list[ProteinDay]
    total_g: float | None
    days_with_protein: int
    # Over the days that have protein data, so a day you didn't log isn't treated as zero.
    average_g_per_day: float | None
    foods_missing_protein: int
    guide: ProteinGuide | None
