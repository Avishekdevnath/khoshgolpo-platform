from dataclasses import dataclass

from app.models.user import UserRole


@dataclass(frozen=True)
class StaticAccount:
    email: str
    username: str
    display_name: str
    password: str
    role: UserRole


STATIC_ACCOUNTS: tuple[StaticAccount, ...] = (
    StaticAccount(
        email="demo@demo.com",
        username="demo",
        display_name="Demo User",
        password="demo123",
        role=UserRole.MEMBER,
    ),
    StaticAccount(
        email="admin@demo.com",
        username="admin",
        display_name="Admin",
        password="admin1234",
        role=UserRole.ADMIN,
    ),
    StaticAccount(
        email="user1@demo.com",
        username="user1",
        display_name="Alice Developer",
        password="user1demo",
        role=UserRole.MEMBER,
    ),
    StaticAccount(
        email="user2@demo.com",
        username="user2",
        display_name="Bob Designer",
        password="user2demo",
        role=UserRole.MEMBER,
    ),
    StaticAccount(
        email="user3@demo.com",
        username="user3",
        display_name="Carol DevOps",
        password="user3demo",
        role=UserRole.MODERATOR,
    ),
)


def find_static_account(identifier: str) -> StaticAccount | None:
    needle = identifier.strip().lower()
    if not needle:
        return None

    for account in STATIC_ACCOUNTS:
        if needle in (account.email.lower(), account.username.lower()):
            return account
    return None


def authenticate_static_account(identifier: str, password: str) -> StaticAccount | None:
    account = find_static_account(identifier)
    if account is None:
        return None
    if password != account.password:
        return None
    return account


def build_static_token(email: str) -> str:
    return f"demo:{email.strip().lower()}"
