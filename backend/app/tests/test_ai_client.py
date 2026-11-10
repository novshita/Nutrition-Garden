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
    settings = type(
        "S", (), {"openai_api_key": "sk-abc", "ai_model": "tiny", "ai_base_url": None, "ai_api_key": None}
    )()
    monkeypatch.setattr(client_module, "get_settings", lambda: settings)
    built = get_ai_client()
    assert isinstance(built, OpenAiClient)
    assert built._model == "tiny" and built._client is not None


# ---- Other OpenAI-compatible providers (for example Google Gemini's free tier) ----

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
BAD_REQUEST = openai.BadRequestError(
    "schema not supported", response=httpx.Response(400, request=REQUEST), body=None
)


class Message:
    def __init__(self, parsed=None, content=None):
        self.parsed, self.content = parsed, content


class Completion:
    def __init__(self, parsed=None, content=None):
        self.choices = [type("Choice", (), {"message": Message(parsed, content)})()]


class StubCompletions:
    def __init__(self, parse_result=None, create_result=None, parse_error=None, create_error=None):
        self.parse_result, self.create_result = parse_result, create_result
        self.parse_error, self.create_error = parse_error, create_error
        self.parse_calls, self.create_calls = [], []

    def parse(self, **kwargs):
        self.parse_calls.append(kwargs)
        if self.parse_error:
            raise self.parse_error
        return self.parse_result

    def create(self, **kwargs):
        self.create_calls.append(kwargs)
        if self.create_error:
            raise self.create_error
        return self.create_result


def make_compatible(model="gemini-test", **stub_args):
    client = OpenAiClient("gem-key", model, GEMINI_URL)
    stub = StubCompletions(**stub_args)
    chat = type("Chat", (), {"completions": stub})()
    client._client = type("StubClient", (), {"chat": chat})()
    return client, stub


def test_another_provider_uses_chat_completions_with_a_strict_schema():
    client, stub = make_compatible(parse_result=Completion(parsed=Answer(text="hi")))
    assert run(client, "my private words") == Answer(text="hi")
    call = stub.parse_calls[0]
    assert call["model"] == "gemini-test"
    assert call["messages"] == [
        {"role": "system", "content": "be kind"},
        {"role": "user", "content": "my private words"},
    ]
    assert call["response_format"] is Answer
    assert "store" not in call  # an OpenAI-only option
    assert stub.create_calls == []


def test_the_base_url_is_passed_to_the_sdk():
    client = OpenAiClient("gem-key", "gemini-test", GEMINI_URL)
    assert str(client._client.base_url).rstrip("/") == GEMINI_URL.rstrip("/")


def test_openai_itself_is_unchanged_when_no_base_url_is_set():
    client, stub = make(Parsed(Answer(text="hi")))
    run(client)
    assert stub.calls[0]["store"] is False


def test_a_provider_that_rejects_the_schema_falls_back_to_plain_json():
    client, stub = make_compatible(
        parse_error=BAD_REQUEST, create_result=Completion(content='{"text": "hello"}')
    )
    assert run(client) == Answer(text="hello")
    call = stub.create_calls[0]
    assert call["response_format"] == {"type": "json_object"}
    system = call["messages"][0]["content"]
    assert system.startswith("be kind") and '"text"' in system  # the schema is described in the prompt
    assert call["messages"][1] == {"role": "user", "content": "hello"}


@pytest.mark.parametrize("content", ['```json\n{"text": "fenced"}\n```', '  {"text": "fenced"}  '])
def test_fenced_or_padded_json_is_accepted(content):
    client, _ = make_compatible(parse_error=BAD_REQUEST, create_result=Completion(content=content))
    assert run(client) == Answer(text="fenced")


@pytest.mark.parametrize("content", ["not json at all", '{"text": 5}', '{"other": "x"}', "", None])
def test_unusable_json_from_another_provider_is_invalid_output(content):
    client, _ = make_compatible(parse_error=BAD_REQUEST, create_result=Completion(content=content))
    with pytest.raises(AiInvalidOutputError):
        run(client)


