from __future__ import annotations

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.core.auth import get_current_user
from app.models.feed_config import FeedConfig, FeedWeights
from app.models.thread import Thread
from app.models.user import User
from app.routers import feed as feed_router_module
from app.routers.feed import router as feed_router
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


def _thread(thread_id: str, author_id: str) -> Thread:
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    return Thread.model_construct(
        id=PydanticObjectId(thread_id),
        title=f"title-{thread_id[-4:]}",
        body="body",
        tags=[],
        author_id=PydanticObjectId(author_id),
        created_at=now,
        updated_at=now,
        post_count=0,
        is_pinned=False,
        is_flagged=False,
        ai_score=None,
        is_deleted=False,
        feed_suppressed=False,
        feed_boost=0.0,
    )


def _build_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    async def fake_config() -> FeedConfig:
        return FeedConfig.model_construct(
            id=PydanticObjectId(),
            version=1,
            weights=FeedWeights(),
            ai_enabled=False,
            ai_timeout_ms=800,
            ai_daily_budget_usd=5.0,
            ai_spend_today_usd=0.0,
            ai_requests_count=0,
            ai_timeout_count=0,
            ai_error_count=0,
            ai_fallback_count=0,
        )

    async def fake_author_lookup(_author_ids: set[PydanticObjectId]) -> dict[str, User]:
        return {}

    async def fake_current_user() -> User:
        return _user()

    monkeypatch.setattr(feed_router_module, "get_or_create_feed_config", fake_config)
    monkeypatch.setattr(feed_router_module, "_load_author_lookup", fake_author_lookup)

    app = FastAPI()
    app.include_router(feed_router)
    app.dependency_overrides[get_current_user] = fake_current_user
    return TestClient(app)


def test_home_feed_cursor_pagination_is_stable(monkeypatch: pytest.MonkeyPatch) -> None:
    first = FeedScoredThread(
        thread=_thread("65aa00000000000000000101", "65aa00000000000000001001"),
        score=1.0,
        reasons=["fresh_topic"],
        breakdown={"recency": 0.2},
    )
    second = FeedScoredThread(
        thread=_thread("65aa00000000000000000102", "65aa00000000000000001002"),
        score=0.9,
        reasons=["general_relevance"],
        breakdown={"recency": 0.1},
    )

    async def fake_fetch_ranked_feed_slice(current_user, *, mode, limit, cursor, weights, **kwargs):
        if cursor is None:
            return [first], "cursor-2"
        if cursor == "cursor-2":
            return [second], None
        return [], None

    monkeypatch.setattr(feed_router_module, "fetch_ranked_feed_slice", fake_fetch_ranked_feed_slice)

    client = _build_client(monkeypatch)
    first_page = client.get("/feed/home", params={"limit": 1})
    assert first_page.status_code == 200
    payload_1 = first_page.json()
    assert payload_1["next_cursor"] == "cursor-2"
    assert [item["id"] for item in payload_1["data"]] == [str(first.thread.id)]

    second_page = client.get("/feed/home", params={"limit": 1, "cursor": payload_1["next_cursor"]})
    assert second_page.status_code == 200
    payload_2 = second_page.json()
    assert payload_2["next_cursor"] is None
    assert [item["id"] for item in payload_2["data"]] == [str(second.thread.id)]


@pytest.mark.parametrize(
    ("reasons", "expects_ai_reason"),
    [
        (["fresh_topic"], False),
        (["fresh_topic", "ai_boost"], True),
    ],
)
def test_home_feed_ai_reason_codes_present_only_when_applied(
    monkeypatch: pytest.MonkeyPatch,
    reasons: list[str],
    expects_ai_reason: bool,
) -> None:
    item = FeedScoredThread(
        thread=_thread("65aa00000000000000000121", "65aa00000000000000001021"),
        score=1.2,
        reasons=reasons,
        breakdown={"recency": 0.2},
    )

    async def fake_fetch_ranked_feed_slice(current_user, *, mode, limit, cursor, weights, **kwargs):
        return [item], None

    monkeypatch.setattr(feed_router_module, "fetch_ranked_feed_slice", fake_fetch_ranked_feed_slice)

    client = _build_client(monkeypatch)
    response = client.get("/feed/home", params={"limit": 20})
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]
    reasons_out: list[str] = payload["data"][0]["reasons"]

    has_ai_reason = "ai_boost" in reasons_out or "ai_penalty" in reasons_out
    assert has_ai_reason is expects_ai_reason
