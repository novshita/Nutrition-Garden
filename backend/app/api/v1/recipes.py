import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import CurrentUser, DbSession
from app.api.v1.food_log import save_food_log
from app.schemas.food_log import FoodLogOut
from app.schemas.recipes import RecipeIn, RecipeLogRequest, RecipeOut
from app.services import recipes as service
from app.services.errors import ConflictError, NotFoundError
from app.services.nutrition.usda_client import UsdaClient, get_usda_client

router = APIRouter(prefix="/recipes", tags=["recipes"])

Usda = Annotated[UsdaClient, Depends(get_usda_client)]


def _handle(action):
    try:
        return action()
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recipe not found") from None
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None


@router.get("", response_model=list[RecipeOut])
def list_recipes(user: CurrentUser, db: DbSession) -> list[RecipeOut]:
    return service.list_recipes(db, user)


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
def create_recipe(body: RecipeIn, user: CurrentUser, db: DbSession) -> RecipeOut:
    recipe = _handle(lambda: service.create_recipe(db, user, body))
    out = RecipeOut.model_validate(recipe)
    db.commit()
    return out


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RecipeOut:
    return _handle(lambda: service.get_recipe(db, user, recipe_id))


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: uuid.UUID, body: RecipeIn, user: CurrentUser, db: DbSession) -> RecipeOut:
    recipe = _handle(lambda: service.update_recipe(db, user, recipe_id, body))
    out = RecipeOut.model_validate(recipe)
    db.commit()
    return out


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    _handle(lambda: service.delete_recipe(db, user, recipe_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{recipe_id}/log", response_model=FoodLogOut, status_code=status.HTTP_201_CREATED)
def log_recipe(
    recipe_id: uuid.UUID, body: RecipeLogRequest, user: CurrentUser, db: DbSession, usda: Usda
) -> FoodLogOut:
    """Log some servings of a recipe as a meal, in one step."""
    request = _handle(lambda: service.build_log_request(db, user, recipe_id, body))
    return save_food_log(request, user, db, usda)
