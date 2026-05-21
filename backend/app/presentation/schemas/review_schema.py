from pydantic import BaseModel, Field
from typing import Optional, List
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


# 🔥 TAMBAHAN PHASE 4: Request Body untuk Reopen & Override Engine
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


# 🔥 TAMBAHAN: Skema Response Performa Analis agar routes tidak error
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


# =========================================================
# 🎯 TARUHAN BARU POIN 3: METADATA PAGINASI REVIEWS HISTORY 
# =========================================================
class ReviewHistoryItem(BaseModel):
    id: int
    transaction_id: int
    alert_id: Optional[int]
    decision: str
    review_note: Optional[str]
    previous_status: Optional[str]
    final_status: str
    reviewed_by: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True  # Mendukung konversi otomatis dari objek SQLAlchemy ORM


class ReviewHistoryPaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ReviewHistoryItem]  # Kontainer utama pembungkus list data riwayat review [cite: 118]