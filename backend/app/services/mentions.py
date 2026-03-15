import re

MENTION_PATTERN = re.compile(r"(?<!\w)@([a-zA-Z0-9_.-]{1,30})")


def extract_mentions_from_text(content: str) -> list[str]:
    """Extract unique mentions from post content, preserving first-seen order."""
    seen: set[str] = set()
    mentions: list[str] = []
    for match in MENTION_PATTERN.finditer(content):
        username = match.group(1).lower()
        if username in seen:
            continue
        seen.add(username)
        mentions.append(username)
    return mentions


def merge_mentions(content: str, provided_mentions: list[str] | None = None) -> list[str]:
    """Merge parsed mentions with optional client-provided mentions."""
    parsed = extract_mentions_from_text(content)
    if not provided_mentions:
        return parsed

    seen = set(parsed)
    merged = list(parsed)
    for item in provided_mentions:
        mention = item.strip().lower()
        if not mention or mention in seen:
            continue
        seen.add(mention)
        merged.append(mention)
    return merged
