import pytest

from app.tests.test_food_logging import RICE, custom_item, post_log, signup, usda_item
from app.tests.test_workouts import exercise, make_template, session_body
from app.tests.test_workouts import signup as workout_signup

LOGS = "/api/v1/food/log"


def item_url(log, item):
    return f"{LOGS}/{log['id']}/items/{item['id']}"


def calories(client):
    return client.get("/api/v1/nutrition/daily").json()["totals"]["calories"]


# ---- Correcting an amount ----


def test_changing_the_amount_recalculates_the_nutrition(client, usda):
    signup(client)
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    assert calories(client) == pytest.approx(130)
    r = client.patch(item_url(log, log["items"][0]), json={"quantity": 200, "unit": "g"})
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["quantity"] == 200 and item["calories"] == pytest.approx(260)
    assert item["id"] == log["items"][0]["id"]
    assert calories(client) == pytest.approx(260)


def test_the_unit_can_change_too(client, usda):
    signup(client)
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    r = client.patch(item_url(log, log["items"][0]), json={"quantity": 1, "unit": "1 cup"})
    assert r.status_code == 200 and r.json()["items"][0]["calories"] == pytest.approx(205.4)


def test_a_wrong_unit_changes_nothing(client, usda):
    signup(client)
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    r = client.patch(item_url(log, log["items"][0]), json={"quantity": 1, "unit": "handful"})
    assert r.status_code == 422
    assert calories(client) == pytest.approx(130)


def test_a_food_already_used_can_be_edited_while_the_database_is_down(client, usda):
    signup(client)
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    usda.unavailable = True  # the food is in the local cache from when it was logged
    r = client.patch(item_url(log, log["items"][0]), json={"quantity": 300, "unit": "g"})
    assert r.status_code == 200 and r.json()["items"][0]["calories"] == pytest.approx(390)


def test_a_custom_food_cannot_be_rescaled(client, usda):
    signup(client)
    log = post_log(client, [custom_item()]).json()
    r = client.patch(item_url(log, log["items"][0]), json={"quantity": 2, "unit": "bowl"})
    assert r.status_code == 422 and "add it again" in r.json()["detail"]
    assert calories(client) == 200


@pytest.mark.parametrize("body", [{"quantity": 0, "unit": "g"}, {"quantity": -1, "unit": "g"}, {"unit": "g"}])
def test_the_new_amount_must_make_sense(client, usda, body):
    signup(client)
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    assert client.patch(item_url(log, log["items"][0]), json=body).status_code == 422


def test_other_peoples_meals_cannot_be_edited(client, usda):
    signup(client, "a@example.com")
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    signup(client, "b@example.com")
    r = client.patch(item_url(log, log["items"][0]), json={"quantity": 1, "unit": "g"})
    assert r.status_code == 404
    assert client.patch(f"{LOGS}/{log['id']}/items/{log['id']}", json={"quantity": 1, "unit": "g"}).status_code == 404


def test_editing_requires_authentication(client, usda):
    signup(client)
    log = post_log(client, [usda_item(RICE, 100, "g")]).json()
    client.cookies.clear()
    assert client.patch(item_url(log, log["items"][0]), json={"quantity": 1, "unit": "g"}).status_code == 401


# ---- Deleting a recorded workout ----


def record(client):
    template = make_template(client, "Upper Body", [exercise("Push-ups")])
    r = client.post("/api/v1/workouts/sessions", json=session_body(template["id"]))
    assert r.status_code == 201
    return r.json()


def test_a_recorded_workout_can_be_deleted(client):
    workout_signup(client)
    session = record(client)
    assert client.delete(f"/api/v1/workouts/sessions/{session['id']}").status_code == 204
    assert client.get("/api/v1/workouts/sessions").json() == []
    assert client.delete(f"/api/v1/workouts/sessions/{session['id']}").status_code == 404


def test_deleting_a_workout_keeps_the_garden_growth_already_earned(client):
    workout_signup(client)
    session = record(client)
    before = client.get("/api/v1/garden").json()["growth_points"]
    assert before > 0
    client.delete(f"/api/v1/workouts/sessions/{session['id']}")
    assert client.get("/api/v1/garden").json()["growth_points"] == before


def test_other_peoples_workouts_cannot_be_deleted(client):
    workout_signup(client, "a@example.com")
    session = record(client)
    workout_signup(client, "b@example.com")
    assert client.delete(f"/api/v1/workouts/sessions/{session['id']}").status_code == 404
    client.cookies.clear()
    assert client.delete(f"/api/v1/workouts/sessions/{session['id']}").status_code == 401
