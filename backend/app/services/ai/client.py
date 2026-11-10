"""The one place that talks to the AI provider (OpenAI, or any OpenAI-compatible service such as Google
Gemini). Keys stay server-side; failures never take the app down.

Everything the model returns goes through a Pydantic model (structured output), and callers still
validate the content afterwards. If AI is unavailable the rest of the app keeps working (spec §65).
"""

import json
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


def _strip_code_fence(text: str) -> str:
    """Some providers wrap JSON in a ```json fence even when told not to."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.removesuffix("```")
    return text.strip()


class OpenAiClient:
    """OpenAI by default. With a `base_url` it speaks the widely supported chat-completions API instead,
    which is what other providers (Gemini, Groq, ...) offer. A model name is then required."""

    def __init__(self, api_key: str, model: str | None = None, base_url: str | None = None):
        self._api_key = api_key
        self._base_url = base_url or None
        self._model = model or (None if self._base_url else AI_DEFAULT_MODEL)
        self._client = (
            openai.OpenAI(
                api_key=api_key, base_url=self._base_url, timeout=AI_TIMEOUT_SECONDS, max_retries=1
            )
            if api_key
            else None
        )

    def parse(self, *, instructions: str, input_text: str, output_model: type[T]) -> T:
        if self._client is None:
            logger.error("The AI API key is not configured")
            raise AiUnavailableError("AI is not configured")
        if self._model is None:
            logger.error("AI_MODEL must be set when AI_BASE_URL is used")
            raise AiUnavailableError("AI is not configured")
        try:
            if self._base_url:
                parsed = self._parse_compatible(instructions, input_text, output_model)
            else:
                response = self._client.responses.parse(
                    model=self._model,
                    instructions=instructions,
                    input=input_text,
                    text_format=output_model,
                    store=False,  # don't keep the person's data on the provider's side
                )
                parsed = response.output_parsed
        except openai.OpenAIError as exc:
            # Log the kind of failure only; never the request, which holds personal data.
            # The status code helps diagnose a retired model (404) or a bad key (401) without leaking anything.
            logger.warning(
                "AI request failed: %s (HTTP %s)", type(exc).__name__, getattr(exc, "status_code", None)
            )
            raise AiUnavailableError("AI request failed") from None
        except (ValidationError, ValueError):
            raise AiInvalidOutputError("The model's answer didn't match the expected shape") from None
        if parsed is None:
            raise AiInvalidOutputError("The model gave no usable answer")
        return parsed

    def _parse_compatible(self, instructions: str, input_text: str, output_model: type[T]) -> T | None:
        messages = [
            {"role": "system", "content": instructions},
            {"role": "user", "content": input_text},
        ]
        try:
            response = self._client.chat.completions.parse(
                model=self._model, messages=messages, response_format=output_model
            )
            return response.choices[0].message.parsed
        except openai.BadRequestError:
            # The provider doesn't take a strict schema: ask for plain JSON and check it ourselves.
            logger.info("Provider rejected the strict schema; using JSON mode")
        schema = json.dumps(output_model.model_json_schema())
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {
                    "role": "system",
                    "content": f"{instructions}\n\nReply with one JSON object that matches this JSON "
                    f"Schema, and nothing else:\n{schema}",
                },
                messages[1],
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return output_model.model_validate_json(_strip_code_fence(content)) if content else None


def configured_key() -> str:
    settings = get_settings()
    return settings.ai_api_key or settings.openai_api_key


def ai_available() -> bool:
    """Whether AI is set up: a key, and a model name if another provider is used."""
    settings = get_settings()
    return bool(configured_key()) and (not settings.ai_base_url or bool(settings.ai_model))


def get_ai_client() -> AiClient:
    """FastAPI dependency; tests override it with a fake."""
    settings = get_settings()
    return OpenAiClient(configured_key(), settings.ai_model or None, settings.ai_base_url or None)
