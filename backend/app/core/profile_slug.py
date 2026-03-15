import re

RESERVED_PROFILE_SLUGS = {
    "admin",
    "threads",
    "notifications",
    "messages",
    "people",
    "profile",
    "users",
    "settings",
    "login",
    "register",
    "auth",
    "community",
    "features",
    "api",
    "about",
    "privacy",
    "terms",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    "static",
    "assets",
    "_next",
}

USERNAME_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$")


def normalize_profile_slug(value: str) -> str:
    return value.strip().lower()


def validate_profile_slug(value: str) -> str:
    normalized = normalize_profile_slug(value)
    if len(normalized) < 3 or len(normalized) > 30:
        raise ValueError("Username must be between 3 and 30 characters")
    if normalized in RESERVED_PROFILE_SLUGS:
        raise ValueError("This username is reserved")
    if not USERNAME_PATTERN.match(normalized):
        raise ValueError("Username can contain lowercase letters, numbers, underscore, and dot")
    return normalized
