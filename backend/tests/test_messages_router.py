from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.routers import messages as messages_router


USER_ID = PydanticObjectId("64f000000000000000000001")
TARGET_ID = PydanticObjectId("64f000000000000000000002")
CONVERSATION_ID = PydanticObjectId("64f000000000000000000003")
MESSAGE_ID = PydanticObjectId("64f000000000000000000004")


class DummyUser:
    def __init__(
        self,
        *,
        user_id: PydanticObjectId,
        display_name: str,
        is_active: bool = True,
        blocked_user_ids: list[PydanticObjectId] | None = None,
        muted_users: list[PydanticObjectId] | None = None,
    ) -> None:
        self.id = user_id
        self.display_name = display_name
        self.username = display_name.lower()
        self.is_active = is_active
        self.blocked_user_ids = blocked_user_ids or []
        self.muted_users = muted_users or []
        self.saved = False

    async def save(self) -> None:
        self.saved = True


class DummyConversation:
    def __init__(self) -> None:
        self.id = CONVERSATION_ID
        self.participant_ids = [USER_ID, TARGET_ID]
        self.message_count = 0
        self.last_message_id = None
        self.last_message_preview = None
        self.last_message_at = None
        self.last_message_sender_id = None
        self.updated_at = datetime.now(timezone.utc)
        self.saved = False

    async def save(self) -> None:
        self.saved = True


class DummyReadState:
    def __init__(self) -> None:
        self.last_read_message_id = None
        self.last_read_sequence = 0
        self.last_read_at = None
        self.saved = False

    async def save(self) -> None:
        self.saved = True


def make_client(current_user: DummyUser) -> TestClient:
    app = FastAPI()
    app.state.limiter = messages_router.limiter
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.include_router(messages_router.router)
    return TestClient(app)


async def _noop_async(*args, **kwargs) -> None:
    return None


def test_create_conversation_returns_existing_conversation(monkeypatch) -> None:
    current_user = DummyUser(user_id=USER_ID, display_name="Current User")
    target_user = DummyUser(user_id=TARGET_ID, display_name="Target User")
    existing_conversation = DummyConversation()

    class FakeConversationModel:
        @classmethod
        async def find_one(cls, query):
            assert query["participant_key"] == messages_router._build_participant_key(USER_ID, TARGET_ID)
            return existing_conversation

    async def fake_get_target_user(target_id: PydanticObjectId) -> DummyUser:
        assert target_id == TARGET_ID
        return target_user

    async def fake_serialize_conversation(conversation, *, current_user):
        return {
            "id": str(conversation.id),
            "participant_ids": [str(USER_ID), str(TARGET_ID)],
            "other_participant": {
                "id": str(TARGET_ID),
                "username": target_user.username,
                "display_name": target_user.display_name,
                "avatar_url": None,
                "is_active": True,
                "is_bot": False,
            },
            "last_message_preview": None,
            "last_message_at": None,
            "last_message_sender_id": None,
            "message_count": 0,
            "unread_count": 0,
            "blocked_by_me": False,
            "blocked_you": False,
            "can_message": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

    monkeypatch.setattr(messages_router, "Conversation", FakeConversationModel)
    monkeypatch.setattr(messages_router, "_get_target_user", fake_get_target_user)
    monkeypatch.setattr(messages_router, "_ensure_connected", _noop_async)
    monkeypatch.setattr(messages_router, "_ensure_read_states", _noop_async)
    monkeypatch.setattr(messages_router, "_serialize_conversation", fake_serialize_conversation)
    monkeypatch.setattr(messages_router, "log_audit", _noop_async)

    client = make_client(current_user)
    response = client.post("/messages/conversations", json={"target_user_id": str(TARGET_ID)})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == str(CONVERSATION_ID)


def test_create_conversation_requires_connection(monkeypatch) -> None:
    current_user = DummyUser(user_id=USER_ID, display_name="Current User")
    target_user = DummyUser(user_id=TARGET_ID, display_name="Target User")

    async def fake_get_target_user(_: PydanticObjectId) -> DummyUser:
        return target_user

    async def fake_ensure_connected(**kwargs) -> None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Messaging is only available for accepted connections",
        )

    monkeypatch.setattr(messages_router, "_get_target_user", fake_get_target_user)
    monkeypatch.setattr(messages_router, "_ensure_connected", fake_ensure_connected)

    client = make_client(current_user)
    response = client.post("/messages/conversations", json={"target_user_id": str(TARGET_ID)})

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "Messaging is only available for accepted connections"


def test_send_message_skips_notification_when_recipient_muted_sender(monkeypatch) -> None:
    current_user = DummyUser(user_id=USER_ID, display_name="Current User")
    target_user = DummyUser(user_id=TARGET_ID, display_name="Target User", muted_users=[USER_ID])
    conversation = DummyConversation()
    sender_state = DummyReadState()
    notification_calls: list[dict] = []

    class FakeMessageModel:
        def __init__(self, *, conversation_id, sender_id, content, sequence) -> None:
            self.id = MESSAGE_ID
            self.conversation_id = conversation_id
            self.sender_id = sender_id
            self.content = content
            self.sequence = sequence
            self.created_at = datetime.now(timezone.utc)
            self.edited_at = None
            self.deleted_at = None
            self.is_deleted = False

        async def insert(self) -> None:
            return None

    class FakeNotification:
        def __init__(self, **kwargs) -> None:
            notification_calls.append(kwargs)

        async def insert(self) -> None:
            return None

    async def fake_get_conversation_for_participant(*args, **kwargs) -> DummyConversation:
        return conversation

    async def fake_get_other_participant(*args, **kwargs) -> DummyUser:
        return target_user

    async def fake_get_or_create_read_state(**kwargs) -> DummyReadState:
        return sender_state

    monkeypatch.setattr(messages_router, "Message", FakeMessageModel)
    monkeypatch.setattr(messages_router, "Notification", FakeNotification)
    monkeypatch.setattr(messages_router, "_get_conversation_for_participant", fake_get_conversation_for_participant)
    monkeypatch.setattr(messages_router, "_get_other_participant", fake_get_other_participant)
    monkeypatch.setattr(messages_router, "_ensure_connected", _noop_async)
    monkeypatch.setattr(messages_router, "_get_or_create_read_state", fake_get_or_create_read_state)
    monkeypatch.setattr(messages_router, "log_audit", _noop_async)

    client = make_client(current_user)
    response = client.post(f"/messages/conversations/{CONVERSATION_ID}/messages", json={"content": "Hello there"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["content"] == "Hello there"
    assert notification_calls == []
    assert conversation.message_count == 1
    assert sender_state.last_read_sequence == 1


def test_block_user_updates_block_state(monkeypatch) -> None:
    current_user = DummyUser(user_id=USER_ID, display_name="Current User")
    target_user = DummyUser(user_id=TARGET_ID, display_name="Target User")

    async def fake_get_target_user(_: PydanticObjectId) -> DummyUser:
        return target_user

    monkeypatch.setattr(messages_router, "_get_target_user", fake_get_target_user)
    monkeypatch.setattr(messages_router, "log_audit", _noop_async)

    client = make_client(current_user)
    response = client.post(f"/messages/users/{TARGET_ID}/block")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["blocked_by_me"] is True
    assert str(TARGET_ID) in {str(item) for item in current_user.blocked_user_ids}
    assert current_user.saved is True