def test_a_refusal_or_empty_parse_is_invalid_output():
    client, _ = make_compatible(parse_result=Completion(parsed=None))
    with pytest.raises(AiInvalidOutputError):
        run(client)


@pytest.mark.parametrize(
    "error",
    [
        openai.APIConnectionError(request=REQUEST),
        openai.RateLimitError("slow down", response=httpx.Response(429, request=REQUEST), body=None),
        openai.AuthenticationError("bad key", response=httpx.Response(401, request=REQUEST), body=None),
    ],
)
def test_other_provider_problems_become_unavailable(error):
    client, _ = make_compatible(parse_error=error)
    with pytest.raises(AiUnavailableError):
        run(client)
    fallback_failure, _ = make_compatible(parse_error=BAD_REQUEST, create_error=error)
    with pytest.raises(AiUnavailableError):
        run(fallback_failure)


def test_another_provider_needs_a_model_name():
    client = OpenAiClient("gem-key", None, GEMINI_URL)
    assert client._model is None
    with pytest.raises(AiUnavailableError):
        run(client)


def test_failures_with_another_provider_never_log_what_the_person_wrote(caplog):
    client, _ = make_compatible(parse_error=openai.APIConnectionError(request=REQUEST))
    with caplog.at_level(logging.DEBUG, logger=client_module.logger.name), pytest.raises(AiUnavailableError):
        run(client, "SECRET-PERSONAL-TEXT gem-key")
    assert "SECRET-PERSONAL-TEXT" not in caplog.text and "gem-key" not in caplog.text


def settings_with(**values):
    base = {"openai_api_key": "", "ai_model": None, "ai_base_url": None, "ai_api_key": None}
    return type("S", (), {**base, **values})()


def test_the_dependency_builds_a_compatible_client_from_settings(monkeypatch):
    monkeypatch.setattr(
        client_module,
        "get_settings",
        lambda: settings_with(ai_api_key="gem-key", ai_model="gemini-test", ai_base_url=GEMINI_URL),
    )
    built = get_ai_client()
    assert built._base_url == GEMINI_URL and built._model == "gemini-test"
    assert built._api_key == "gem-key"  # AI_API_KEY wins over OPENAI_API_KEY


def test_empty_settings_fall_back_to_plain_openai(monkeypatch):
    monkeypatch.setattr(
        client_module,
        "get_settings",
        lambda: settings_with(openai_api_key="sk-abc", ai_model="", ai_base_url="", ai_api_key=""),
    )
    built = get_ai_client()
    assert built._base_url is None and built._model == AI_DEFAULT_MODEL and built._api_key == "sk-abc"


@pytest.mark.parametrize(
    "values,expected",
    [
        ({}, False),
        ({"openai_api_key": "sk-abc"}, True),
        ({"ai_api_key": "gem-key", "ai_base_url": GEMINI_URL}, False),  # no model yet
        ({"ai_api_key": "gem-key", "ai_base_url": GEMINI_URL, "ai_model": "gemini-test"}, True),
        ({"ai_base_url": GEMINI_URL, "ai_model": "gemini-test"}, False),  # no key
    ],
)
def test_ai_counts_as_available_only_when_fully_set_up(monkeypatch, values, expected):
    monkeypatch.setattr(client_module, "get_settings", lambda: settings_with(**values))
    assert client_module.ai_available() is expected


def test_the_log_includes_the_status_code_to_help_diagnose_problems(caplog):
    gone = openai.NotFoundError("model retired", response=httpx.Response(404, request=REQUEST), body=None)
    client, _ = make_compatible(parse_error=gone)
    with caplog.at_level(logging.DEBUG, logger=client_module.logger.name), pytest.raises(AiUnavailableError):
        run(client, "SECRET-PERSONAL-TEXT")
    assert "NotFoundError (HTTP 404)" in caplog.text
    assert "SECRET-PERSONAL-TEXT" not in caplog.text
