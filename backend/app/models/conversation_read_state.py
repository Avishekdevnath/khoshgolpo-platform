from datetime import datetime

from beanie import Document, Insert, PydanticObjectId, Replace, before_event
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.common import utc_now


class ConversationReadState(Document):
    conversation_id: PydanticObjectId
    user_id: PydanticObjectId
    last_read_message_id: PydanticObjectId | None = None
    last_read_sequence: int = 0
    last_read_at: datetime | None = None

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @before_event([Insert, Replace])
    def update_timestamps(self) -> None:
        now = utc_now()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    class Settings:
        name = "conversation_read_states"
        indexes = [
            "user_id",
            "conversation_id",
            IndexModel([("conversation_id", ASCENDING), ("user_id", ASCENDING)], unique=True),
        ]
