from datetime import datetime

from pydantic import BaseModel, Field


class MessageParticipantOut(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: str | None = None
    is_active: bool
    is_bot: bool = False


class ConversationOut(BaseModel):
    id: str
    participant_ids: list[str]
    other_participant: MessageParticipantOut
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    last_message_sender_id: str | None = None
    message_count: int
    unread_count: int
    blocked_by_me: bool = False
    blocked_you: bool = False
    can_message: bool = True
    created_at: datetime
    updated_at: datetime


class ConversationListResponse(BaseModel):
    data: list[ConversationOut]
    next_cursor: str | None = None


class ConversationCreateRequest(BaseModel):
    target_user_id: str = Field(min_length=1, max_length=64)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    sequence: int
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    is_deleted: bool
    is_own: bool


class MessageListResponse(BaseModel):
    conversation: ConversationOut
    data: list[MessageOut]
    next_cursor: str | None = None


class MarkReadRequest(BaseModel):
    last_read_message_id: str | None = None


class MessageUnreadCountResponse(BaseModel):
    unread_count: int


class MessageBlockStatusResponse(BaseModel):
    target_user_id: str
    blocked_by_me: bool
    blocked_you: bool
    can_message: bool
