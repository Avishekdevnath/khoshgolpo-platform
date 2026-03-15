from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from beanie import PydanticObjectId
import pytest

from app.core.auth import get_current_user
from app.models.user import User
import app.routers.users as users_router_module
from app.routers.users import router as users_router


def _user(user_id: str, username: str, display_name: str) -> User:
    return User.model_construct(
        id=PydanticObjectId(user_id),
        username=username,
        email=f"{username}@example.com",
        display_name=display_name,
        bio=None,
        role="member",
        is_active=True,
    )


def _people_candidate(user_id: str, username: str, display_name: str, **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "id": user_id,
        "username": username,
        "display_name": display_name,
        "profile_slug": None,
        "avatar_url": None,
        "bio": f"{display_name} bio",
        "role": "member",
        "created_at": datetime.now(timezone.utc),
        "followers_count": 0,
        "mutual_follow_count": 0,
        "shared_interest_count": 0,
        "is_following": False,
        "follows_you": False,
        "is_connected": False,
        "has_pending_request": False,
        "is_requester": False,
        "pending_request_id": None,
        "can_message": False,
        "blocked_by_me": False,
        "blocked_you": False,
        "_incoming_pending": False,
    }
    base.update(overrides)
    return base


class _FakeQuery:
    def __init__(self, users: list[User]) -> None:
        self._users = users
        self._limit = len(users)

    def limit(self, limit: int) -> "_FakeQuery":
        self._limit = limit
        return self

    async def to_list(self) -> list[User]:
        return self._users[: self._limit]


def test_users_search_includes_id_field(monkeypatch: pytest.MonkeyPatch) -> None:
    seeded = [
        _user("65aa00000000000000000101", "alpha", "Alpha User"),
        _user("65aa00000000000000000102", "beta", "Beta User"),
    ]

    def fake_find(*_args, **_kwargs) -> _FakeQuery:
        return _FakeQuery(seeded)

    async def fake_current_user() -> User:
        return seeded[0]

    monkeypatch.setattr(users_router_module.User, "find", fake_find)

    app = FastAPI()
    app.include_router(users_router)
    app.dependency_overrides[get_current_user] = fake_current_user
    client = TestClient(app)

    response = client.get("/users/search", params={"q": "a", "limit": 2})
    assert response.status_code == 200
    payload = response.json()
    assert payload["users"]
    first = payload["users"][0]
    assert set(first.keys()) == {"id", "username", "display_name"}
    assert first["id"] == str(seeded[0].id)


def test_people_search_short_query_returns_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    seeded = [_user("65aa00000000000000000101", "alpha", "Alpha User")]

    async def fake_current_user() -> User:
        return seeded[0]

    async def fail_load_people_candidates(*args, **kwargs):
        raise AssertionError("people candidates should not load for short queries")

    monkeypatch.setattr(users_router_module, "_load_people_candidates", fail_load_people_candidates)

    app = FastAPI()
    app.include_router(users_router)
    app.dependency_overrides[get_current_user] = fake_current_user
    client = TestClient(app)

    response = client.get("/users/people/search", params={"q": "a"})

    assert response.status_code == 200
    assert response.json() == {
        "data": [],
        "page": 1,
        "limit": 20,
        "total": 0,
        "q": "a",
        "sort": "relevance",
        "relationship": "all",
    }


def test_people_search_returns_enriched_people_cards(monkeypatch: pytest.MonkeyPatch) -> None:
    seeded = [_user("65aa00000000000000000101", "viewer", "Viewer User")]
    candidate = _people_candidate(
        "65aa00000000000000000155",
        "alpha",
        "Alpha User",
        followers_count=18,
        follows_you=True,
        has_pending_request=True,
        is_requester=False,
        pending_request_id="65aa00000000000000000999",
        _incoming_pending=True,
    )

    async def fake_current_user() -> User:
        return seeded[0]

    async def fake_load_people_candidates(current_user: User, *, q: str | None = None) -> list[dict[str, object]]:
        assert current_user.username == "viewer"
        assert q == "alpha"
        return [candidate]

    monkeypatch.setattr(users_router_module, "_load_people_candidates", fake_load_people_candidates)

    app = FastAPI()
    app.include_router(users_router)
    app.dependency_overrides[get_current_user] = fake_current_user
    client = TestClient(app)

    response = client.get(
        "/users/people/search",
        params={"q": "alpha", "sort": "relevance", "relationship": "all"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["sort"] == "relevance"
    item = payload["data"][0]
    assert item["username"] == "alpha"
    assert item["pending_request_id"] == "65aa00000000000000000999"
    assert item["follows_you"] is True
    assert item["reason"] == {"kind": "exact_username", "label": "Exact username match"}


def test_people_explore_returns_sectioned_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    seeded = [_user("65aa00000000000000000101", "viewer", "Viewer User")]
    candidates = [
        _people_candidate(
            "65aa00000000000000000111",
            "suggested",
            "Suggested User",
            shared_interest_count=2,
            followers_count=5,
        ),
        _people_candidate(
            "65aa00000000000000000112",
            "popular",
            "Popular User",
            followers_count=100,
            is_following=True,
        ),
        _people_candidate(
            "65aa00000000000000000113",
            "connected",
            "Connected User",
            is_connected=True,
            can_message=True,
            followers_count=9,
        ),
        _people_candidate(
            "65aa00000000000000000114",
            "newest",
            "Newest User",
            created_at=datetime(2030, 1, 1, tzinfo=timezone.utc),
        ),
    ]

    async def fake_current_user() -> User:
        return seeded[0]

    async def fake_load_people_candidates(current_user: User, *, q: str | None = None) -> list[dict[str, object]]:
        assert current_user.username == "viewer"
        assert q is None
        return candidates

    monkeypatch.setattr(users_router_module, "_load_people_candidates", fake_load_people_candidates)

    app = FastAPI()
    app.include_router(users_router)
    app.dependency_overrides[get_current_user] = fake_current_user
    client = TestClient(app)

    response = client.get("/users/people/explore")

    assert response.status_code == 200
    payload = response.json()
    assert [section["key"] for section in payload["sections"]] == ["suggested", "popular", "new"]
    assert payload["sections"][0]["data"][0]["username"] == "suggested"
    assert payload["sections"][1]["data"][0]["username"] == "popular"
    assert payload["sections"][2]["data"][0]["username"] == "newest"
    assert payload["ranked"]["total"] == 4
