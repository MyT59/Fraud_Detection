from __future__ import annotations

from typing import Any

from app.domain.repositories.isolation_scoring_repository import IsolationScoringRepository


class ScoreIsolationHistoryUseCase:
    def __init__(self, scoring_repository: IsolationScoringRepository) -> None:
        self._scoring_repository = scoring_repository

    def execute(
        self,
        domain: str,
        records: list[dict[str, Any]],
        review_score_threshold: float | None = None,
        high_risk_score_threshold: float | None = None,
    ) -> dict[str, Any]:
        if domain not in self._scoring_repository.available_domains():
            raise ValueError(f"Domain isolation tidak ditemukan: {domain}")

        result = self._scoring_repository.score_history(
            domain=domain,
            records=records,
            review_score_threshold=review_score_threshold,
            high_risk_score_threshold=high_risk_score_threshold,
        )
        return result.to_dict()
