from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from beanie import PydanticObjectId

from app.models.feed_config import FeedConfig, FeedWeights
from app.models.thread import Thread
from app.models.user import User
from app.services.feed_ai import FeedAIRerankError, FeedAIRerankTimeoutError
from app.services.feed_query import _maybe_apply_ai_rerank
from app.services.feed_ranker import FeedScoredThread


def _user() -> User:
    return User.model_construct(
        id=PydanticObjectId("65aa00000000000000000001"),
        username="reader",
        email="reader@example.com",
        display_name="Reader",
        following=[],
        muted_users=[],
        interest_tags=[],
        hidden_tags=[],
    )


def _thread(*, thread_id: str, author_id: str, created_at: datetime) -> Thread:
    return Thread.model_construct(
        id=PydanticObjectId(thread_id),
        title=f"title-{thread_id[-4:]}",
        body="body",
        tags=["x"],
        author_id=PydanticObjectId(author_id),
        created_at=created_at,
        updated_at=created_at,
        post_count=0,
        is_pinned=False,
        is_flagged=False,
        ai_score=None,
        is_deleted=False,
        feed_suppressed=False,
        feed_boost=0.0,
    )


def _ranked_items() -> list[FeedScoredThread]:
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    first = _thread(
        thread_id="65aa00000000000000000101",
        author_id="65aa00000000000000001001",
        created_at=now,
    )
    second = _thread(
        thread_id="65aa00000000000000000102",
        author_id="65aa00000000000000001002",
        created_at=now,
    )
    return [
        FeedScoredThread(thread=first, score=1.0, reasons=["fresh_topic"], breakdown={"recency": 0.2}),
        FeedScoredThread(thread=second, score=0.9, reasons=["general_relevance"], breakdown={"recency": 0.1}),
    ]


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


def test_ai_runs_only_for_home_first_page(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_save(self) -> FeedConfig:
        return self

    monkeypatch.setattr(FeedConfig, "save", _fake_save, raising=False)

    called = 0

    async def fake_rerank(*_args, **_kwargs) -> dict[str, float]:
        nonlocal called
        called += 1
        return {}

    ranked = _ranked_items()
    config = _config()
    settings = SimpleNamespace(feed_v2_enabled=True, feed_ai_enabled=True)

    unchanged = asyncio.run(
        _maybe_apply_ai_rerank(
            ranked,
            current_user=_user(),
            mode="home",
            cursor="opaque-cursor",
            feed_config=config,
            settings=settings,
            rerank_func=fake_rerank,
        )
    )
    assert called == 0
    assert [str(item.thread.id) for item in unchanged] == [str(item.thread.id) for item in ranked]

    asyncio.run(
        _maybe_apply_ai_rerank(
            ranked,
            current_user=_user(),
            mode="home",
            cursor=None,
            feed_config=config,
            settings=settings,
            rerank_func=fake_rerank,
        )
    )
    assert called == 1


def test_ai_adjustments_are_clamped_and_reason_codes_applied(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_save(self) -> FeedConfig:
        return self

    monkeypatch.setattr(FeedConfig, "save", _fake_save, raising=False)

    ranked = _ranked_items()
    config = _config()
    settings = SimpleNamespace(feed_v2_enabled=True, feed_ai_enabled=True)

    async def fake_rerank(*_args, **_kwargs) -> dict[str, float]:
        return {
            str(ranked[0].thread.id): 99.0,
            str(ranked[1].thread.id): -99.0,
        }

    reranked = asyncio.run(
        _maybe_apply_ai_rerank(
            ranked,
            current_user=_user(),
            mode="home",
            cursor=None,
            feed_config=config,
            settings=settings,
            rerank_func=fake_rerank,
        )
    )

    by_id = {str(item.thread.id): item for item in reranked}
    first = by_id[str(ranked[0].thread.id)]
    second = by_id[str(ranked[1].thread.id)]
    assert first.score == pytest.approx(1.25)
    assert second.score == pytest.approx(0.65)
    assert "ai_boost" in first.reasons
    assert "ai_penalty" in second.reasons


def test_ai_timeout_falls_back_to_deterministic_order(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_save(self) -> FeedConfig:
        return self

    monkeypatch.setattr(FeedConfig, "save", _fake_save, raising=False)

    ranked = _ranked_items()
    config = _config()
    settings = SimpleNamespace(feed_v2_enabled=True, feed_ai_enabled=True)

    async def fake_rerank(*_args, **_kwargs) -> dict[str, float]:
        raise FeedAIRerankTimeoutError("timeout")

    fallback = asyncio.run(
        _maybe_apply_ai_rerank(
            ranked,
            current_user=_user(),
            mode="home",
            cursor=None,
            feed_config=config,
            settings=settings,
            rerank_func=fake_rerank,
        )
    )

    assert [str(item.thread.id) for item in fallback] == [str(item.thread.id) for item in ranked]
    assert [item.score for item in fallback] == [item.score for item in ranked]
    assert config.ai_requests_count == 1
    assert config.ai_timeout_count == 1
    assert config.ai_fallback_count == 1
    assert config.ai_error_count == 0


def test_ai_error_falls_back_to_deterministic_order(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_save(self) -> FeedConfig:
        return self

    monkeypatch.setattr(FeedConfig, "save", _fake_save, raising=False)

    ranked = _ranked_items()
    config = _config()
    settings = SimpleNamespace(feed_v2_enabled=True, feed_ai_enabled=True)

    async def fake_rerank(*_args, **_kwargs) -> dict[str, float]:
        raise FeedAIRerankError("bad payload")

    fallback = asyncio.run(
        _maybe_apply_ai_rerank(
            ranked,
            current_user=_user(),
            mode="home",
            cursor=None,
            feed_config=config,
            settings=settings,
            rerank_func=fake_rerank,
        )
    )

    assert [str(item.thread.id) for item in fallback] == [str(item.thread.id) for item in ranked]
    assert config.ai_requests_count == 1
    assert config.ai_error_count == 1
    assert config.ai_fallback_count == 1


def test_budget_cap_disables_ai_rerank(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_save(self) -> FeedConfig:
        return self

    monkeypatch.setattr(FeedConfig, "save", _fake_save, raising=False)

    ranked = _ranked_items()
    config = _config()
    config.ai_spend_today_usd = config.ai_daily_budget_usd
    settings = SimpleNamespace(feed_v2_enabled=True, feed_ai_enabled=True)
    called = 0

    async def fake_rerank(*_args, **_kwargs) -> dict[str, float]:
        nonlocal called
        called += 1
        return {}

    fallback = asyncio.run(
        _maybe_apply_ai_rerank(
            ranked,
            current_user=_user(),
            mode="home",
            cursor=None,
            feed_config=config,
            settings=settings,
            rerank_func=fake_rerank,
        )
    )

    assert called == 0
    assert config.ai_requests_count == 0
    assert [str(item.thread.id) for item in fallback] == [str(item.thread.id) for item in ranked]
