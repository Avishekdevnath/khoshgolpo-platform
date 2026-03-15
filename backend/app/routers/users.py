import re
from datetime import datetime, timedelta, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.profile_slug import validate_profile_slug
from app.models.connection import Connection, ConnectionStatus, MessageRequest
from app.models.user import User
from app.models.audit_log import AuditLog, AuditSeverity, AuditResult
from app.models.notification import Notification, NotificationType
from app.schemas.audit_log import AuditLogOut
from app.schemas.discovery import (
    PeopleCardOut,
    PeopleExploreRankedOut,
    PeopleExploreResponse,
    PeopleExploreSectionOut,
    PeopleReasonOut,
    PeopleSearchResponse,
)
from app.services.audit import log_audit
from app.schemas.user import UserOut, UserUpdate
from app.schemas.follow import FollowAction, FollowStats, FollowStatus, FollowerOut, FollowerListResponse

router = APIRouter(prefix="/users", tags=["users"])


SLUG_COOLDOWN_DAYS = 30


class UserActivityListResponse(BaseModel):
    data: list[AuditLogOut]
    page: int
    limit: int
    total: int


class ProfileSlugUpdate(BaseModel):
    slug: str = Field(min_length=3, max_length=30)


PEOPLE_SECTION_SIZE = 6


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    return _to_user_out(current_user)


@router.patch("/me")
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
) -> UserOut:
    changes: dict[str, object] = {}
    if payload.display_name is not None:
        changes["display_name"] = payload.display_name
        current_user.display_name = payload.display_name
    if payload.bio is not None:
        changes["bio"] = True  # don't log full bio text
        current_user.bio = payload.bio
    if payload.first_name is not None:
        changes["first_name"] = True
        current_user.first_name = payload.first_name.strip() or None
    if payload.last_name is not None:
        changes["last_name"] = True
        current_user.last_name = payload.last_name.strip() or None
    if payload.gender is not None:
        changes["gender"] = True
        current_user.gender = payload.gender.strip() or None

    # Auto-derive display_name from first + last when either changes
    if payload.first_name is not None or payload.last_name is not None:
        fn = (current_user.first_name or "").strip()
        ln = (current_user.last_name or "").strip()
        derived = f"{fn} {ln}".strip()
        if derived:
            current_user.display_name = derived
            changes["display_name"] = derived

    await current_user.save()

    if changes:
        await log_audit(
            action="user_profile_edited",
            actor_id=current_user.id,
            target_type="user",
            target_id=current_user.id,
            details={"fields": list(changes.keys())},
        )

    return _to_user_out(current_user)


@router.get("/search")
async def search_users(
    q: str = Query(default="", min_length=0, max_length=30),
    limit: int = Query(default=6, ge=1, le=20),
    _: User = Depends(get_current_user),
) -> dict:
    if q.strip():
        pattern = {"$regex": f"^{re.escape(q.strip())}", "$options": "i"}
        users = await User.find(
            {"$or": [{"username": pattern}, {"display_name": pattern}]}
        ).limit(limit).to_list()
    else:
        users = await User.find().limit(limit).to_list()
    return {
        "users": [
            {
                "id": str(u.id),
                "username": u.username,
                "display_name": u.display_name,
            }
            for u in users
        ]
    }


@router.get("/people/search")
async def search_people(
    q: str = Query(default="", max_length=50),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=40),
    sort: str = Query(default="relevance", pattern="^(relevance|most_followed|newest)$"),
    relationship: str = Query(default="all", pattern="^(all|not_following|can_connect|connections)$"),
    current_user: User = Depends(get_current_user),
) -> PeopleSearchResponse:
    query_text = q.strip()
    if not query_text or len(query_text) < 2:
        return PeopleSearchResponse(
            data=[],
            page=page,
            limit=limit,
            total=0,
            q=query_text,
            sort=sort,
            relationship=relationship,
        )

    candidates = await _load_people_candidates(current_user, q=query_text)
    filtered = [item for item in candidates if _matches_people_relationship_filter(item, relationship)]
    sorted_items = _sort_people_search(filtered, query_text=query_text, sort=sort)
    total = len(sorted_items)
    page_items = _paginate_items(sorted_items, page=page, limit=limit)

    return PeopleSearchResponse(
        data=[_to_people_card_out(item, context="search", query_text=query_text, sort=sort) for item in page_items],
        page=page,
        limit=limit,
        total=total,
        q=query_text,
        sort=sort,
        relationship=relationship,
    )


