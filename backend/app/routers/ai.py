from fastapi import APIRouter

from app.schemas.ai import ToneCheckRequest, ToneCheckResponse
from app.services.ai import pre_submit_tone_check

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/tone-check")
async def tone_check(payload: ToneCheckRequest) -> ToneCheckResponse:
    result = pre_submit_tone_check(payload.content.strip())
    return ToneCheckResponse(
        score=result.score,
        warning=result.warning,
        flagged=result.flagged,
        suggestion=result.suggestion,
        reason=result.reason,
    )
