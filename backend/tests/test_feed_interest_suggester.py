from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from beanie import PydanticObjectId

from app.models.feed_config import FeedConfig, FeedWeights
from app.models.user import User
from app.services.feed_ai import FeedAISuggestionPayloadError, FeedAISuggestionTimeoutError
from app.services import feed_interest_suggester as suggester


def _user() -> User:
    return User.model_construct(
        id=PydanticObjectId("65aa00000000000000000001"),
        username="reader",
        email="reader@example.com",
        display_name="Reader",
        following=[],
        muted_users=[],
        interest_tags=["python", "backend"],
        hidden_tags=[],
    )


def _config() -> FeedConfig:
    return FeedConfig.model_construct(
        id=PydanticObjectId(),
        version=1,
        weights=FeedWeights(),
        ai_enabled=True,
        ai_timeout_ms=800,
        ai_daily_budget_usd=5.0,
        ai_spend_today_usd=0.0,
        ai_requests_count=0,
        ai_timeout_count=0,
        ai_error_count=0,
        ai_fallback_count=0,
    )


def test_apply_replace_mode_merge_and_replace() -> None:
    merged = suggester._apply_replace_mode(["python", "backend"], ["backend", "llm"], "merge")
    replaced = suggester._apply_replace_mode(["python", "backend"], ["backend", "llm"], "replace")

    assert merged == ["python", "backend", "llm"]
    assert replaced == ["backend", "llm"]


def test_suggest_tags_timeout_uses_deterministic_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    config = _config()

    async def fake_config() -> FeedConfig:
        return config

    async def fake_save(self) -> FeedConfig:
        return self

    async def fake_suggest(*_args, **_kwargs) -> list[str]:
        raise FeedAISuggestionTimeoutError("timeout")

    monkeypatch.setattr(suggester, "get_or_create_feed_config", fake_config)
    monkeypatch.setattr(suggester, "get_settings", lambda: SimpleNamespace(openai_api_key="test-key"))
    monkeypatch.setattr(FeedConfig, "save", fake_save, raising=False)
    monkeypatch.setattr(suggester, "suggest_interest_tags", fake_suggest)

    tags, status, error = asyncio.run(
        suggester._suggest_tags_for_user(
            _user(),
            signal_tags=["ml", "python", "fastapi"],
            max_tags_per_user=3,
        )
    )

    assert status == "fallback"
    assert tags == ["ml", "python", "fastapi"]
    assert error == "ai_timeout"
    assert config.ai_requests_count == 1
    assert config.ai_timeout_count == 1
    assert config.ai_fallback_count == 1


def test_suggest_tags_budget_exhaustion_skips_ai(monkeypatch: pytest.MonkeyPatch) -> None:
    config = _config()
    config.ai_spend_today_usd = config.ai_daily_budget_usd

    async def fake_config() -> FeedConfig:
        return config

    monkeypatch.setattr(suggester, "get_or_create_feed_config", fake_config)

    tags, status, error = asyncio.run(
        suggester._suggest_tags_for_user(
            _user(),
            signal_tags=["security", "devops"],
            max_tags_per_user=2,
        )
    )

    assert status == "budget_exceeded"
    assert tags == ["security", "devops"]
    assert error == "budget_exceeded"
    assert config.ai_requests_count == 0


def test_suggest_tags_payload_error_uses_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    config = _config()

    async def fake_config() -> FeedConfig:
        return config

    async def fake_save(self) -> FeedConfig:
        return self

    async def fake_suggest(*_args, **_kwargs) -> list[str]:
        raise FeedAISuggestionPayloadError("invalid payload")

    monkeypatch.setattr(suggester, "get_or_create_feed_config", fake_config)
    monkeypatch.setattr(suggester, "get_settings", lambda: SimpleNamespace(openai_api_key="test-key"))
    monkeypatch.setattr(FeedConfig, "save", fake_save, raising=False)
    monkeypatch.setattr(suggester, "suggest_interest_tags", fake_suggest)

    tags, status, error = asyncio.run(
        suggester._suggest_tags_for_user(
            _user(),
            signal_tags=["ml", "python"],
            max_tags_per_user=2,
        )
    )

    assert status == "fallback"
    assert tags == ["ml", "python"]
    assert error == "ai_error"
    assert config.ai_requests_count == 1
    assert config.ai_error_count == 1
    assert config.ai_fallback_count == 1
