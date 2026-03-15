from beanie import PydanticObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.routers import connections as connections_router


USER_ID = PydanticObjectId("65bb00000000000000000001")
TARGET_ID = PydanticObjectId("65bb00000000000000000002")
REQUEST_ID = PydanticObjectId("65bb00000000000000000003")


class DummyUser:
    def __init__(self, *, user_id: PydanticObjectId, blocked_user_ids: list[PydanticObjectId] | None = None) -> None:
        self.id = user_id
        self.blocked_user_ids = blocked_user_ids or []
        self.is_active = True


class DummyRequest:
    def __init__(self) -> None:
        self.id = REQUEST_ID
        self.sender_id = TARGET_ID
        self.recipient_id = USER_ID
        self.status = connections_router.ConnectionStatus.PENDING


def make_client(current_user: DummyUser) -> TestClient:
    app = FastAPI()
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.include_router(connections_router.router)
    return TestClient(app)


def test_connection_status_includes_pending_request_id(monkeypatch) -> None:
    current_user = DummyUser(user_id=USER_ID)
    target_user = DummyUser(user_id=TARGET_ID)
    pending_request = DummyRequest()

    async def fake_user_get(target_id):
        if target_id == TARGET_ID:
            return target_user
        return None

    async def fake_connection_find_one(query):
        assert query["$or"]
        return None

    async def fake_request_find_one(query):
        assert query["status"] == connections_router.ConnectionStatus.PENDING
        return pending_request

    monkeypatch.setattr(connections_router.User, "get", fake_user_get)
    monkeypatch.setattr(connections_router.Connection, "find_one", fake_connection_find_one)
    monkeypatch.setattr(connections_router.MessageRequest, "find_one", fake_request_find_one)

    client = make_client(current_user)
    response = client.get(f"/connections/{TARGET_ID}/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["has_pending_request"] is True
    assert payload["is_requester"] is False
    assert payload["pending_request_id"] == str(REQUEST_ID)
