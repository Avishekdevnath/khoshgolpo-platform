from pydantic import BaseModel, Field


class ToneCheckRequest(BaseModel):
    content: str = Field(min_length=1)


class ToneCheckResponse(BaseModel):
    score: float
    warning: bool
    flagged: bool
    suggestion: str | None = None
    reason: str | None = None
