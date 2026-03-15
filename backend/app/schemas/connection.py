from datetime import datetime

from pydantic import BaseModel


class MessageRequestOut(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    message: str | None = None
    status: str
    created_at: datetime
    # Enriched other-party user info (populated by list endpoints)
    other_user_id: str | None = None
    other_user_username: str | None = None
    other_user_display_name: str | None = None

    model_config = {"from_attributes": True}


class MessageRequestListResponse(BaseModel):
    data: list[MessageRequestOut]
    total: int
    page: int
    limit: int


class ConnectionOut(BaseModel):
    id: str
    user_id: str
    connected_user_id: str
    status: str
    created_at: datetime
    connected_user_username: str | None = None
    connected_user_display_name: str | None = None
    connected_user_avatar_url: str | None = None
    connected_user_is_active: bool | None = None
    connected_user_is_bot: bool | None = None

    model_config = {"from_attributes": True}


class ConnectionListResponse(BaseModel):
    data: list[ConnectionOut]
    total: int


class ConnectionStatusResponse(BaseModel):
    is_connected: bool
    has_pending_request: bool
    is_requester: bool  # True if current user sent the request
    pending_request_id: str | None = None
    can_message: bool = False
    blocked_by_me: bool = False
    blocked_you: bool = False
