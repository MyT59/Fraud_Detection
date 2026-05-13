from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import Query 
from app.infrastructure.database.session import get_db
from app.application.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/kpi")
def get_kpi(db: Session = Depends(get_db)):
    return DashboardService.get_kpi(db)


@router.get("/transactions/trend")
def get_transaction_trend(db: Session = Depends(get_db)):
    return DashboardService.get_transaction_trend(db)


@router.get("/fraud/distribution")
def get_fraud_distribution(db: Session = Depends(get_db)):
    return DashboardService.get_fraud_distribution(db)


@router.get("/alerts/recent")
def get_recent_alerts(db: Session = Depends(get_db)):
    return DashboardService.get_recent_alerts(db)


@router.get("/patterns/top")
def get_top_patterns(db: Session = Depends(get_db)):
    return DashboardService.get_top_patterns(db)


@router.get("/alerts/trend")
def get_alert_trend(db: Session = Depends(get_db)):
    return DashboardService.get_alert_trend(db)


@router.get("/system-health")
def get_system_health(db: Session = Depends(get_db)):
    return DashboardService.get_system_health(db)


@router.get("/activity")
def get_activity(
    type: str = None,
    db: Session = Depends(get_db)
):
    return DashboardService.get_activity_timeline(db, type)

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    return {
        "kpi": DashboardService.get_kpi(db),
        "transaction_trend": DashboardService.get_transaction_trend(db),
        "fraud_distribution": DashboardService.get_fraud_distribution(db),
        "recent_alerts": DashboardService.get_recent_alerts(db),
        "top_patterns": DashboardService.get_top_patterns(db),
        "activity": DashboardService.get_activity_timeline(db),
        "system_health": DashboardService.get_system_health(db)
    }

@router.get("/transactions/trend/detail")
def get_transaction_trend_detail(
    range: str = Query("today"),
    start: str = None,
    end: str = None,
    db: Session = Depends(get_db)
):
    return DashboardService.get_transaction_trend_detail(
        db,
        range=range,
        start=start,
        end=end
    )