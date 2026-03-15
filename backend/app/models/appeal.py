from datetime import datetime
from enum import Enum

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pymongo import ASCENDING, DESCENDING, IndexModel
from pydantic import Field

from app.models.common import utc_now


class AppealStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AppealContentType(str, Enum):
    THREAD = "thread"
    POST = "post"


class ModerationAppeal(Document):
    notification_id: PydanticObjectId
    appellant_id: PydanticObjectId

    content_type: AppealContentType
    content_id: PydanticObjectId
    thread_id: PydanticObjectId | None = None
    post_id: PydanticObjectId | None = None

    reason: str = Field(min_length=5, max_length=500)
    status: AppealStatus = AppealStatus.PENDING
    admin_note: str | None = Field(default=None, max_length=500)

    resolved_by: PydanticObjectId | None = None
    resolved_at: datetime | None = None

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    class Settings:
        name = "moderation_appeals"
        indexes = [
            "notification_id",
            "appellant_id",
            "content_id",
            "status",
            "created_at",
            IndexModel([("status", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("appellant_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("notification_id", ASCENDING), ("appellant_id", ASCENDING)]),
        ]
