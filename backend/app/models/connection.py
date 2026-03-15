from datetime import datetime

from beanie import Document, PydanticObjectId
from pydantic import Field

from app.models.common import utc_now


class ConnectionStatus:
    PENDING = "pending"
    CONNECTED = "connected"
    BLOCKED = "blocked"


class MessageRequest(Document):
    """Message/connection request from one user to another"""

    sender_id: PydanticObjectId
    recipient_id: PydanticObjectId
    message: str | None = Field(default=None, max_length=500)
    status: str = Field(default=ConnectionStatus.PENDING)  # pending, accepted, rejected, blocked
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "message_requests"
        indexes = [
            "sender_id",
            "recipient_id",
            ["sender_id", "recipient_id"],
        ]


class Connection(Document):
    """Bidirectional connection between two users"""

    user_id: PydanticObjectId
    connected_user_id: PydanticObjectId
    status: str = Field(default=ConnectionStatus.CONNECTED)  # connected, blocked
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "connections"
        indexes = [
            "user_id",
            "connected_user_id",
            ["user_id", "connected_user_id"],
        ]
