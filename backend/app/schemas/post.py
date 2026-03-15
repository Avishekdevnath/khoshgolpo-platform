from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PostCreate(BaseModel):
    content: str = Field(min_length=1)
    parent_post_id: str | None = None
    mentions: list[str] = Field(default_factory=list)
    author_id: str | None = None


class PostUpdate(BaseModel):
    content: str = Field(min_length=1)


class PostOut(BaseModel):
    id: str
    thread_id: str
    author_id: str
    author_username: str | None = None
    author_display_name: str | None = None
    author_is_bot: bool = False
    parent_post_id: str | None
    content: str
    mentions: list[str]
    ai_score: float | None
    is_flagged: bool
    is_deleted: bool
    like_count: int = 0
    liked_by_me: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PostTreeNode(PostOut):
    children: list["PostTreeNode"] = Field(default_factory=list)


class PostTreeListResponse(BaseModel):
    data: list[PostTreeNode]
    page: int
    limit: int
    total: int


PostTreeNode.model_rebuild()
