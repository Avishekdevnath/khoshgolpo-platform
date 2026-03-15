from fastapi import APIRouter, Depends, HTTPException, Query, status
from beanie import PydanticObjectId

from app.core.auth import get_current_user
from app.models.connection import Connection, ConnectionStatus, MessageRequest
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.connection import (
    ConnectionListResponse,
    ConnectionOut,
    ConnectionStatusResponse,
    MessageRequestListResponse,
    MessageRequestOut,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/connections", tags=["connections"])


@router.post("/{target_user_id}/request")
async def send_message_request(
    target_user_id: str,
    message: str | None = Query(None, max_length=500),
    current_user: User = Depends(get_current_user),
) -> MessageRequestOut:
    """Send a message request (connection request) to another user"""
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    # Check if target user exists
    target_user = await User.get(target_oid)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent self-messaging
    if target_oid == current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot message yourself")

    blocked_by_me, blocked_you = _get_block_status(current_user, target_user)
    if blocked_by_me or blocked_you:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Messaging is blocked for this user")

    # Check if already connected
    existing = await Connection.find_one({
        "$or": [
            {"user_id": current_user.id, "connected_user_id": target_oid},
            {"user_id": target_oid, "connected_user_id": current_user.id},
        ]
    })
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already connected")

    # Check if any pending request already exists in either direction
    existing_request = await MessageRequest.find_one({
        "$or": [
            {"sender_id": current_user.id, "recipient_id": target_oid},
            {"sender_id": target_oid, "recipient_id": current_user.id},
        ],
        "status": ConnectionStatus.PENDING,
    })
    if existing_request:
        if existing_request.sender_id == current_user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already sent")
        else:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user already sent you a request — accept it instead")

    # Create message request
    req = MessageRequest(
        sender_id=current_user.id,
        recipient_id=target_oid,
        message=message,
        status=ConnectionStatus.PENDING,
    )
    await req.insert()

    # Notify recipient (include request_id so the UI can accept/decline inline)
    await Notification(
        type=NotificationType.CONNECTION,
        recipient_id=target_oid,
        actor_id=current_user.id,
        message=f"{current_user.display_name} sent you a connection request",
        metadata={"request_id": str(req.id), "connection_action": "incoming_request"},
    ).insert()

    # Log audit
    await log_audit(
        action="message_request_sent",
        actor_id=current_user.id,
        target_id=target_oid,
        target_type="user",
    )

    return MessageRequestOut(
        id=str(req.id),
        sender_id=str(req.sender_id),
        recipient_id=str(req.recipient_id),
        message=req.message,
        status=req.status,
        created_at=req.created_at,
    )


@router.post("/{request_id}/accept")
async def accept_message_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
) -> ConnectionStatusResponse:
    """Accept a message request and create connection"""
    try:
        req_oid = PydanticObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request ID")

    req = await MessageRequest.get(req_oid)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only recipient can accept
    if req.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    sender = await User.get(req.sender_id)
    if sender is None or not sender.is_active or not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot accept requests for inactive users")

    blocked_by_me, blocked_you = _get_block_status(current_user, sender)
    if blocked_by_me or blocked_you:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Messaging is blocked for this user")

    # Update request status
    req.status = "accepted"
    await req.save()

    # Create bidirectional connection (guard against duplicate accepts)
    existing_conn = await Connection.find_one({
        "user_id": req.sender_id,
        "connected_user_id": req.recipient_id,
        "status": ConnectionStatus.CONNECTED,
    })
    if not existing_conn:
        conn1 = Connection(
            user_id=req.sender_id,
            connected_user_id=req.recipient_id,
            status=ConnectionStatus.CONNECTED,
        )
        conn2 = Connection(
            user_id=req.recipient_id,
            connected_user_id=req.sender_id,
            status=ConnectionStatus.CONNECTED,
        )
        await conn1.insert()
        await conn2.insert()

    # Notify the original sender
    await Notification(
        type=NotificationType.CONNECTION,
        recipient_id=req.sender_id,
        actor_id=current_user.id,
        message=f"{current_user.display_name} accepted your connection request",
    ).insert()

    # Log audit
    await log_audit(
        action="message_request_accepted",
        actor_id=current_user.id,
        target_id=req.sender_id,
        target_type="user",
    )

    return ConnectionStatusResponse(
        is_connected=True,
        has_pending_request=False,
        is_requester=False,
        pending_request_id=None,
        can_message=True,
        blocked_by_me=False,
        blocked_you=False,
    )


