from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from beanie import PydanticObjectId
from jwt import PyJWTError

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.core.profile_slug import validate_profile_slug
from app.core.static_auth import authenticate_static_account, build_static_token
from app.models.channel import Channel
from app.models.audit_log import AuditLog, AuditResult, AuditSeverity
from app.models.user import User, UserRole
from app.services.audit import log_audit
from app.schemas.auth import (
    AuthChangePasswordRequest,
    AuthForgotPasswordRequest,
    AuthForgotPasswordResponse,
    AuthLoginRequest,
    AuthMessageResponse,
    AuthRegisterRequest,
    AuthRegisterResponse,
    AuthResetPasswordRequest,
    AuthTokenResponse,
    AuthVerifyIdentityRequest,
    AuthVerifyIdentityResponse,
)
from app.schemas.user import UserOut
from app.services.security import (
    create_access_token,
    create_identity_token,
    decode_identity_token,
    decode_access_token,
    generate_recovery_code,
    hash_password,
    token_uses_remember_me,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def _ensure_db_ready(request: Request) -> None:
    db_error = getattr(request.app.state, "db_error", None)
    if db_error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {db_error}",
        )


def _verify_security_answer(user: User, *, recovery_code: str | None, fav_animal: str | None, fav_person: str | None) -> bool:
    """Return True if any one security answer is correct."""
    if recovery_code and verify_password(recovery_code.strip(), user.recovery_code_hash):
        return True
    if fav_animal and verify_password(fav_animal.strip().lower(), user.fav_animal_hash):
        return True
    if fav_person and verify_password(fav_person.strip().lower(), user.fav_person_hash):
        return True
    return False


@router.post("/register")
@limiter.limit("5/minute")
async def register(payload: AuthRegisterRequest, request: Request) -> AuthRegisterResponse:
    _ensure_db_ready(request)
    settings = get_settings()
    if settings.auth_mode == "static":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Registration is disabled while AUTH_MODE=static",
        )

    try:
        username = validate_profile_slug(payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    email = payload.email.strip().lower()

    existing = await User.find_one({"$or": [{"username": username}, {"email": email}]})
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")

    recovery_code = generate_recovery_code()

    user = User(
        username=username,
        email=email,
        display_name=payload.display_name.strip(),
        password_hash=hash_password(payload.password),
        password_changed_at=datetime.now(timezone.utc),
        recovery_code_hash=hash_password(recovery_code),
        fav_animal_hash=hash_password(payload.fav_animal.strip().lower()) if payload.fav_animal else None,
        fav_person_hash=hash_password(payload.fav_person.strip().lower()) if payload.fav_person else None,
        first_name=payload.first_name.strip() if payload.first_name else None,
        last_name=payload.last_name.strip() if payload.last_name else None,
        gender=payload.gender.strip() if payload.gender else None,
        profile_slug=username,
        profile_slug_changed_at=None,
    )
    await user.insert()

    default_channels = await Channel.find({"is_default": True}).to_list()
    if default_channels:
        user.subscribed_channels = [ch.id for ch in default_channels]
        await user.save()

    token = create_access_token(str(user.id), remember_me=True)

    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else None
    )
    await log_audit(
        action="user_registered",
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
        ip=ip,
        details={"username": username, "email": email},
    )

    return AuthRegisterResponse(access_token=token, user=_to_user_out(user), recovery_code=recovery_code)


