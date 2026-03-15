from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user, require_roles
from app.models.channel import Channel
from app.models.user import User, UserRole
from app.schemas.channel import (
    ChannelCreate,
    ChannelListResponse,
    ChannelOut,
    ChannelUpdate,
)

router = APIRouter(prefix="/channels", tags=["channels"])


# ── Helpers ────────────────────────────────────────────────────────────────────


def _to_out(ch: Channel) -> ChannelOut:
    return ChannelOut(
        id=str(ch.id),
        name=ch.name,
        slug=ch.slug,
        tag=ch.tag,
        description=ch.description,
        color=ch.color,
        is_default=ch.is_default,
        created_at=ch.created_at,
        updated_at=ch.updated_at,
    )


# ── Public endpoints ───────────────────────────────────────────────────────────


@router.get("")
async def list_channels(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> ChannelListResponse:
    total = await Channel.find_all().count()
    channels = (
        await Channel.find_all()
        .sort("name")
        .skip((page - 1) * limit)
        .limit(limit)
        .to_list()
    )
    return ChannelListResponse(
        data=[_to_out(c) for c in channels],
        page=page,
        limit=limit,
        total=total,
    )


# NOTE: /me/subscribed MUST be defined before /{slug} to avoid path conflict
@router.get("/me/subscribed")
async def my_channels(
    current_user: User = Depends(get_current_user),
) -> ChannelListResponse:
    if not current_user.subscribed_channels:
        return ChannelListResponse(data=[], page=1, limit=50, total=0)
    channels = (
        await Channel.find({"_id": {"$in": current_user.subscribed_channels}})
        .sort("name")
        .to_list()
    )
    return ChannelListResponse(
        data=[_to_out(c) for c in channels],
        page=1,
        limit=len(channels),
        total=len(channels),
    )


@router.get("/{slug}")
async def get_channel(slug: str) -> ChannelOut:
    ch = await Channel.find_one({"slug": slug})
    if ch is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    return _to_out(ch)


# ── Admin endpoints ────────────────────────────────────────────────────────────


@router.post("")
async def create_channel(
    payload: ChannelCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> ChannelOut:
    existing = await Channel.find_one(
        {"$or": [{"slug": payload.slug}, {"tag": payload.tag}]}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Channel slug or tag already exists",
        )
    ch = Channel(**payload.model_dump())
    await ch.insert()
    return _to_out(ch)


@router.patch("/{slug}")
async def update_channel(
    slug: str,
    payload: ChannelUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> ChannelOut:
    ch = await Channel.find_one({"slug": slug})
    if ch is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    updates = payload.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(ch, k, v)
    await ch.save()
    return _to_out(ch)


# ── Subscribe / Unsubscribe ───────────────────────────────────────────────────


@router.post("/{slug}/subscribe")
async def subscribe(
    slug: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    ch = await Channel.find_one({"slug": slug})
    if ch is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if ch.id not in current_user.subscribed_channels:
        current_user.subscribed_channels.append(ch.id)
        await current_user.save()
    return {"message": "Subscribed"}


@router.delete("/{slug}/subscribe")
async def unsubscribe(
    slug: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    ch = await Channel.find_one({"slug": slug})
    if ch is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if ch.id in current_user.subscribed_channels:
        current_user.subscribed_channels.remove(ch.id)
        await current_user.save()
    return {"message": "Unsubscribed"}