@router.delete("/{request_id}/reject")
async def reject_message_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Reject a message request"""
    try:
        req_oid = PydanticObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request ID")

    req = await MessageRequest.get(req_oid)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only recipient can reject
    if req.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Delete request
    await req.delete()

    # Log audit
    await log_audit(
        action="message_request_rejected",
        actor_id=current_user.id,
        target_id=req.sender_id,
        target_type="user",
    )

    return {"status": "rejected"}


@router.get("/pending")
async def get_pending_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> MessageRequestListResponse:
    """Get incoming pending connection requests for current user (received)"""
    offset = (page - 1) * limit

    query = {"recipient_id": current_user.id, "status": ConnectionStatus.PENDING}
    total = await MessageRequest.find(query).count()
    requests = await MessageRequest.find(query).sort("-created_at").skip(offset).limit(limit).to_list()

    sender_ids = [r.sender_id for r in requests]
    user_lookup = await _load_user_lookup(sender_ids)

    return MessageRequestListResponse(
        data=[_to_request_out(r, user_lookup.get(str(r.sender_id))) for r in requests],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/sent")
async def get_sent_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> MessageRequestListResponse:
    """Get outgoing pending connection requests sent by current user"""
    offset = (page - 1) * limit

    query = {"sender_id": current_user.id, "status": ConnectionStatus.PENDING}
    total = await MessageRequest.find(query).count()
    requests = await MessageRequest.find(query).sort("-created_at").skip(offset).limit(limit).to_list()

    recipient_ids = [r.recipient_id for r in requests]
    user_lookup = await _load_user_lookup(recipient_ids)

    return MessageRequestListResponse(
        data=[_to_request_out(r, user_lookup.get(str(r.recipient_id))) for r in requests],
        total=total,
        page=page,
        limit=limit,
    )


@router.delete("/{request_id}/cancel")
async def cancel_message_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Cancel a connection request you sent"""
    try:
        req_oid = PydanticObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request ID")

    req = await MessageRequest.get(req_oid)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if req.sender_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await req.delete()

    await log_audit(
        action="message_request_cancelled",
        actor_id=current_user.id,
        target_id=req.recipient_id,
        target_type="user",
    )

    return {"status": "cancelled"}


@router.get("/{target_user_id}/status")
async def get_connection_status(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
) -> ConnectionStatusResponse:
    """Check connection status with another user"""
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    target_user = await User.get(target_oid)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    blocked_by_me, blocked_you = _get_block_status(current_user, target_user)

    # Check if connected
    connection = await Connection.find_one({
        "$or": [
            {"user_id": current_user.id, "connected_user_id": target_oid},
            {"user_id": target_oid, "connected_user_id": current_user.id},
        ]
    })

    if connection:
        return ConnectionStatusResponse(
            is_connected=True,
            has_pending_request=False,
            is_requester=False,
            pending_request_id=None,
            can_message=target_user.is_active and not blocked_by_me and not blocked_you,
            blocked_by_me=blocked_by_me,
            blocked_you=blocked_you,
        )

    # Check if request exists
    request = await MessageRequest.find_one({
        "$or": [
            {"sender_id": current_user.id, "recipient_id": target_oid},
            {"sender_id": target_oid, "recipient_id": current_user.id},
        ],
        "status": ConnectionStatus.PENDING,
    })

    if request:
        return ConnectionStatusResponse(
            is_connected=False,
            has_pending_request=True,
            is_requester=request.sender_id == current_user.id,
            pending_request_id=str(request.id),
            can_message=False,
            blocked_by_me=blocked_by_me,
            blocked_you=blocked_you,
        )

    return ConnectionStatusResponse(
        is_connected=False,
        has_pending_request=False,
        is_requester=False,
        pending_request_id=None,
        can_message=False,
        blocked_by_me=blocked_by_me,
        blocked_you=blocked_you,
    )


@router.get("/{target_user_id}/list")
async def get_connections(
    target_user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> ConnectionListResponse:
    """Get list of connections for a user"""
    try:
        target_oid = PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    offset = (page - 1) * limit
    query = {"user_id": target_oid, "status": ConnectionStatus.CONNECTED}
    total = await Connection.find(query).count()
    connections = await Connection.find(query).sort("-created_at").skip(offset).limit(limit).to_list()

    connected_ids = [connection.connected_user_id for connection in connections]
    user_lookup = await _load_user_lookup(connected_ids)

    return ConnectionListResponse(
        data=[_to_connection_out(connection, user_lookup.get(str(connection.connected_user_id))) for connection in connections],
        total=total,
    )


def _get_block_status(current_user: User, target_user: User) -> tuple[bool, bool]:
    current_id = str(current_user.id)
    target_id = str(target_user.id)
    blocked_by_me = target_id in {str(item) for item in current_user.blocked_user_ids}
    blocked_you = current_id in {str(item) for item in target_user.blocked_user_ids}
    return blocked_by_me, blocked_you


async def _load_user_lookup(user_ids: list[PydanticObjectId]) -> dict[str, User]:
    if not user_ids:
        return {}
    users = await User.find({"_id": {"$in": user_ids}}).to_list()
    return {str(user.id): user for user in users}


def _to_request_out(req: MessageRequest, other_user: User | None) -> MessageRequestOut:
    return MessageRequestOut(
        id=str(req.id),
        sender_id=str(req.sender_id),
        recipient_id=str(req.recipient_id),
        message=req.message,
        status=req.status,
        created_at=req.created_at,
        other_user_id=str(other_user.id) if other_user else None,
        other_user_username=other_user.username if other_user else None,
        other_user_display_name=other_user.display_name if other_user else None,
    )


def _to_connection_out(connection: Connection, connected_user: User | None) -> ConnectionOut:
    return ConnectionOut(
        id=str(connection.id),
        user_id=str(connection.user_id),
        connected_user_id=str(connection.connected_user_id),
        status=connection.status,
        created_at=connection.created_at,
        connected_user_username=connected_user.username if connected_user else None,
        connected_user_display_name=connected_user.display_name if connected_user else None,
        connected_user_avatar_url=connected_user.avatar_url if connected_user else None,
        connected_user_is_active=connected_user.is_active if connected_user else None,
        connected_user_is_bot=connected_user.is_bot if connected_user else None,
    )
