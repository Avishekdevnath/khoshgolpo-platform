from __future__ import annotations

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.core.auth import get_current_user
from app.models.user import User, UserRole
import app.routers.admin_feed as admin_feed_module
from app.routers.admin_feed import router as admin_feed_router


def _user(role: UserRole = UserRole.ADMIN) -> User:
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    return User.model_construct(
        id=PydanticObjectId("65aa00000000000000000099"),
        username="admin" if role == UserRole.ADMIN else "member",
        email="admin@example.com" if role == UserRole.ADMIN else "member@example.com",
        display_name="Admin" if role == UserRole.ADMIN else "Member",
        role=role,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def _build_client(monkeypatch: pytest.MonkeyPatch, role: UserRole = UserRole.ADMIN) -> TestClient:
    async def fake_current_user() -> User:
        return _user(role)

    async def fake_log_audit(**_kwargs) -> None:
        return None

    async def fake_batch_runner(_job_id: str) -> None:
        return None

    class FakeJob:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)
            self.id = None
            self.created_at = datetime(2026, 3, 1, tzinfo=timezone.utc)

        async def insert(self):
            self.id = PydanticObjectId("65aa00000000000000000999")
            return self

    monkeypatch.setattr(admin_feed_module, "log_audit", fake_log_audit)
    monkeypatch.setattr(admin_feed_module, "FeedInterestSuggestionJob", FakeJob)
    monkeypatch.setattr(admin_feed_module, "run_interest_suggestion_batch", fake_batch_runner)

    app = FastAPI()
    app.include_router(admin_feed_router)
    app.dependency_overrides[get_current_user] = fake_current_user
    return TestClient(app)


def test_create_interest_job_rejects_invalid_user_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _build_client(monkeypatch)
    response = client.post(
        "/admin/feed/interests/suggestions/jobs",
        json={"user_ids": ["not-an-object-id"]},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid user_id"


def test_create_interest_job_returns_queued_job(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _build_client(monkeypatch)
    response = client.post(
        "/admin/feed/interests/suggestions/jobs",
        json={
            "user_ids": ["65aa00000000000000000101", "65aa00000000000000000102"],
            "replace_mode": "merge",
            "max_tags_per_user": 8,
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["job_id"] == "65aa00000000000000000999"
    assert payload["status"] == "queued"
    assert payload["requested_count"] == 2


def test_create_interest_job_rejects_empty_list(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _build_client(monkeypatch)
    response = client.post(
        "/admin/feed/interests/suggestions/jobs",
        json={"user_ids": []},
    )
    assert response.status_code == 422


def test_create_interest_job_rejects_more_than_50_users(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _build_client(monkeypatch)
    user_ids = [f"65aa0000000000000000{i:04x}"[-24:] for i in range(60)]
    response = client.post(
        "/admin/feed/interests/suggestions/jobs",
        json={"user_ids": user_ids},
    )
    assert response.status_code == 422


def test_create_interest_job_requires_admin_role(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _build_client(monkeypatch, role=UserRole.MEMBER)
    response = client.post(
        "/admin/feed/interests/suggestions/jobs",
        json={"user_ids": ["65aa00000000000000000101"]},
    )
    assert response.status_code == 403
