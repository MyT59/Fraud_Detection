from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.application.services.report_service import ReportService
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.session import get_db
from app.infrastructure.repositories.report_repository import ReportRepository
from app.infrastructure.database.enums import (
    ActivityActionEnum,
    SeverityLevelEnum,
    EventSourceEnum,
)
from app.core.rbac import require_roles
from app.presentation.schemas.report_schema import (
    ReportGenerateRequest,
    ReportPaginatedResponse,
    ReportResponse,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


# ==========================================
# GENERATE REPORT
# ==========================================
@router.post("/generate", response_model=ReportResponse)
def generate_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")),
):
    try:
        service = ReportService(db)

        report = service.generate_report(
            report_name=payload.report_name,
            report_type=payload.report_type,
            format=payload.format,
            date_from=payload.date_from,
            date_to=payload.date_to,
            generated_by=current_admin.id,
            service_source=payload.service_source,
            final_status=payload.final_status,
            risk_level=payload.risk_level,
            user_account_id=payload.user_account_id,
            min_amount=payload.min_amount,
            max_amount=payload.max_amount,
            min_risk_score=payload.min_risk_score,
            max_risk_score=payload.max_risk_score,
            action_type=payload.action_type,
            module_source=payload.module_source,
            severity=payload.severity,
            status=payload.status,
            category=payload.category,
            blacklist_type=payload.blacklist_type,
            service_scope=payload.service_scope,
            is_active=payload.is_active,
            source=payload.source,
        )

        log_activity(
            db=db,
            admin=current_admin,
            action_type=ActivityActionEnum.REPORT_GENERATED,
            module_source=EventSourceEnum.REPORTS,
            severity=SeverityLevelEnum.INFO,
            target_type="REPORT",
            target_id=str(report.id),
            details={
                "report_name": report.report_name,
                "report_type": report.report_type.value,
                "format": report.format.value,
                "date_from": payload.date_from.strftime("%Y-%m-%d"),
                "date_to": payload.date_to.strftime("%Y-%m-%d"),
                "total_records": report.total_records,
                "filter_criteria": report.filter_criteria,
            },
        )
        db.commit()

        return report

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# REPORT HISTORY
# ==========================================
@router.get("", response_model=ReportPaginatedResponse)
def get_reports(
    report_type: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")),
):
    repo = ReportRepository(db)

    items, total = repo.get_reports(
        report_type=report_type,
        status=status,
        page=page,
        limit=limit,
    )

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items,
    }


# ==========================================
# DETAIL REPORT
# ==========================================
@router.get("/{report_id}", response_model=ReportResponse)
def get_report_detail(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")),
):
    repo = ReportRepository(db)
    report = repo.get_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return report


# ==========================================
# DOWNLOAD REPORT
# ==========================================
@router.get("/{report_id}/download")
def download_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")),
):
    repo = ReportRepository(db)
    report = repo.get_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.file_path:
        raise HTTPException(status_code=400, detail="Report file not available")

    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.REPORT_DOWNLOADED,
        module_source=EventSourceEnum.REPORTS,
        severity=SeverityLevelEnum.INFO,
        target_type="REPORT",
        target_id=str(report.id),
        details={
            "report_name": report.report_name,
            "report_type": report.report_type.value,
            "format": report.format.value,
        },
    )
    db.commit()

    return FileResponse(
        path=report.file_path,
        filename=report.file_path.split("/")[-1],
    )