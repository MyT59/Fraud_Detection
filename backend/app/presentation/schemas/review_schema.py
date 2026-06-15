from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, Optional, List
from enum import Enum
from datetime import datetime

class ReviewDecision(str, Enum):
    FRAUD = "FRAUD"
    SAFE = "SAFE"


class ConfidenceEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ReviewRequest(BaseModel):
    alert_id: int
    decision: ReviewDecision
    note: Optional[str] = Field(None, max_length=500)
    decision_confidence: ConfidenceEnum


class ReviewOverrideRequest(BaseModel):
    new_decision: ReviewDecision
    reason: str = Field(..., min_length=10, max_length=1000)

class FalseNegativeReportRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)

class ReviewMetricsResponse(BaseModel):
    total_reviews: int
    fraud_count: int
    safe_count: int
    fraud_confirmation_rate: float
    avg_review_duration_minutes: float
    open_alerts: int
    in_progress_alerts: int


class AnalystPerformanceResponse(BaseModel):
    analyst_id: Optional[int]
    analyst_name: Optional[str]
    analyst_email: Optional[str]
    reviews_completed: int
    avg_review_seconds: float
    fraud_detected: int


class HourlyReviewMetric(BaseModel):
    hour: str
    count: int


class DailyFraudMetric(BaseModel):
    day: str
    count: int


class DailyQueueGrowthMetric(BaseModel):
    day: str
    incoming_alerts: int
    resolved_alerts: int


class ReviewTimelineAnalyticsResponse(BaseModel):
    reviews_per_hour_24h: List[HourlyReviewMetric]
    fraud_per_day_7d: List[DailyFraudMetric]
    queue_growth_7d: List[DailyQueueGrowthMetric]


class ReviewHistoryItem(BaseModel):
    id: int
    transaction_id: int
    alert_id: Optional[int]
    decision: str
    decision_confidence: Optional[str] = None          # LOW | MEDIUM | HIGH
    review_note: Optional[str]
    previous_status: Optional[str]
    final_status: str
    reviewed_by: Optional[int] = None
    reviewer_name: Optional[str] = None                # ✅ Snapshot nama — immutable audit trail
    created_at: datetime
    review_started_at: Optional[datetime] = None       # untuk hitung durasi review
    review_completed_at: Optional[datetime] = None     # untuk hitung durasi review

    # Override info — hanya terisi jika SUPER_ADMIN/RISK_MANAGER override vonis
    is_overridden: Optional[bool] = False
    overridden_by: Optional[int] = None
    overridden_at: Optional[datetime] = None
    override_reason: Optional[str] = None

    # Snapshot transaksi saat review dilakukan — immutable, data as-of review time
    transaction_snapshot: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class ReviewHistoryPaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ReviewHistoryItem]

class MyReviewMetricsResponse(BaseModel):
    """
    Metrics personal milik analis yang sedang login.
    Berbeda dengan ReviewMetricsResponse yang bersifat global (seluruh tim).
    """
    total_reviews: int
    fraud_count: int
    safe_count: int
    fraud_confirmation_rate: float
    avg_review_duration_minutes: float
    open_alerts: int
    in_progress_alerts: int