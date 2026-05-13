from __future__ import annotations

from typing import Any

from app.domain.repositories.isolation_scoring_repository import IsolationScoringRepository
from app.application.services.isolation_ml_service import process_history_isolation


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

        # tetap pakai repository untuk validasi domain (biar aman)
        if domain not in self._scoring_repository.available_domains():
            raise ValueError(f"Domain isolation tidak ditemukan: {domain}")

        # 🔥 pakai clean flow (bukan repository lagi)
        return process_history_isolation(domain, records)