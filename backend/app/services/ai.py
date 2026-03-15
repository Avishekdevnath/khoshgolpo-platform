import json
from dataclasses import dataclass

from openai import OpenAI

from app.core.config import get_settings


@dataclass
class ToneCheckResult:
    score: float
    warning: bool
    flagged: bool
    suggestion: str | None
    reason: str | None


def _clamp_score(score: float) -> float:
    if score < 0:
        return 0.0
    if score > 1:
        return 1.0
    return score


def _fallback_result(reason: str = "AI fallback") -> ToneCheckResult:
    settings = get_settings()
    return ToneCheckResult(
        score=0.0,
        warning=False,
        flagged=False,
        suggestion=None,
        reason=reason if settings.openai_api_key else "No OpenAI key configured; auto-approved",
    )


def score_content(content: str) -> ToneCheckResult:
    settings = get_settings()
    if not settings.openai_api_key:
        return _fallback_result()

    prompt = (
        "You are a moderation assistant. Analyze tone toxicity/hostility.\n"
        "Return strict JSON with keys: score, suggestion, reason.\n"
        "score is float 0..1 where 1 is highly hostile.\n"
        "suggestion is short, actionable rewrite hint.\n"
        "reason is short explanation."
    )

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.ai_model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": content},
            ],
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        payload = json.loads(raw) if raw else {}
        score = _clamp_score(float(payload.get("score", 0)))
        warning = score >= settings.ai_warning_threshold
        flagged = score >= settings.ai_flag_threshold
        suggestion = payload.get("suggestion")
        reason = payload.get("reason")
        return ToneCheckResult(
            score=score,
            warning=warning,
            flagged=flagged,
            suggestion=suggestion if isinstance(suggestion, str) else None,
            reason=reason if isinstance(reason, str) else None,
        )
    except Exception:
        return _fallback_result(reason="AI request failed; auto-approved")


def pre_submit_tone_check(content: str) -> ToneCheckResult:
    return score_content(content)