@router.get("/people/explore")
async def explore_people(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=40),
    sort: str = Query(default="social", pattern="^(social|most_followed|newest)$"),
    current_user: User = Depends(get_current_user),
) -> PeopleExploreResponse:
    candidates = await _load_people_candidates(current_user)

    suggested_source = [
        item
        for item in candidates
        if not item["is_following"] and not item["is_connected"]
        and (
            int(item["shared_interest_count"]) > 0
            or int(item["mutual_follow_count"]) > 0
            or bool(item["follows_you"])
        )
    ]
    suggested = _sort_people_explore_suggested(
        suggested_source,
        has_interest_tags=bool(_normalize_interest_tags(current_user.interest_tags)),
    )[:PEOPLE_SECTION_SIZE]

    shown_ids: set[str] = {item["id"] for item in suggested}

    popular_candidates = [item for item in candidates if item["id"] not in shown_ids]
    popular = _sort_people_by_popularity(popular_candidates)[:PEOPLE_SECTION_SIZE]
    shown_ids.update(item["id"] for item in popular)

    newest_pool = [item for item in candidates if not item["is_following"]]
    newest = _sort_people_by_newest(newest_pool)[:PEOPLE_SECTION_SIZE]

    ranked_candidates = candidates
    ranked = _sort_people_explore_ranked(
        ranked_candidates,
        sort=sort,
        has_interest_tags=bool(_normalize_interest_tags(current_user.interest_tags)),
    )

    return PeopleExploreResponse(
        sections=[
            PeopleExploreSectionOut(
                key="suggested",
                title="Suggested for you",
                data=[_to_people_card_out(item, context="suggested", sort=sort) for item in suggested],
            ),
            PeopleExploreSectionOut(
                key="popular",
                title="Popular people",
                data=[_to_people_card_out(item, context="popular", sort=sort) for item in popular],
            ),
            PeopleExploreSectionOut(
                key="new",
                title="New on KhoshGolpo",
                data=[_to_people_card_out(item, context="new", sort=sort) for item in newest],
            ),
        ],
        ranked=PeopleExploreRankedOut(
            data=[
                _to_people_card_out(item, context="ranked", sort=sort)
                for item in _paginate_items(ranked, page=page, limit=limit)
            ],
            page=page,
            limit=limit,
            total=len(ranked),
        ),
        sort=sort,
    )


@router.get("/me/activity")
async def get_my_activity(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    category: str = Query(default="all"),
    current_user: User = Depends(get_current_user),
) -> UserActivityListResponse:
    category_key = category.strip().lower()
    base_filter: dict[str, object] = {
        "$or": [
            {"actor_id": current_user.id},
            {"target_id": current_user.id},
        ]
    }
    actions = _activity_actions_for_category(category_key)
    if actions:
        base_filter["action"] = {"$in": actions}

    query = AuditLog.find(base_filter)
    total = await query.count()
    offset = (page - 1) * limit
    logs = await query.sort("-created_at").skip(offset).limit(limit).to_list() if total > 0 else []

    return UserActivityListResponse(
        data=[_to_audit_log_out(item) for item in logs],
        page=page,
        limit=limit,
        total=total,
    )


