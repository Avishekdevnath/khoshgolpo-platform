import base64
import json

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.auth import get_current_user
from app.models.common import utc_now
from app.models.connection import Connection, ConnectionStatus
from app.models.conversation import Conversation
from app.models.conversation_read_state import ConversationReadState
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.message import (
    ConversationCreateRequest,
    ConversationListResponse,
    ConversationOut,
    MarkReadRequest,
    MessageBlockStatusResponse,
    MessageCreate,
    MessageListResponse,
    MessageOut,
    MessageParticipantOut,
    MessageUnreadCountResponse,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/messages", tags=["messages"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/conversations")
async def list_conversations(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> ConversationListResponse:
    offset = _decode_cursor(cursor)
    conversations = (
        await Conversation.find({"participant_ids": current_user.id})
        .sort([("last_message_at", -1), ("updated_at", -1)])
        .skip(offset)
        .limit(limit)
        .to_list()
    )
    items = await _serialize_conversations(conversations, current_user=current_user)
    next_cursor = _encode_cursor(offset + len(conversations)) if len(conversations) == limit else None
    return ConversationListResponse(data=items, next_cursor=next_cursor)


@router.post("/conversations")
@limiter.limit("20/minute")
async def create_conversation(
    payload: ConversationCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    target_id = _parse_object_id(payload.target_user_id, field_name="target_user_id")
    target_user = await _get_target_user(target_id)
    _ensure_not_self(current_user=current_user, target_id=target_id)
    _ensure_active_users(current_user=current_user, target_user=target_user)
    _ensure_not_blocked(current_user=current_user, target_user=target_user)
    await _ensure_connected(current_user_id=current_user.id, target_user_id=target_user.id)

    participant_key = _build_participant_key(current_user.id, target_user.id)
    conversation = await Conversation.find_one({"participant_key": participant_key})
    if conversation is None:
        conversation = Conversation(
            participant_ids=[current_user.id, target_user.id],
            participant_key=participant_key,
        )
        await conversation.insert()

    await _ensure_read_states(conversation)
    await log_audit(
        action="conversation_opened",
        actor_id=current_user.id,
        target_type="conversation",
        target_id=conversation.id,
        details={"target_user_id": str(target_user.id)},
    )
    return await _serialize_conversation(conversation, current_user=current_user)


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> MessageListResponse:
    conversation = await _get_conversation_for_participant(conversation_id, current_user=current_user)
    offset = _decode_cursor(cursor)
    messages = (
        await Message.find({"conversation_id": conversation.id})
        .sort("-sequence")
        .skip(offset)
        .limit(limit)
        .to_list()
    )
    next_cursor = _encode_cursor(offset + len(messages)) if len(messages) == limit else None
    return MessageListResponse(
        conversation=await _serialize_conversation(conversation, current_user=current_user),
        data=[_to_message_out(item, current_user=current_user) for item in reversed(messages)],
        next_cursor=next_cursor,
    )


@router.post("/conversations/{conversation_id}/messages")
@limiter.limit("60/minute")
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    conversation = await _get_conversation_for_participant(conversation_id, current_user=current_user)
    target_user = await _get_other_participant(conversation, current_user=current_user)
    _ensure_active_users(current_user=current_user, target_user=target_user)
    _ensure_not_blocked(current_user=current_user, target_user=target_user)
    await _ensure_connected(current_user_id=current_user.id, target_user_id=target_user.id)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message content cannot be empty")

    next_sequence = conversation.message_count + 1
    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=content,
        sequence=next_sequence,
    )
    await message.insert()

    conversation.message_count = next_sequence
    conversation.last_message_id = message.id
    conversation.last_message_preview = _build_message_preview(content)
    conversation.last_message_at = message.created_at
    conversation.last_message_sender_id = current_user.id
    conversation.updated_at = message.created_at
    await conversation.save()

    sender_state = await _get_or_create_read_state(conversation_id=conversation.id, user_id=current_user.id)
    sender_state.last_read_message_id = message.id
    sender_state.last_read_sequence = message.sequence
    sender_state.last_read_at = message.created_at
    await sender_state.save()
    await _get_or_create_read_state(conversation_id=conversation.id, user_id=target_user.id)

    if str(current_user.id) not in {str(item) for item in target_user.muted_users}:
        await Notification(
            type=NotificationType.MESSAGE,
            recipient_id=target_user.id,
            actor_id=current_user.id,
            message=f"{current_user.display_name} sent you a message",
            metadata={
                "conversation_id": str(conversation.id),
                "message_id": str(message.id),
                "message_sequence": message.sequence,
            },
        ).insert()

    await log_audit(
        action="message_sent",
        actor_id=current_user.id,
        target_type="conversation",
        target_id=conversation.id,
        details={"message_id": str(message.id), "recipient_id": str(target_user.id)},
    )
    return _to_message_out(message, current_user=current_user)


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    payload: MarkReadRequest,
    current_user: User = Depends(get_current_user),
) -> MessageUnreadCountResponse:
    conversation = await _get_conversation_for_participant(conversation_id, current_user=current_user)
    if conversation.message_count <= 0:
        return MessageUnreadCountResponse(unread_count=0)

    read_state = await _get_or_create_read_state(conversation_id=conversation.id, user_id=current_user.id)
    message = await _resolve_last_read_message(conversation=conversation, payload=payload)
    if message is None:
        return MessageUnreadCountResponse(unread_count=max(conversation.message_count - read_state.last_read_sequence, 0))

    if message.sequence > read_state.last_read_sequence:
        read_state.last_read_message_id = message.id
        read_state.last_read_sequence = message.sequence
        read_state.last_read_at = utc_now()
        await read_state.save()

    await Notification.get_motor_collection().update_many(
        {
            "recipient_id": current_user.id,
            "type": NotificationType.MESSAGE,
            "is_read": False,
            "metadata.conversation_id": str(conversation.id),
            "metadata.message_sequence": {"$lte": message.sequence},
        },
        {"$set": {"is_read": True, "updated_at": utc_now()}},
    )

    return MessageUnreadCountResponse(unread_count=max(conversation.message_count - read_state.last_read_sequence, 0))


