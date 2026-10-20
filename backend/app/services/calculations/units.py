"""Unit conversions between display units and canonical storage units (spec §4).

Canonical: weight kg, height cm, water ml. Imperial water uses US fluid ounces.
"""

KG_PER_LB = 0.45359237
CM_PER_INCH = 2.54
INCHES_PER_FOOT = 12
ML_PER_US_FL_OZ = 29.5735295625


def kg_to_lb(kg: float) -> float:
    return kg / KG_PER_LB


def lb_to_kg(lb: float) -> float:
    return lb * KG_PER_LB


def cm_to_ft_in(cm: float) -> tuple[int, float]:
    """Return (feet, inches) where inches is in [0, 12)."""
    total_inches = cm / CM_PER_INCH
    feet = int(total_inches // INCHES_PER_FOOT)
    return feet, total_inches - feet * INCHES_PER_FOOT


def ft_in_to_cm(feet: float, inches: float = 0.0) -> float:
    return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH


def ml_to_fl_oz(ml: float) -> float:
    return ml / ML_PER_US_FL_OZ


def fl_oz_to_ml(fl_oz: float) -> float:
    return fl_oz * ML_PER_US_FL_OZ