@router.post("/me/profile-slug")
async def update_profile_slug(
    payload: ProfileSlugUpdate,
    current_user: User = Depends(get_current_user),
) -> UserOut:
    """Change the user's profile slug (vanity URL). Allowed once every 30 days."""
    # 1. Validate format + reserved words
    try:
        new_slug = validate_profile_slug(payload.slug)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    # 2. No-op if same as current (does NOT start the cooldown clock)
    if new_slug == current_user.profile_slug:
        return _to_user_out(current_user)

    # 3. Enforce 30-day cooldown (None = never changed = skip)
    if current_user.profile_slug_changed_at is not None:
        cooldown_until = current_user.profile_slug_changed_at + timedelta(days=SLUG_COOLDOWN_DAYS)
        now = datetime.now(timezone.utc)
        if now < cooldown_until:
            days_left = (cooldown_until - now).days + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"You can change your profile slug in {days_left} day(s).",
            )

    # 4. Uniqueness — must not collide with any username OR any profile_slug
    taken_by_username = await User.find_one({"username": new_slug, "_id": {"$ne": current_user.id}})
    if taken_by_username:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slug is already taken.")

    taken_by_slug = await User.find_one({"profile_slug": new_slug, "_id": {"$ne": current_user.id}})
    if taken_by_slug:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slug is already taken.")

    # 5. Apply
    current_user.profile_slug = new_slug
    current_user.profile_slug_changed_at = datetime.now(timezone.utc)
    await current_user.save()

    await log_audit(
        action="user_profile_slug_changed",
        actor_id=current_user.id,
        target_type="user",
        target_id=current_user.id,
        details={"new_slug": new_slug},
    )

    return _to_user_out(current_user)