@router.get("/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)) -> MessageUnreadCountResponse:
    conversations = await Conversation.find({"participant_ids": current_user.id}).to_list()
    if not conversations:
        return MessageUnreadCountResponse(unread_count=0)

    states = await ConversationReadState.find(
        {"conversation_id": {"$in": [item.id for item in conversations]}, "user_id": current_user.id}
    ).to_list()
    state_lookup = {str(item.conversation_id): item for item in states}

    unread_count = 0
    for conversation in conversations:
        read_state = state_lookup.get(str(conversation.id))
        unread_count += max(conversation.message_count - (read_state.last_read_sequence if read_state else 0), 0)

    return MessageUnreadCountResponse(unread_count=unread_count)


@router.post("/users/{user_id}/block")
@limiter.limit("30/minute")
async def block_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> MessageBlockStatusResponse:
    target_id = _parse_object_id(user_id, field_name="user_id")
    target_user = await _get_target_user(target_id)
    _ensure_not_self(current_user=current_user, target_id=target_id)

    if str(target_id) not in {str(item) for item in current_user.blocked_user_ids}:
        current_user.blocked_user_ids.append(target_id)
        await current_user.save()

    await log_audit(
        action="message_user_blocked",
        actor_id=current_user.id,
        target_type="user",
        target_id=target_user.id,
    )
    return await _to_block_status(current_user=current_user, target_user=target_user)


@router.delete("/users/{user_id}/block")
async def unblock_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
) -> MessageBlockStatusResponse:
    target_id = _parse_object_id(user_id, field_name="user_id")
    target_user = await _get_target_user(target_id)
    _ensure_not_self(current_user=current_user, target_id=target_id)

    next_blocked_ids = [item for item in current_user.blocked_user_ids if str(item) != str(target_id)]
    if len(next_blocked_ids) != len(current_user.blocked_user_ids):
        current_user.blocked_user_ids = next_blocked_ids
        await current_user.save()

    await log_audit(
        action="message_user_unblocked",
        actor_id=current_user.id,
        target_type="user",
        target_id=target_user.id,
    )
    return await _to_block_status(current_user=current_user, target_user=target_user)


