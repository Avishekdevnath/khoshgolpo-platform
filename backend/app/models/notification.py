from datetime import datetime
from enum import Enum

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pymongo import ASCENDING, DESCENDING, IndexModel
from pydantic import Field

from app.models.common import utc_now


class NotificationType(str, Enum):
    MENTION = "mention"
    REPLY = "reply"
    FOLLOW = "follow"
    CONNECTION = "connection"
    MESSAGE = "message"
    MODERATION = "moderation"
    SYSTEM = "system"


class Notification(Document):
    type: NotificationType
    recipient_id: PydanticObjectId
    actor_id: PydanticObjectId | None = None
    thread_id: PydanticObjectId | None = None
    post_id: PydanticObjectId | None = None

    message: str = Field(min_length=1, max_length=300)
    metadata: dict[str, str | bool | int | float | None] = Field(default_factory=dict)
    is_read: bool = False

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    class Settings:
        name = "notifications"
        indexes = [
            "recipient_id",
            "is_read",
            "created_at",
            IndexModel([("recipient_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("recipient_id", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)]),
        ]
