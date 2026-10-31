"""The one place that talks to OpenAI. Keys stay server-side; failures never take the app down.

Everything the model returns goes through a Pydantic model (structured output), and callers still
validate the content afterwards. If AI is unavailable the rest of the app keeps working (spec §65).
"""

import logging
from typing import Protocol, TypeVar

import openai
from pydantic import BaseModel, ValidationError

from app.config import AI_DEFAULT_MODEL, AI_TIMEOUT_SECONDS, get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class AiError(Exception):
    pass


class AiUnavailableError(AiError):
    """AI isn't configured, can't be reached, or refused. Safe to show as 'try again later'."""


class AiInvalidOutputError(AiError):
    """The model answered, but not with something usable."""


class AiLimitError(AiError):
    """The person has used today's AI allowance."""


class AiClient(Protocol):
    def parse(self, *, instructions: str, input_text: str, output_model: type[T]) -> T: ...


class OpenAiClient:
    def __init__(self, api_key: str, model: str | None = None):
        self._api_key = api_key
        self._model = model or AI_DEFAULT_MODEL
        self._client = (
            openai.OpenAI(api_key=api_key, timeout=AI_TIMEOUT_SECONDS, max_retries=1) if api_key else None
        )

    def parse(self, *, instructions: str, input_text: str, output_model: type[T]) -> T:
        if self._client is None:
            logger.error("OPENAI_API_KEY is not configured")
            raise AiUnavailableError("AI is not configured")
        try:
            response = self._client.responses.parse(
                model=self._model,
                instructions=instructions,
                input=input_text,
                text_format=output_model,
                store=False,  # don't keep the person's data on the provider's side
            )
        except openai.OpenAIError as exc:
            # Log the kind of failure only; never the request, which holds personal data.
            logger.warning("OpenAI request failed: %s", type(exc).__name__)
            raise AiUnavailableError("AI request failed") from None
        except ValidationError:
            raise AiInvalidOutputError("The model's answer didn't match the expected shape") from None
        parsed = response.output_parsed
        if parsed is None:
            raise AiInvalidOutputError("The model gave no usable answer")
        return parsed


def get_ai_client() -> AiClient:
    """FastAPI dependency; tests override it with a fake."""
    settings = get_settings()
    return OpenAiClient(settings.openai_api_key, settings.ai_model)
