from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.appeal import AppealStatus
from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    id: str
    type: NotificationType
    recipient_id: str
    actor_id: str | None
    thread_id: str | None
    post_id: str | None
    message: str
    metadata: dict[str, str | bool | int | float | None] = Field(default_factory=dict)
    is_read: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationMarkRead(BaseModel):
    is_read: bool = True


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    total: int
    unread_count: int
    page: int
    limit: int
    has_more: bool


class NotificationAppealCreateRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class NotificationAppealOut(BaseModel):
    id: str
    notification_id: str
    status: AppealStatus
    reason: str
    admin_note: str | None
    created_at: datetime
    updated_at: datetime
