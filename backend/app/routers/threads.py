from typing import Literal

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.auth import get_current_user, get_optional_current_user
from app.models.post import Post
from app.models.notification import Notification, NotificationType
from app.models.thread import Thread
from app.models.thread import ThreadStatus
from app.models.user import User, UserRole
from app.schemas.post import PostCreate, PostOut, PostTreeListResponse, PostTreeNode
from app.schemas.thread import ThreadCreate, ThreadListResponse, ThreadOut, ThreadUpdate, ReportRequest
from app.models.audit_log import AuditSeverity
from app.services.ai import score_content
from app.services.audit import log_audit
from app.services.mentions import merge_mentions

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("")
async def list_threads(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tag: str | None = None,
    search: str | None = None,
    sort: Literal["newest", "oldest", "most_replies"] = "newest",
    status_filter: ThreadStatus | None = Query(default=None, alias="status"),
    author_id: str | None = None,
    current_user: User | None = Depends(get_optional_current_user),
) -> ThreadListResponse:
    await _ensure_db_ready(request)
    filters: list[dict[str, object]] = [{"is_deleted": False}]
    if tag:
        filters.append({"tags": tag.strip().lower()})
    if status_filter:
        filters.append({"status": status_filter})
    if author_id:
        try:
            filters.append({"author_id": PydanticObjectId(author_id.strip())})
        except Exception:
            pass  # ignore invalid author_id — return all threads

    if search:
        query = search.strip()
        if query:
            regex = {"$regex": query, "$options": "i"}
            filters.append({"$or": [{"title": regex}, {"body": regex}]})

    query_builder = Thread.find(*filters)
    total = await query_builder.count()

    sort_key = "-created_at"
    if sort == "oldest":
        sort_key = "created_at"
    elif sort == "most_replies":
        sort_key = "-post_count"

    offset = (page - 1) * limit
    threads = (
        await query_builder.sort(sort_key).skip(offset).limit(limit).to_list()
        if total > 0
        else []
    )
    author_ids = list({item.author_id for item in threads})
    authors = await User.find({"_id": {"$in": author_ids}}).to_list() if author_ids else []
    author_lookup = {str(author.id): author for author in authors}

    return ThreadListResponse(
        data=[_to_thread_out(item, author_lookup.get(str(item.author_id)), current_user_id=str(current_user.id) if current_user else None) for item in threads],
        page=page,
        limit=limit,
        total=total,
    )


@router.post("")
async def create_thread(payload: ThreadCreate, request: Request, current_user: User = Depends(get_current_user)) -> ThreadOut:
    await _ensure_db_ready(request)
    # DB init can fail at startup in dev; return clean 503 instead of internal errors.
    # request is not needed elsewhere in this handler, so we keep check local in query-heavy endpoints.
    clean_tags = _normalize_tags(payload.tags)

    thread = Thread(
        title=payload.title.strip(),
        body=payload.body.strip(),
        tags=clean_tags,
        author_id=current_user.id,
    )
    moderation = _score_thread_text(thread.title, thread.body)
    thread.ai_score = moderation.score
    thread.is_flagged = moderation.flagged
    await thread.insert()

    await log_audit(
        action="thread_created",
        actor_id=current_user.id,
        target_type="thread",
        target_id=thread.id,
        details={"title": thread.title[:120], "flagged": thread.is_flagged},
    )

    return _to_thread_out(thread, current_user, current_user_id=str(current_user.id))


@router.get("/{thread_id}")
async def get_thread(
    thread_id: str,
    current_user: User | None = Depends(get_optional_current_user),
) -> ThreadOut:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    filters: dict[str, object] = {"_id": object_id}
    if not _can_view_deleted_content(current_user):
        filters["is_deleted"] = False
    thread = await Thread.find_one(filters)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    author = await User.find_one({"_id": thread.author_id})
    return _to_thread_out(thread, author, current_user_id=str(current_user.id) if current_user else None)


