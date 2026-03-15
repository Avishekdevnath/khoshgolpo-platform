from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.thread import ThreadStatus
from app.models.user import UserRole
from app.schemas.audit_log import AuditLogOut
from app.schemas.post import PostOut
from app.schemas.thread import ThreadOut
from app.schemas.user import UserOut


class AdminUserListResponse(BaseModel):
    data: list[UserOut]
    page: int
    limit: int
    total: int


class AdminModerationItem(BaseModel):
    type: Literal["thread", "post"]
    id: str
    thread_id: str | None = None
    author_id: str
    author_username: str | None = None
    author_display_name: str | None = None
    title: str | None = None
    content: str | None = None
    status: ThreadStatus | None = None
    ai_score: float | None = None
    is_flagged: bool | None = None
    is_deleted: bool
    created_at: datetime


class AdminModerationListResponse(BaseModel):
    data: list[AdminModerationItem]
    page: int
    limit: int
    total: int
    flagged_posts: int
    flagged_threads: int


class AdminModerationActionRequest(BaseModel):
    action: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=300)


class AdminModerationBulkItem(BaseModel):
    content_type: Literal["thread", "post"] = "post"
    content_id: str | None = None
    post_id: str | None = None
    action: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=300)


class AdminBulkModerationRequest(BaseModel):
    actions: list[AdminModerationBulkItem] = Field(min_length=1, max_length=100)


class AdminBulkModerationResult(BaseModel):
    content_type: Literal["thread", "post"]
    content_id: str
    action: Literal["approve", "reject"]
    success: bool
    error: str | None = None


class AdminBulkModerationResponse(BaseModel):
    results: list[AdminBulkModerationResult]
    processed: int
    succeeded: int
    failed: int


class AdminUserRoleUpdate(BaseModel):
    role: UserRole
    reason: str | None = Field(default=None, max_length=300)


class AdminUserStatusUpdate(BaseModel):
    is_active: bool
    reason: str | None = Field(default=None, max_length=300)


class AdminThreadStatusUpdate(BaseModel):
    status: ThreadStatus
    reason: str | None = Field(default=None, max_length=300)


class AdminThreadPinUpdate(BaseModel):
    is_pinned: bool
    reason: str | None = Field(default=None, max_length=300)


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_threads: int
    total_posts: int
    flagged_posts: int
    deleted_posts: int
    generated_at: datetime


class AuditLogListResponse(BaseModel):
    data: list[AuditLogOut]
    page: int
    limit: int
    total: int


class AdminContentItem(BaseModel):
    type: Literal["thread", "post"]
    id: str
    thread_id: str | None = None
    author_id: str
    author_username: str | None = None
    author_display_name: str | None = None
    title: str | None = None
    content: str | None = None
    status: ThreadStatus | None = None
    is_pinned: bool | None = None
    ai_score: float | None = None
    is_flagged: bool | None = None
    is_deleted: bool
    created_at: datetime


class AdminContentListResponse(BaseModel):
    data: list[AdminContentItem]
    page: int
    limit: int
    total: int
    missing_ai_reports: int


class AdminContentFlagUpdate(BaseModel):
    is_flagged: bool
    reason: str | None = Field(default=None, max_length=300)


class AdminContentEditRequest(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    content: str | None = Field(default=None)
    reason: str | None = Field(default=None, max_length=300)


class AdminContentNotifyRequest(BaseModel):
    message: str = Field(min_length=1, max_length=300)
    reason: str | None = Field(default=None, max_length=300)


class AdminContentNotifyResponse(BaseModel):
    success: bool


class AdminContentRereportMissingRequest(BaseModel):
    limit: int = Field(default=200, ge=1, le=1000)
    include_deleted: bool = False


class AdminContentRereportResponse(BaseModel):
    processed: int
    updated: int
    failed: int
    flagged: int
    threads_updated: int
    posts_updated: int


class AdminThreadListResponse(BaseModel):
    data: list[ThreadOut]
    page: int
    limit: int
    total: int


class AdminAppealItem(BaseModel):
    id: str
    notification_id: str
    appellant_id: str
    appellant_username: str | None = None
    appellant_display_name: str | None = None
    content_type: Literal["thread", "post"]
    content_id: str
    thread_id: str | None = None
    post_id: str | None = None
    notification_message: str
    reason: str
    status: Literal["pending", "approved", "rejected"]
    admin_note: str | None = None
    resolved_by: str | None = None
    resolved_by_username: str | None = None
    resolved_by_display_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminAppealListResponse(BaseModel):
    data: list[AdminAppealItem]
    page: int
    limit: int
    total: int
    pending_count: int


class AdminAppealResolveRequest(BaseModel):
    action: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=500)


# ─── User detail / notes / bulk ───────────────────────────────────────────────

class AdminNoteOut(BaseModel):
    note: str
    admin_id: str
    admin_display_name: str | None = None
    created_at: datetime


class AdminUserDetailResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    bio: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    total_posts: int
    total_threads: int
    followers_count: int
    following_count: int
    login_attempts: int
    locked_until: datetime | None = None
    last_login: datetime | None = None
    admin_notes: list[AdminNoteOut]
    recent_audit_logs: list[AuditLogOut]


class AdminNoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=500)


class AdminBulkRoleUpdate(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=50)
    role: UserRole
    reason: str | None = Field(default=None, max_length=300)


class AdminBulkStatusUpdate(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=50)
    is_active: bool
    reason: str | None = Field(default=None, max_length=300)


class AdminBulkUserResult(BaseModel):
    user_id: str
    success: bool
    error: str | None = None


class AdminBulkUserResponse(BaseModel):
    results: list[AdminBulkUserResult]
    processed: int
    succeeded: int
    failed: int
