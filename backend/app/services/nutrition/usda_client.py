"""Thin client for USDA FoodData Central. Only the backend ever talks to USDA (spec §2, §19)."""

import logging

import httpx

from app.config import USDA_BASE_URL, USDA_TIMEOUT_SECONDS, get_settings

logger = logging.getLogger(__name__)


class UsdaError(Exception):
    pass


class UsdaUnavailableError(UsdaError):
    """USDA could not be reached or gave an unusable answer. Safe to show as 'try again'."""


class UsdaNotFoundError(UsdaError):
    pass


class UsdaClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = USDA_BASE_URL,
        timeout: float = USDA_TIMEOUT_SECONDS,
        transport: httpx.BaseTransport | None = None,
    ):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._transport = transport

    def _get(self, path: str, params: dict | None = None) -> dict:
        if not self._api_key:
            logger.error("USDA_API_KEY is not configured")
            raise UsdaUnavailableError("USDA is not configured")
        try:
            # The key goes in a header so it never appears in URLs or logs.
            with httpx.Client(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={"X-Api-Key": self._api_key},
                transport=self._transport,
            ) as client:
                response = client.get(path, params=params)
        except httpx.HTTPError as exc:
            logger.warning("USDA request failed: %s", type(exc).__name__)
            raise UsdaUnavailableError("USDA request failed") from None
        if response.status_code == 404:
            raise UsdaNotFoundError(path)
        if response.status_code != 200:
            logger.warning("USDA returned HTTP %s", response.status_code)
            raise UsdaUnavailableError(f"USDA returned {response.status_code}")
        try:
            data = response.json()
        except ValueError:
            raise UsdaUnavailableError("USDA returned invalid JSON") from None
        if not isinstance(data, dict):
            raise UsdaUnavailableError("USDA returned an unexpected payload")
        return data

    def search(self, query: str, page: int, page_size: int, data_types: list[str]) -> dict:
        return self._get(
            "/foods/search",
            {
                "query": query,
                "pageNumber": page,
                "pageSize": page_size,
                "dataType": ",".join(data_types),
            },
        )

    def get_food(self, fdc_id: int) -> dict:
        return self._get(f"/food/{fdc_id}")


def get_usda_client() -> UsdaClient:
    """FastAPI dependency; tests override it with a fake."""
    return UsdaClient(get_settings().usda_api_key)