@router.patch("/{thread_id}")
async def update_thread(
    thread_id: str,
    payload: ThreadUpdate,
    current_user: User = Depends(get_current_user),
) -> ThreadOut:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id, "is_deleted": False})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    is_admin = current_user.role == UserRole.ADMIN
    if thread.author_id != current_user.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this thread")
    if (
        thread.status == ThreadStatus.ARCHIVED
        and not is_admin
        and any(value is not None for value in (payload.title, payload.body, payload.tags, payload.status))
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived threads cannot be edited",
        )

    changed = False
    content_changed = False

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="title cannot be empty",
            )
        if title != thread.title:
            thread.title = title
            changed = True
            content_changed = True
    if payload.body is not None:
        body = payload.body.strip()
        if not body:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="body cannot be empty",
            )
        if body != thread.body:
            if thread.post_count > 0 and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Thread body can no longer be edited after replies are posted",
                )
            thread.body = body
            changed = True
            content_changed = True
    if payload.tags is not None:
        tags = _normalize_tags(payload.tags)
        if tags != thread.tags:
            thread.tags = tags
            changed = True
    if payload.status is not None and payload.status != thread.status:
        thread.status = payload.status
        changed = True

    if content_changed:
        moderation = _score_thread_text(thread.title, thread.body)
        thread.ai_score = moderation.score
        thread.is_flagged = moderation.flagged

    if changed:
        await thread.save()
        await log_audit(
            action="thread_edited",
            actor_id=current_user.id,
            target_type="thread",
            target_id=thread.id,
            details={"title": thread.title[:120], "content_changed": content_changed},
        )
    author = current_user if thread.author_id == current_user.id else await User.find_one({"_id": thread.author_id})
    return _to_thread_out(thread, author, current_user_id=str(current_user.id))


@router.delete("/{thread_id}")
async def delete_thread(thread_id: str, current_user: User = Depends(get_current_user)) -> dict[str, str]:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id, "is_deleted": False})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    if thread.author_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this thread")

    thread.is_deleted = True
    thread.status = ThreadStatus.ARCHIVED
    await thread.save()

    await log_audit(
        action="thread_deleted",
        actor_id=current_user.id,
        target_type="thread",
        target_id=thread.id,
        severity=AuditSeverity.WARNING,
        details={"title": thread.title[:120]},
    )

    return {"message": "Thread deleted"}


@router.post("/{thread_id}/posts")
async def create_post(
    thread_id: str,
    payload: PostCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> PostOut:
    await _ensure_db_ready(request)
    thread_object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": thread_object_id, "is_deleted": False})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    parent_post_id: PydanticObjectId | None = None
    parent_author_id: PydanticObjectId | None = None
    if payload.parent_post_id:
        parent_post_id = _parse_object_id(payload.parent_post_id, field_name="parent_post_id")
        parent_post = await Post.find_one(
            {
                "_id": parent_post_id,
                "thread_id": thread_object_id,
                "is_deleted": False,
            }
        )
        if parent_post is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent post not found")
        parent_author_id = parent_post.author_id

    content = payload.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="content cannot be empty",
        )

    post = Post(
        thread_id=thread_object_id,
        author_id=current_user.id,
        parent_post_id=parent_post_id,
        content=content,
        mentions=merge_mentions(content, payload.mentions),
    )

    moderation = score_content(content)
    post.ai_score = moderation.score
    post.is_flagged = moderation.flagged
    await post.insert()

    thread.post_count += 1
    await thread.save()

    await log_audit(
        action="post_created",
        actor_id=current_user.id,
        target_type="post",
        target_id=post.id,
        details={
            "thread_id": str(thread.id),
            "parent_post_id": str(parent_post_id) if parent_post_id else None,
            "flagged": post.is_flagged,
        },
    )

    await _create_post_notifications(
        post,
        parent_author_id=parent_author_id,
        thread_author_id=thread.author_id,
    )

    return _to_post_out(post, current_user, current_user_id=str(current_user.id))


@router.post("/{thread_id}/report", status_code=status.HTTP_200_OK)
async def report_thread(
    thread_id: str,
    payload: ReportRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    await _ensure_db_ready(request)
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id, "is_deleted": False})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    thread.is_flagged = True
    await thread.save()

    # Find admins to notify
    admins = await User.find({"role": UserRole.ADMIN}).to_list()
    notifs: list[Notification] = [
        Notification(
            type=NotificationType.MODERATION,
            recipient_id=admin.id,
            actor_id=current_user.id,
            thread_id=thread.id,
            post_id=None,
            message=f"Thread reported: [{payload.reason}] {payload.detail[:120]}".strip(),
        )
        for admin in admins
    ]
    if notifs:
        await Notification.insert_many(notifs)

    await log_audit(
        action="thread_reported",
        actor_id=current_user.id,
        target_type="thread",
        target_id=thread.id,
        severity=AuditSeverity.WARNING,
        details={"reason": payload.reason, "detail": payload.detail[:200]},
    )
    return {"ok": True}


