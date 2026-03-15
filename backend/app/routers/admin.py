from datetime import datetime, timezone
from typing import Literal

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.auth import require_roles
from app.models.appeal import AppealContentType, AppealStatus, ModerationAppeal
from app.models.audit_log import AuditLog, AuditResult, AuditSeverity
from app.models.notification import Notification, NotificationType
from app.models.post import Post
from app.models.thread import Thread, ThreadStatus
from app.models.user import AdminNote, User, UserRole
from app.schemas.admin import (
    AdminBulkModerationRequest,
    AdminBulkModerationResponse,
    AdminBulkModerationResult,
    AdminBulkRoleUpdate,
    AdminBulkStatusUpdate,
    AdminBulkUserResponse,
    AdminBulkUserResult,
    AdminAppealItem,
    AdminAppealListResponse,
    AdminAppealResolveRequest,
    AdminContentEditRequest,
    AdminContentFlagUpdate,
    AdminContentItem,
    AdminContentListResponse,
    AdminContentNotifyRequest,
    AdminContentNotifyResponse,
    AdminContentRereportMissingRequest,
    AdminContentRereportResponse,
    AdminModerationActionRequest,
    AdminModerationItem,
    AdminModerationListResponse,
    AdminNoteCreate,
    AdminNoteOut,
    AdminStatsResponse,
    AdminThreadPinUpdate,
    AdminThreadStatusUpdate,
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    AuditLogListResponse,
)
from app.schemas.audit_log import AuditLogOut
from app.schemas.post import PostOut
from app.schemas.thread import ThreadOut
from app.schemas.user import UserOut, UserUpdate
from app.services.ai import score_content
from app.services.mentions import merge_mentions

