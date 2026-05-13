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

# 🔥 pakai clean ML
from app.infrastructure.ml.scoring import score_history_isolation
from app.infrastructure.ml.model_loader import DOMAIN_ISO_CONFIG


class SklearnIsolationScoringRepository(IsolationScoringRepository):

    def available_domains(self) -> list[str]:
        return list(DOMAIN_ISO_CONFIG.keys())

    def score_history(
        self,
        domain: str,
        records: list[dict[str, Any]],
        review_score_threshold: float | None = None,
        high_risk_score_threshold: float | None = None,
    ) -> IsolationScoreResult:

        raw = score_history_isolation(
            domain=domain,
            records=records,
        )

        thresholds = raw["thresholds"]

        high = 0
        review = 0
        predictions = []

        for item in raw["results"]:
            score = item["score"]

            # 🔥 decision logic (sementara tetap di repo biar gak breaking)
            if score <= thresholds["high_risk_score_threshold"]:
                risk_label = RiskLabel("HIGH_RISK")
                manual_action = ManualAction("MANUAL_REVIEW_PRIORITY")
                high += 1
            elif score <= thresholds["review_score_threshold"]:
                risk_label = RiskLabel("REVIEW")
                manual_action = ManualAction("MANUAL_REVIEW")
                review += 1
            else:
                risk_label = RiskLabel("NORMAL")
                manual_action = ManualAction("NO_BLOCK_AUTO")

            predictions.append(
                IsolationPrediction(
                    record={},  # optional
                    anomaly_score=score,
                    is_anomaly=item["is_anomaly"],
                    risk_label=risk_label,
                    matched_patterns=item["patterns"],
                    manual_action=manual_action,
                )
            )

        summary = IsolationScoreSummary(
            high_risk=high,
            review=review,
            normal=len(predictions) - high - review,
            review_score_threshold=thresholds["review_score_threshold"],
            high_risk_score_threshold=thresholds["high_risk_score_threshold"],
        )

        return IsolationScoreResult(
            domain=raw["domain"],
            total_records=raw["total_records"],
            summary=summary,
            results=predictions,
        )