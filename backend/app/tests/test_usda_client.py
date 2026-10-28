import httpx
import pytest

from app.services.nutrition.usda_client import (
    UsdaClient,
    UsdaNotFoundError,
    UsdaUnavailableError,
)

SECRET = "super-secret-key"


def make_client(handler, api_key=SECRET):
    return UsdaClient(api_key, base_url="https://usda.test/fdc/v1", transport=httpx.MockTransport(handler))


def test_search_sends_key_in_header_not_url():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return httpx.Response(200, json={"foods": []})

    make_client(handler).search("egg", 2, 10, ["Foundation", "SR Legacy"])
    request = seen["request"]
    assert request.headers["X-Api-Key"] == SECRET
    assert SECRET not in str(request.url)
    assert request.url.path == "/fdc/v1/foods/search"
    params = dict(request.url.params)
    assert params == {
        "query": "egg",
        "pageNumber": "2",
        "pageSize": "10",
        "dataType": "Foundation,SR Legacy",
    }


def test_get_food_path():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json={"fdcId": 1})

    assert make_client(handler).get_food(1) == {"fdcId": 1}
    assert seen["path"] == "/fdc/v1/food/1"


def test_404_is_not_found():
    with pytest.raises(UsdaNotFoundError):
        make_client(lambda r: httpx.Response(404)).get_food(1)


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500, 503])
def test_error_statuses_are_unavailable(status):
    with pytest.raises(UsdaUnavailableError):
        make_client(lambda r: httpx.Response(status)).get_food(1)


def test_network_failure_is_unavailable_and_hides_details():
    def handler(request):
        raise httpx.ConnectTimeout(f"timeout talking to {request.url}")

    with pytest.raises(UsdaUnavailableError) as exc:
        make_client(handler).get_food(1)
    assert SECRET not in str(exc.value)


@pytest.mark.parametrize("body", [b"not json", b"[1, 2]"])
def test_bad_payload_is_unavailable(body):
    with pytest.raises(UsdaUnavailableError):
        make_client(lambda r: httpx.Response(200, content=body)).get_food(1)


def test_missing_api_key_makes_no_request():
    called = []

    def handler(request):
        called.append(request)
        return httpx.Response(200, json={})

    with pytest.raises(UsdaUnavailableError):
        make_client(handler, api_key="").get_food(1)
    assert called == []