@router.post("/login")
@limiter.limit("10/minute")
async def login(payload: AuthLoginRequest, request: Request) -> AuthTokenResponse:
    _ensure_db_ready(request)
    settings = get_settings()
    identifier = payload.identifier.strip().lower()

    if settings.auth_mode == "static":
        account = authenticate_static_account(identifier, payload.password)
        if account is None:
            await _write_auth_audit(
                request=request,
                action="auth_login_failed",
                result=AuditResult.FAILED,
                severity=AuditSeverity.WARNING,
                details={"identifier": identifier[:120], "reason": "invalid_credentials"},
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user = await _get_or_create_static_user(account.email, account.username, account.display_name, account.role)
        await _write_auth_audit(
            request=request,
            action="auth_login_success",
            actor_id=user.id,
            target_id=user.id,
            details={"identifier": identifier[:120], "mode": "static"},
        )
        token = build_static_token(account.email)
        return AuthTokenResponse(access_token=token, user=_to_user_out(user))

    user = await User.find_one({"$or": [{"username": identifier}, {"email": identifier}]})
    if user is None:
        await _write_auth_audit(
            request=request,
            action="auth_login_failed",
            result=AuditResult.FAILED,
            severity=AuditSeverity.WARNING,
            details={"identifier": identifier[:120], "reason": "user_not_found"},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    now = datetime.now(timezone.utc)

    if user.locked_until and user.locked_until.replace(tzinfo=timezone.utc) > now:
        remaining = int((user.locked_until.replace(tzinfo=timezone.utc) - now).total_seconds() / 60) + 1
        await _write_auth_audit(
            request=request,
            action="auth_account_locked",
            actor_id=user.id,
            target_id=user.id,
            severity=AuditSeverity.WARNING,
            result=AuditResult.FAILED,
            details={"remaining_minutes": remaining},
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked due to too many failed attempts. Try again in {remaining} minute(s).",
        )

    if not verify_password(payload.password, user.password_hash):
        user.login_attempts += 1
        lockout_triggered = False
        if user.login_attempts >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            user.login_attempts = 0
            lockout_triggered = True
        await user.save()
        await _write_auth_audit(
            request=request,
            action="auth_login_failed",
            actor_id=user.id,
            target_id=user.id,
            result=AuditResult.FAILED,
            severity=AuditSeverity.WARNING,
            details={"reason": "invalid_password", "lockout_triggered": lockout_triggered},
        )
        if lockout_triggered:
            await _write_auth_audit(
                request=request,
                action="auth_account_locked",
                actor_id=user.id,
                target_id=user.id,
                severity=AuditSeverity.WARNING,
                details={"duration_minutes": LOCKOUT_DURATION_MINUTES},
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.force_password_change:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required. Please reset your password before logging in.",
        )

    user.login_attempts = 0
    user.locked_until = None
    user.last_login = now
    await user.save()
    await _write_auth_audit(
        request=request,
        action="auth_login_success",
        actor_id=user.id,
        target_id=user.id,
        details={"identifier": identifier[:120], "mode": "jwt"},
    )

    token = create_access_token(str(user.id), remember_me=payload.remember_me)
    return AuthTokenResponse(access_token=token, user=_to_user_out(user))


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return _to_user_out(user)


@router.post("/refresh")
async def refresh(request: Request, user: User = Depends(get_current_user)) -> AuthTokenResponse:
    settings = get_settings()
    if settings.auth_mode == "static":
        return AuthTokenResponse(access_token=build_static_token(user.email), user=_to_user_out(user))

    authorization = request.headers.get("authorization", "")
    remember_me = False
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", maxsplit=1)[1].strip()
        remember_me = token_uses_remember_me(decode_access_token(token))

    return AuthTokenResponse(
        access_token=create_access_token(str(user.id), remember_me=remember_me),
        user=_to_user_out(user),
    )


@router.post("/logout")
async def logout(_: User = Depends(get_current_user)) -> dict[str, str]:
    await log_audit(
        action="user_logout",
        actor_id=_.id,
        target_type="user",
        target_id=_.id,
    )
    return {"message": "Logged out"}


@router.post("/verify-identity")
@limiter.limit("5/minute")
async def verify_identity(
    payload: AuthVerifyIdentityRequest,
    request: Request,
) -> AuthVerifyIdentityResponse:
    """Verify a user's identity via security questions. Returns a 10-min identity_token."""
    _ensure_db_ready(request)
    settings = get_settings()
    if settings.auth_mode == "static":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Password recovery is disabled while AUTH_MODE=static",
        )

    identifier = payload.identifier.strip().lower()
    user = await User.find_one({"$or": [{"username": identifier}, {"email": identifier}]})
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with that identifier")

    has_security = any([user.recovery_code_hash, user.fav_animal_hash, user.fav_person_hash])

    # No security questions set → identifier alone is enough (first-time / legacy users)
    if not has_security:
        return AuthVerifyIdentityResponse(identity_token=create_identity_token(str(user.id)))

    # Security questions exist but none provided → tell frontend to show the questions
    any_answer_provided = any([payload.recovery_code, payload.fav_animal, payload.fav_person])
    if not any_answer_provided:
        return AuthVerifyIdentityResponse(needs_questions=True)

    # Verify the provided answer
    if not _verify_security_answer(
        user,
        recovery_code=payload.recovery_code,
        fav_animal=payload.fav_animal,
        fav_person=payload.fav_person,
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Security answer incorrect")

    return AuthVerifyIdentityResponse(identity_token=create_identity_token(str(user.id)))


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    payload: AuthResetPasswordRequest,
    request: Request,
) -> AuthMessageResponse:
    """Set a new password using the identity_token from verify-identity."""
    _ensure_db_ready(request)
    settings = get_settings()
    if settings.auth_mode == "static":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Reset password is disabled while AUTH_MODE=static",
        )

    try:
        token_payload = decode_identity_token(payload.token.strip())
        subject = str(token_payload.get("sub", "")).strip()
        user_id = PydanticObjectId(subject)
    except (PyJWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = await User.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.force_password_change = False
    await user.save()
    await AuditLog(
        action="user_password_reset",
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        created_at=datetime.now(timezone.utc),
    ).insert()
    return AuthMessageResponse(message="Password reset successful")


@router.post("/change-password")
async def change_password(
    payload: AuthChangePasswordRequest,
    current_user: User = Depends(get_current_user),
) -> AuthMessageResponse:
    """Change password for an already-logged-in user via current password or security questions."""
    verified = False

    # Option 1: verify via current password
    if payload.current_password and current_user.password_hash:
        if verify_password(payload.current_password, current_user.password_hash):
            verified = True

    # Option 2: verify via security answers
    if not verified and _verify_security_answer(
        current_user,
        recovery_code=payload.recovery_code,
        fav_animal=payload.fav_animal,
        fav_person=payload.fav_person,
    ):
        verified = True

    if not verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verification failed")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.password_changed_at = datetime.now(timezone.utc)
    current_user.force_password_change = False
    await current_user.save()
    await AuditLog(
        action="user_password_changed",
        actor_id=current_user.id,
        target_type="user",
        target_id=current_user.id,
        severity=AuditSeverity.INFO,
        result=AuditResult.SUCCESS,
        created_at=datetime.now(timezone.utc),
    ).insert()
    return AuthMessageResponse(message="Password changed successfully")


# ── Kept for backwards-compat; not the primary flow anymore ──────────────────

@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    payload: AuthForgotPasswordRequest,
    request: Request,
) -> AuthForgotPasswordResponse:
    _ensure_db_ready(request)
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Email-based reset is no longer supported. Use POST /auth/verify-identity instead.",
    )


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


