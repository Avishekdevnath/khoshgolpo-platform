from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI

from app.core.config import get_settings
from app.models.thread import Thread

_MAX_SHORTLIST = 30
_MAX_SUGGESTION_TAGS = 30


class FeedAIRerankTimeoutError(Exception):
    pass


class FeedAIRerankError(Exception):
    pass


class FeedAIRerankPayloadError(FeedAIRerankError):
    pass


class FeedAISuggestionTimeoutError(Exception):
    pass


class FeedAISuggestionError(Exception):
    pass


class FeedAISuggestionPayloadError(FeedAISuggestionError):
    pass


def _clamp(value: float, minimum: float, maximum: float) -> float:
    if value < minimum:
        return minimum
    if value > maximum:
        return maximum
    return value


def _age_hours(created_at: datetime) -> float:
    timestamp = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - timestamp.astimezone(timezone.utc)
    return max(delta.total_seconds() / 3600.0, 0.0)


def _extract_json_payload(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if not text:
        raise FeedAIRerankPayloadError("Empty AI response payload")

    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise FeedAIRerankPayloadError("AI response is not valid JSON") from exc

    if not isinstance(payload, dict):
        raise FeedAIRerankPayloadError("AI response must be a JSON object")
    return payload


def _coerce_adjustments(payload: dict[str, Any], valid_ids: set[str], cap: float) -> dict[str, float]:
    parsed: dict[str, float] = {}

    adjustments = payload.get("adjustments")
    if isinstance(adjustments, list):
        for item in adjustments:
            if not isinstance(item, dict):
                continue
            thread_id = str(item.get("thread_id", "")).strip()
            if not thread_id or thread_id not in valid_ids:
                continue
            try:
                value = float(item.get("adjustment", 0.0))
            except (TypeError, ValueError):
                continue
            parsed[thread_id] = round(_clamp(value, -cap, cap), 6)
        return parsed

    for thread_id in valid_ids:
        if thread_id not in payload:
            continue
        try:
            value = float(payload[thread_id])
        except (TypeError, ValueError):
            continue
        parsed[thread_id] = round(_clamp(value, -cap, cap), 6)
    return parsed


def _build_thread_summary(thread: Thread) -> dict[str, Any]:
    return {
        "thread_id": str(thread.id),
        "title": thread.title[:160],
        "body_excerpt": thread.body[:220],
        "tags": thread.tags[:8],
        "post_count": int(thread.post_count),
        "is_pinned": bool(thread.is_pinned),
        "age_hours": round(_age_hours(thread.created_at), 2),
    }


def _normalize_tag_list(values: list[str], *, max_items: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        tag = raw.strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)
        if len(normalized) >= max_items:
            break
    return normalized


def _extract_suggested_tags(payload: dict[str, Any], *, max_tags: int) -> list[str]:
    candidates = payload.get("tags")
    if candidates is None:
        candidates = payload.get("interest_tags")
    if not isinstance(candidates, list):
        raise FeedAISuggestionPayloadError("AI suggestion payload missing tags array")
    values = [item for item in candidates if isinstance(item, str)]
    return _normalize_tag_list(values, max_items=max_tags)


def _call_openai(
    *,
    api_key: str,
    model: str,
    prompt: str,
    user_payload: str,
) -> str:
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_payload},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def _call_openai_for_tags(
    *,
    api_key: str,
    model: str,
    prompt: str,
    user_payload: str,
) -> str:
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_payload},
        ],
    )
    return (response.choices[0].message.content or "").strip()


async def rerank_shortlist(
    user_context: dict[str, Any],
    threads_shortlist: list[Thread],
    timeout_ms: int,
    cap: float,
) -> dict[str, float]:
    settings = get_settings()
    if not settings.openai_api_key or not threads_shortlist:
        return {}

    shortlist = threads_shortlist[:_MAX_SHORTLIST]
    shortlist_ids = {str(thread.id) for thread in shortlist}
    if not shortlist_ids:
        return {}

    prompt = (
        "You are a feed ranking assistant.\n"
        "Given a shortlist of threads and limited user context, return bounded ranking adjustments.\n"
        "Output strict JSON only with this shape:\n"
        '{"adjustments":[{"thread_id":"<id>","adjustment":0.00}]}\n'
        "Use adjustment range -1.0 to 1.0 where positive means boost and negative means penalty.\n"
        "Only include IDs from the shortlist. Omit uncertain items."
    )
    user_payload = json.dumps(
        {
            "cap": cap,
            "user_context": user_context,
            "threads": [_build_thread_summary(thread) for thread in shortlist],
        },
        separators=(",", ":"),
    )

    try:
        raw = await asyncio.wait_for(
            asyncio.to_thread(
                _call_openai,
                api_key=settings.openai_api_key,
                model=settings.ai_model,
                prompt=prompt,
                user_payload=user_payload,
            ),
            timeout=max(timeout_ms, 1) / 1000.0,
        )
    except TimeoutError as exc:
        raise FeedAIRerankTimeoutError("AI rerank timed out") from exc
    except Exception as exc:
        raise FeedAIRerankError("AI rerank request failed") from exc

    payload = _extract_json_payload(raw)
    adjustments = _coerce_adjustments(payload, shortlist_ids, cap)
    return adjustments


async def suggest_interest_tags(
    user_context: dict[str, Any],
    signal_tags: list[str],
    timeout_ms: int,
    max_tags: int,
) -> list[str]:
    settings = get_settings()
    if not settings.openai_api_key:
        return []

    capped_max = max(1, min(int(max_tags), _MAX_SUGGESTION_TAGS))
    normalized_signals = _normalize_tag_list(signal_tags, max_items=_MAX_SUGGESTION_TAGS)
    if not normalized_signals and not user_context:
        return []

    prompt = (
        "You are a feed personalization assistant.\n"
        "Given weak user context and seed tags, suggest concise interest tags for feed personalization.\n"
        "Output strict JSON only with this shape:\n"
        '{"tags":["tag1","tag2"]}\n'
        "Rules:\n"
        "- lowercase tags\n"
        "- 1 to 3 words per tag\n"
        "- no punctuation-only tags\n"
        "- return at most the requested max_tags\n"
        "- keep tags broad and safe"
    )
    user_payload = json.dumps(
        {
            "max_tags": capped_max,
            "user_context": user_context,
            "signal_tags": normalized_signals,
        },
        separators=(",", ":"),
    )

    try:
        raw = await asyncio.wait_for(
            asyncio.to_thread(
                _call_openai_for_tags,
                api_key=settings.openai_api_key,
                model=settings.ai_model,
                prompt=prompt,
                user_payload=user_payload,
            ),
            timeout=max(timeout_ms, 1) / 1000.0,
        )
    except TimeoutError as exc:
        raise FeedAISuggestionTimeoutError("AI interest suggestion timed out") from exc
    except Exception as exc:
        raise FeedAISuggestionError("AI interest suggestion request failed") from exc

    payload = _extract_json_payload(raw)
    return _extract_suggested_tags(payload, max_tags=capped_max)
