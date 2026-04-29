from __future__ import annotations

from pydantic import BaseModel, Field


class IsolationHistoryRequest(BaseModel):
    records: list[dict] = Field(default_factory=list)
    review_score_threshold: float | None = None
    high_risk_score_threshold: float | None = None
