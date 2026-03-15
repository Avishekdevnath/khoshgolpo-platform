from pydantic import BaseModel, ConfigDict
from datetime import datetime


class FollowAction(BaseModel):
    """Request body for follow/unfollow actions"""
    target_user_id: str  # ID of user to follow/unfollow


class FollowStats(BaseModel):
    """Follow statistics returned after follow/unfollow action"""
    followers_count: int
    following_count: int


class FollowStatus(BaseModel):
    """Current follow status between current user and target user"""
    is_following: bool
    follows_you: bool = False
    followers_count: int
    following_count: int


class FollowerOut(BaseModel):
    """User in a follower/following list"""
    id: str
    username: str
    display_name: str | None = None
    bio: str | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FollowerListResponse(BaseModel):
    """Paginated list of followers/following"""
    data: list[FollowerOut]
    page: int
    limit: int
    total: int