@router.post("/{thread_id}/posts/{post_id}/report", status_code=status.HTTP_200_OK)
async def report_post(
    thread_id: str,
    post_id: str,
    payload: ReportRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    await _ensure_db_ready(request)
    thread_oid = _parse_object_id(thread_id, field_name="thread_id")
    post_oid = _parse_object_id(post_id, field_name="post_id")

    post = await Post.find_one({"_id": post_oid, "thread_id": thread_oid, "is_deleted": False})
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post.is_flagged = True
    await post.save()

    admins = await User.find({"role": UserRole.ADMIN}).to_list()
    notifs: list[Notification] = [
        Notification(
            type=NotificationType.MODERATION,
            recipient_id=admin.id,
            actor_id=current_user.id,
            thread_id=thread_oid,
            post_id=post.id,
            message=f"Post reported: [{payload.reason}] {payload.detail[:120]}".strip(),
        )
        for admin in admins
    ]
    if notifs:
        await Notification.insert_many(notifs)

    await log_audit(
        action="post_reported",
        actor_id=current_user.id,
        target_type="post",
        target_id=post.id,
        severity=AuditSeverity.WARNING,
        details={"reason": payload.reason, "detail": payload.detail[:200], "thread_id": thread_id},
    )
    return {"ok": True}


@router.post("/{thread_id}/like", status_code=status.HTTP_200_OK)
async def toggle_thread_like(
    thread_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id, "is_deleted": False})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    user_oid = current_user.id
    if user_oid in thread.likes:
        thread.likes.remove(user_oid)
        liked = False
    else:
        thread.likes.append(user_oid)
        liked = True
    await thread.save()
    return {"liked": liked, "like_count": len(thread.likes)}


@router.post("/{thread_id}/posts/{post_id}/like", status_code=status.HTTP_200_OK)
async def toggle_post_like(
    thread_id: str,
    post_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    thread_oid = _parse_object_id(thread_id, field_name="thread_id")
    post_oid = _parse_object_id(post_id, field_name="post_id")
    post = await Post.find_one({"_id": post_oid, "thread_id": thread_oid, "is_deleted": False})
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    user_oid = current_user.id
    if user_oid in post.likes:
        post.likes.remove(user_oid)
        liked = False
    else:
        post.likes.append(user_oid)
        liked = True
    await post.save()
    return {"liked": liked, "like_count": len(post.likes)}


@router.get("/{thread_id}/posts")
async def list_thread_posts(
    thread_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_optional_current_user),
) -> PostTreeListResponse:
    thread_object_id = _parse_object_id(thread_id, field_name="thread_id")
    include_deleted = _can_view_deleted_content(current_user)

    thread_filters: dict[str, object] = {"_id": thread_object_id}
    if not include_deleted:
        thread_filters["is_deleted"] = False
    thread = await Thread.find_one(thread_filters)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    post_filters: dict[str, object] = {"thread_id": thread_object_id}
    if not include_deleted:
        post_filters["is_deleted"] = False
    posts = await Post.find(post_filters).sort("created_at").to_list()

    author_ids = list({item.author_id for item in posts})
    authors = await User.find({"_id": {"$in": author_ids}}).to_list() if author_ids else []
    author_lookup = {str(author.id): author for author in authors}

    roots = _build_post_tree(posts, author_lookup, current_user_id=str(current_user.id) if current_user else None)
    total = len(roots)
    offset = (page - 1) * limit

    return PostTreeListResponse(
        data=roots[offset : offset + limit],
        page=page,
        limit=limit,
        total=total,
    )


