from datetime import datetime

from pydantic import BaseModel


class PeopleReasonOut(BaseModel):
    kind: str
    label: str


class PeopleCardOut(BaseModel):
    id: str
    username: str
    display_name: str
    profile_slug: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    role: str
    created_at: datetime
    followers_count: int = 0
    mutual_follow_count: int = 0
    shared_interest_count: int = 0
    is_following: bool = False
    follows_you: bool = False
    is_connected: bool = False
    has_pending_request: bool = False
    is_requester: bool = False
    pending_request_id: str | None = None
    can_message: bool = False
    blocked_by_me: bool = False
    blocked_you: bool = False
    reason: PeopleReasonOut


class PeopleSearchResponse(BaseModel):
    data: list[PeopleCardOut]
    page: int
    limit: int
    total: int
    q: str
    sort: str
    relationship: str


class PeopleExploreSectionOut(BaseModel):
    key: str
    title: str
    data: list[PeopleCardOut]


class PeopleExploreRankedOut(BaseModel):
    data: list[PeopleCardOut]
    page: int
    limit: int
    total: int


class PeopleExploreResponse(BaseModel):
    sections: list[PeopleExploreSectionOut]
    ranked: PeopleExploreRankedOut
    sort: str
