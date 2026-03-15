from datetime import timedelta
from typing import Literal

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user, get_optional_current_user
from app.models.common import utc_now
from app.models.thread import Thread
from app.models.user import User
from app.schemas.feed import (
    FeedExplainResponse,
    FeedInterestUpdate,
    FeedItemOut,
    FeedListResponse,
    FeedPreferencesOut,
    FeedPreferencesUpdate,
    MyFeedResponse,
    PopularTopicOut,
    PopularTopicsResponse,
    TopicsSetRequest,
)
from app.services.audit import log_audit
from app.services.feed_config import get_or_create_feed_config
from app.services.feed_query import apply_visibility_filters, explain_thread_for_user, fetch_ranked_feed_slice

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/following")
async def get_following_feed(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> FeedListResponse:
    config = await get_or_create_feed_config()
    try:
        ranked, next_cursor = await fetch_ranked_feed_slice(
            current_user,
            mode="following",
            limit=limit,
            cursor=cursor,
            weights=config.weights,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    author_lookup = await _load_author_lookup({item.thread.author_id for item in ranked})
    return FeedListResponse(
        data=[_to_feed_item(item.thread, author_lookup.get(str(item.thread.author_id)), item.score, item.reasons) for item in ranked],
        limit=limit,
        next_cursor=next_cursor,
        mode="following",
    )


@router.get("/home")
async def get_home_feed(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> FeedListResponse:
    config = await get_or_create_feed_config()
    try:
        ranked, next_cursor = await fetch_ranked_feed_slice(
            current_user,
            mode="home",
            limit=limit,
            cursor=cursor,
            weights=config.weights,
            feed_config=config,
            allow_ai=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    author_lookup = await _load_author_lookup({item.thread.author_id for item in ranked})
    return FeedListResponse(
        data=[_to_feed_item(item.thread, author_lookup.get(str(item.thread.author_id)), item.score, item.reasons) for item in ranked],
        limit=limit,
        next_cursor=next_cursor,
        mode="home",
    )


@router.get("/preferences")
async def get_feed_preferences(current_user: User = Depends(get_current_user)) -> FeedPreferencesOut:
    return _to_feed_preferences_out(current_user)


@router.patch("/preferences")
async def update_feed_preferences(
    payload: FeedPreferencesUpdate,
    current_user: User = Depends(get_current_user),
) -> FeedPreferencesOut:
    changed_fields: list[str] = []

    if payload.interest_tags is not None:
        current_user.interest_tags = _normalize_tag_list(payload.interest_tags, max_items=30)
        current_user.topics_selected = len(current_user.interest_tags) > 0
        changed_fields.append("interest_tags")
    if payload.hidden_tags is not None:
        current_user.hidden_tags = _normalize_tag_list(payload.hidden_tags, max_items=30)
        changed_fields.append("hidden_tags")
    if payload.muted_user_ids is not None:
        current_user.muted_users = [_parse_object_id(item, field_name="muted_user_id") for item in payload.muted_user_ids]
        changed_fields.append("muted_user_ids")

    if changed_fields:
        await current_user.save()
        await log_audit(
            action="feed_preferences_updated",
            actor_id=current_user.id,
            target_type="user",
            target_id=current_user.id,
            details={"fields": changed_fields},
        )

    return _to_feed_preferences_out(current_user)


@router.post("/interest")
async def update_interest_tags(
    payload: FeedInterestUpdate,
    current_user: User = Depends(get_current_user),
) -> FeedPreferencesOut:
    current_user.interest_tags = _normalize_tag_list(payload.interest_tags, max_items=30)
    current_user.topics_selected = len(current_user.interest_tags) > 0
    await current_user.save()
    await log_audit(
        action="feed_interests_updated",
        actor_id=current_user.id,
        target_type="user",
        target_id=current_user.id,
        details={"interest_count": len(current_user.interest_tags)},
    )
    return _to_feed_preferences_out(current_user)


@router.get("/explain/{thread_id}")
async def explain_feed_item(
    thread_id: str,
    mode: Literal["home", "following"] = Query(default="home"),
    current_user: User = Depends(get_current_user),
) -> FeedExplainResponse:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id, "is_deleted": False, "feed_suppressed": {"$ne": True}})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    visible = apply_visibility_filters([thread], current_user)
    if not visible:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not visible for this user")
    thread = visible[0]

    config = await get_or_create_feed_config()
    scored = explain_thread_for_user(thread, current_user, config.weights)
    reasons = list(scored.reasons)
    if mode == "following" and str(thread.author_id) not in {str(item) for item in current_user.following}:
        reasons.append("not_following_author")

    return FeedExplainResponse(
        thread_id=str(thread.id),
        mode=mode,
        score=scored.score,
        reasons=reasons,
        breakdown=scored.breakdown,
    )


@router.get("/topics/popular")
async def get_popular_topics(
    limit: int = Query(default=40, ge=1, le=100),
) -> PopularTopicsResponse:
    pipeline = [
        {"$match": {"is_deleted": False, "feed_suppressed": {"$ne": True}}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "thread_count": {"$sum": 1}}},
        {"$sort": {"thread_count": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0, "name": "$_id", "thread_count": 1}},
    ]
    results = await Thread.aggregate(pipeline).to_list()
    topics = [PopularTopicOut(name=r["name"], thread_count=r["thread_count"]) for r in results]
    return PopularTopicsResponse(topics=topics)


@router.post("/topics")
async def set_user_topics(
    payload: TopicsSetRequest,
    current_user: User = Depends(get_current_user),
) -> FeedPreferencesOut:
    current_user.interest_tags = _normalize_tag_list(payload.topics, max_items=30)
    current_user.topics_selected = True
    await current_user.save()
    await log_audit(
        action="feed_topics_set",
        actor_id=current_user.id,
        target_type="user",
        target_id=current_user.id,
        details={"topic_count": len(current_user.interest_tags), "topics": current_user.interest_tags},
    )
    return _to_feed_preferences_out(current_user)


@router.get("/my-feed")
async def get_my_feed(
    sort: Literal["recent", "trending"] = Query(default="recent"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> MyFeedResponse:
    if not current_user.interest_tags:
        return MyFeedResponse(data=[], next_cursor=None, has_topics=False)

    interest_set = [tag.strip().lower() for tag in current_user.interest_tags if tag.strip()]
    base_filter: dict = {
        "is_deleted": False,
        "feed_suppressed": {"$ne": True},
        "tags": {"$in": interest_set},
    }

    offset = _decode_cursor(cursor)

    if sort == "trending":
        cutoff = utc_now() - timedelta(days=7)
        base_filter["updated_at"] = {"$gte": cutoff}
        threads = (
            await Thread.find(base_filter)
            .sort([("-post_count", 1), ("-updated_at", 1)])
            .skip(offset)
            .limit(limit)
            .to_list()
        )
    else:
        threads = (
            await Thread.find(base_filter)
            .sort("-created_at")
            .skip(offset)
            .limit(limit)
            .to_list()
        )

    author_lookup = await _load_author_lookup({t.author_id for t in threads})
    data = [_to_feed_item(t, author_lookup.get(str(t.author_id)), 0.0, []) for t in threads]
    next_cursor = _encode_cursor(offset + len(threads)) if len(threads) == limit else None
    return MyFeedResponse(data=data, next_cursor=next_cursor, has_topics=True)


@router.get("/explore")
async def get_explore_feed(
    sort: Literal["recent", "trending"] = Query(default="recent"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User | None = Depends(get_optional_current_user),
) -> FeedListResponse:
    base_filter: dict = {"is_deleted": False, "feed_suppressed": {"$ne": True}}
    muted_ids: set[str] = set()
    if current_user:
        muted_ids = {str(m) for m in current_user.muted_users}

    offset = _decode_cursor(cursor)

    if sort == "trending":
        cutoff = utc_now() - timedelta(days=7)
        base_filter["updated_at"] = {"$gte": cutoff}
        threads = (
            await Thread.find(base_filter)
            .sort([("-post_count", 1), ("-updated_at", 1)])
            .skip(offset)
            .limit(limit)
            .to_list()
        )
    else:
        threads = (
            await Thread.find(base_filter)
            .sort("-created_at")
            .skip(offset)
            .limit(limit)
            .to_list()
        )

    if muted_ids:
        threads = [t for t in threads if str(t.author_id) not in muted_ids]

    author_lookup = await _load_author_lookup({t.author_id for t in threads})
    data = [_to_feed_item(t, author_lookup.get(str(t.author_id)), 0.0, []) for t in threads]
    next_cursor = _encode_cursor(offset + limit) if len(threads) == limit else None
    return FeedListResponse(data=data, limit=limit, next_cursor=next_cursor, mode="home")


def _encode_cursor(offset: int) -> str:
    import base64, json
    payload = json.dumps({"offset": max(offset, 0)}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    import base64, json
    try:
        padded = cursor + ("=" * (-len(cursor) % 4))
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        return max(int(json.loads(raw).get("offset", 0)), 0)
    except Exception:
        return 0


def _normalize_tag_list(values: list[str], *, max_items: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        tag = raw.strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)
    return normalized[:max_items]


def _parse_object_id(value: str, *, field_name: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        ) from exc


async def _load_author_lookup(author_ids: set[PydanticObjectId]) -> dict[str, User]:
    if not author_ids:
        return {}
    users = await User.find({"_id": {"$in": list(author_ids)}}).to_list()
    return {str(item.id): item for item in users}


def _to_feed_item(
    thread: Thread,
    author: User | None,
    score: float,
    reasons: list[str],
) -> FeedItemOut:
    return FeedItemOut(
        id=str(thread.id),
        title=thread.title,
        body=thread.body,
        tags=thread.tags,
        author_id=str(thread.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        post_count=thread.post_count,
        status=thread.status,
        is_pinned=thread.is_pinned,
        is_flagged=thread.is_flagged,
        is_deleted=thread.is_deleted,
        feed_boost=thread.feed_boost,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        score=score,
        reasons=reasons,
    )


def _to_feed_preferences_out(user: User) -> FeedPreferencesOut:
    return FeedPreferencesOut(
        interest_tags=user.interest_tags,
        hidden_tags=user.hidden_tags,
        muted_user_ids=[str(item) for item in user.muted_users],
        topics_selected=user.topics_selected,
    )
