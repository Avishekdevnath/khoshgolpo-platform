from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    slug: str = Field(min_length=1, max_length=60)
    tag: str = Field(min_length=1, max_length=40)
    description: str = Field(default="", max_length=280)
    color: str = Field(default="#9BA3BE", max_length=10)
    is_default: bool = False


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=280)
    color: str | None = Field(default=None, max_length=10)
    is_default: bool | None = None


class ChannelOut(BaseModel):
    id: str
    name: str
    slug: str
    tag: str
    description: str
    color: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChannelListResponse(BaseModel):
    data: list[ChannelOut]
    page: int
    limit: int
    total: int
