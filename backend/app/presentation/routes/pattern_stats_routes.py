from fastapi import APIRouter

from app.application.services.pattern_analytics_service import (
    PatternStatsService
)

router = APIRouter(
    prefix="/patterns",
    tags=["Pattern Analytics"]
)


@router.get("/stats")
def get_pattern_stats():

    return (
        PatternStatsService
        .get_pattern_stats()
    )