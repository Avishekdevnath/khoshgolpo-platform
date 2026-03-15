from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.models.appeal import AppealContentType, AppealStatus, ModerationAppeal
from app.models.common import utc_now
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.services.audit import log_audit
from app.schemas.notification import (
    NotificationAppealCreateRequest,
    NotificationAppealOut,
    NotificationListResponse,
    NotificationOut,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    is_read: bool | None = Query(default=None),
    type_filter: NotificationType | None = Query(default=None, alias="type"),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    filters: dict[str, object] = {"recipient_id": current_user.id}
    if is_read is not None:
        filters["is_read"] = is_read
    if type_filter is not None:
        filters["type"] = type_filter

    base_query = Notification.find(filters)

    total = await base_query.count()
    unread_count = await Notification.find({"recipient_id": current_user.id, "is_read": False}).count()

    offset = (page - 1) * limit
    items = await base_query.sort("-created_at").skip(offset).limit(limit).to_list() if total > 0 else []

    return NotificationListResponse(
        items=[_to_notification_out(item) for item in items],
        total=total,
        unread_count=unread_count,
        page=page,
        limit=limit,
        has_more=(offset + len(items)) < total,
    )


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
) -> NotificationOut:
    object_id = _parse_object_id(notification_id, field_name="notification_id")
    notification = await Notification.find_one({"_id": object_id, "recipient_id": current_user.id})
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    await notification.save()
    return _to_notification_out(notification)


@router.patch("/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)) -> dict[str, int]:
    result = await Notification.get_motor_collection().update_many(
        {"recipient_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True, "updated_at": utc_now()}},
    )
    return {"updated": int(result.modified_count)}


@router.post("/{notification_id}/appeal")
async def create_notification_appeal(
    notification_id: str,
    payload: NotificationAppealCreateRequest,
    current_user: User = Depends(get_current_user),
) -> NotificationAppealOut:
    object_id = _parse_object_id(notification_id, field_name="notification_id")
    notification = await Notification.find_one({"_id": object_id, "recipient_id": current_user.id})
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    if notification.type != NotificationType.MODERATION or not _is_removed_moderation_notification(notification):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This notification is not eligible for appeal",
        )

    existing = await ModerationAppeal.find_one({"notification_id": notification.id, "appellant_id": current_user.id})
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appeal already submitted")

    if notification.post_id is not None:
        content_type = AppealContentType.POST
        content_id = notification.post_id
    elif notification.thread_id is not None:
        content_type = AppealContentType.THREAD
        content_id = notification.thread_id
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Appeal target is missing",
        )

    reason = payload.reason.strip()
    if len(reason) < 5:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Appeal reason is too short")

    appeal = await ModerationAppeal(
        notification_id=notification.id,
        appellant_id=current_user.id,
        content_type=content_type,
        content_id=content_id,
        thread_id=notification.thread_id,
        post_id=notification.post_id,
        reason=reason,
        status=AppealStatus.PENDING,
    ).insert()

    next_metadata = dict(notification.metadata or {})
    next_metadata["appeal_status"] = AppealStatus.PENDING.value
    next_metadata["appealable"] = False
    notification.metadata = next_metadata
    notification.updated_at = utc_now()
    await notification.save()

    await log_audit(
        action="appeal_submitted",
        actor_id=current_user.id,
        target_type=content_type.value,
        target_id=content_id,
        details={
            "appeal_id": str(appeal.id),
            "notification_id": str(notification.id),
        },
    )

    return NotificationAppealOut(
        id=str(appeal.id),
        notification_id=str(appeal.notification_id),
        status=appeal.status,
        reason=appeal.reason,
        admin_note=appeal.admin_note,
        created_at=appeal.created_at,
        updated_at=appeal.updated_at,
    )


def _parse_object_id(value: str, *, field_name: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        ) from exc


def _to_notification_out(notification: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(notification.id),
        type=notification.type,
        recipient_id=str(notification.recipient_id),
        actor_id=str(notification.actor_id) if notification.actor_id else None,
        thread_id=str(notification.thread_id) if notification.thread_id else None,
        post_id=str(notification.post_id) if notification.post_id else None,
        message=notification.message,
        metadata=notification.metadata,
        is_read=notification.is_read,
        created_at=notification.created_at,
        updated_at=notification.updated_at,
    )


def _is_removed_moderation_notification(notification: Notification) -> bool:
    action = str((notification.metadata or {}).get("moderation_action") or "").strip().lower()
    if action == "removed":
        return True
    return "removed" in notification.message.lower()
