from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import UsdaFoodCache


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correct-horse", "display_name": "Rose"},
        ).status_code
        == 201
    )


def test_requires_authentication(client, usda):
    assert client.get("/api/v1/food/search", params={"query": "egg"}).status_code == 401
    assert client.get("/api/v1/food/171287").status_code == 401
    assert usda.search_calls == [] and usda.food_calls == []


def test_search_returns_normalized_results(client, usda):
    signup(client)
    body = client.get("/api/v1/food/search", params={"query": " egg "}).json()
    assert body["source"] == "usda"
    assert body["total_hits"] == 2
    assert body["results"][0]["name"] == "Egg, whole, raw, fresh"
    assert body["results"][0]["nutrition_per_100g"]["calories"] == 143
    assert body["results"][1]["brand"] == "Sunny Farms"
    assert usda.search_calls[0] == ("egg", 1, 25, ["Foundation", "SR Legacy"])


def test_branded_foods_are_opt_in(client, usda):
    signup(client)
    client.get("/api/v1/food/search", params={"query": "egg", "include_branded": "true"})
    assert usda.search_calls[0][3] == ["Foundation", "SR Legacy", "Branded"]


@pytest.mark.parametrize(
    "params",
    [{"query": "e"}, {"query": "x" * 101}, {"query": "egg", "page": 0}, {"query": "egg", "page_size": 51}, {}],
)
def test_invalid_search_rejected_before_calling_usda(client, usda, params):
    signup(client)
    assert client.get("/api/v1/food/search", params=params).status_code == 422
    assert usda.search_calls == []


def test_food_detail_is_fetched_then_cached(client, usda, db):
    signup(client)
    first = client.get("/api/v1/food/168878").json()
    assert first["source"] == "usda" and first["stale"] is False
    assert first["food"]["nutrition_per_100g"]["fat_g"] is None
    assert [p["description"] for p in first["food"]["portions"]] == ["1 cup", "1/2 cup"]

    second = client.get("/api/v1/food/168878").json()
    assert second["source"] == "cache"
    assert second["food"] == first["food"]
    assert usda.food_calls == [168878]  # second call never reached USDA
    assert len(db.scalars(select(UsdaFoodCache)).all()) == 1


def test_expired_cache_is_refreshed_without_duplicating(client, usda, db):
    signup(client)
    client.get("/api/v1/food/168878")
    row = db.scalar(select(UsdaFoodCache))
    row.fetched_at = datetime.now(UTC) - timedelta(days=31)
    db.flush()
    assert client.get("/api/v1/food/168878").json()["source"] == "usda"
    assert usda.food_calls == [168878, 168878]
    assert len(db.scalars(select(UsdaFoodCache)).all()) == 1


def test_stale_cache_served_when_usda_is_down(client, usda, db):
    signup(client)
    client.get("/api/v1/food/168878")
    db.scalar(select(UsdaFoodCache)).fetched_at = datetime.now(UTC) - timedelta(days=60)
    db.flush()
    usda.unavailable = True
    body = client.get("/api/v1/food/168878").json()
    assert body["source"] == "cache" and body["stale"] is True


def test_uncached_food_with_usda_down_returns_safe_503(client, usda):
    signup(client)
    usda.unavailable = True
    r = client.get("/api/v1/food/168878")
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"]
    assert "USDA" not in r.json()["detail"] and "down" not in r.json()["detail"]


def test_unknown_food_is_404_and_bad_ids_422(client, usda):
    signup(client)
    assert client.get("/api/v1/food/999999999").status_code == 404
    assert client.get("/api/v1/food/0").status_code == 422
    assert client.get("/api/v1/food/abc").status_code == 422


def test_search_falls_back_to_previously_used_foods(client, usda):
    signup(client)
    client.get("/api/v1/food/168878")
    client.get("/api/v1/food/171287")
    usda.unavailable = True
    body = client.get("/api/v1/food/search", params={"query": "rice"}).json()
    assert body["source"] == "cache"
    assert [f["fdc_id"] for f in body["results"]] == [168878]
    assert body["total_hits"] == 1
    # Nothing cached for this query: still a clean, empty answer so the UI can offer retry/manual.
    empty = client.get("/api/v1/food/search", params={"query": "pizza"}).json()
    assert empty["source"] == "cache" and empty["results"] == []


def test_cache_search_does_not_treat_like_wildcards_as_wildcards(client, usda):
    signup(client)
    client.get("/api/v1/food/168878")
    usda.unavailable = True
    for query in ("%%", "__", "r%e"):
        assert client.get("/api/v1/food/search", params={"query": query}).json()["results"] == []


def test_cached_food_data_is_shared_reference_data(client, usda):
    signup(client, "a@example.com")
    client.get("/api/v1/food/168878")
    signup(client, "b@example.com")
    assert client.get("/api/v1/food/168878").json()["source"] == "cache"