@router.get("/me/profile-slug/check")
async def check_profile_slug(
    slug: str = Query(min_length=3, max_length=30),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Availability check used by the debounced frontend input."""
    try:
        normalized = validate_profile_slug(slug)
    except ValueError as exc:
        return {"available": False, "reason": str(exc)}

    # Same as current — trivially available
    if normalized == current_user.profile_slug:
        return {"available": True}

    taken_by_username = await User.find_one({"username": normalized, "_id": {"$ne": current_user.id}})
    if taken_by_username:
        return {"available": False, "reason": "Already taken."}

    taken_by_slug = await User.find_one({"profile_slug": normalized, "_id": {"$ne": current_user.id}})
    if taken_by_slug:
        return {"available": False, "reason": "Already taken."}

    return {"available": True}


@router.get("/{user_id}")
async def get_user_profile(user_id: str) -> UserOut:
    user = await _find_user(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_user_out(user)


@router.post("/{target_user_id}/follow")
async def follow_user(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
) -> FollowStats:
    """Follow a user. Add target_user_id to current_user's following list."""
    # Parse target ID
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user ID")

    # Prevent self-follow
    if current_user.id == target_oid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot follow yourself")

    # Check target user exists
    target_user = await User.find_one({"_id": target_oid})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Add to following list if not already following
    if target_oid not in current_user.following:
        current_user.following.append(target_oid)
        await current_user.save()

        # Notify the target user
        await Notification(
            type=NotificationType.FOLLOW,
            recipient_id=target_oid,
            actor_id=current_user.id,
            message=f"{current_user.display_name} started following you",
        ).insert()

        # Audit log
        await AuditLog(
            action="user_followed",
            actor_id=current_user.id,
            target_type="user",
            target_id=target_oid,
            severity=AuditSeverity.INFO,
            result=AuditResult.SUCCESS,
            created_at=datetime.now(timezone.utc),
        ).insert()

    # Return stats for the TARGET user (who is being followed)
    followers_count = await User.find({"following": target_oid, "is_active": True}).count()
    following_count = await _count_active_following(target_user)
    return FollowStats(
        followers_count=followers_count,
        following_count=following_count,
    )


@router.delete("/{target_user_id}/follow")
async def unfollow_user(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
) -> FollowStats:
    """Unfollow a user. Remove target_user_id from current_user's following list."""
    # Parse target ID
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user ID")

    # Check target user exists
    target_user = await User.find_one({"_id": target_oid})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Remove from following list if currently following
    if target_oid in current_user.following:
        current_user.following.remove(target_oid)
        await current_user.save()

        # Notify the target user
        await Notification(
            type=NotificationType.FOLLOW,
            recipient_id=target_oid,
            actor_id=current_user.id,
            message=f"{current_user.display_name} unfollowed you",
        ).insert()

        # Audit log
        await AuditLog(
            action="user_unfollowed",
            actor_id=current_user.id,
            target_type="user",
            target_id=target_oid,
            severity=AuditSeverity.INFO,
            result=AuditResult.SUCCESS,
            created_at=datetime.now(timezone.utc),
        ).insert()

    # Return stats for the TARGET user
    followers_count = await User.find({"following": target_oid, "is_active": True}).count()
    following_count = await _count_active_following(target_user)
    return FollowStats(
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/{target_user_id}/follow-status")
async def get_follow_status(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
) -> FollowStatus:
    """Get follow status and counts for a user."""
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user ID")

    target_user = await User.find_one({"_id": target_oid})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    is_following = target_oid in current_user.following
    follows_you = current_user.id in target_user.following
    followers_count = await User.find({"following": target_oid, "is_active": True}).count()
    following_count = await _count_active_following(target_user)

    return FollowStatus(
        is_following=is_following,
        follows_you=follows_you,
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/{target_user_id}/followers")
async def list_followers(
    target_user_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> FollowerListResponse:
    """Get users following target_user_id (people who follow target)."""
    # Parse target ID
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user ID")

    # Check target user exists
    target_user = await User.find_one({"_id": target_oid})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Find users who follow target_user (have target_oid in their following list)
    query = User.find({"following": target_oid, "is_active": True})
    total = await query.count()
    offset = (page - 1) * limit
    followers = await query.sort("-created_at").skip(offset).limit(limit).to_list() if total > 0 else []

    return FollowerListResponse(
        data=[
            FollowerOut(
                id=str(f.id),
                username=f.username,
                display_name=f.display_name,
                bio=f.bio,
                is_active=f.is_active,
                created_at=f.created_at,
            )
            for f in followers
        ],
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/{target_user_id}/following")
async def list_following(
    target_user_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> FollowerListResponse:
    """Get users that target_user_id follows (people they follow)."""
    # Parse target ID
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user ID")

    # Check target user exists
    target_user = await User.find_one({"_id": target_oid})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get active users that target_user follows
    if not target_user.following:
        return FollowerListResponse(data=[], page=page, limit=limit, total=0)

    query = User.find({"_id": {"$in": target_user.following}, "is_active": True})
    total = await query.count()
    offset = (page - 1) * limit
    following_users = await query.sort("-created_at").skip(offset).limit(limit).to_list() if total > 0 else []

    return FollowerListResponse(
        data=[
            FollowerOut(
                id=str(u.id),
                username=u.username,
                display_name=u.display_name,
                bio=u.bio,
                is_active=u.is_active,
                created_at=u.created_at,
            )
            for u in following_users
        ],
        page=page,
        limit=limit,
        total=total,
    )


async def _load_people_candidates(current_user: User, *, q: str | None = None) -> list[dict[str, object]]:
    base_filter = _build_people_base_filter(current_user, q=q)
    users = await User.find(base_filter).to_list()
    if not users:
        return []

    candidate_ids = [user.id for user in users]
    follower_counts = await _load_people_follower_counts(candidate_ids)
    connected_ids = await _load_people_connected_ids(current_user.id, candidate_ids)
    pending_requests = await _load_people_pending_requests(current_user.id, candidate_ids)
    following_ids = {str(item) for item in current_user.following}
    interest_tags = _normalize_interest_tags(current_user.interest_tags)

    items: list[dict[str, object]] = []
    for user in users:
        user_id = str(user.id)
        user_following = {str(item) for item in user.following}
        request = pending_requests.get(user_id)
        has_pending_request = request is not None
        is_requester = bool(request and str(request.sender_id) == str(current_user.id))
        shared_interest_count = len(interest_tags & _normalize_interest_tags(user.interest_tags))
        is_connected = user_id in connected_ids
        items.append(
            {
                "id": user_id,
                "username": user.username,
                "display_name": user.display_name,
                "profile_slug": user.profile_slug,
                "avatar_url": user.avatar_url,
                "bio": user.bio,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "created_at": user.created_at,
                "followers_count": follower_counts.get(user_id, 0),
                "mutual_follow_count": len(following_ids & user_following),
                "shared_interest_count": shared_interest_count,
                "is_following": user_id in following_ids,
                "follows_you": str(current_user.id) in user_following,
                "is_connected": is_connected,
                "has_pending_request": has_pending_request,
                "is_requester": is_requester,
                "pending_request_id": str(request.id) if request else None,
                "can_message": is_connected,
                "blocked_by_me": False,
                "blocked_you": False,
                "_incoming_pending": bool(request and str(request.recipient_id) == str(current_user.id)),
            }
        )
    return items


def _build_people_base_filter(current_user: User, *, q: str | None = None) -> dict[str, object]:
    id_filter: dict[str, object] = {"$ne": current_user.id}
    if current_user.blocked_user_ids:
        id_filter["$nin"] = current_user.blocked_user_ids

    base_filter: dict[str, object] = {
        "_id": id_filter,
        "is_active": True,
        "is_bot": False,
        "blocked_user_ids": {"$nin": [current_user.id]},
    }
    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        base_filter["$or"] = [
            {"username": pattern},
            {"display_name": pattern},
            {"bio": pattern},
        ]
    return base_filter


async def _load_people_follower_counts(candidate_ids: list[PydanticObjectId]) -> dict[str, int]:
    if not candidate_ids:
        return {}
    pipeline: list[dict[str, object]] = [
        {"$match": {"is_active": True, "following": {"$in": candidate_ids}}},
        {"$unwind": "$following"},
        {"$match": {"following": {"$in": candidate_ids}}},
        {"$group": {"_id": "$following", "count": {"$sum": 1}}},
    ]
    return {
        str(doc["_id"]): int(doc["count"])
        for doc in await User.aggregate(pipeline).to_list()
    }


async def _load_people_connected_ids(
    current_user_id: PydanticObjectId,
    candidate_ids: list[PydanticObjectId],
) -> set[str]:
    if not candidate_ids:
        return set()
    connections = await Connection.find(
        {
            "user_id": current_user_id,
            "connected_user_id": {"$in": candidate_ids},
            "status": ConnectionStatus.CONNECTED,
        }
    ).to_list()
    return {str(item.connected_user_id) for item in connections}


async def _load_people_pending_requests(
    current_user_id: PydanticObjectId,
    candidate_ids: list[PydanticObjectId],
) -> dict[str, MessageRequest]:
    if not candidate_ids:
        return {}
    requests = await MessageRequest.find(
        {
            "status": ConnectionStatus.PENDING,
            "$or": [
                {"sender_id": current_user_id, "recipient_id": {"$in": candidate_ids}},
                {"sender_id": {"$in": candidate_ids}, "recipient_id": current_user_id},
            ],
        }
    ).to_list()
    result: dict[str, MessageRequest] = {}
    for request in requests:
        other_id = request.recipient_id if request.sender_id == current_user_id else request.sender_id
        result[str(other_id)] = request
    return result


def _normalize_interest_tags(tags: list[str]) -> set[str]:
    return {
        tag.strip().lower()
        for tag in tags
        if isinstance(tag, str) and tag.strip()
    }


def _matches_people_relationship_filter(item: dict[str, object], relationship: str) -> bool:
    if relationship == "all":
        return True
    if relationship == "not_following":
        return not bool(item["is_following"])
    if relationship == "can_connect":
        return not bool(item["is_connected"]) and not bool(item["has_pending_request"])
    if relationship == "connections":
        return bool(item["is_connected"])
    return True


def _sort_people_search(items: list[dict[str, object]], *, query_text: str, sort: str) -> list[dict[str, object]]:
    normalized_query = query_text.strip().lower()

    def relevance_key(item: dict[str, object]) -> tuple[object, ...]:
        return (
            _search_match_bucket(item, normalized_query),
            0 if item["follows_you"] else 1,
            0 if item["is_connected"] else 1,
            0 if item["_incoming_pending"] else 1,
            -int(item["mutual_follow_count"]),
            -int(item["followers_count"]),
            -_created_at_value(item),
            str(item["username"]).lower(),
        )

    sorted_items = list(items)
    if sort == "most_followed":
        sorted_items.sort(key=_people_popularity_sort_key)
        return sorted_items
    if sort == "newest":
        sorted_items.sort(key=_people_newest_sort_key)
        return sorted_items
    sorted_items.sort(key=relevance_key)
    return sorted_items


def _sort_people_explore_suggested(
    items: list[dict[str, object]],
    *,
    has_interest_tags: bool,
) -> list[dict[str, object]]:
    sorted_items = list(items)
    sorted_items.sort(key=lambda item: _people_social_sort_key(item, has_interest_tags=has_interest_tags))
    return sorted_items


def _sort_people_explore_ranked(
    items: list[dict[str, object]],
    *,
    sort: str,
    has_interest_tags: bool,
) -> list[dict[str, object]]:
    sorted_items = list(items)
    if sort == "most_followed":
        sorted_items.sort(key=_people_popularity_sort_key)
        return sorted_items
    if sort == "newest":
        sorted_items.sort(key=_people_newest_sort_key)
        return sorted_items
    sorted_items.sort(key=lambda item: _people_social_sort_key(item, has_interest_tags=has_interest_tags))
    return sorted_items


def _sort_people_by_popularity(items: list[dict[str, object]]) -> list[dict[str, object]]:
    sorted_items = list(items)
    sorted_items.sort(key=_people_popularity_sort_key)
    return sorted_items


def _sort_people_by_newest(items: list[dict[str, object]]) -> list[dict[str, object]]:
    sorted_items = list(items)
    sorted_items.sort(key=_people_newest_sort_key)
    return sorted_items


def _people_social_sort_key(item: dict[str, object], *, has_interest_tags: bool) -> tuple[object, ...]:
    prefix = (
        -int(item["shared_interest_count"]),
        0 if item["follows_you"] else 1,
        -int(item["mutual_follow_count"]),
        0 if item["_incoming_pending"] else 1,
    ) if has_interest_tags else (
        0 if item["follows_you"] else 1,
        -int(item["mutual_follow_count"]),
        0 if item["_incoming_pending"] else 1,
    )
    return (
        *prefix,
        -int(item["followers_count"]),
        -_created_at_value(item),
        str(item["username"]).lower(),
    )


def _people_popularity_sort_key(item: dict[str, object]) -> tuple[object, ...]:
    return (
        -int(item["followers_count"]),
        -_created_at_value(item),
        str(item["username"]).lower(),
    )


def _people_newest_sort_key(item: dict[str, object]) -> tuple[object, ...]:
    return (
        -_created_at_value(item),
        -int(item["followers_count"]),
        str(item["username"]).lower(),
    )


def _search_match_bucket(item: dict[str, object], query_text: str) -> int:
    username = str(item["username"]).lower()
    display_name = str(item["display_name"]).lower()
    bio = str(item.get("bio") or "").lower()
    if username == query_text:
        return 0
    if username.startswith(query_text):
        return 1
    if display_name.startswith(query_text):
        return 2
    if query_text in username or query_text in display_name:
        return 3
    if query_text in bio:
        return 4
    return 5


def _paginate_items(items: list[dict[str, object]], *, page: int, limit: int) -> list[dict[str, object]]:
    offset = (page - 1) * limit
    return items[offset : offset + limit]


def _to_people_card_out(
    item: dict[str, object],
    *,
    context: str,
    query_text: str = "",
    sort: str,
) -> PeopleCardOut:
    return PeopleCardOut(
        id=str(item["id"]),
        username=str(item["username"]),
        display_name=str(item["display_name"]),
        profile_slug=item.get("profile_slug"),
        avatar_url=item.get("avatar_url"),
        bio=item.get("bio"),
        role=str(item["role"]),
        created_at=item["created_at"],
        followers_count=int(item["followers_count"]),
        mutual_follow_count=int(item["mutual_follow_count"]),
        shared_interest_count=int(item["shared_interest_count"]),
        is_following=bool(item["is_following"]),
        follows_you=bool(item["follows_you"]),
        is_connected=bool(item["is_connected"]),
        has_pending_request=bool(item["has_pending_request"]),
        is_requester=bool(item["is_requester"]),
        pending_request_id=item.get("pending_request_id"),
        can_message=bool(item["can_message"]),
        blocked_by_me=bool(item["blocked_by_me"]),
        blocked_you=bool(item["blocked_you"]),
        reason=_build_people_reason(item, context=context, query_text=query_text, sort=sort),
    )


def _build_people_reason(
    item: dict[str, object],
    *,
    context: str,
    query_text: str,
    sort: str,
) -> PeopleReasonOut:
    if context == "search" and sort == "relevance":
        bucket = _search_match_bucket(item, query_text.lower())
        if bucket == 0:
            return PeopleReasonOut(kind="exact_username", label="Exact username match")
        if bucket == 1:
            return PeopleReasonOut(kind="username_prefix", label="Username match")
        if bucket == 2:
            return PeopleReasonOut(kind="display_name_prefix", label="Display name match")
        if bucket == 3:
            return PeopleReasonOut(kind="name_match", label="Name match")
        if bucket == 4:
            return PeopleReasonOut(kind="bio_match", label="Bio match")

    if context == "new":
        return PeopleReasonOut(kind="new", label="New on KhoshGolpo")
    if context == "popular":
        return PeopleReasonOut(kind="popular", label="Popular on KhoshGolpo")

    if int(item["shared_interest_count"]) > 0:
        count = int(item["shared_interest_count"])
        suffix = "" if count == 1 else "s"
        return PeopleReasonOut(kind="shared_interests", label=f"{count} shared interest{suffix}")
    if bool(item["follows_you"]):
        return PeopleReasonOut(kind="follows_you", label="Follows you")
    if int(item["mutual_follow_count"]) > 0:
        count = int(item["mutual_follow_count"])
        suffix = "" if count == 1 else "s"
        return PeopleReasonOut(kind="mutual_follows", label=f"{count} mutual follow{suffix}")
    if bool(item["_incoming_pending"]):
        return PeopleReasonOut(kind="pending_request", label="Sent you a request")
    if sort == "newest":
        return PeopleReasonOut(kind="new", label="New on KhoshGolpo")
    return PeopleReasonOut(kind="popular", label="Popular on KhoshGolpo")


def _created_at_value(item: dict[str, object]) -> float:
    created_at = item["created_at"]
    return created_at.timestamp() if isinstance(created_at, datetime) else 0.0


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        bio=user.bio,
        role=user.role,
        is_active=user.is_active,
        is_bot=user.is_bot,
        first_name=user.first_name,
        last_name=user.last_name,
        gender=user.gender,
        profile_slug=user.profile_slug,
        profile_slug_changed_at=user.profile_slug_changed_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def _find_user(user_id: str) -> User | None:
    # 1. Try ObjectId (permanent — always resolves even after slug changes)
    try:
        object_id = PydanticObjectId(user_id)
        user = await User.find_one({"_id": object_id})
        if user is not None:
            return user
    except Exception:
        pass

    normalized = user_id.strip().lower()
    if not normalized:
        return None

    # 2. Try username (permanent handle)
    user = await User.find_one({"username": normalized})
    if user is not None:
        return user

    # 3. Try profile_slug (changeable vanity URL)
    return await User.find_one({"profile_slug": normalized})


async def _count_active_following(user: User) -> int:
    if not user.following:
        return 0
    return await User.find({"_id": {"$in": user.following}, "is_active": True}).count()


def _activity_actions_for_category(category: str) -> list[str] | None:
    if category == "all":
        return None
    if category == "security":
        return [
            "auth_login_success",
            "auth_login_failed",
            "auth_account_locked",
            "user_password_changed",
            "user_password_reset",
            "user_password_change_enforced",
            "user_password_change_enforcement_cleared",
            "user_logout",
        ]
    if category == "content":
        return [
            "thread_created",
            "thread_edited",
            "thread_deleted",
            "thread_restored",
            "thread_status_changed",
            "thread_pin_changed",
            "post_created",
            "post_edited",
            "post_deleted",
            "post_restored",
            "moderation_approve",
            "moderation_reject",
            "moderation_bulk_completed",
            "appeal_submitted",
            "appeal_approved",
            "appeal_rejected",
        ]
    if category == "account":
        return [
            "user_registered",
            "user_role_changed",
            "user_status_changed",
            "user_profile_edited",
            "user_profile_slug_changed",
            "user_followed",
            "user_unfollowed",
            "admin_note_added",
            "message_request_sent",
            "message_request_accepted",
            "message_request_rejected",
        ]
    if category == "system":
        return [
            "system_notification_sent",
        ]
    return None


def _to_audit_log_out(log: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=str(log.id),
        action=log.action,
        actor_id=str(log.actor_id) if log.actor_id else None,
        target_type=log.target_type,
        target_id=str(log.target_id) if log.target_id else None,
        severity=log.severity,
        result=log.result,
        request_id=log.request_id,
        ip=log.ip,
        details=log.details,
        created_at=log.created_at,
    )
