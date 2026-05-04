from __future__ import annotations

from typing import Any

from app.domain.entities.ml_prediction import (
    IsolationPrediction,
    IsolationScoreResult,
    IsolationScoreSummary,
    ManualAction,
    RiskLabel,
)
from app.domain.repositories.isolation_scoring_repository import IsolationScoringRepository
from app.infrastructure.ml import isolation


class SklearnIsolationScoringRepository(IsolationScoringRepository):
    def available_domains(self) -> list[str]:
        return list(isolation.DOMAIN_ISO_CONFIG.keys())

    def score_history(
        self,
        domain: str,
        records: list[dict[str, Any]],
        review_score_threshold: float | None = None,
        high_risk_score_threshold: float | None = None,
    ) -> IsolationScoreResult:
        raw = isolation.score_history_isolation(
            domain=domain,
            records=records,
            review_score_threshold=review_score_threshold,
            high_risk_score_threshold=high_risk_score_threshold,
        )

        summary = IsolationScoreSummary(**raw["summary"])
        predictions = [
            IsolationPrediction(
                record=item["record"],
                anomaly_score=item["anomaly_score"],
                is_anomaly=item["is_anomaly"],
                risk_label=RiskLabel(item["risk_label"]),
                matched_patterns=item["matched_patterns"],
                manual_action=ManualAction(item["manual_action"]),
            )
            for item in raw["results"]
        ]

        return IsolationScoreResult(
            domain=raw["domain"],
            total_records=raw["total_records"],
            summary=summary,
            results=predictions,
        )