def _parse_object_id(value: str, *, field_name: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        ) from exc


def _ensure_not_self(*, current_user: User, target_id: PydanticObjectId) -> None:
    if current_user.id == target_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot message yourself")


async def _get_target_user(target_id: PydanticObjectId) -> User:
    target_user = await User.get(target_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return target_user


def _ensure_active_users(*, current_user: User, target_user: User) -> None:
    if not current_user.is_active or not target_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Messaging is unavailable for inactive users")


def _get_block_status(current_user: User, target_user: User) -> tuple[bool, bool]:
    current_id = str(current_user.id)
    target_id = str(target_user.id)
    blocked_by_me = target_id in {str(item) for item in current_user.blocked_user_ids}
    blocked_you = current_id in {str(item) for item in target_user.blocked_user_ids}
    return blocked_by_me, blocked_you


def _ensure_not_blocked(*, current_user: User, target_user: User) -> None:
    blocked_by_me, blocked_you = _get_block_status(current_user, target_user)
    if blocked_by_me or blocked_you:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Messaging is blocked for this user")


async def _ensure_connected(*, current_user_id: PydanticObjectId, target_user_id: PydanticObjectId) -> None:
    connection = await Connection.find_one(
        {
            "user_id": current_user_id,
            "connected_user_id": target_user_id,
            "status": ConnectionStatus.CONNECTED,
        }
    )
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Messaging is only available for accepted connections",
        )


