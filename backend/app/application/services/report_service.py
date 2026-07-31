from datetime import datetime, timezone
import json
from pathlib import Path
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.application.services.report_exporters.csv_exporter import CsvExporter
from app.application.services.report_exporters.excel_exporter import ExcelExporter
from app.application.services.report_exporters.pdf_exporter import PdfExporter
from app.infrastructure.database.enums import (
    ReportFormatEnum,
    ReportStatusEnum,
    ReportTypeEnum,
)
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.report_model import Report
from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem
from app.infrastructure.database.models.retrain_history_model import RetrainHistory
from app.infrastructure.database.models.ml_model_model import MLModel
from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.infrastructure.ml.evaluation_loader import EvaluationLoader
from app.infrastructure.repositories.report_repository import ReportRepository
from app.infrastructure.storage.report_storage import ReportStorage
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


class ReportService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = ReportRepository(db)

    # ==========================================
    # PRIVATE UTILITY HELPERS
    # ==========================================

    def _get_enum_value(self, value) -> str:
        val_str = value.value if hasattr(value, "value") else str(value)
        if "TransactionStatusEnum." in val_str:
            return val_str.replace("TransactionStatusEnum.", "")
        return val_str

    def _format_datetime(self, dt) -> str:
        if hasattr(dt, "strftime"):
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        return str(dt)

    # ==========================================
    # PUBLIC ENTRY POINT
    # ==========================================

    @log_performance
    def create_report(
        self,
        report_name: str,
        report_type: ReportTypeEnum,
        format: ReportFormatEnum,
        date_from: datetime,
        date_to: datetime,
        generated_by: int | None = None,
        service_source: str | None = None,
        final_status=None,
        risk_level=None,
        user_account_id: str | None = None,
        min_amount=None,
        max_amount=None,
        min_risk_score=None,
        max_risk_score=None,
        # Activity Log filters
        action_type: str | None = None,
        action_types: list[str] | None = None,
        module_source: str | None = None,
        severity: str | None = None,
        # Fraud Pattern filters
        status: str | None = None,
        category: str | None = None,
        # Blacklist filters
        blacklist_type: str | None = None,
        service_scope: str | None = None,
        is_active: bool | None = None,
        source: str | None = None,
        # Manual Review filters
        reviewer_id: int | None = None,
    ):
        # Menyusun dictionary kriteria filter untuk kolom JSONB
        raw_filters = {
            "service_source":  service_source,
            "final_status":    self._get_enum_value(final_status) if final_status else None,
            "risk_level":      self._get_enum_value(risk_level) if risk_level else None,
            "user_account_id": user_account_id,
            "min_amount":      float(min_amount) if min_amount else None,
            "max_amount":      float(max_amount) if max_amount else None,
            "min_risk_score":  min_risk_score,
            "max_risk_score":  max_risk_score,
            # Activity Log filters
            "action_type":     action_type,
            "action_types":    action_types,
            "module_source":   module_source,
            "severity":        severity,
            # Fraud Pattern filters
            "status":          status,
            "category":        category,
            # Blacklist filters
            "type":            blacklist_type,
            "service_scope":   service_scope,
            "is_active":       is_active,
            "source":          source,
            # Manual Review filters
            "reviewer_id":     reviewer_id,
        }
        # Bersihkan key yang bernilai None agar JSONB bersih
        filter_criteria = {k: v for k, v in raw_filters.items() if v is not None}

        # Create report row dengan filter_criteria
        report = Report(
            report_name=report_name,
            report_type=report_type,
            format=format,
            date_from=date_from,
            date_to=date_to,
            generated_by=generated_by,
            status=ReportStatusEnum.PENDING,
            filter_criteria=filter_criteria,  # Pastikan kolom ini sudah ada di model Report kamu
        )

        self.repo.create(report)
        self.db.commit()
        self.db.refresh(report)

        return report

    def process_report(self, report_id: UUID):
        """Generate an already persisted report using this service's DB session."""
        report = self.repo.get_by_id(report_id)
        if not report:
            return None

        self.repo.mark_processing(report)
        self.db.commit()

        # Dispatch
        try:
            if report.report_type == ReportTypeEnum.TRANSACTION:
                return self.generate_transaction_report(report)

            elif report.report_type == ReportTypeEnum.FRAUD_DETECTION:
                return self.generate_fraud_detection_report(report)

            elif report.report_type == ReportTypeEnum.ACTIVITY_LOG:
                return self.generate_activity_log_report(report)

            elif report.report_type == ReportTypeEnum.FRAUD_PATTERN:
                return self.generate_fraud_pattern_report(report)

            elif report.report_type == ReportTypeEnum.BLACKLIST:
                return self.generate_blacklist_report(report)

            elif report.report_type == ReportTypeEnum.ML_PERFORMANCE:
                return self.generate_ml_performance_report(report)

            elif report.report_type == ReportTypeEnum.MANUAL_REVIEW:
                return self.generate_manual_review_report(report)

            elif report.report_type == ReportTypeEnum.ALERT:
                return self.generate_alert_report(report)

            elif report.report_type == ReportTypeEnum.GLOBAL_RULE:
                return self.generate_global_rule_report(report)

            raise ValueError(f"Unsupported report type: {report.report_type}")

        except Exception as e:
            self.repo.mark_failed(report, str(e))
            self.db.commit()
            raise

    def generate_report(self, *args, **kwargs):
        """Backward-compatible synchronous API for callers outside the HTTP route."""
        report = self.create_report(*args, **kwargs)
        return self.process_report(report.id)

    # ==========================================
    # STORAGE HELPER
    # ==========================================

    def _build_local_temp_path(self, report: Report) -> str:
        """Path file sementara di local disk, sebelum di-upload ke Supabase."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        extension_map = {
            ReportFormatEnum.CSV: "csv",
            ReportFormatEnum.XLSX: "xlsx",
            ReportFormatEnum.PDF: "pdf",
        }

        extension = extension_map[report.format]
        folder = Path(f"storage/tmp_reports/{extension}")
        folder.mkdir(parents=True, exist_ok=True)

        return str(
            folder / f"{report.report_type.value.lower()}_{timestamp}_{report.id}.{extension}"
        )

    def _build_storage_path(self, report: Report) -> str:
        """Path tujuan di Supabase Storage bucket 'reports'."""
        extension_map = {
            ReportFormatEnum.CSV: "csv",
            ReportFormatEnum.XLSX: "xlsx",
            ReportFormatEnum.PDF: "pdf",
        }
        extension = extension_map[report.format]
        return f"{report.report_type.value.lower()}/{report.id}.{extension}"

    def _export_and_finalize(self, report: Report, headers, rows):
        """
        Export ke local temp file -> coba upload ke Supabase Storage.
        Jika Supabase tidak aktif/gagal, fallback ke local file storage
        (file_path diberi prefix "local:" agar route download tahu cara handle-nya).
        """
        local_path = self._build_local_temp_path(report)
        self._export(report, headers, rows, local_path)

        storage_path = self._build_storage_path(report)
        final_file_path = None

        try:
            ReportStorage.upload_report(
                local_file_path=local_path,
                storage_path=storage_path,
            )
            final_file_path = storage_path

            try:
                Path(local_path).unlink(missing_ok=True)
            except Exception:
                logger.warning(f"Gagal menghapus temp file lokal: {local_path}")

        except Exception as e:
            # Supabase tidak aktif / gagal upload -> fallback ke local storage permanen
            logger.warning(
                f"Upload ke Supabase Storage gagal ({e}). Fallback ke local storage."
            )
            permanent_local_path = self._move_to_permanent_local_storage(local_path, report)
            final_file_path = f"local:{permanent_local_path}"

        self.repo.mark_completed(
            report,
            file_path=final_file_path,
            total_records=len(rows),
            completed_at=datetime.now(timezone.utc),
        )
        self.db.commit()
        return report

    def _move_to_permanent_local_storage(self, local_temp_path: str, report: Report) -> str:
        """Pindahkan file dari folder temp ke folder permanen lokal saat Supabase tidak tersedia."""
        extension_map = {
            ReportFormatEnum.CSV: "csv",
            ReportFormatEnum.XLSX: "xlsx",
            ReportFormatEnum.PDF: "pdf",
        }
        extension = extension_map[report.format]
        folder = Path(f"storage/reports/{extension}")
        folder.mkdir(parents=True, exist_ok=True)

        permanent_path = folder / f"{report.report_type.value.lower()}_{report.id}.{extension}"
        Path(local_temp_path).replace(permanent_path)
        return str(permanent_path)

    # ==========================================
    # TRANSACTION REPORT WITH DYNAMIC FILTERING
    # ==========================================

    @log_performance
    def generate_transaction_report(self, report: Report):
        # Ambil criteria filter dari JSONB
        filters = report.filter_criteria or {}

        # Base Query dengan Filter Waktu Utama
        query = self.db.query(Transaction).filter(
            Transaction.transaction_time >= report.date_from,
            Transaction.transaction_time <= report.date_to,
        )

        # Menerapkan Filter Tambahan Secara Dinamis dari JSONB
        if filters.get("service_source"):
            query = query.filter(Transaction.service_source == filters["service_source"])

        if filters.get("final_status"):
            query = query.filter(Transaction.final_status == filters["final_status"])

        if filters.get("risk_level"):
            query = query.filter(Transaction.risk_level == filters["risk_level"])

        if filters.get("user_account_id"):
            query = query.filter(Transaction.user_account_id == filters["user_account_id"])

        if filters.get("min_amount"):
            query = query.filter(Transaction.amount >= filters["min_amount"])

        if filters.get("max_amount"):
            query = query.filter(Transaction.amount <= filters["max_amount"])

        if filters.get("min_risk_score") is not None:
            query = query.filter(Transaction.risk_score >= filters["min_risk_score"])

        if filters.get("max_risk_score") is not None:
            query = query.filter(Transaction.risk_score <= filters["max_risk_score"])

        # Execute Query
        transactions = query.order_by(Transaction.transaction_time.desc()).all()

        # Kondisional Output Kolom (9 Kolom PDF vs 15 Kolom CSV/XLSX)
        if report.format == ReportFormatEnum.PDF:
            headers = [
                "Transaction ID",
                "Original Trx ID",
                "Service Source",
                "User Account",
                "Amount",
                "Risk Score",
                "Risk Level",
                "Final Status",
                "Transaction Time",
            ]
            rows = [
                [
                    trx.id,
                    trx.original_trx_id,
                    trx.service_source,
                    trx.user_account_id,
                    f"Rp {float(trx.amount):,.2f}",
                    trx.risk_score,
                    trx.risk_level,
                    self._get_enum_value(trx.final_status),
                    self._format_datetime(trx.transaction_time),
                ]
                for trx in transactions
            ]
        else:
            headers = [
                "Transaction ID",
                "Original Trx ID",
                "Service Source",
                "User Account",
                "Amount",
                "IP Address",
                "City",
                "Country",
                "Risk Score",
                "Anomaly Score",
                "Risk Level",
                "Is Flagged ML",
                "Violation Reason",
                "Final Status",
                "Transaction Time",
            ]
            rows = [
                [
                    trx.id,
                    trx.original_trx_id,
                    trx.service_source,
                    trx.user_account_id,
                    f"Rp {float(trx.amount):,.2f}",
                    trx.ip_address or "-",
                    trx.city or "-",
                    trx.country or "-",
                    trx.risk_score,
                    trx.anomaly_score,
                    trx.risk_level,
                    "YES" if trx.is_flagged_ml else "NO",
                    trx.violation_reason or "-",
                    self._get_enum_value(trx.final_status),
                    self._format_datetime(trx.transaction_time),
                ]
                for trx in transactions
            ]

        # Generate File
        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # MANUAL REVIEW REPORT
    # ==========================================

    @log_performance
    def generate_manual_review_report(self, report: Report):
        filters = report.filter_criteria or {}

        query = self.db.query(ManualReview).filter(
            ManualReview.created_at >= report.date_from,
            ManualReview.created_at <= report.date_to,
            ManualReview.is_deleted == False,
        )

        if filters.get("reviewer_id"):
            query = query.filter(ManualReview.reviewer_id == int(filters["reviewer_id"]))

        reviews = query.order_by(ManualReview.created_at.desc()).all()

        if report.format == ReportFormatEnum.PDF:
            headers = [
                "Review ID",
                "Transaction ID",
                "Alert ID",
                "Reviewer",
                "Decision",
                "Confidence",
                "Final Status",
                "Reviewed At",
            ]
            rows = [
                [
                    review.id,
                    review.transaction_id,
                    review.alert_id or "-",
                    review.reviewer_name or (review.admin.full_name if review.admin else "-"),
                    self._get_enum_value(review.decision),
                    review.decision_confidence or "-",
                    self._get_enum_value(review.final_status),
                    self._format_datetime(review.created_at),
                ]
                for review in reviews
            ]
        else:
            headers = [
                "Review ID",
                "Transaction ID",
                "Alert ID",
                "Reviewer ID",
                "Reviewer Name",
                "Reviewer Email",
                "Decision",
                "Confidence",
                "Previous Status",
                "Final Status",
                "Review Note",
                "Started At",
                "Completed At",
                "Reviewed At",
                "Overridden",
                "Override Reason",
            ]
            rows = [
                [
                    review.id,
                    review.transaction_id,
                    review.alert_id or "-",
                    review.reviewer_id or "-",
                    review.reviewer_name or (review.admin.full_name if review.admin else "-"),
                    review.admin.email if review.admin else "-",
                    self._get_enum_value(review.decision),
                    review.decision_confidence or "-",
                    review.previous_status or "-",
                    self._get_enum_value(review.final_status),
                    review.review_note or "-",
                    self._format_datetime(review.review_started_at) if review.review_started_at else "-",
                    self._format_datetime(review.review_completed_at) if review.review_completed_at else "-",
                    self._format_datetime(review.created_at),
                    "YES" if review.is_overridden else "NO",
                    review.override_reason or "-",
                ]
                for review in reviews
            ]

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # FRAUD DETECTION REPORT
    # ==========================================

    @log_performance
    def generate_fraud_detection_report(self, report: Report):
        filters = report.filter_criteria or {}
        service_source = filters.get("service_source")

        # Base filter waktu
        def base_q(model):
            q = self.db.query(func.count(model.id))
            if hasattr(model, "transaction_time"):
                q = q.filter(
                    model.transaction_time >= report.date_from,
                    model.transaction_time <= report.date_to,
                )
            return q

        def trx_q():
            q = self.db.query(func.count(Transaction.id)).filter(
                Transaction.transaction_time >= report.date_from,
                Transaction.transaction_time <= report.date_to,
            )
            if service_source:
                q = q.filter(Transaction.service_source == service_source)
            return q

        total_transactions = trx_q().scalar() or 0
        total_fraud = trx_q().filter(Transaction.final_status == "FRAUD").scalar() or 0
        total_safe  = trx_q().filter(Transaction.final_status == "SAFE").scalar() or 0
        total_review = trx_q().filter(
            Transaction.final_status.in_(["FLAGGED", "PENDING", "UNDER_REVIEW"])
        ).scalar() or 0
        alert_query = self.db.query(func.count(FraudAlert.id)).join(
            Transaction, FraudAlert.transaction_id == Transaction.id
        ).filter(
            FraudAlert.created_at >= report.date_from,
            FraudAlert.created_at <= report.date_to,
        )
        review_query = self.db.query(func.count(ManualReview.id)).join(
            Transaction, ManualReview.transaction_id == Transaction.id
        ).filter(
            ManualReview.created_at >= report.date_from,
            ManualReview.created_at <= report.date_to,
            ManualReview.is_deleted == False,
        )
        if service_source:
            alert_query = alert_query.filter(Transaction.service_source == service_source)
            review_query = review_query.filter(Transaction.service_source == service_source)

        total_alerts = alert_query.scalar() or 0
        total_reviews = review_query.scalar() or 0

        fraud_rate = round((total_fraud / total_transactions * 100) if total_transactions else 0, 2)

        patterns_query = (
            self.db.query(FraudPattern)
            .filter(
                FraudPattern.is_deleted == False,
                FraudPattern.created_at >= report.date_from,
                FraudPattern.created_at <= report.date_to,
            )
        )
        if service_source:
            patterns_query = patterns_query.filter(FraudPattern.service_source == service_source)
        patterns = (
            patterns_query
            .order_by(FraudPattern.hit_count.desc())
            .limit(10)
            .all()
        )

        headers = ["Metric", "Value"]
        rows = [
            ["Period",             f"{report.date_from.strftime('%Y-%m-%d')} s/d {report.date_to.strftime('%Y-%m-%d')}"],
            ["Service Source",     service_source or "ALL"],
            ["", ""],
            ["Total Transactions", total_transactions],
            ["Total Fraud",        total_fraud],
            ["Total Safe",         total_safe],
            ["Total Flagged",      total_review],
            ["Fraud Rate (%)",     fraud_rate],
            ["Total Alerts",       total_alerts],
            ["Total Reviews",      total_reviews],
            ["", ""],
            ["Top 10 Patterns Created in Period", "Hit Count"],
        ]

        for pattern in patterns:
            rows.append([pattern.pattern_name, pattern.hit_count or 0])

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # FRAUD PATTERN REPORT
    # ==========================================

    @log_performance
    def generate_fraud_pattern_report(self, report: Report):
        filters = report.filter_criteria or {}

        query = self.db.query(FraudPattern).filter(
            FraudPattern.is_deleted == False,
            FraudPattern.created_at >= report.date_from,
            FraudPattern.created_at <= report.date_to,
        )

        # Filter opsional
        if filters.get("risk_level"):
            # Map risk_level FE (high/medium/low) ke risk_score range
            risk_ranges = {
                "high":   (75, 100),
                "medium": (45, 74),
                "low":    (0,  44),
            }
            r = risk_ranges.get(filters["risk_level"].lower())
            if r:
                query = query.filter(
                    FraudPattern.risk_score >= r[0],
                    FraudPattern.risk_score <= r[1],
                )

        if filters.get("status") == "active":
            query = query.filter(FraudPattern.is_active == True)
        elif filters.get("status") == "inactive":
            query = query.filter(FraudPattern.is_active == False)

        if filters.get("category"):
            query = query.filter(
                FraudPattern.pattern_category == filters["category"].upper()
            )

        patterns = query.order_by(FraudPattern.hit_count.desc()).all()

        def risk_label(score):
            if score >= 75: return "High"
            if score >= 45: return "Medium"
            return "Low"

        def fmt_loss(avg):
            if not avg: return "0 Rb"
            juta = avg / 1_000_000
            if juta >= 1: return f"{juta:.1f} Jt"
            return f"{avg / 1_000:.0f} Rb"

        if report.format == ReportFormatEnum.PDF:
            headers = [
                "ID", "Pattern Name", "Category", "Risk",
                "Status", "Detections", "Accuracy", "False Pos.",
                "Avg Loss (IDR)", "Action",
            ]
            rows = [
                [
                    p.id,
                    p.pattern_name,
                    p.pattern_category or "-",
                    risk_label(p.risk_score or 0),
                    "Active" if p.is_active else "Inactive",
                    p.hit_count or 0,
                    f"{round((p.accuracy_score or 0) * 100 if (p.accuracy_score or 0) <= 1 else (p.accuracy_score or 0), 1)}%",
                    f"{round((p.false_positive_rate or 0) * 100 if (p.false_positive_rate or 0) <= 1 else (p.false_positive_rate or 0), 1)}%",
                    fmt_loss(p.avg_amount if hasattr(p, 'avg_amount') else None),
                    p.action or "-",
                ]
                for p in patterns
            ]
        else:
            headers = [
                "ID", "Pattern Name", "Category", "Risk Level", "Risk Score",
                "Status", "Action", "Service Source",
                "Detections", "Accuracy (%)", "False Positive Rate (%)",
                "Avg Loss (IDR)", "Last Updated",
            ]
            rows = [
                [
                    p.id,
                    p.pattern_name,
                    p.pattern_category or "-",
                    risk_label(p.risk_score or 0),
                    p.risk_score or 0,
                    "Active" if p.is_active else "Inactive",
                    p.action or "-",
                    p.service_source or "ALL",
                    p.hit_count or 0,
                    round((p.accuracy_score or 0) * 100 if (p.accuracy_score or 0) <= 1 else (p.accuracy_score or 0), 1),
                    round((p.false_positive_rate or 0) * 100 if (p.false_positive_rate or 0) <= 1 else (p.false_positive_rate or 0), 1),
                    fmt_loss(p.avg_amount if hasattr(p, 'avg_amount') else None),
                    self._format_datetime(p.updated_at) if hasattr(p, 'updated_at') and p.updated_at else "-",
                ]
                for p in patterns
            ]

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # GLOBAL RULE CONFIGURATION REPORT
    # ==========================================

    @log_performance
    def generate_global_rule_report(self, report: Report):
        """Export Global Rule configuration and its current runtime effectiveness."""
        filters = report.filter_criteria or {}
        # This is a configuration snapshot. Do not hide an active rule merely
        # because it was created outside an arbitrary reporting period.
        query = self.db.query(GlobalRule).filter(GlobalRule.is_deleted == False)

        if filters.get("service_scope"):
            query = query.filter(GlobalRule.service_scope == filters["service_scope"])

        if filters.get("is_active") is not None:
            query = query.filter(GlobalRule.is_active == filters["is_active"])

        rules = query.order_by(
            GlobalRule.priority.desc(),
            GlobalRule.rule_name.asc(),
        ).all()

        headers = [
            "ID", "Rule Name", "Rule Key", "Service Scope", "Status",
            "Action", "Severity", "Priority", "Rule Group", "Hit Count",
            "Conditions", "Description", "Created At", "Last Updated",
        ]
        rows = [
            [
                rule.id,
                rule.rule_name,
                rule.rule_key,
                rule.service_scope or "ALL",
                "Active" if rule.is_active else "Inactive",
                rule.action or "-",
                rule.severity or "-",
                rule.priority or 0,
                rule.rule_group or "-",
                rule.hit_count or 0,
                json.dumps(rule.rule_config, ensure_ascii=False)
                if rule.rule_config else "-",
                rule.description or "-",
                self._format_datetime(rule.created_at) if rule.created_at else "-",
                self._format_datetime(rule.updated_at) if rule.updated_at else "-",
            ]
            for rule in rules
        ]

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # ALERT REPORT
    # ==========================================

    @log_performance
    def generate_alert_report(self, report: Report):
        filters = report.filter_criteria or {}
        query = self.db.query(FraudAlert).join(Transaction).filter(
            FraudAlert.created_at >= report.date_from,
            FraudAlert.created_at <= report.date_to,
        )
        if filters.get("service_source"):
            query = query.filter(Transaction.service_source == filters["service_source"])

        alerts = query.order_by(FraudAlert.created_at.desc()).all()
        headers = (
            ["Alert ID", "Transaction ID", "Type", "Severity", "Status", "Created At"]
            if report.format == ReportFormatEnum.PDF
            else [
                "Alert ID", "Transaction ID", "Service Source", "Type", "Severity",
                "Priority", "Status", "Title", "Message", "Created At", "Resolved At",
            ]
        )
        rows = []
        for alert in alerts:
            common = [
                alert.id,
                alert.transaction_id,
                alert.alert_type,
                alert.severity,
                self._get_enum_value(alert.status),
            ]
            if report.format == ReportFormatEnum.PDF:
                rows.append(common + [self._format_datetime(alert.created_at)])
            else:
                rows.append([
                    alert.id,
                    alert.transaction_id,
                    alert.transaction.service_source if alert.transaction else "-",
                    alert.alert_type,
                    alert.severity,
                    alert.priority if alert.priority is not None else "-",
                    self._get_enum_value(alert.status),
                    alert.title or "-",
                    alert.message or "-",
                    self._format_datetime(alert.created_at),
                    self._format_datetime(alert.resolved_at) if alert.resolved_at else "-",
                ])
        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # ML PERFORMANCE REPORT
    # ==========================================

    @log_performance
    def generate_ml_performance_report(self, report: Report):
        eval_data = EvaluationLoader.load_isolation_evaluation() or {}
        domains = eval_data.get("domains", {})
        generated_at = eval_data.get("generated_at_utc", "-")

        headers = ["Metric", "Value"]
        rows = [
            ["Evaluation Generated At (UTC)", generated_at],
            ["", ""],
        ]

        # ==========================================
        # 1. MODEL PERFORMANCE SUMMARY
        # ==========================================
        rows.append(["=== 1. MODEL PERFORMANCE SUMMARY ===", ""])

        for domain_name, d in domains.items():
            meta = d.get("training_metadata", {})
            thresholds = meta.get("thresholds", {})
            ev = d.get("evaluation", {})
            review_boundary = ev.get("review_threshold_boundary", {})

            # Versi model aktif dari DB
            active_model = (
                self.db.query(MLModel)
                .filter(MLModel.target_service == domain_name, MLModel.is_active == True)
                .order_by(MLModel.created_at.desc())
                .first()
            )

            rows.append([f"--- {domain_name.upper()} ---", ""])
            rows.append(["Active Model Version", active_model.version_name if active_model else "-"])
            rows.append(["Model Created At", self._format_datetime(active_model.created_at) if active_model else "-"])
            rows.append(["Dataset Size", d.get("dataset_size", "-")])
            rows.append(["Anomaly Count (default)", d.get("anomaly_count_at_default", "-")])
            rows.append(["Anomaly Rate", f"{(d.get('anomaly_rate', 0) or 0) * 100:.1f}%"])
            rows.append(["Contamination Rate", meta.get("contamination", "-")])
            rows.append(["Review Score Threshold", thresholds.get("review_score_threshold", "-")])
            rows.append(["High-Risk Score Threshold", thresholds.get("high_risk_score_threshold", "-")])
            rows.append(["Predictions at Review Boundary", review_boundary.get("predictions", "-")])
            rows.append(["Numeric Features Count", len(meta.get("numeric_features", []))])
            rows.append(["Categorical Features Count", len(meta.get("categorical_features", []))])
            rows.append(["Numeric Features", ", ".join(meta.get("numeric_features", []))])
            rows.append(["Categorical Features", ", ".join(meta.get("categorical_features", []))])
            rows.append(["", ""])

        # ==========================================
        # 2. RETRAIN HISTORY (filtered by periode)
        # ==========================================
        rh_query = self.db.query(RetrainHistory).filter(
            RetrainHistory.execution_time >= report.date_from,
            RetrainHistory.execution_time <= report.date_to,
        )
        rh_list = rh_query.order_by(RetrainHistory.execution_time.desc()).all()

        total_retrain = len(rh_list)
        success_retrain = sum(1 for h in rh_list if h.status == "SUCCESS")
        total_anomalies = sum(h.anomalies_found or 0 for h in rh_list)
        total_patterns = sum(h.new_patterns_count or 0 for h in rh_list)
        success_rate = round((success_retrain / total_retrain * 100) if total_retrain else 0, 2)

        # Feedback records used & records trained — dari log_details JSONB
        total_feedback_used = 0
        total_records_trained = 0
        records_with_total = 0
        records_with_feedback = 0
        trigger_counts = {}
        for h in rh_list:
            ld = h.log_details or {}
            if ld.get("total_records") is not None:
                total_records_trained += ld.get("total_records", 0) or 0
                records_with_total += 1
            if ld.get("feedback_records_used") is not None:
                total_feedback_used += ld.get("feedback_records_used", 0) or 0
                records_with_feedback += 1
            trig = h.trigger_source or "unknown"
            trigger_counts[trig] = trigger_counts.get(trig, 0) + 1

        rows.append([
            "=== 2. RETRAIN HISTORY ===",
            f"Periode: {report.date_from.strftime('%Y-%m-%d')} s/d {report.date_to.strftime('%Y-%m-%d')}",
        ])
        rows.append(["Total Retrain Executions", total_retrain])
        rows.append(["Successful Retrains", success_retrain])
        rows.append(["Retrain Success Rate (%)", success_rate])
        rows.append([
            "Total Records Trained (cumulative)",
            f"{total_records_trained}" + (f" (dari {records_with_total}/{total_retrain} eksekusi yang punya data ini)" if records_with_total < total_retrain else ""),
        ])
        rows.append([
            "Total Feedback Records Used (cumulative)",
            f"{total_feedback_used}" + (f" (dari {records_with_feedback}/{total_retrain} eksekusi yang punya data ini)" if records_with_feedback < total_retrain else ""),
        ])
        rows.append(["Total Anomalies Found (cumulative)", total_anomalies])
        rows.append(["Total New Patterns Discovered (cumulative)", total_patterns])
        rows.append(["", ""])

        rows.append(["Trigger Type Breakdown", ""])
        if trigger_counts:
            for trig, cnt in trigger_counts.items():
                rows.append([f"  - {trig}", cnt])
        else:
            rows.append(["  (tidak ada retrain pada periode ini)", ""])
        rows.append(["", ""])

        # Per-retrain detail (limit 10 terbaru biar tidak terlalu panjang)
        rows.append(["Recent Retrain Executions (max 10)", ""])
        rows.append(["  Execution Time | Trigger | Status | Records | Feedback Used | New Patterns", ""])
        for h in rh_list[:10]:
            ld = h.log_details or {}
            records_val = ld.get("total_records")
            feedback_val = ld.get("feedback_records_used")
            rows.append([
                f"  {self._format_datetime(h.execution_time)} | {h.trigger_source or '-'} | {h.status or '-'}",
                f"records={records_val if records_val is not None else 'n/a'}, "
                f"feedback={feedback_val if feedback_val is not None else 'n/a'}, "
                f"anomalies={h.anomalies_found or 0}, patterns={h.new_patterns_count or 0}",
            ])
        rows.append(["", ""])

        # ==========================================
        # 3. PATTERN DISCOVERY
        # ==========================================
        rows.append(["=== 3. PATTERN DISCOVERY ===", ""])

        top_patterns = (
            self.db.query(FraudPattern)
            .order_by(FraudPattern.hit_count.desc())
            .limit(10)
            .all()
        )

        rows.append(["Top 10 Patterns | Category | Risk Score | Hit Count", ""])
        for p in top_patterns:
            rows.append([
                f"  {p.pattern_name}",
                f"category={p.pattern_category or '-'}, risk_score={p.risk_score or 0}, hits={p.hit_count or 0}",
            ])
        rows.append(["", ""])

        total_patterns_db = self.db.query(func.count(FraudPattern.id)).scalar() or 0
        active_patterns_db = (
            self.db.query(func.count(FraudPattern.id))
            .filter(FraudPattern.is_active == True)
            .scalar() or 0
        )
        rows.append(["Total Patterns in System", total_patterns_db])
        rows.append(["Active Patterns", active_patterns_db])
        rows.append(["", ""])

        # ==========================================
        # 4. FRAUD DETECTION EFFECTIVENESS
        # ==========================================
        rows.append([
            "=== 4. FRAUD DETECTION EFFECTIVENESS ===",
            f"Periode: {report.date_from.strftime('%Y-%m-%d')} s/d {report.date_to.strftime('%Y-%m-%d')}",
        ])

        for domain_name, d in domains.items():
            total_trx = (
                self.db.query(func.count(Transaction.id))
                .filter(
                    Transaction.service_source == domain_name.upper(),
                    Transaction.transaction_time >= report.date_from,
                    Transaction.transaction_time <= report.date_to,
                )
                .scalar() or 0
            )
            fraud_trx = (
                self.db.query(func.count(Transaction.id))
                .filter(
                    Transaction.service_source == domain_name.upper(),
                    Transaction.final_status == "FRAUD",
                    Transaction.transaction_time >= report.date_from,
                    Transaction.transaction_time <= report.date_to,
                )
                .scalar() or 0
            )
            actual_fraud_rate = round((fraud_trx / total_trx * 100) if total_trx else 0, 2)
            model_anomaly_rate = round((d.get("anomaly_rate", 0) or 0) * 100, 2)

            rows.append([f"--- {domain_name.upper()} ---", ""])
            rows.append(["Total Transactions Processed", total_trx])
            rows.append(["Actual Fraud Count", fraud_trx])
            rows.append(["Actual Fraud Rate (%)", actual_fraud_rate])
            rows.append(["Model Anomaly Rate (%)", model_anomaly_rate])
            rows.append([
                "Anomaly Rate vs Actual Fraud Rate Gap",
                f"{round(model_anomaly_rate - actual_fraud_rate, 2)} pp "
                f"({'model lebih sensitif' if model_anomaly_rate > actual_fraud_rate else 'model kurang sensitif' if model_anomaly_rate < actual_fraud_rate else 'sejalan'})",
            ])
            rows.append(["", ""])

        rows.append(["Total New Patterns Generated (all retrains, periode ini)", total_patterns])
        rows.append(["", ""])

        # ==========================================
        # CATATAN
        # ==========================================
        rows.append(["=== CATATAN ===", ""])
        rows.append([
            "Akurasi Model",
            "Tidak tersedia — dataset training bersifat unlabeled (tanpa kolom IS_FRAUD), "
            "sehingga metrik Precision, Recall, dan F1-Score tidak dapat dihitung.",
        ])
        rows.append([
            "Metode Evaluasi",
            "Berbasis threshold boundary dari hasil training (Isolation Forest), bukan validasi terhadap ground truth.",
        ])
        rows.append([
            "Anomaly Rate vs Fraud Rate",
            "Perbandingan ini bersifat indikatif — anomaly rate adalah parameter model (contamination), "
            "sedangkan fraud rate adalah hasil keputusan final (rule engine + pattern + ML + review analis).",
        ])

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # BLACKLIST REPORT
    # ==========================================

    @log_performance
    def generate_blacklist_report(self, report: Report):
        filters = report.filter_criteria or {}

        query = self.db.query(BlacklistItem).filter(
            BlacklistItem.is_deleted == False,
            BlacklistItem.created_at >= report.date_from,
            BlacklistItem.created_at <= report.date_to,
        )

        if filters.get("type"):
            query = query.filter(BlacklistItem.type == filters["type"])

        if filters.get("service_scope"):
            query = query.filter(BlacklistItem.service_scope == filters["service_scope"])

        if filters.get("is_active") is not None:
            query = query.filter(BlacklistItem.is_active == filters["is_active"])

        if filters.get("status"):
            query = query.filter(BlacklistItem.status == filters["status"])

        if filters.get("source"):
            query = query.filter(BlacklistItem.source == filters["source"])

        items = query.order_by(BlacklistItem.hit_count.desc()).all()

        if report.format == ReportFormatEnum.PDF:
            headers = [
                "ID", "Type", "Value", "Service Scope",
                "Status", "Active", "Hit Count", "Reason",
            ]
            rows = [
                [
                    item.id,
                    item.type.value if hasattr(item.type, "value") else str(item.type),
                    item.value,
                    item.service_scope or "ALL",
                    item.status or "-",
                    "Yes" if item.is_active else "No",
                    item.hit_count or 0,
                    (item.reason or "-")[:80],  # truncate untuk PDF
                ]
                for item in items
            ]
        else:
            headers = [
                "ID", "Type", "Value", "Service Scope",
                "Status", "Is Active", "Source",
                "Hit Count", "Reason", "Review Note",
                "Added By", "Created At", "Updated At",
            ]
            rows = [
                [
                    item.id,
                    item.type.value if hasattr(item.type, "value") else str(item.type),
                    item.value,
                    item.service_scope or "ALL",
                    item.status or "-",
                    "YES" if item.is_active else "NO",
                    item.source or "MANUAL",
                    item.hit_count or 0,
                    item.reason or "-",
                    item.review_note or "-",
                    item.admin.full_name if item.admin else "-",
                    self._format_datetime(item.created_at),
                    self._format_datetime(item.updated_at),
                ]
                for item in items
            ]

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # ACTIVITY LOG REPORT
    # ==========================================

    @log_performance
    def generate_activity_log_report(self, report: Report):
        filters = report.filter_criteria or {}

        query = (
            self.db.query(ActivityLog)
            .outerjoin(Admin, ActivityLog.admin_id == Admin.id)
            .filter(
                ActivityLog.created_at >= report.date_from,
                ActivityLog.created_at <= report.date_to,
            )
        )

        # Filter opsional dari filter_criteria
        action_types = filters.get("action_types") or (
            [filters["action_type"]] if filters.get("action_type") else []
        )
        if action_types:
            query = query.filter(ActivityLog.action_type.in_(action_types))

        if filters.get("module_source"):
            query = query.filter(ActivityLog.module_source == filters["module_source"])

        SEVERITY_ORDER = ["INFO", "WARNING", "HIGH", "CRITICAL"]
        if filters.get("severity"):
            min_idx = SEVERITY_ORDER.index(filters["severity"]) if filters["severity"] in SEVERITY_ORDER else 0
            allowed = SEVERITY_ORDER[min_idx:]
            query = query.filter(ActivityLog.severity.in_(allowed))

        logs = query.order_by(ActivityLog.created_at.desc()).all()

        if report.format == ReportFormatEnum.PDF:
            headers = [
                "ID",
                "Tanggal",
                "Action Type",
                "Module",
                "Severity",
                "Admin",
                "Target Type",
                "Target ID",
            ]
            rows = [
                [
                    log.id,
                    self._format_datetime(log.created_at),
                    log.action_type,
                    log.module_source or "-",
                    log.severity or "-",
                    log.admin.full_name if log.admin else "System",
                    log.target_type or "-",
                    log.target_id or "-",
                ]
                for log in logs
            ]
        else:
            headers = [
                "ID",
                "Tanggal",
                "Action Type",
                "Module Source",
                "Severity",
                "Admin Name",
                "Admin Email",
                "Target Type",
                "Target ID",
                "IP Address",
                "Device",
                "Browser",
                "Details",
            ]
            rows = [
                [
                    log.id,
                    self._format_datetime(log.created_at),
                    log.action_type,
                    log.module_source or "-",
                    log.severity or "-",
                    log.admin.full_name if log.admin else "System",
                    log.admin.email if log.admin else "-",
                    log.target_type or "-",
                    log.target_id or "-",
                    log.ip_address or "-",
                    log.device or "-",
                    log.browser or "-",
                    str(log.details) if log.details else "-",
                ]
                for log in logs
            ]

        return self._export_and_finalize(report, headers, rows)

    # ==========================================
    # EXPORT DISPATCHER
    # ==========================================

    def _export(self, report: Report, headers, rows, file_path):
        if report.format == ReportFormatEnum.CSV:
            CsvExporter.export(headers=headers, rows=rows, output_path=file_path)
        elif report.format == ReportFormatEnum.XLSX:
            ExcelExporter.export(headers=headers, rows=rows, output_path=file_path)
        elif report.format == ReportFormatEnum.PDF:
            PdfExporter.export(title=report.report_name, headers=headers, rows=rows, output_path=file_path)
        else:
            raise ValueError(f"Unsupported format: {report.format}")
