import logging

import httpx
import openai
import pytest
from pydantic import BaseModel, ValidationError

import app.services.ai.client as client_module
from app.config import AI_DEFAULT_MODEL
from app.services.ai.client import (
    AiInvalidOutputError,
    AiUnavailableError,
    OpenAiClient,
    get_ai_client,
)

REQUEST = httpx.Request("POST", "https://api.openai.com/v1/responses")


class Answer(BaseModel):
    text: str


class Parsed:
    def __init__(self, output_parsed):
        self.output_parsed = output_parsed


class StubResponses:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


def make(result=None, error=None, model=None):
    client = OpenAiClient("sk-test", model)
    stub = StubResponses(result, error)
    client._client = type("StubClient", (), {"responses": stub})()
    return client, stub


def run(client, text="hello"):
    return client.parse(instructions="be kind", input_text=text, output_model=Answer)


def test_returns_the_parsed_answer_and_asks_for_structured_output_without_storing():
    client, stub = make(Parsed(Answer(text="hi")))
    assert run(client, "my private words") == Answer(text="hi")
    call = stub.calls[0]
    assert call["model"] == AI_DEFAULT_MODEL
    assert call["instructions"] == "be kind" and call["input"] == "my private words"
    assert call["text_format"] is Answer
    assert call["store"] is False  # the provider isn't asked to keep the person's data


def test_uses_the_configured_model():
    client, stub = make(Parsed(Answer(text="hi")), model="my-model")
    run(client)
    assert stub.calls[0]["model"] == "my-model"


def test_a_missing_key_means_unavailable_without_any_request():
    client = OpenAiClient("")
    assert client._client is None
    with pytest.raises(AiUnavailableError):
        run(client)


@pytest.mark.parametrize(
    "error",
    [
        openai.APIConnectionError(request=REQUEST),
        openai.APITimeoutError(request=REQUEST),
        openai.RateLimitError("slow down", response=httpx.Response(429, request=REQUEST), body=None),
        openai.AuthenticationError("bad key", response=httpx.Response(401, request=REQUEST), body=None),
        openai.InternalServerError("oops", response=httpx.Response(500, request=REQUEST), body=None),
    ],
)
def test_provider_problems_become_unavailable(error):
    client, _ = make(error=error)
    with pytest.raises(AiUnavailableError):
        run(client)


def test_unusable_answers_are_invalid_output():
    client, _ = make(Parsed(None))
    with pytest.raises(AiInvalidOutputError):
        run(client)
    try:
        Answer.model_validate({"text": 5})
    except ValidationError as exc:
        broken, _ = make(error=exc)
        with pytest.raises(AiInvalidOutputError):
            run(broken)


def test_failures_never_log_what_the_person_wrote(caplog):
    client, _ = make(error=openai.APIConnectionError(request=REQUEST))
    with caplog.at_level(logging.DEBUG, logger=client_module.logger.name), pytest.raises(AiUnavailableError):
        run(client, "SECRET-PERSONAL-TEXT sk-test")
    assert "SECRET-PERSONAL-TEXT" not in caplog.text
    assert "sk-test" not in caplog.text
    assert "APIConnectionError" in caplog.text  # only the kind of failure is recorded


def test_the_dependency_reads_the_key_and_model_from_settings(monkeypatch):
    settings = type("S", (), {"openai_api_key": "sk-abc", "ai_model": "tiny"})()
    monkeypatch.setattr(client_module, "get_settings", lambda: settings)
    built = get_ai_client()
    assert isinstance(built, OpenAiClient)
    assert built._model == "tiny" and built._client is not None
