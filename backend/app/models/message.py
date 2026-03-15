from datetime import datetime

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.common import utc_now


class Message(Document):
    conversation_id: PydanticObjectId
    sender_id: PydanticObjectId
    content: str = Field(min_length=1, max_length=1000)
    sequence: int = Field(ge=1)

    created_at: datetime = Field(default_factory=utc_now)
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    is_deleted: bool = False

    @before_event([Insert, Replace])
    def normalize_content(self) -> None:
        self.content = self.content.strip()
        if not self.content:
            raise ValueError("Message content cannot be empty")
        if self.created_at is None:
            self.created_at = utc_now()

    class Settings:
        name = "messages"
        indexes = [
            "conversation_id",
            "sender_id",
            IndexModel([("conversation_id", ASCENDING), ("sequence", DESCENDING)]),
        ]
