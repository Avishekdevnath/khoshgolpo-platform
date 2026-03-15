import base64
import hashlib
import hmac
import os
import secrets
import string
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(derived).decode()}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        encoded_salt, encoded_hash = password_hash.split("$", maxsplit=1)
        salt = base64.b64decode(encoded_salt.encode())
        expected = base64.b64decode(encoded_hash.encode())
    except Exception:
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return hmac.compare_digest(actual, expected)


def create_access_token(
    user_id: str,
    *,
    remember_me: bool = False,
    expires_minutes: int | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    lifetime_minutes = expires_minutes
    if lifetime_minutes is None:
        lifetime_minutes = (
            settings.remember_me_access_token_expire_minutes
            if remember_me
            else settings.access_token_expire_minutes
        )
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=lifetime_minutes)).timestamp()),
        "remember": remember_me,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def token_uses_remember_me(payload: dict) -> bool:
    return bool(payload.get("remember", False))


def create_password_reset_token(user_id: str, *, expires_minutes: int = 30) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "password_reset",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_password_reset_token(token: str) -> dict:
    payload = decode_access_token(token)
    if payload.get("type") != "password_reset":
        raise jwt.PyJWTError("Invalid token type")
    return payload


_RC_ALPHABET = string.ascii_lowercase + string.digits


def generate_recovery_code() -> str:
    """Return a human-readable recovery code like 'khosh-7x2m-9p3q'."""
    part1 = "".join(secrets.choice(_RC_ALPHABET) for _ in range(4))
    part2 = "".join(secrets.choice(_RC_ALPHABET) for _ in range(4))
    return f"khosh-{part1}-{part2}"


def create_identity_token(user_id: str, *, expires_minutes: int = 10) -> str:
    """Short-lived token issued after security-question verification."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "identity",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_identity_token(token: str) -> dict:
    payload = decode_access_token(token)
    if payload.get("type") != "identity":
        raise jwt.PyJWTError("Invalid token type")
    return payload
