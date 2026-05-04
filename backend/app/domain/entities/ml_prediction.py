from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class RiskLabel(str, Enum):
    HIGH_RISK = "HIGH_RISK"
    REVIEW = "REVIEW"
    NORMAL = "NORMAL"


class ManualAction(str, Enum):
    MANUAL_REVIEW_PRIORITY = "MANUAL_REVIEW_PRIORITY"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    NO_BLOCK_AUTO = "NO_BLOCK_AUTO"


@dataclass(frozen=True)
class IsolationThresholds:
    review_score_threshold: float
    high_risk_score_threshold: float

    def validate(self) -> None:
        if self.review_score_threshold < self.high_risk_score_threshold:
            raise ValueError("review_score_threshold tidak boleh lebih kecil dari high_risk_score_threshold")


@dataclass(frozen=True)
class IsolationPrediction:
    record: dict[str, Any]
    anomaly_score: float
    is_anomaly: int
    risk_label: RiskLabel
    matched_patterns: list[str]
    manual_action: ManualAction

    def to_dict(self) -> dict[str, Any]:
        return {
            "record": self.record,
            "anomaly_score": self.anomaly_score,
            "is_anomaly": self.is_anomaly,
            "risk_label": self.risk_label.value,
            "matched_patterns": self.matched_patterns,
            "manual_action": self.manual_action.value,
        }


@dataclass(frozen=True)
class IsolationScoreSummary:
    high_risk: int
    review: int
    normal: int
    review_score_threshold: float
    high_risk_score_threshold: float
    default_thresholds: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "high_risk": self.high_risk,
            "review": self.review,
            "normal": self.normal,
            "review_score_threshold": self.review_score_threshold,
            "high_risk_score_threshold": self.high_risk_score_threshold,
            "default_thresholds": self.default_thresholds,
        }


@dataclass(frozen=True)
class IsolationScoreResult:
    domain: str
    total_records: int
    summary: IsolationScoreSummary
    results: list[IsolationPrediction]

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "total_records": self.total_records,
            "summary": self.summary.to_dict(),
            "results": [prediction.to_dict() for prediction in self.results],
        }
