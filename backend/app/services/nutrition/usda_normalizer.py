"""Turn USDA FoodData Central payloads into the internal nutrition model (spec §19, §23).

USDA reports nutrients per 100 g. Search results and detail records use different shapes,
so both are handled. A nutrient that is absent or null becomes None, never 0.
"""

from app.schemas.nutrition import FoodItem, Micronutrient, NutritionPer100g, Portion

# Energy: kcal is nutrient 1008; Foundation foods often only carry the Atwater energies.
ENERGY_NUTRIENT_IDS = (1008, 2047, 2048)
PROTEIN_ID = 1003
FAT_ID = 1004
CARBOHYDRATE_ID = 1005
FIBER_ID = 1079

# key -> (USDA nutrient id, unit stored for that key)
MICRONUTRIENTS: dict[str, tuple[int, str]] = {
    "calcium": (1087, "mg"),
    "iron": (1089, "mg"),
    "magnesium": (1090, "mg"),
    "potassium": (1092, "mg"),
    "sodium": (1093, "mg"),
    "zinc": (1095, "mg"),
    "vitamin_c": (1162, "mg"),
    "vitamin_e": (1109, "mg"),
    "vitamin_a_rae": (1106, "µg"),
    "vitamin_d": (1114, "µg"),
    "vitamin_k": (1185, "µg"),
    "vitamin_b12": (1178, "µg"),
    "folate_dfe": (1190, "µg"),
}


def _nutrient_values(raw_nutrients: list[dict]) -> dict[int, tuple[float, str]]:
    """Map nutrient id -> (value, unit) from either USDA shape."""
    values: dict[int, tuple[float, str]] = {}
    for entry in raw_nutrients or []:
        nutrient = entry.get("nutrient")
        if nutrient is not None:  # detail shape
            nutrient_id, unit, value = nutrient.get("id"), nutrient.get("unitName"), entry.get("amount")
        else:  # search shape
            nutrient_id, unit, value = entry.get("nutrientId"), entry.get("unitName"), entry.get("value")
        if nutrient_id is None or value is None:
            continue
        values[int(nutrient_id)] = (float(value), (unit or "").lower())
    return values


def _energy_kcal(values: dict[int, tuple[float, str]]) -> float | None:
    for nutrient_id in ENERGY_NUTRIENT_IDS:
        entry = values.get(nutrient_id)
        if entry is not None and entry[1] in ("kcal", ""):
            return entry[0]
    return None


def _micros(values: dict[int, tuple[float, str]]) -> dict[str, Micronutrient]:
    micros = {}
    for key, (nutrient_id, unit) in MICRONUTRIENTS.items():
        entry = values.get(nutrient_id)
        if entry is not None:
            micros[key] = Micronutrient(amount=entry[0], unit=unit)
    return micros


def _portions(raw: dict) -> list[Portion]:
    portions = []
    for portion in raw.get("foodPortions") or []:
        grams = portion.get("gramWeight")
        if not grams or grams <= 0:
            continue
        description = portion.get("portionDescription")
        if not description or description.lower() == "quantity not specified":
            amount = portion.get("amount")
            unit = (portion.get("measureUnit") or {}).get("name")
            modifier = portion.get("modifier")
            parts = [str(amount) if amount else None]
            parts += [unit if unit and unit != "undetermined" else None, modifier]
            description = " ".join(p for p in parts if p)
        if description:
            portions.append(Portion(description=description, gram_weight=float(grams)))

    serving = raw.get("servingSize")
    unit = str(raw.get("servingSizeUnit") or "").lower()
    if serving and serving > 0 and unit in ("g", "grm"):
        label = raw.get("householdServingFullText") or f"{serving:g} g serving"
        portions.append(Portion(description=label, gram_weight=float(serving)))
    return portions


def normalize_food(raw: dict) -> FoodItem:
    values = _nutrient_values(raw.get("foodNutrients"))

    def get(nutrient_id: int) -> float | None:
        entry = values.get(nutrient_id)
        return entry[0] if entry is not None else None

    return FoodItem(
        fdc_id=int(raw["fdcId"]),
        name=str(raw.get("description") or "").strip() or f"Food {raw['fdcId']}",
        data_type=str(raw.get("dataType") or "Unknown"),
        brand=(raw.get("brandOwner") or raw.get("brandName") or None),
        portions=_portions(raw),
        nutrition_per_100g=NutritionPer100g(
            calories=_energy_kcal(values),
            protein_g=get(PROTEIN_ID),
            carbohydrate_g=get(CARBOHYDRATE_ID),
            fat_g=get(FAT_ID),
            fiber_g=get(FIBER_ID),
            micronutrients=_micros(values),
        ),
    )
