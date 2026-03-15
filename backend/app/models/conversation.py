from datetime import datetime

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.common import utc_now


class Conversation(Document):
    participant_ids: list[PydanticObjectId] = Field(min_length=2, max_length=2)
    participant_key: str = Field(min_length=1, max_length=128)

    last_message_id: PydanticObjectId | None = None
    last_message_preview: str | None = Field(default=None, max_length=160)
    last_message_at: datetime | None = None
    last_message_sender_id: PydanticObjectId | None = None
    message_count: int = 0

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now
        self.participant_ids = sorted(self.participant_ids, key=str)
        self.participant_key = ":".join(str(item) for item in self.participant_ids)
        if self.last_message_at is None:
            self.last_message_at = self.created_at

    class Settings:
        name = "conversations"
        indexes = [
            "participant_ids",
            "last_message_at",
            IndexModel([("participant_key", ASCENDING)], unique=True),
            IndexModel([("participant_ids", ASCENDING), ("last_message_at", DESCENDING)]),
        ]
