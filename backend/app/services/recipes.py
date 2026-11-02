"""A person's own recipes, and logging a serving of one as a meal (product spec §18)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import config
from app.models import Recipe, User
from app.schemas.food_log import CustomItemIn, FoodLogCreate
from app.schemas.recipes import RecipeIn, RecipeLogRequest
from app.services.errors import ConflictError, NotFoundError

NUTRIENT_FIELDS = ("calories", "protein_g", "carbohydrate_g", "fat_g", "fiber_g")


def _apply(recipe: Recipe, data: RecipeIn) -> None:
    recipe.name = data.name
    recipe.description = data.description
    recipe.servings = data.servings
    recipe.serving_size = data.serving_size
    for field in NUTRIENT_FIELDS:
        setattr(recipe, field, getattr(data, field))
    recipe.ingredients = data.ingredients
    recipe.alternatives = data.alternatives
    recipe.instructions = data.instructions


def list_recipes(db: Session, user: User) -> list[Recipe]:
    return list(db.scalars(select(Recipe).where(Recipe.user_id == user.id).order_by(func.lower(Recipe.name), Recipe.id)))


def _owned(db: Session, user: User, recipe_id: uuid.UUID) -> Recipe:
    recipe = db.scalar(select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id))
    if recipe is None:
        raise NotFoundError
    return recipe


get_recipe = _owned


def create_recipe(db: Session, user: User, data: RecipeIn) -> Recipe:
    count = db.scalar(select(func.count(Recipe.id)).where(Recipe.user_id == user.id)) or 0
    if count >= config.MAX_RECIPES_PER_USER:
        raise ConflictError("That's a lot of recipes. Delete a few to make room.")
    recipe = Recipe(user_id=user.id)
    _apply(recipe, data)
    db.add(recipe)
    db.flush()
    return recipe


def update_recipe(db: Session, user: User, recipe_id: uuid.UUID, data: RecipeIn) -> Recipe:
    recipe = _owned(db, user, recipe_id)
    _apply(recipe, data)
    db.flush()
    return recipe


def delete_recipe(db: Session, user: User, recipe_id: uuid.UUID) -> None:
    db.delete(_owned(db, user, recipe_id))
    db.flush()


def _scaled(value, servings: float) -> float | None:
    """Per-serving value times servings, rounded. Unknown stays unknown, never zero."""
    return None if value is None else round(float(value) * servings, 2)


def build_log_request(db: Session, user: User, recipe_id: uuid.UUID, data: RecipeLogRequest) -> FoodLogCreate:
    """A food log for `servings` of the recipe. The food log snapshots the values, so editing or
    deleting the recipe later never changes what was logged."""
    recipe = _owned(db, user, recipe_id)
    if recipe.calories is None:
        raise ConflictError("Add calories to this recipe first, so a serving can be logged.")
    values = {field: _scaled(getattr(recipe, field), data.servings) for field in NUTRIENT_FIELDS}
    item = CustomItemIn(
        food_source="CUSTOM",
        food_name=recipe.name,
        quantity=data.servings,
        unit="serving",
        calories=values["calories"],
        protein_g=values["protein_g"],
        carbohydrate_g=values["carbohydrate_g"],
        fat_g=values["fat_g"],
        fiber_g=values["fiber_g"],
    )
    return FoodLogCreate(meal_type=data.meal_type, consumed_at=data.consumed_at, items=[item])