async def _get_conversation_for_participant(conversation_id: str, *, current_user: User) -> Conversation:
    object_id = _parse_object_id(conversation_id, field_name="conversation_id")
    conversation = await Conversation.get(object_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if str(current_user.id) not in {str(item) for item in conversation.participant_ids}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this conversation")
    await _ensure_read_states(conversation)
    return conversation


async def _get_other_participant(conversation: Conversation, *, current_user: User) -> User:
    other_id = next((item for item in conversation.participant_ids if str(item) != str(current_user.id)), None)
    if other_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conversation is missing a participant")
    other_user = await User.get(other_id)
    if other_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation participant not found")
    return other_user


def _build_participant_key(user_a: PydanticObjectId, user_b: PydanticObjectId) -> str:
    return ":".join(sorted([str(user_a), str(user_b)]))


def _build_message_preview(content: str) -> str:
    return " ".join(content.split())[:160]


async def _ensure_read_states(conversation: Conversation) -> None:
    existing = await ConversationReadState.find({"conversation_id": conversation.id}).to_list()
    existing_ids = {str(item.user_id) for item in existing}
    for participant_id in conversation.participant_ids:
        if str(participant_id) in existing_ids:
            continue
        await ConversationReadState(conversation_id=conversation.id, user_id=participant_id).insert()


async def _get_or_create_read_state(
    *,
    conversation_id: PydanticObjectId,
    user_id: PydanticObjectId,
) -> ConversationReadState:
    state = await ConversationReadState.find_one({"conversation_id": conversation_id, "user_id": user_id})
    if state is not None:
        return state
    state = ConversationReadState(conversation_id=conversation_id, user_id=user_id)
    await state.insert()
    return state


async def _resolve_last_read_message(
    *,
    conversation: Conversation,
    payload: MarkReadRequest,
) -> Message | None:
    if payload.last_read_message_id:
        message_id = _parse_object_id(payload.last_read_message_id, field_name="last_read_message_id")
        message = await Message.find_one({"_id": message_id, "conversation_id": conversation.id})
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        return message

    return await Message.find_one({"conversation_id": conversation.id}, sort=[("sequence", -1)])


async def _serialize_conversations(
    conversations: list[Conversation],
    *,
    current_user: User,
) -> list[ConversationOut]:
    if not conversations:
        return []

    conversation_ids = [item.id for item in conversations]
    other_ids = [
        participant_id
        for conversation in conversations
        for participant_id in conversation.participant_ids
        if str(participant_id) != str(current_user.id)
    ]

    other_users = await User.find({"_id": {"$in": other_ids}}).to_list() if other_ids else []
    read_states = await ConversationReadState.find(
        {"conversation_id": {"$in": conversation_ids}, "user_id": current_user.id}
    ).to_list()
    connections = await Connection.find(
        {
            "user_id": current_user.id,
            "connected_user_id": {"$in": other_ids},
            "status": ConnectionStatus.CONNECTED,
        }
    ).to_list()

    user_lookup = {str(item.id): item for item in other_users}
    read_state_lookup = {str(item.conversation_id): item for item in read_states}
    connected_ids = {str(item.connected_user_id) for item in connections}

    return [
        _serialize_conversation_from_context(
            conversation,
            current_user=current_user,
            user_lookup=user_lookup,
            read_state_lookup=read_state_lookup,
            connected_ids=connected_ids,
        )
        for conversation in conversations
    ]


async def _serialize_conversation(conversation: Conversation, *, current_user: User) -> ConversationOut:
    return (await _serialize_conversations([conversation], current_user=current_user))[0]


def _serialize_conversation_from_context(
    conversation: Conversation,
    *,
    current_user: User,
    user_lookup: dict[str, User],
    read_state_lookup: dict[str, ConversationReadState],
    connected_ids: set[str],
) -> ConversationOut:
    other_id = next((item for item in conversation.participant_ids if str(item) != str(current_user.id)), None)
    if other_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conversation is missing a participant")

    other_user = user_lookup.get(str(other_id))
    if other_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation participant not found")

    blocked_by_me, blocked_you = _get_block_status(current_user, other_user)
    read_state = read_state_lookup.get(str(conversation.id))
    unread_count = max(conversation.message_count - (read_state.last_read_sequence if read_state else 0), 0)

    return ConversationOut(
        id=str(conversation.id),
        participant_ids=[str(item) for item in conversation.participant_ids],
        other_participant=MessageParticipantOut(
            id=str(other_user.id),
            username=other_user.username,
            display_name=other_user.display_name,
            avatar_url=other_user.avatar_url,
            is_active=other_user.is_active,
            is_bot=other_user.is_bot,
        ),
        last_message_preview=conversation.last_message_preview,
        last_message_at=conversation.last_message_at,
        last_message_sender_id=str(conversation.last_message_sender_id) if conversation.last_message_sender_id else None,
        message_count=conversation.message_count,
        unread_count=unread_count,
        blocked_by_me=blocked_by_me,
        blocked_you=blocked_you,
        can_message=other_user.is_active and not blocked_by_me and not blocked_you and str(other_user.id) in connected_ids,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def _to_message_out(message: Message, *, current_user: User) -> MessageOut:
    return MessageOut(
        id=str(message.id),
        conversation_id=str(message.conversation_id),
        sender_id=str(message.sender_id),
        content=message.content,
        sequence=message.sequence,
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
        is_deleted=message.is_deleted,
        is_own=str(message.sender_id) == str(current_user.id),
    )


async def _to_block_status(*, current_user: User, target_user: User) -> MessageBlockStatusResponse:
    blocked_by_me, blocked_you = _get_block_status(current_user, target_user)
    can_message = False
    if current_user.is_active and target_user.is_active and not blocked_by_me and not blocked_you:
        connection = await Connection.find_one({
            "user_id": current_user.id,
            "connected_user_id": target_user.id,
            "status": ConnectionStatus.CONNECTED,
        })
        can_message = connection is not None
    return MessageBlockStatusResponse(
        target_user_id=str(target_user.id),
        blocked_by_me=blocked_by_me,
        blocked_you=blocked_you,
        can_message=can_message,
    )


def _encode_cursor(offset: int) -> str:
    payload = json.dumps({"offset": max(offset, 0)}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        padded = cursor + ("=" * (-len(cursor) % 4))
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        return max(int(json.loads(raw).get("offset", 0)), 0)
    except Exception:
        return 0
