"""Hand-written payloads shaped like USDA FoodData Central responses (no network in tests)."""

EGG_SEARCH_ITEM = {
    "fdcId": 171287,
    "description": "Egg, whole, raw, fresh",
    "dataType": "SR Legacy",
    "foodNutrients": [
        {"nutrientId": 1008, "nutrientName": "Energy", "unitName": "KCAL", "value": 143},
        {"nutrientId": 1003, "nutrientName": "Protein", "unitName": "G", "value": 12.56},
        {"nutrientId": 1004, "nutrientName": "Total lipid (fat)", "unitName": "G", "value": 9.51},
        {"nutrientId": 1005, "nutrientName": "Carbohydrate", "unitName": "G", "value": 0.72},
        {"nutrientId": 1079, "nutrientName": "Fiber", "unitName": "G", "value": 0},
        {"nutrientId": 1087, "nutrientName": "Calcium", "unitName": "MG", "value": 56},
    ],
}

BRANDED_SEARCH_ITEM = {
    "fdcId": 2000001,
    "description": "CRUNCHY GRANOLA",
    "dataType": "Branded",
    "brandOwner": "Sunny Farms",
    "servingSize": 30,
    "servingSizeUnit": "g",
    "householdServingFullText": "1/3 cup",
    "foodNutrients": [
        {"nutrientId": 1008, "unitName": "KCAL", "value": 450},
        {"nutrientId": 1003, "unitName": "G", "value": 9},
    ],
}

SEARCH_RESPONSE = {
    "totalHits": 2,
    "currentPage": 1,
    "totalPages": 1,
    "foods": [EGG_SEARCH_ITEM, BRANDED_SEARCH_ITEM],
}

# Detail shape: nested "nutrient", Atwater energy only, fat missing, kJ-free.
RICE_DETAIL = {
    "fdcId": 168878,
    "description": "Rice, white, long-grain, cooked",
    "dataType": "Foundation",
    "foodNutrients": [
        {"nutrient": {"id": 2047, "name": "Energy (Atwater)", "unitName": "kcal"}, "amount": 130},
        {"nutrient": {"id": 1003, "name": "Protein", "unitName": "g"}, "amount": 2.69},
        {"nutrient": {"id": 1005, "name": "Carbohydrate", "unitName": "g"}, "amount": 28.2},
        {"nutrient": {"id": 1004, "name": "Total fat", "unitName": "g"}, "amount": None},
        {"nutrient": {"id": 1089, "name": "Iron", "unitName": "mg"}, "amount": 1.2},
    ],
    "foodPortions": [
        {
            "gramWeight": 158,
            "amount": 1,
            "measureUnit": {"name": "cup"},
            "modifier": "",
            "portionDescription": "Quantity not specified",
        },
        {"gramWeight": 0, "amount": 1, "measureUnit": {"name": "undetermined"}},
        {"gramWeight": 79, "portionDescription": "1/2 cup"},
    ],
}

KJ_ONLY = {
    "fdcId": 1,
    "description": "Mystery food",
    "dataType": "SR Legacy",
    "foodNutrients": [{"nutrientId": 1062, "unitName": "kJ", "value": 600}],
}