async def _get_or_create_static_user(
    email: str,
    username: str,
    display_name: str,
    role: UserRole,
) -> User:
    normalized_email = email.strip().lower()
    user = await User.find_one({"email": normalized_email})
    if user is not None:
        changed = False
        if user.username != username:
            user.username = username
            changed = True
        if user.display_name != display_name:
            user.display_name = display_name
            changed = True
        if user.role != role:
            user.role = role
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        if changed:
            await user.save()
        return user

    user = User(
        username=username,
        email=normalized_email,
        display_name=display_name,
        role=role,
        password_hash=None,
        profile_slug=username,
        profile_slug_changed_at=None,
    )
    await user.insert()

    default_channels = await Channel.find({"is_default": True}).to_list()
    if default_channels:
        user.subscribed_channels = [ch.id for ch in default_channels]
        await user.save()

    return user


async def _write_auth_audit(
    *,
    request: Request,
    action: str,
    actor_id: PydanticObjectId | None = None,
    target_id: PydanticObjectId | None = None,
    severity: AuditSeverity = AuditSeverity.INFO,
    result: AuditResult = AuditResult.SUCCESS,
    details: dict[str, object] | None = None,
) -> None:
    request_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id")
    ip = request.headers.get("x-forwarded-for")
    if ip:
        ip = ip.split(",")[0].strip()
    elif request.client and request.client.host:
        ip = request.client.host
    else:
        ip = None

    await AuditLog(
        action=action,
        actor_id=actor_id,
        target_type="user" if target_id else "auth",
        target_id=target_id,
        severity=severity,
        result=result,
        request_id=request_id[:120] if request_id else None,
        ip=ip[:64] if ip else None,
        details=details or {},
        created_at=datetime.now(timezone.utc),
    ).insert()