router = APIRouter(prefix="/admin", tags=["admin"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    sort: Literal["newest", "oldest", "name_az", "name_za"] = Query(default="newest"),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminUserListResponse:
    filters = _build_user_filters(search=search, role=role, is_active=is_active)
    query = User.find(filters)

    sort_field = {
        "newest": "-created_at",
        "oldest": "+created_at",
        "name_az": "+display_name",
        "name_za": "-display_name",
    }.get(sort, "-created_at")

    total = await query.count()
    offset = (page - 1) * limit
    users = await query.sort(sort_field).skip(offset).limit(limit).to_list() if total > 0 else []

    return AdminUserListResponse(
        data=[_to_user_out(item) for item in users],
        page=page,
        limit=limit,
        total=total,
    )


@router.post("/users/bulk-role")
@limiter.limit("10/minute")
async def bulk_update_user_role(
    payload: AdminBulkRoleUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminBulkUserResponse:
    results: list[AdminBulkUserResult] = []
    for uid in payload.user_ids:
        try:
            object_id = _parse_object_id(uid, field_name="user_id")
            user = await User.find_one({"_id": object_id})
            if user is None:
                results.append(AdminBulkUserResult(user_id=uid, success=False, error="Not found"))
                continue
            if user.id == admin_user.id and payload.role != UserRole.ADMIN:
                results.append(AdminBulkUserResult(user_id=uid, success=False, error="Cannot demote self"))
                continue
            before_role = user.role
            if before_role != payload.role:
                user.role = payload.role
                await user.save()
                await _write_audit_log(
                    action="user_role_changed",
                    actor_id=admin_user.id,
                    target_type="user",
                    target_id=user.id,
                    request=request,
                    reason=payload.reason,
                    before={"role": before_role},
                    after={"role": user.role},
                )
                await _notify_user_if_other(
                    recipient_id=user.id,
                    actor_id=admin_user.id,
                    message=f"Your account role was changed to {user.role}.",
                )
            results.append(AdminBulkUserResult(user_id=uid, success=True))
        except Exception as exc:
            results.append(AdminBulkUserResult(user_id=uid, success=False, error=str(exc)))
    succeeded = sum(1 for r in results if r.success)
    return AdminBulkUserResponse(
        results=results, processed=len(results), succeeded=succeeded, failed=len(results) - succeeded,
    )


@router.post("/users/bulk-status")
@limiter.limit("10/minute")
async def bulk_update_user_status(
    payload: AdminBulkStatusUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminBulkUserResponse:
    results: list[AdminBulkUserResult] = []
    for uid in payload.user_ids:
        try:
            object_id = _parse_object_id(uid, field_name="user_id")
            user = await User.find_one({"_id": object_id})
            if user is None:
                results.append(AdminBulkUserResult(user_id=uid, success=False, error="Not found"))
                continue
            if user.id == admin_user.id and not payload.is_active:
                results.append(AdminBulkUserResult(user_id=uid, success=False, error="Cannot deactivate self"))
                continue
            before_active = user.is_active
            if before_active != payload.is_active:
                user.is_active = payload.is_active
                await user.save()
                if not payload.is_active:
                    await _clear_follow_relationships(user)
                await _write_audit_log(
                    action="user_status_changed",
                    actor_id=admin_user.id,
                    target_type="user",
                    target_id=user.id,
                    request=request,
                    severity=AuditSeverity.WARNING if not payload.is_active else AuditSeverity.INFO,
                    reason=payload.reason,
                    before={"is_active": before_active},
                    after={"is_active": user.is_active},
                )
                await _notify_user_if_other(
                    recipient_id=user.id,
                    actor_id=admin_user.id,
                    message=_user_status_message(is_active=user.is_active),
                )
            results.append(AdminBulkUserResult(user_id=uid, success=True))
        except Exception as exc:
            results.append(AdminBulkUserResult(user_id=uid, success=False, error=str(exc)))
    succeeded = sum(1 for r in results if r.success)
    return AdminBulkUserResponse(
        results=results, processed=len(results), succeeded=succeeded, failed=len(results) - succeeded,
    )


@router.get("/users/{user_id}/detail")
async def get_user_detail(
    user_id: str,
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminUserDetailResponse:
    object_id = _parse_object_id(user_id, field_name="user_id")
    user = await User.find_one({"_id": object_id})
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await _build_user_detail_response(user)


@router.post("/users/{user_id}/notes")
@limiter.limit("60/minute")
async def add_user_note(
    user_id: str,
    payload: AdminNoteCreate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminUserDetailResponse:
    object_id = _parse_object_id(user_id, field_name="user_id")
    target_user = await User.find_one({"_id": object_id})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_note = AdminNote(note=payload.note.strip(), admin_id=admin_user.id)
    target_user.admin_notes.append(new_note)
    await target_user.save()

    await _write_audit_log(
        action="admin_note_added",
        actor_id=admin_user.id,
        target_type="user",
        target_id=target_user.id,
        request=request,
        severity=AuditSeverity.INFO,
    )
    return await _build_user_detail_response(target_user)


@router.patch("/users/{user_id}/role")
@limiter.limit("30/minute")
async def update_user_role(
    user_id: str,
    payload: AdminUserRoleUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserOut:
    object_id = _parse_object_id(user_id, field_name="user_id")
    target_user = await User.find_one({"_id": object_id})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target_user.id == admin_user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot remove your own admin role",
        )

    before_role = target_user.role
    changed = before_role != payload.role
    target_user.role = payload.role
    if changed:
        await target_user.save()
        await _write_audit_log(
            action="user_role_changed",
            actor_id=admin_user.id,
            target_type="user",
            target_id=target_user.id,
            request=request,
            reason=payload.reason,
            before={"role": before_role},
            after={"role": target_user.role},
        )
        await _notify_user_if_other(
            recipient_id=target_user.id,
            actor_id=admin_user.id,
            message=f"Your account role was changed to {target_user.role}.",
        )

    return _to_user_out(target_user)


@router.patch("/users/{user_id}/status")
@limiter.limit("30/minute")
async def update_user_status(
    user_id: str,
    payload: AdminUserStatusUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserOut:
    object_id = _parse_object_id(user_id, field_name="user_id")
    target_user = await User.find_one({"_id": object_id})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target_user.id == admin_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot deactivate your own account",
        )

    before_active = target_user.is_active
    changed = before_active != payload.is_active
    target_user.is_active = payload.is_active
    if changed:
        await target_user.save()
        if not payload.is_active:
            await _clear_follow_relationships(target_user)
        await _write_audit_log(
            action="user_status_changed",
            actor_id=admin_user.id,
            target_type="user",
            target_id=target_user.id,
            request=request,
            severity=AuditSeverity.WARNING if not payload.is_active else AuditSeverity.INFO,
            reason=payload.reason,
            before={"is_active": before_active},
            after={"is_active": target_user.is_active},
        )
        await _notify_user_if_other(
            recipient_id=target_user.id,
            actor_id=admin_user.id,
            message=_user_status_message(is_active=target_user.is_active),
        )

    return _to_user_out(target_user)


@router.patch("/users/{user_id}/profile")
@limiter.limit("30/minute")
async def update_user_profile(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserOut:
    """Admin: edit a user's display_name and/or bio."""
    object_id = _parse_object_id(user_id, field_name="user_id")
    target_user = await User.find_one({"_id": object_id})
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    before = {"display_name": target_user.display_name, "bio": target_user.bio}
    if payload.display_name is not None:
        target_user.display_name = payload.display_name
    if payload.bio is not None:
        target_user.bio = payload.bio
    after = {"display_name": target_user.display_name, "bio": target_user.bio}

    if before != after:
        await target_user.save()
        await _write_audit_log(
            action="user_profile_edited",
            actor_id=admin_user.id,
            target_type="user",
            target_id=target_user.id,
            request=request,
            severity=AuditSeverity.INFO,
            before=before,
            after=after,
        )

    return _to_user_out(target_user)


@router.get("/moderation")
async def list_moderation_queue(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminModerationListResponse:
    flagged_posts = await Post.find({"is_flagged": True, "is_deleted": False}).to_list()
    flagged_threads = await Thread.find({"is_flagged": True, "is_deleted": False}).to_list()

    author_ids: set[PydanticObjectId] = {item.author_id for item in flagged_posts}
    author_ids.update(item.author_id for item in flagged_threads)
    user_lookup = await _load_user_lookup(author_ids)

    items: list[AdminModerationItem] = []
    items.extend(_to_moderation_item_from_post(item, user_lookup.get(str(item.author_id))) for item in flagged_posts)
    items.extend(_to_moderation_item_from_thread(item, user_lookup.get(str(item.author_id))) for item in flagged_threads)
    items.sort(key=lambda item: item.created_at, reverse=True)

    total = len(items)
    offset = (page - 1) * limit

    return AdminModerationListResponse(
        data=items[offset : offset + limit],
        page=page,
        limit=limit,
        total=total,
        flagged_posts=len(flagged_posts),
        flagged_threads=len(flagged_threads),
    )


@router.patch("/moderation/{post_id}")
@limiter.limit("30/minute")
async def moderate_post(
    post_id: str,
    payload: AdminModerationActionRequest,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> PostOut:
    object_id = _parse_object_id(post_id, field_name="post_id")
    post = await Post.find_one({"_id": object_id})
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    await _apply_moderation_action(
        post=post,
        action=payload.action,
        reason=payload.reason,
        actor=admin_user,
        request=request,
    )

    author = await User.find_one({"_id": post.author_id})
    return _to_post_out(post, author)


@router.post("/moderation/bulk")
@limiter.limit("20/minute")
async def moderate_posts_bulk(
    payload: AdminBulkModerationRequest,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminBulkModerationResponse:
    results: list[AdminBulkModerationResult] = []

    for item in payload.actions:
        content_type: Literal["thread", "post"] = item.content_type
        content_id = (item.content_id or item.post_id or "").strip()
        if not content_id:
            results.append(
                AdminBulkModerationResult(
                    content_type=content_type,
                    content_id="",
                    action=item.action,
                    success=False,
                    error="content_id is required",
                )
            )
            continue

        try:
            if content_type == "thread":
                object_id = _parse_object_id(content_id, field_name="content_id")
                thread = await Thread.find_one({"_id": object_id})
                if thread is None:
                    results.append(
                        AdminBulkModerationResult(
                            content_type="thread",
                            content_id=content_id,
                            action=item.action,
                            success=False,
                            error="Thread not found",
                        )
                    )
                    continue

                await _apply_thread_moderation_action(
                    thread=thread,
                    action=item.action,
                    reason=item.reason,
                    actor=admin_user,
                    request=request,
                )
                results.append(
                    AdminBulkModerationResult(
                        content_type="thread",
                        content_id=content_id,
                        action=item.action,
                        success=True,
                        error=None,
                    )
                )
                continue

            object_id = _parse_object_id(content_id, field_name="content_id")
            post = await Post.find_one({"_id": object_id})
            if post is None:
                results.append(
                    AdminBulkModerationResult(
                        content_type="post",
                        content_id=content_id,
                        action=item.action,
                        success=False,
                        error="Post not found",
                    )
                )
                continue

            await _apply_moderation_action(
                post=post,
                action=item.action,
                reason=item.reason,
                actor=admin_user,
                request=request,
            )
            results.append(
                AdminBulkModerationResult(
                    content_type="post",
                    content_id=content_id,
                    action=item.action,
                    success=True,
                    error=None,
                )
            )
        except HTTPException as exc:
            results.append(
                AdminBulkModerationResult(
                    content_type=content_type,
                    content_id=content_id,
                    action=item.action,
                    success=False,
                    error=str(exc.detail),
                )
            )
        except Exception:
            results.append(
                AdminBulkModerationResult(
                    content_type=content_type,
                    content_id=content_id,
                    action=item.action,
                    success=False,
                    error="Unexpected moderation error",
                )
            )

    succeeded = sum(1 for result in results if result.success)
    failed = len(results) - succeeded
    return AdminBulkModerationResponse(
        results=results,
        processed=len(results),
        succeeded=succeeded,
        failed=failed,
    )


@router.delete("/threads/{thread_id}")
@limiter.limit("20/minute")
async def delete_thread_admin(
    thread_id: str,
    request: Request,
    reason: str | None = Query(default=None, max_length=300),
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> ThreadOut:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id, "is_deleted": False})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    before_state = {"is_deleted": thread.is_deleted, "status": thread.status}
    thread.is_deleted = True
    thread.status = ThreadStatus.ARCHIVED
    await thread.save()

    await _write_audit_log(
        action="admin_thread_deleted",
        actor_id=admin_user.id,
        target_type="thread",
        target_id=thread.id,
        request=request,
        severity=AuditSeverity.WARNING,
        reason=reason,
        before=before_state,
        after={"is_deleted": thread.is_deleted, "status": thread.status},
    )
    await _notify_user_if_other(
        recipient_id=thread.author_id,
        actor_id=admin_user.id,
        message="Your thread was removed by an administrator.",
        thread_id=thread.id,
    )

    author = await User.find_one({"_id": thread.author_id})
    return _to_thread_out(thread, author)


@router.delete("/posts/{post_id}")
@limiter.limit("20/minute")
async def delete_post_admin(
    post_id: str,
    request: Request,
    reason: str | None = Query(default=None, max_length=300),
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> PostOut:
    object_id = _parse_object_id(post_id, field_name="post_id")
    post = await Post.find_one({"_id": object_id, "is_deleted": False})
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    before_state = {"is_deleted": post.is_deleted, "is_flagged": post.is_flagged}
    post.is_deleted = True
    post.is_flagged = False
    await post.save()
    await _decrement_thread_post_count(post.thread_id)

    await _write_audit_log(
        action="admin_post_deleted",
        actor_id=admin_user.id,
        target_type="post",
        target_id=post.id,
        request=request,
        severity=AuditSeverity.WARNING,
        reason=reason,
        before=before_state,
        after={"is_deleted": post.is_deleted, "is_flagged": post.is_flagged},
    )
    await _notify_user_if_other(
        recipient_id=post.author_id,
        actor_id=admin_user.id,
        message="Your post was removed by an administrator.",
        thread_id=post.thread_id,
        post_id=post.id,
    )

    author = await User.find_one({"_id": post.author_id})
    return _to_post_out(post, author)


@router.patch("/threads/{thread_id}/status")
@limiter.limit("30/minute")
async def update_thread_status_admin(
    thread_id: str,
    payload: AdminThreadStatusUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> ThreadOut:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    before_status = thread.status
    changed = before_status != payload.status
    thread.status = payload.status
    if changed:
        await thread.save()
        await _write_audit_log(
            action="thread_status_changed",
            actor_id=admin_user.id,
            target_type="thread",
            target_id=thread.id,
            request=request,
            severity=AuditSeverity.WARNING if payload.status == ThreadStatus.ARCHIVED else AuditSeverity.INFO,
            reason=payload.reason,
            before={"status": before_status},
            after={"status": thread.status},
        )

    author = await User.find_one({"_id": thread.author_id})
    return _to_thread_out(thread, author)


@router.patch("/threads/{thread_id}/pin")
@limiter.limit("30/minute")
async def update_thread_pin_admin(
    thread_id: str,
    payload: AdminThreadPinUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> ThreadOut:
    object_id = _parse_object_id(thread_id, field_name="thread_id")
    thread = await Thread.find_one({"_id": object_id})
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    before_pin = thread.is_pinned
    changed = before_pin != payload.is_pinned
    thread.is_pinned = payload.is_pinned
    if changed:
        await thread.save()
        await _write_audit_log(
            action="thread_pin_changed",
            actor_id=admin_user.id,
            target_type="thread",
            target_id=thread.id,
            request=request,
            reason=payload.reason,
            before={"is_pinned": before_pin},
            after={"is_pinned": thread.is_pinned},
        )

    author = await User.find_one({"_id": thread.author_id})
    return _to_thread_out(thread, author)


@router.get("/audit-logs")
async def list_audit_logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    action: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    severity: AuditSeverity | None = Query(default=None),
    result: AuditResult | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    request_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AuditLogListResponse:
    filters: dict[str, object] = {}
    action_value = action.strip() if action else ""
    target_type_value = target_type.strip() if target_type else ""
    request_id_value = request_id.strip() if request_id else ""
    if action_value:
        filters["action"] = action_value
    if target_type_value:
        filters["target_type"] = target_type_value
    if severity:
        filters["severity"] = severity
    if result:
        filters["result"] = result
    if actor_id:
        filters["actor_id"] = _parse_object_id(actor_id, field_name="actor_id")
    if request_id_value:
        filters["request_id"] = request_id_value
    if date_from or date_to:
        created_filter: dict[str, datetime] = {}
        if date_from:
            created_filter["$gte"] = date_from
        if date_to:
            created_filter["$lte"] = date_to
        filters["created_at"] = created_filter

    query = AuditLog.find(filters)
    total = await query.count()
    offset = (page - 1) * limit
    logs = await query.sort("-created_at").skip(offset).limit(limit).to_list() if total > 0 else []

    # Batch-resolve user IDs to usernames/display names
    user_ids: set[PydanticObjectId] = set()
    for log in logs:
        if log.actor_id:
            user_ids.add(log.actor_id)
        if log.target_type == "user" and log.target_id:
            user_ids.add(log.target_id)
    user_map: dict[str, User] = {}
    if user_ids:
        found_users = await User.find({"_id": {"$in": list(user_ids)}}).to_list()
        user_map = {str(u.id): u for u in found_users}

    return AuditLogListResponse(
        data=[_to_audit_log_out(item, user_map) for item in logs],
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/appeals")
async def list_appeals(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: AppealStatus | None = Query(default=None, alias="status"),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminAppealListResponse:
    filters: dict[str, object] = {}
    if status_filter is not None:
        filters["status"] = status_filter

    base_query = ModerationAppeal.find(filters)
    total = await base_query.count()
    pending_count = await ModerationAppeal.find({"status": AppealStatus.PENDING}).count()

    offset = (page - 1) * limit
    appeals = await base_query.sort("-created_at").skip(offset).limit(limit).to_list() if total > 0 else []

    user_ids: set[PydanticObjectId] = {item.appellant_id for item in appeals}
    user_ids.update(item.resolved_by for item in appeals if item.resolved_by is not None)
    user_lookup = await _load_user_lookup(user_ids)

    notification_ids = [item.notification_id for item in appeals]
    notifications = (
        await Notification.find({"_id": {"$in": notification_ids}}).to_list()
        if notification_ids
        else []
    )
    notification_lookup = {str(item.id): item for item in notifications}

    return AdminAppealListResponse(
        data=[_to_admin_appeal_item(item, user_lookup, notification_lookup) for item in appeals],
        page=page,
        limit=limit,
        total=total,
        pending_count=pending_count,
    )


@router.patch("/appeals/{appeal_id}")
@limiter.limit("40/minute")
async def resolve_appeal(
    appeal_id: str,
    payload: AdminAppealResolveRequest,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminAppealItem:
    object_id = _parse_object_id(appeal_id, field_name="appeal_id")
    appeal = await ModerationAppeal.find_one({"_id": object_id})
    if appeal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appeal not found")

    if appeal.status != AppealStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appeal is already resolved")

    action = payload.action
    note = payload.note.strip() if payload.note else None
    restored = False

    if action == "approve":
        restored = await _restore_appealed_content(appeal)
        appeal.status = AppealStatus.APPROVED
    else:
        appeal.status = AppealStatus.REJECTED

    appeal.admin_note = note
    appeal.resolved_by = admin_user.id
    appeal.resolved_at = datetime.now(timezone.utc)
    await appeal.save()

    await _write_audit_log(
        action=f"appeal_{action}",
        actor_id=admin_user.id,
        target_type=appeal.content_type.value,
        target_id=appeal.content_id,
        request=request,
        severity=AuditSeverity.INFO if action == "approve" else AuditSeverity.WARNING,
        reason=note,
        metadata={
            "appeal_id": str(appeal.id),
            "notification_id": str(appeal.notification_id),
            "status": appeal.status.value,
            "restored": restored,
        },
    )

    source_notification = await Notification.find_one({"_id": appeal.notification_id})
    if source_notification is not None:
        next_metadata = dict(source_notification.metadata or {})
        next_metadata["appeal_status"] = appeal.status.value
        next_metadata["appealable"] = False
        if note:
            next_metadata["admin_note"] = note
        source_notification.metadata = next_metadata
        await source_notification.save()

    if action == "approve":
        message = (
            f"Your appeal was approved and your {appeal.content_type.value} was restored."
            if restored
            else f"Your appeal for this {appeal.content_type.value} was approved."
        )
    else:
        message = f"Your appeal for this {appeal.content_type.value} was rejected."
    await Notification(
        type=NotificationType.MODERATION,
        recipient_id=appeal.appellant_id,
        actor_id=None,
        thread_id=appeal.thread_id,
        post_id=appeal.post_id,
        message=message,
        metadata={
            "moderation_action": "appeal_result",
            "appeal_status": appeal.status.value,
            "appealable": False,
            "content_type": appeal.content_type.value,
            "content_id": str(appeal.content_id),
            **({"admin_note": note} if note else {}),
        },
    ).insert()

    user_lookup = await _load_user_lookup({appeal.appellant_id, admin_user.id})
    notification_lookup: dict[str, Notification] = {}
    if source_notification is not None:
        notification_lookup[str(source_notification.id)] = source_notification

    return _to_admin_appeal_item(appeal, user_lookup, notification_lookup)


@router.get("/content")
async def list_content(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    content_type: Literal["all", "thread", "post"] = Query(default="all", alias="type"),
    search: str | None = Query(default=None),
    is_deleted: bool | None = Query(default=None),
    is_flagged: bool | None = Query(default=None),
    thread_status: ThreadStatus | None = Query(default=None, alias="status"),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentListResponse:
    query_text = search.strip() if search else None
    regex = {"$regex": query_text, "$options": "i"} if query_text else None

    threads: list[Thread] = []
    posts: list[Post] = []

    if content_type in ("all", "thread"):
        thread_filters: dict[str, object] = {}
        if is_deleted is not None:
            thread_filters["is_deleted"] = is_deleted
        if is_flagged is not None:
            thread_filters["is_flagged"] = is_flagged
        if thread_status is not None:
            thread_filters["status"] = thread_status
        if regex is not None:
            thread_filters["$or"] = [{"title": regex}, {"body": regex}]
        threads = await Thread.find(thread_filters).sort("-created_at").to_list()

    if content_type in ("all", "post"):
        post_filters: dict[str, object] = {}
        if is_deleted is not None:
            post_filters["is_deleted"] = is_deleted
        if is_flagged is not None:
            post_filters["is_flagged"] = is_flagged
        if regex is not None:
            post_filters["content"] = regex
        posts = await Post.find(post_filters).sort("-created_at").to_list()

    author_ids: set[PydanticObjectId] = {item.author_id for item in threads}
    author_ids.update(item.author_id for item in posts)
    user_lookup = await _load_user_lookup(author_ids)

    items: list[AdminContentItem] = []
    for thread in threads:
        author = user_lookup.get(str(thread.author_id))
        items.append(_to_admin_content_item_from_thread(thread, author))

    for post in posts:
        author = user_lookup.get(str(post.author_id))
        items.append(_to_admin_content_item_from_post(post, author))

    items.sort(key=lambda item: item.created_at, reverse=True)
    total = len(items)
    missing_ai_reports = sum(1 for item in items if item.ai_score is None)
    offset = (page - 1) * limit
    return AdminContentListResponse(
        data=items[offset : offset + limit],
        page=page,
        limit=limit,
        total=total,
        missing_ai_reports=missing_ai_reports,
    )


@router.get("/content/{content_type}/{content_id}")
async def get_content_item(
    content_type: Literal["thread", "post"],
    content_id: str,
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentItem:
    target = await _get_admin_content_target(content_type=content_type, content_id=content_id, include_deleted=True)
    if content_type == "thread":
        thread = target
        author = await User.find_one({"_id": thread.author_id})
        return _to_admin_content_item_from_thread(thread, author)

    post = target
    author = await User.find_one({"_id": post.author_id})
    return _to_admin_content_item_from_post(post, author)


@router.post("/content/rereport-missing")
@limiter.limit("5/minute")
async def rereport_missing_content(
    payload: AdminContentRereportMissingRequest,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentRereportResponse:
    limit = payload.limit
    base_filters: dict[str, object] = {"ai_score": None}
    if not payload.include_deleted:
        base_filters["is_deleted"] = False

    threads = await Thread.find(base_filters).sort("created_at").limit(limit).to_list()
    remaining = max(limit - len(threads), 0)
    posts = await Post.find(base_filters).sort("created_at").limit(remaining).to_list() if remaining > 0 else []

    processed = 0
    updated = 0
    failed = 0
    flagged = 0
    threads_updated = 0
    posts_updated = 0

    for thread in threads:
        processed += 1
        try:
            moderation = score_content(_thread_moderation_text(thread.title, thread.body))
            thread.ai_score = moderation.score
            thread.is_flagged = moderation.flagged
            await thread.save()
            updated += 1
            threads_updated += 1
            if moderation.flagged:
                flagged += 1
        except Exception:
            failed += 1

    for post in posts:
        processed += 1
        try:
            moderation = score_content(post.content)
            post.ai_score = moderation.score
            post.is_flagged = moderation.flagged
            await post.save()
            updated += 1
            posts_updated += 1
            if moderation.flagged:
                flagged += 1
        except Exception:
            failed += 1

    await _write_audit_log(
        action="content_ai_rereport_missing",
        actor_id=admin_user.id,
        target_type="content",
        target_id=None,
        request=request,
        reason=None,
        metadata={
            "limit": limit,
            "include_deleted": payload.include_deleted,
            "processed": processed,
            "updated": updated,
            "failed": failed,
            "flagged": flagged,
            "threads_updated": threads_updated,
            "posts_updated": posts_updated,
        },
    )

    return AdminContentRereportResponse(
        processed=processed,
        updated=updated,
        failed=failed,
        flagged=flagged,
        threads_updated=threads_updated,
        posts_updated=posts_updated,
    )


@router.post("/content/{content_type}/{content_id}/rereport")
@limiter.limit("20/minute")
async def rereport_content_item(
    content_type: Literal["thread", "post"],
    content_id: str,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentItem:
    target = await _get_admin_content_target(content_type=content_type, content_id=content_id)

    if content_type == "thread":
        thread = target
        before_state = {"ai_score": thread.ai_score, "is_flagged": thread.is_flagged}
        moderation = score_content(_thread_moderation_text(thread.title, thread.body))
        thread.ai_score = moderation.score
        thread.is_flagged = moderation.flagged
        await thread.save()
        author = await User.find_one({"_id": thread.author_id})
        await _write_audit_log(
            action="content_ai_rereported",
            actor_id=admin_user.id,
            target_type="thread",
            target_id=thread.id,
            request=request,
            reason=None,
            before=before_state,
            after={"ai_score": thread.ai_score, "is_flagged": thread.is_flagged},
        )
        return _to_admin_content_item_from_thread(thread, author)

    post = target
    before_state = {"ai_score": post.ai_score, "is_flagged": post.is_flagged}
    moderation = score_content(post.content)
    post.ai_score = moderation.score
    post.is_flagged = moderation.flagged
    await post.save()
    author = await User.find_one({"_id": post.author_id})
    await _write_audit_log(
        action="content_ai_rereported",
        actor_id=admin_user.id,
        target_type="post",
        target_id=post.id,
        request=request,
        reason=None,
        before=before_state,
        after={"ai_score": post.ai_score, "is_flagged": post.is_flagged},
    )
    return _to_admin_content_item_from_post(post, author)


@router.patch("/content/{content_type}/{content_id}/flag")
@limiter.limit("30/minute")
async def set_content_flag_state(
    content_type: Literal["thread", "post"],
    content_id: str,
    payload: AdminContentFlagUpdate,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentItem:
    target = await _get_admin_content_target(content_type=content_type, content_id=content_id)

    if content_type == "thread":
        thread = target
        before_flagged = thread.is_flagged
        thread.is_flagged = payload.is_flagged
        if before_flagged != thread.is_flagged:
            await thread.save()
            await _write_audit_log(
                action="content_flag_updated",
                actor_id=admin_user.id,
                target_type="thread",
                target_id=thread.id,
                request=request,
                severity=AuditSeverity.WARNING if thread.is_flagged else AuditSeverity.INFO,
                reason=payload.reason,
                before={"is_flagged": before_flagged},
                after={"is_flagged": thread.is_flagged},
            )
        author = await User.find_one({"_id": thread.author_id})
        return _to_admin_content_item_from_thread(thread, author)

    post = target
    before_flagged = post.is_flagged
    post.is_flagged = payload.is_flagged
    if before_flagged != post.is_flagged:
        await post.save()
        await _write_audit_log(
            action="content_flag_updated",
            actor_id=admin_user.id,
            target_type="post",
            target_id=post.id,
            request=request,
            severity=AuditSeverity.WARNING if post.is_flagged else AuditSeverity.INFO,
            reason=payload.reason,
            before={"is_flagged": before_flagged},
            after={"is_flagged": post.is_flagged},
        )
    author = await User.find_one({"_id": post.author_id})
    return _to_admin_content_item_from_post(post, author)


@router.patch("/content/{content_type}/{content_id}/edit")
@limiter.limit("30/minute")
async def edit_content_item(
    content_type: Literal["thread", "post"],
    content_id: str,
    payload: AdminContentEditRequest,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentItem:
    target = await _get_admin_content_target(content_type=content_type, content_id=content_id)

    if content_type == "thread":
        thread = target
        if payload.title is None and payload.content is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide title or content")

        before_state = {
            "title": thread.title,
            "content": thread.body,
            "ai_score": thread.ai_score,
            "is_flagged": thread.is_flagged,
        }
        changed = False

        if payload.title is not None:
            title = payload.title.strip()
            if not title:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="title cannot be empty")
            if title != thread.title:
                thread.title = title
                changed = True

        if payload.content is not None:
            content = payload.content.strip()
            if not content:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="content cannot be empty")
            if content != thread.body:
                thread.body = content
                changed = True

        if changed:
            moderation = score_content(_thread_moderation_text(thread.title, thread.body))
            thread.ai_score = moderation.score
            thread.is_flagged = moderation.flagged
            await thread.save()
            await _write_audit_log(
                action="content_edited",
                actor_id=admin_user.id,
                target_type="thread",
                target_id=thread.id,
                request=request,
                severity=AuditSeverity.WARNING,
                reason=payload.reason,
                before=before_state,
                after={
                    "title": thread.title,
                    "content": thread.body,
                    "ai_score": thread.ai_score,
                    "is_flagged": thread.is_flagged,
                },
            )

        author = await User.find_one({"_id": thread.author_id})
        return _to_admin_content_item_from_thread(thread, author)

    post = target
    if payload.content is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide content")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="content cannot be empty")

    if content != post.content:
        before_state = {
            "content": post.content,
            "mentions": post.mentions,
            "ai_score": post.ai_score,
            "is_flagged": post.is_flagged,
        }
        post.content = content
        post.mentions = merge_mentions(content, None)
        moderation = score_content(content)
        post.ai_score = moderation.score
        post.is_flagged = moderation.flagged
        await post.save()
        await _write_audit_log(
            action="content_edited",
            actor_id=admin_user.id,
            target_type="post",
            target_id=post.id,
            request=request,
            severity=AuditSeverity.WARNING,
            reason=payload.reason,
            before=before_state,
            after={
                "content": post.content,
                "mentions": post.mentions,
                "ai_score": post.ai_score,
                "is_flagged": post.is_flagged,
            },
        )

    author = await User.find_one({"_id": post.author_id})
    return _to_admin_content_item_from_post(post, author)


@router.post("/content/{content_type}/{content_id}/notify")
@limiter.limit("40/minute")
async def notify_content_author(
    content_type: Literal["thread", "post"],
    content_id: str,
    payload: AdminContentNotifyRequest,
    request: Request,
    admin_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminContentNotifyResponse:
    target = await _get_admin_content_target(content_type=content_type, content_id=content_id, include_deleted=True)
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="message cannot be empty")

    thread_id: PydanticObjectId | None = None
    post_id: PydanticObjectId | None = None
    target_id: PydanticObjectId | None = None

    if content_type == "thread":
        thread = target
        thread_id = thread.id
        target_id = thread.id
        recipient_id = thread.author_id
    else:
        post = target
        thread_id = post.thread_id
        post_id = post.id
        target_id = post.id
        recipient_id = post.author_id

    await _notify_user_if_other(
        recipient_id=recipient_id,
        actor_id=admin_user.id,
        message=message,
        thread_id=thread_id,
        post_id=post_id,
    )
    await _write_audit_log(
        action="content_author_notified",
        actor_id=admin_user.id,
        target_type=content_type,
        target_id=target_id,
        request=request,
        reason=payload.reason,
        metadata={"message": message},
    )

    return AdminContentNotifyResponse(success=True)


@router.get("/stats")
async def get_admin_stats(_: User = Depends(require_roles(UserRole.ADMIN))) -> AdminStatsResponse:
    total_users = await User.find({}).count()
    active_users = await User.find({"is_active": True}).count()
    total_threads = await Thread.find({"is_deleted": False}).count()
    total_posts = await Post.find({"is_deleted": False}).count()
    flagged_threads = await Thread.find({"is_flagged": True, "is_deleted": False}).count()
    flagged_posts = await Post.find({"is_flagged": True, "is_deleted": False}).count() + flagged_threads
    deleted_posts = await Post.find({"is_deleted": True}).count()

    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        total_threads=total_threads,
        total_posts=total_posts,
        flagged_posts=flagged_posts,
        deleted_posts=deleted_posts,
        generated_at=datetime.now(timezone.utc),
    )


def _to_admin_content_item_from_thread(thread: Thread, author: User | None = None) -> AdminContentItem:
    return AdminContentItem(
        type="thread",
        id=str(thread.id),
        thread_id=None,
        author_id=str(thread.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        title=thread.title,
        content=thread.body,
        status=thread.status,
        is_pinned=thread.is_pinned,
        ai_score=thread.ai_score,
        is_flagged=thread.is_flagged,
        is_deleted=thread.is_deleted,
        created_at=thread.created_at,
    )


def _to_admin_content_item_from_post(post: Post, author: User | None = None) -> AdminContentItem:
    return AdminContentItem(
        type="post",
        id=str(post.id),
        thread_id=str(post.thread_id),
        author_id=str(post.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        title=None,
        content=post.content,
        status=None,
        is_pinned=None,
        ai_score=post.ai_score,
        is_flagged=post.is_flagged,
        is_deleted=post.is_deleted,
        created_at=post.created_at,
    )


def _to_admin_appeal_item(
    appeal: ModerationAppeal,
    user_lookup: dict[str, User],
    notification_lookup: dict[str, Notification],
) -> AdminAppealItem:
    appellant = user_lookup.get(str(appeal.appellant_id))
    resolver = user_lookup.get(str(appeal.resolved_by)) if appeal.resolved_by is not None else None
    source_notification = notification_lookup.get(str(appeal.notification_id))

    return AdminAppealItem(
        id=str(appeal.id),
        notification_id=str(appeal.notification_id),
        appellant_id=str(appeal.appellant_id),
        appellant_username=appellant.username if appellant else None,
        appellant_display_name=appellant.display_name if appellant else None,
        content_type=appeal.content_type.value,
        content_id=str(appeal.content_id),
        thread_id=str(appeal.thread_id) if appeal.thread_id else None,
        post_id=str(appeal.post_id) if appeal.post_id else None,
        notification_message=source_notification.message if source_notification else "",
        reason=appeal.reason,
        status=appeal.status.value,
        admin_note=appeal.admin_note,
        resolved_by=str(appeal.resolved_by) if appeal.resolved_by else None,
        resolved_by_username=resolver.username if resolver else None,
        resolved_by_display_name=resolver.display_name if resolver else None,
        resolved_at=appeal.resolved_at,
        created_at=appeal.created_at,
        updated_at=appeal.updated_at,
    )


def _to_moderation_item_from_thread(thread: Thread, author: User | None = None) -> AdminModerationItem:
    return AdminModerationItem(
        type="thread",
        id=str(thread.id),
        thread_id=None,
        author_id=str(thread.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        title=thread.title,
        content=thread.body,
        status=thread.status,
        ai_score=thread.ai_score,
        is_flagged=thread.is_flagged,
        is_deleted=thread.is_deleted,
        created_at=thread.created_at,
    )


def _to_moderation_item_from_post(post: Post, author: User | None = None) -> AdminModerationItem:
    return AdminModerationItem(
        type="post",
        id=str(post.id),
        thread_id=str(post.thread_id),
        author_id=str(post.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        title=None,
        content=post.content,
        status=None,
        ai_score=post.ai_score,
        is_flagged=post.is_flagged,
        is_deleted=post.is_deleted,
        created_at=post.created_at,
    )


async def _get_admin_content_target(
    *,
    content_type: Literal["thread", "post"],
    content_id: str,
    include_deleted: bool = False,
) -> Thread | Post:
    object_id = _parse_object_id(content_id, field_name="content_id")
    filters: dict[str, object] = {"_id": object_id}
    if not include_deleted:
        filters["is_deleted"] = False

    if content_type == "thread":
        target = await Thread.find_one(filters)
    else:
        target = await Post.find_one(filters)

    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{content_type.capitalize()} not found")
    return target


def _thread_moderation_text(title: str, body: str) -> str:
    return f"{title.strip()}\n\n{body.strip()}"


def _build_user_filters(
    *,
    search: str | None,
    role: UserRole | None,
    is_active: bool | None,
) -> dict[str, object]:
    filters: dict[str, object] = {}
    if role is not None:
        filters["role"] = role
    if is_active is not None:
        filters["is_active"] = is_active

    if search:
        query = search.strip()
        if query:
            regex = {"$regex": query, "$options": "i"}
            filters["$or"] = [
                {"username": regex},
                {"email": regex},
                {"display_name": regex},
            ]
    return filters


def _parse_object_id(value: str, *, field_name: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        ) from exc


async def _load_user_lookup(user_ids: set[PydanticObjectId]) -> dict[str, User]:
    if not user_ids:
        return {}
    users = await User.find({"_id": {"$in": list(user_ids)}}).to_list()
    return {str(item.id): item for item in users}


def _moderation_message(action: str) -> str:
    if action == "approve":
        return "A moderator reviewed your flagged post and approved it."
    return "A moderator reviewed your flagged post and removed it."


def _moderation_notification_metadata(
    *,
    action: str,
    content_type: Literal["thread", "post"],
    content_id: PydanticObjectId,
) -> dict[str, str | bool]:
    removed = action == "reject"
    return {
        "moderation_action": "removed" if removed else "approved",
        "content_type": content_type,
        "content_id": str(content_id),
        "appealable": removed,
        "appeal_status": "none",
    }


def _user_status_message(*, is_active: bool) -> str:
    if is_active:
        return "Your account has been reactivated by an administrator."
    return "Your account has been deactivated by an administrator."


async def _notify_user_if_other(
    *,
    recipient_id: PydanticObjectId,
    actor_id: PydanticObjectId | None,
    message: str,
    thread_id: PydanticObjectId | None = None,
    post_id: PydanticObjectId | None = None,
) -> None:
    if actor_id is not None and recipient_id == actor_id:
        return
    await Notification(
        type=NotificationType.SYSTEM,
        recipient_id=recipient_id,
        actor_id=None,
        thread_id=thread_id,
        post_id=post_id,
        message=message,
    ).insert()


async def _write_audit_log(
    *,
    action: str,
    actor_id: PydanticObjectId | None,
    target_type: str,
    target_id: PydanticObjectId | None,
    request: Request | None = None,
    severity: AuditSeverity = AuditSeverity.INFO,
    result: AuditResult = AuditResult.SUCCESS,
    reason: str | None = None,
    before: dict[str, object] | None = None,
    after: dict[str, object] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    details: dict[str, object] = {}
    if reason:
        details["reason"] = reason
    if before is not None:
        details["before"] = before
    if after is not None:
        details["after"] = after
    if metadata is not None:
        details["metadata"] = metadata

    request_id = _extract_request_id(request)
    ip = _extract_request_ip(request)

    await AuditLog(
        action=action,
        actor_id=actor_id,
        target_type=target_type,
        target_id=target_id,
        severity=severity,
        result=result,
        request_id=request_id,
        ip=ip,
        details=details,
    ).insert()


def _extract_request_id(request: Request | None) -> str | None:
    if request is None:
        return None
    for key in ("x-request-id", "x-correlation-id"):
        value = request.headers.get(key)
        if value:
            return value[:120]
    return None


def _extract_request_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


async def _decrement_thread_post_count(thread_id: PydanticObjectId) -> None:
    thread = await Thread.find_one({"_id": thread_id, "is_deleted": False})
    if thread is None:
        return
    if thread.post_count <= 0:
        return
    thread.post_count -= 1
    await thread.save()


async def _increment_thread_post_count(thread_id: PydanticObjectId) -> None:
    thread = await Thread.find_one({"_id": thread_id, "is_deleted": False})
    if thread is None:
        return
    thread.post_count += 1
    await thread.save()


async def _restore_appealed_content(appeal: ModerationAppeal) -> bool:
    if appeal.content_type == AppealContentType.THREAD:
        thread = await Thread.find_one({"_id": appeal.content_id})
        if thread is None:
            return False
        if not thread.is_deleted:
            return False
        thread.is_deleted = False
        thread.is_flagged = False
        if thread.status == ThreadStatus.ARCHIVED:
            thread.status = ThreadStatus.OPEN
        await thread.save()
        return True

    post = await Post.find_one({"_id": appeal.content_id})
    if post is None:
        return False
    if not post.is_deleted:
        return False
    post.is_deleted = False
    post.is_flagged = False
    await post.save()
    await _increment_thread_post_count(post.thread_id)
    return True


async def _apply_moderation_action(
    *,
    post: Post,
    action: Literal["approve", "reject"],
    reason: str | None,
    actor: User,
    request: Request | None = None,
) -> None:
    if action == "approve":
        post.is_flagged = False
    else:
        if not post.is_deleted:
            await _decrement_thread_post_count(post.thread_id)
        post.is_flagged = False
        post.is_deleted = True

    await post.save()
    await _write_audit_log(
        action=f"moderation_{action}",
        actor_id=actor.id,
        target_type="post",
        target_id=post.id,
        request=request,
        severity=AuditSeverity.WARNING if action == "reject" else AuditSeverity.INFO,
        reason=reason,
        before=None,
        after={"is_flagged": post.is_flagged, "is_deleted": post.is_deleted},
    )

    await Notification(
        type=NotificationType.MODERATION,
        recipient_id=post.author_id,
        actor_id=None,
        thread_id=post.thread_id,
        post_id=post.id,
        message=_moderation_message(action),
        metadata=_moderation_notification_metadata(
            action=action,
            content_type="post",
            content_id=post.id,
        ),
    ).insert()


async def _apply_thread_moderation_action(
    *,
    thread: Thread,
    action: Literal["approve", "reject"],
    reason: str | None,
    actor: User,
    request: Request | None = None,
) -> None:
    before_state = {
        "is_flagged": thread.is_flagged,
        "is_deleted": thread.is_deleted,
        "status": thread.status,
    }
    if action == "approve":
        thread.is_flagged = False
    else:
        thread.is_flagged = False
        thread.is_deleted = True
        thread.status = ThreadStatus.ARCHIVED

    await thread.save()
    await _write_audit_log(
        action=f"moderation_{action}",
        actor_id=actor.id,
        target_type="thread",
        target_id=thread.id,
        request=request,
        severity=AuditSeverity.WARNING if action == "reject" else AuditSeverity.INFO,
        reason=reason,
        before=before_state,
        after={
            "is_flagged": thread.is_flagged,
            "is_deleted": thread.is_deleted,
            "status": thread.status,
        },
    )

    await Notification(
        type=NotificationType.MODERATION,
        recipient_id=thread.author_id,
        actor_id=None,
        thread_id=thread.id,
        post_id=None,
        message="A moderator reviewed your flagged thread and approved it."
        if action == "approve"
        else "A moderator reviewed your flagged thread and removed it.",
        metadata=_moderation_notification_metadata(
            action=action,
            content_type="thread",
            content_id=thread.id,
        ),
    ).insert()


async def _build_user_detail_response(user: User) -> AdminUserDetailResponse:
    total_posts = await Post.find({"author_id": user.id, "is_deleted": False}).count()
    total_threads = await Thread.find({"author_id": user.id, "is_deleted": False}).count()
    followers_count = await User.find({"following": user.id, "is_active": True}).count()
    following_count = await _count_active_following(user)

    audit_logs = (
        await AuditLog.find({"target_id": user.id})
        .sort("-created_at")
        .limit(5)
        .to_list()
    )

    # Resolve user IDs in audit logs (actors + user targets)
    audit_user_ids: set[PydanticObjectId] = set()
    for log in audit_logs:
        if log.actor_id:
            audit_user_ids.add(log.actor_id)
        if log.target_type == "user" and log.target_id:
            audit_user_ids.add(log.target_id)
    audit_user_map: dict[str, User] = {}
    if audit_user_ids:
        found = await User.find({"_id": {"$in": list(audit_user_ids)}}).to_list()
        audit_user_map = {str(u.id): u for u in found}

    # Resolve admin display names for notes
    admin_ids = {n.admin_id for n in user.admin_notes}
    admin_lookup = await _load_user_lookup(admin_ids) if admin_ids else {}

    return AdminUserDetailResponse(
        id=str(user.id),
        username=user.username,
        email=str(user.email),
        display_name=user.display_name,
        bio=user.bio,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        total_posts=total_posts,
        total_threads=total_threads,
        followers_count=followers_count,
        following_count=following_count,
        login_attempts=user.login_attempts,
        locked_until=user.locked_until,
        last_login=user.last_login,
        admin_notes=[
            AdminNoteOut(
                note=n.note,
                admin_id=str(n.admin_id),
                admin_display_name=admin_lookup.get(str(n.admin_id), None) and admin_lookup[str(n.admin_id)].display_name,
                created_at=n.created_at,
            )
            for n in user.admin_notes
        ],
        recent_audit_logs=[_to_audit_log_out(log, audit_user_map) for log in audit_logs],
    )


async def _count_active_following(user: User) -> int:
    if not user.following:
        return 0
    return await User.find({"_id": {"$in": user.following}, "is_active": True}).count()


async def _clear_follow_relationships(target_user: User) -> None:
    target_id = target_user.id
    followers = await User.find({"following": target_id}).to_list()
    for follower in followers:
        if target_id not in follower.following:
            continue
        follower.following = [followed_id for followed_id in follower.following if followed_id != target_id]
        await follower.save()

    if target_user.following:
        target_user.following = []
        await target_user.save()


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        bio=user.bio,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _to_post_out(post: Post, author: User | None = None) -> PostOut:
    return PostOut(
        id=str(post.id),
        thread_id=str(post.thread_id),
        author_id=str(post.author_id),
        author_username=author.username if author else None,
        author_display_name=author.display_name if author else None,
        parent_post_id=str(post.parent_post_id) if post.parent_post_id else None,
        content=post.content,
        mentions=post.mentions,
        ai_score=post.ai_score,
        is_flagged=post.is_flagged,
        is_deleted=post.is_deleted,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _to_thread_out(thread: Thread, author: User | None = None) -> ThreadOut:
    return ThreadOut(
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
        ai_score=thread.ai_score,
        is_flagged=thread.is_flagged,
        is_deleted=thread.is_deleted,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


def _to_audit_log_out(
    log: AuditLog,
    user_map: dict[str, User] | None = None,
) -> AuditLogOut:
    actor_username: str | None = None
    actor_display_name: str | None = None
    target_display_name: str | None = None

    if user_map:
        actor_key = str(log.actor_id) if log.actor_id else None
        if actor_key and actor_key in user_map:
            actor = user_map[actor_key]
            actor_username = actor.username
            actor_display_name = actor.display_name

        if log.target_type == "user" and log.target_id:
            target_key = str(log.target_id)
            if target_key in user_map:
                target_user = user_map[target_key]
                target_display_name = f"{target_user.display_name} (@{target_user.username})"

    return AuditLogOut(
        id=str(log.id),
        action=log.action,
        actor_id=str(log.actor_id) if log.actor_id else None,
        actor_username=actor_username,
        actor_display_name=actor_display_name,
        target_type=log.target_type,
        target_id=str(log.target_id) if log.target_id else None,
        target_display_name=target_display_name,
        severity=log.severity,
        result=log.result,
        request_id=log.request_id,
        ip=log.ip,
        details=log.details,
        created_at=log.created_at,
    )
