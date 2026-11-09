"""Protein summaries (product spec: protein is tracked, not targeted). Unknown (None) is never zero."""

from collections.abc import Sequence
from datetime import date, timedelta

from app.config import PROTEIN_GUIDE_G_PER_KG, PROTEIN_SUMMARY_DAYS
from app.schemas.protein import ProteinDay, ProteinGuide, ProteinWeek
from app.services.calculations.nutrition import NutritionTotals, sum_known


def protein_guide(weight_kg: float | None) -> ProteinGuide | None:
    """The range many people aim for at this body weight, or None if weight isn't known."""
    if weight_kg is None or weight_kg <= 0:
        return None
    low, high = (round(weight_kg * factor) for factor in PROTEIN_GUIDE_G_PER_KG)
    return ProteinGuide(
        weight_kg=round(weight_kg, 1),
        low_g_per_day=low,
        high_g_per_day=high,
        low_g_per_week=low * PROTEIN_SUMMARY_DAYS,
        high_g_per_week=high * PROTEIN_SUMMARY_DAYS,
    )


def summarize_week(
    end: date, totals_by_day: Sequence[NutritionTotals], weight_kg: float | None
) -> ProteinWeek:
    """`totals_by_day` is oldest first, one entry per day, ending on `end`."""
    start = end - timedelta(days=len(totals_by_day) - 1)
    days = [
        ProteinDay(
            date=start + timedelta(days=i),
            protein_g=t.protein_g,
            foods_missing_protein=t.items_missing["protein_g"],
        )
        for i, t in enumerate(totals_by_day)
    ]
    known = [d.protein_g for d in days if d.protein_g is not None]
    total = sum_known(known)
    return ProteinWeek(
        start_date=start,
        end_date=end,
        days=days,
        total_g=total,
        days_with_protein=len(known),
        average_g_per_day=round(total / len(known), 1) if total is not None else None,
        foods_missing_protein=sum(d.foods_missing_protein for d in days),
        guide=protein_guide(weight_kg),
    )
