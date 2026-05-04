from __future__ import annotations

from typing import Any, Protocol

from app.domain.entities.ml_prediction import IsolationScoreResult


class IsolationScoringRepository(Protocol):
    def available_domains(self) -> list[str]:
        ...

    def score_history(
        self,
        domain: str,
        records: list[dict[str, Any]],
        review_score_threshold: float | None = None,
        high_risk_score_threshold: float | None = None,
    ) -> IsolationScoreResult:
        ...