def _normalize_tags(tags: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        normalized = tag.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped[:10]


def _parse_object_id(value: str, *, field_name: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception as exc:  # pragma: no cover - defensive input guard
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        ) from exc


def _to_thread_out(thread: Thread, author: User | None = None, current_user_id: str | None = None) -> ThreadOut:
    like_ids = [str(uid) for uid in thread.likes] if thread.likes else []
    return ThreadOut(
        id=str(thread.id),
        title=thread.title,
        body=thread.body,
        tags=thread.tags,
        author_id=str(thread.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        author_is_bot=author.is_bot if author else False,
        post_count=thread.post_count,
        like_count=len(like_ids),
        liked_by_me=current_user_id in like_ids if current_user_id else False,
        status=thread.status,
        is_pinned=thread.is_pinned,
        ai_score=thread.ai_score,
        is_flagged=thread.is_flagged,
        is_deleted=thread.is_deleted,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


async def _ensure_db_ready(request: Request) -> None:
    db_error = getattr(request.app.state, "db_error", None)
    if not db_error:
        return
    # Startup failed — check if DB recovered since then
    from app.core.database import ping_database
    if await ping_database():
        request.app.state.db_error = None
        return
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Database unavailable: {db_error}",
    )


def _to_post_out(post: Post, author: User | None = None, current_user_id: str | None = None) -> PostOut:
    like_ids = [str(uid) for uid in post.likes] if post.likes else []
    return PostOut(
        id=str(post.id),
        thread_id=str(post.thread_id),
        author_id=str(post.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        author_is_bot=author.is_bot if author else False,
        parent_post_id=str(post.parent_post_id) if post.parent_post_id else None,
        content=post.content,
        mentions=post.mentions,
        ai_score=post.ai_score,
        is_flagged=post.is_flagged,
        is_deleted=post.is_deleted,
        like_count=len(like_ids),
        liked_by_me=current_user_id in like_ids if current_user_id else False,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


async def _create_post_notifications(
    post: Post,
    *,
    parent_author_id: PydanticObjectId | None,
    thread_author_id: PydanticObjectId,
) -> None:
    created: list[Notification] = []
    recipient_ids: set[PydanticObjectId] = set()

    if post.parent_post_id is None and thread_author_id != post.author_id:
        recipient_ids.add(thread_author_id)
        created.append(
            Notification(
                type=NotificationType.REPLY,
                recipient_id=thread_author_id,
                actor_id=post.author_id,
                thread_id=post.thread_id,
                post_id=post.id,
                message="Someone replied to your thread.",
            )
        )

    if parent_author_id and parent_author_id != post.author_id:
        recipient_ids.add(parent_author_id)
        created.append(
            Notification(
                type=NotificationType.REPLY,
                recipient_id=parent_author_id,
                actor_id=post.author_id,
                thread_id=post.thread_id,
                post_id=post.id,
                message="Someone replied to your post.",
            )
        )

    if post.mentions:
        mentioned_users = await User.find({"username": {"$in": [m.lower() for m in post.mentions]}}).to_list()
        for user in mentioned_users:
            if user.id == post.author_id or user.id in recipient_ids:
                continue
            recipient_ids.add(user.id)
            created.append(
                Notification(
                    type=NotificationType.MENTION,
                    recipient_id=user.id,
                    actor_id=post.author_id,
                    thread_id=post.thread_id,
                    post_id=post.id,
                    message="You were mentioned in a conversation.",
                )
            )

    if post.is_flagged:
        created.append(
            Notification(
                type=NotificationType.MODERATION,
                recipient_id=post.author_id,
                actor_id=None,
                thread_id=post.thread_id,
                post_id=post.id,
                message="Your post was flagged by AI moderation and is under review.",
            )
        )

    if created:
        await Notification.insert_many(created)


def _build_post_tree(posts: list[Post], author_lookup: dict[str, User] | None = None, current_user_id: str | None = None) -> list[PostTreeNode]:
    author_lookup = author_lookup or {}
    nodes: dict[str, PostTreeNode] = {}
    for item in posts:
        author = author_lookup.get(str(item.author_id))
        node = PostTreeNode(**_to_post_out(item, author, current_user_id).model_dump(), children=[])
        nodes[node.id] = node

    roots: list[PostTreeNode] = []
    for item in posts:
        node = nodes[str(item.id)]
        if item.parent_post_id is None:
            roots.append(node)
            continue

        parent_key = str(item.parent_post_id)
        parent = nodes.get(parent_key)
        if parent is None:
            roots.append(node)
            continue
        parent.children.append(node)

    return roots


def _score_thread_text(title: str, body: str):
    return score_content(f"{title.strip()}\n\n{body.strip()}")


def _can_view_deleted_content(current_user: User | None) -> bool:
    return current_user is not None and current_user.role == UserRole.ADMIN
