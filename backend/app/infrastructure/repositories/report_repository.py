from uuid import UUID

from sqlalchemy.orm import Session, joinedload # <-- Diimpor di sini

from app.infrastructure.database.enums import ReportStatusEnum
from app.infrastructure.database.models.report_model import Report


class ReportRepository:

    def __init__(self, db: Session):
        self.db = db

    # ==========================================
    # CREATE
    # ==========================================

    def create(self, report: Report):
        self.db.add(report)
        self.db.flush()
        return report

    # ==========================================
    # GET BY ID
    # ==========================================

    def get_by_id(self, report_id: UUID):
        return (
            self.db.query(Report)
            .filter(
                Report.id == report_id,
                Report.is_deleted == False,
            )
            .first()
        )

    # ==========================================
    # REPORT HISTORY
    # ==========================================

    def get_reports(
        self,
        report_type=None,
        status=None,
        format=None,
        page=1,
        limit=20,
    ):
        # Menggunakan joinedload untuk eager loading relasi admin
        query = (
            self.db.query(Report)
            .options(
                joinedload(Report.generated_by_admin)
            )
            .filter(Report.is_deleted == False)
        )

        if report_type:
            query = query.filter(
                Report.report_type == report_type
            )

        if status:
            query = query.filter(
                Report.status == status
            )

        if format:
            query = query.filter(Report.format == format)

        total = query.count()

        items = (
            query
            .order_by(Report.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        return items, total

    # ==========================================
    # UPDATE
    # ==========================================

    def update(self, report: Report):
        self.db.add(report)

    # ==========================================
    # MARK PROCESSING
    # ==========================================

    def mark_processing(self, report: Report):
        report.status = ReportStatusEnum.PROCESSING

        self.db.add(report)

        return report

    # ==========================================
    # MARK COMPLETED
    # ==========================================

    def mark_completed(
        self,
        report: Report,
        file_path: str,
        total_records: int,
        completed_at,
    ):
        report.status = ReportStatusEnum.COMPLETED
        report.file_path = file_path
        report.total_records = total_records
        report.completed_at = completed_at

        self.db.add(report)

        return report

    # ==========================================
    # MARK FAILED
    # ==========================================

    def mark_failed(
        self,
        report: Report,
        error_message: str,
    ):
        report.status = ReportStatusEnum.FAILED
        report.error_message = error_message

        self.db.add(report)

        return report
