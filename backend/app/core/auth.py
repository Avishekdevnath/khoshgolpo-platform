from collections.abc import Callable

from beanie import PydanticObjectId
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWTError

from app.core.config import get_settings
from app.core.static_auth import find_static_account
from app.models.user import User, UserRole
from app.services.security import decode_access_token


async def get_current_user(authorization: str | None = Header(default=None)) -> User:
    user = await _resolve_user_from_authorization(authorization, require_auth=True)
    if user is None:  # pragma: no cover - guarded by require_auth=True
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return user


async def get_optional_current_user(authorization: str | None = Header(default=None)) -> User | None:
    return await _resolve_user_from_authorization(authorization, require_auth=False)


async def _resolve_user_from_authorization(authorization: str | None, *, require_auth: bool) -> User | None:
    if not authorization:
        if require_auth:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
        return None
    if not authorization.lower().startswith("bearer "):
        if require_auth:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
        return None

    token = authorization.split(" ", maxsplit=1)[1].strip()
    settings = get_settings()
    if settings.auth_mode == "static" and token.lower().startswith("demo:"):
        email = token[5:].strip().lower()
        static_account = find_static_account(email)
        if static_account is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        user = await User.find_one({"email": static_account.email})
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

    try:
        payload = decode_access_token(token)
        subject = str(payload.get("sub", "")).strip()
        if not subject:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    try:
        user_id = PydanticObjectId(subject)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc

    user = await User.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    async def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _dependency
