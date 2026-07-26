from pathlib import Path
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.application.services.report_service import ReportService
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.session import get_db
from app.infrastructure.repositories.report_repository import ReportRepository
from app.infrastructure.storage.report_storage import ReportStorage
from app.infrastructure.database.enums import (
    ActivityActionEnum,
    SeverityLevelEnum,
    EventSourceEnum,
)
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.role_model import Role
from app.core.rbac import require_roles
from app.presentation.schemas.report_schema import (
    FraudAnalystOptionResponse,
    ReportGenerateRequest,
    ReportPaginatedResponse,
    ReportResponse,
    ReportDownloadResponse,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


# ==========================================
# GENERATE REPORT
# ==========================================
@router.post("/generate", response_model=ReportResponse)
def generate_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
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
            action_types=payload.action_types,
            module_source=payload.module_source,
            severity=payload.severity,
            status=payload.status,
            category=payload.category,
            blacklist_type=payload.blacklist_type,
            service_scope=payload.service_scope,
            is_active=payload.is_active,
            source=payload.source,
            reviewer_id=payload.reviewer_id,
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

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# REPORT HISTORY
# ==========================================
@router.get("/fraud-analysts", response_model=list[FraudAnalystOptionResponse])
def get_fraud_analysts_for_report(
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
):
    return (
        db.query(Admin)
        .join(Role, Admin.role_id == Role.id)
        .filter(
            Role.role_name == "FRAUD_ANALYST",
            Admin.is_active == True,
            Admin.is_deleted == False,
        )
        .order_by(Admin.full_name.asc())
        .all()
    )


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
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
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
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
):
    repo = ReportRepository(db)
    report = repo.get_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return report


# ==========================================
# DOWNLOAD REPORT
# ==========================================
@router.get("/{report_id}/download", response_model=ReportDownloadResponse)
def download_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
):
    repo = ReportRepository(db)
    report = repo.get_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.file_path:
        raise HTTPException(status_code=400, detail="Report file not available")

    # Cek apakah file disimpan lokal (fallback) atau di Supabase Storage
    if report.file_path.startswith("local:"):
        local_path = report.file_path.removeprefix("local:")
        if not Path(local_path).exists():
            raise HTTPException(status_code=404, detail="Report file not found on local storage")
        # Untuk file lokal, arahkan ke endpoint static-serve internal
        download_url = f"/reports/{report.id}/raw"
    else:
        download_url = ReportStorage.generate_download_url(report.file_path)

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

    return {
        "report_id": report.id,
        "report_name": report.report_name,
        "format": report.format,
        "download_url": download_url,
    }


# ==========================================
# RAW FILE SERVE (fallback lokal saja)
# ==========================================
@router.get("/{report_id}/raw")
def download_report_raw(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
):
    """Serve file lokal langsung — hanya dipakai saat Supabase tidak aktif (fallback)."""
    repo = ReportRepository(db)
    report = repo.get_by_id(report_id)

    if not report or not report.file_path or not report.file_path.startswith("local:"):
        raise HTTPException(status_code=404, detail="Local report file not found")

    local_path = report.file_path.removeprefix("local:")
    if not Path(local_path).exists():
        raise HTTPException(status_code=404, detail="Report file not found on disk")

    extension = local_path.rsplit(".", 1)[-1].lower()
    media_type_map = {
        "pdf": "application/pdf",
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }

    return FileResponse(
        path=local_path,
        filename=f"{report.report_name}.{extension}",
        media_type=media_type_map.get(extension, "application/octet-stream"),
    )


# ==========================================
# SOFT DELETE REPORT
# ==========================================
@router.delete("/{report_id}")
def delete_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
):
    repo = ReportRepository(db)
    report = repo.get_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.is_deleted = True
    report.deleted_at = datetime.now(timezone.utc)
    report.deleted_by = current_admin.id

    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.REPORT_DELETED,
        module_source=EventSourceEnum.REPORTS,
        severity=SeverityLevelEnum.WARNING,
        target_type="REPORT",
        target_id=str(report.id),
        details={
            "report_name": report.report_name,
            "reason": "Soft deleted by administrator",
        },
    )

    db.commit()
    return {"message": "Report soft deleted"}
