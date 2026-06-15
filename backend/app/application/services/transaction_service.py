import asyncio
import time
import requests
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.enums import TransactionStatusEnum, ActivityActionEnum, SeverityLevelEnum, EventSourceEnum

from app.application.services.alert_service import create_alert
from app.application.services.rule_engine_service import run_rule_engine
from app.application.services.pattern_engine_service import run_pattern_engine, detect_pattern_location_jump
from app.application.services.blacklist_service import run_blacklist_check
from app.application.services.ensemble_engine_service import run_ensemble_engine
from app.application.services.activity_log_service import log_activity
from app.application.services.ml_realtime_service import process_transaction_ml_async
from app.domain.entities.target_type import TargetType
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


# =========================
# HELPER FUNCTIONS
# =========================
def normalize(value: str | None, to_lower: bool = True):
    if value is None:
        return None
    value = str(value).strip()
    return value.lower() if to_lower else value


def _enqueue_ml(db: Session, trx: Transaction):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(
                process_transaction_ml_async(transaction_id=trx.id)
            )
            logger.info(f"[ML] Async task created untuk trx {trx.id}")
        else:
            logger.warning(f"[ML] Event loop tidak aktif untuk trx {trx.id}, ML dilewati.")
    except RuntimeError as e:
        logger.warning(f"[ML] RuntimeError saat enqueue trx {trx.id}: {str(e)}")
    except Exception as e:
        logger.error(f"[ML] Gagal enqueue ML untuk trx {trx.id}: {str(e)}")


@log_performance(label="TransactionService._apply_hard_block")
def _apply_hard_block(trx: Transaction, violations: list, db: Session, bl_score: float = None):
    trx.risk_score = max(100, bl_score or 100)
    trx.final_status = TransactionStatusEnum.FRAUD
    trx.risk_level = "CRITICAL"

    if violations:
        trx.violation_reason = " | ".join([f"{v['type']}:{v['name']}" for v in violations])

    trx.is_flagged_ml = True
    create_alert(db, trx)

    log_activity(
        db=db,
        admin=None,
        action_type=ActivityActionEnum.FLAG_TRANSACTION,
        module_source=EventSourceEnum.SYSTEM,
        severity=SeverityLevelEnum.CRITICAL,
        target_type=TargetType.TRANSACTION,
        target_id=trx.id,
        details={
            "risk_score": trx.risk_score,
            "risk_level": trx.risk_level,
            "reason": "HARD_BLOCK"
        }
    )

    db.commit()
    db.refresh(trx)
    _enqueue_ml(db, trx)
    return trx


def _determine_risk_level(score: int) -> str:
    if score >= 80: return "CRITICAL"
    if score >= 60: return "HIGH"
    if score >= 40: return "MEDIUM"
    if score >= 20: return "LOW"
    return "SAFE"


# =========================
# GEOIP CACHE
# Satu IP hanya di-lookup sekali — sisanya dari cache memory.
# maxsize=10000 cukup untuk ribuan IP unik selama demo/produksi.
# =========================
@lru_cache(maxsize=10_000)
def enrich_geoip_location(ip_address: str) -> tuple[str | None, str | None]:
    """
    Terjemahkan IP ke (city, country) via ip-api.com.
    Hasil di-cache per IP — network call hanya terjadi 1× per IP unik.
    """
    if not ip_address or ip_address in ("127.0.0.1", "localhost", "0.0.0.0"):
        return None, None

    try:
        response = requests.get(
            f"http://ip-api.com/json/{ip_address}?fields=status,city,countryCode",
            timeout=2
        )
        data = response.json()
        if data.get("status") == "success":
            return data.get("city"), data.get("countryCode")
    except Exception as e:
        logger.warning(f"[GeoIP] Lookup failed for {ip_address}: {str(e)}")

    return None, None


# =========================
# MAIN PROCESS
# Catatan: fungsi ini SUDAH memiliki instrumentasi performa manual
# yang granular per-stage (_tick/_tock + logger.info [PERF]).
# @log_performance TIDAK ditambahkan di sini untuk menghindari
# duplikasi log entry pada hot path setiap transaksi.
# =========================
def process_transaction(data: dict, db: Session):
    # ── Performance tracking ──────────────────────────────────
    _t = {}
    _total_start = time.perf_counter()

    def _tick(label: str):
        _t[label] = time.perf_counter()

    def _tock(label: str) -> float:
        return round(time.perf_counter() - _t[label], 4)

    try:
        # =========================
        # 1. VALIDATION & IDEMPOTENCY
        # =========================
        original_trx_id = data.get("original_trx_id")
        service_source  = data.get("service_source").upper()
        user_account_id = data.get("user_account_id")
        amount          = data.get("amount")

        if not original_trx_id or not service_source or not user_account_id:
            raise ValueError("original_trx_id, service_source, and user_account_id are required")

        if not isinstance(amount, (int, float)):
            raise ValueError("amount must be a number")

        repo     = TransactionRepository(db)
        existing = repo.get_by_original(service_source, original_trx_id)
        if existing:
            return existing

        # =========================
        # 2. CREATE TRANSACTION
        # =========================
        trx = Transaction(
            original_trx_id    = original_trx_id,
            service_source     = service_source,
            user_account_id    = normalize(user_account_id),
            amount             = amount,
            transaction_time   = data.get("transaction_time") or datetime.now(timezone.utc),
            transaction_status = "SUCCESS",
            final_status       = TransactionStatusEnum.PENDING,
            ip_address         = data.get("ip_address"),
            terminal_id        = data.get("terminal_id"),
            merchant_id        = data.get("merchant_id"),
            account_number     = data.get("account_number"),
            transaction_details= data.get("transaction_details"),
            risk_score         = 0
        )

        # ── GeoIP (cached) ───────────────────────────────────
        _tick("geoip")
        if trx.ip_address:
            city, country = enrich_geoip_location(trx.ip_address)
            trx.city    = city
            trx.country = country
        _perf_geoip = _tock("geoip")

        # ── Location Jump ────────────────────────────────────
        is_jump, jump_reason = detect_pattern_location_jump(db, trx)
        if is_jump:
            trx.risk_level    = "HIGH"
            trx.risk_score   += 80.0
            trx.anomaly_score = 0.99
            trx.final_status  = TransactionStatusEnum.UNDER_REVIEW
            trx.violation_reason = jump_reason

        repo.create(trx)

        violations = []
        if is_jump:
            violations.append({"type": "PATTERN", "name": "Location Jump Detected", "details": jump_reason})

        # =========================
        # 3. BLACKLIST ENGINE
        # =========================
        _tick("blacklist")
        is_blacklisted, bl_violations, bl_score = run_blacklist_check(db, trx)
        violations.extend(bl_violations)
        _perf_bl = _tock("blacklist")

        if is_blacklisted:
            logger.info(
                f"[PERF] trx={original_trx_id} | GeoIP={_perf_geoip}s | "
                f"Blacklist={_perf_bl}s (HARD BLOCK)"
            )
            return _apply_hard_block(trx, violations, db, bl_score)

        # =========================
        # 4. RULE ENGINE
        # =========================
        _tick("rule")
        rule_violations, rule_score, rule_actions = run_rule_engine(db, trx)
        violations.extend(rule_violations)
        trx.violation_rule_ids = [v["rule_id"] for v in rule_violations if "rule_id" in v]
        _perf_rule = _tock("rule")

        if isinstance(rule_actions, str):
            rule_actions = [rule_actions]

        if "BLOCK" in rule_actions:
            logger.info(
                f"[PERF] trx={original_trx_id} | GeoIP={_perf_geoip}s | "
                f"Blacklist={_perf_bl}s | Rule={_perf_rule}s (RULE BLOCK)"
            )
            return _apply_hard_block(trx, violations, db, bl_score)

        # =========================
        # 5. PATTERN ENGINE
        # =========================
        _tick("pattern")
        pattern_violations, pattern_ids, pattern_score, pattern_actions = run_pattern_engine(db, trx)
        violations.extend(pattern_violations)
        _perf_pattern = _tock("pattern")

        if isinstance(pattern_actions, str):
            pattern_actions = [pattern_actions]

        # =========================
        # 6. ENSEMBLE ENGINE
        # =========================
        _tick("ensemble")
        ml_score = 0
        ensemble  = run_ensemble_engine(
            rule_score, rule_actions, pattern_score, pattern_actions, ml_score,
            pattern_violations=pattern_violations,
            transaction_id=trx.id,
        )
        trx.risk_score   = max(trx.risk_score, ensemble.get("final_score", 0))
        _perf_ensemble = _tock("ensemble")

        if trx.final_status == TransactionStatusEnum.PENDING:
            trx.final_status = ensemble.get("final_status", TransactionStatusEnum.UNDER_REVIEW)

        # =========================
        # 7. RISK ESCALATION
        # =========================
        if len(pattern_ids) >= 2:
            trx.risk_score = min(100, trx.risk_score + 10)

        if any("Super" in v["name"] or "Decline + Velocity" in v["name"] for v in violations):
            trx.risk_score = min(100, trx.risk_score + 20)

        if trx.risk_score >= 90:
            trx.final_status = TransactionStatusEnum.FRAUD

        # =========================
        # 8. FINALIZE
        # =========================
        trx.risk_level          = _determine_risk_level(trx.risk_score)
        trx.violation_pattern_ids = pattern_ids

        if violations:
            trx.violation_reason = " | ".join(
                list(dict.fromkeys([f"{v['type']}:{v['name']}" for v in violations]))
            )

        trx.score_breakdown = {
            "rule_score":    rule_score,
            "pattern_score": pattern_score,
            "ml_score":      ml_score,
            "final_score":   trx.risk_score,
            "pattern_names": [v["name"] for v in violations if v["type"] == "PATTERN"],
            "rule_names":    [v["name"] for v in violations if v["type"] == "RULE"],
        }

        # =========================
        # 9. ALERT & COMMIT
        # =========================
        _tick("alert")
        if trx.final_status in [TransactionStatusEnum.UNDER_REVIEW, TransactionStatusEnum.FRAUD]:
            trx.is_flagged_ml = True
            create_alert(db, trx)
            log_activity(
                db=db,
                admin=None,
                action_type=ActivityActionEnum.FLAG_TRANSACTION,
                module_source=EventSourceEnum.SYSTEM,
                severity=SeverityLevelEnum.WARNING if trx.final_status == TransactionStatusEnum.UNDER_REVIEW else SeverityLevelEnum.CRITICAL,
                target_type=TargetType.TRANSACTION,
                target_id=trx.id,
                details={
                    "risk_score": trx.risk_score,
                    "risk_level": trx.risk_level,
                    "final_status": str(trx.final_status)
                }
            )
        _perf_alert = _tock("alert")

        _tick("commit")
        db.commit()
        db.refresh(trx)
        _perf_commit = _tock("commit")

        # ── ML async enqueue ─────────────────────────────────
        _tick("ml_enqueue")
        _enqueue_ml(db, trx)
        _perf_ml = _tock("ml_enqueue")

        # ── Performance log ──────────────────────────────────
        _perf_total = round(time.perf_counter() - _total_start, 4)
        logger.info(
            f"[PERF] trx={original_trx_id} | "
            f"GeoIP={_perf_geoip}s | "
            f"Blacklist={_perf_bl}s | "
            f"Rule={_perf_rule}s | "
            f"Pattern={_perf_pattern}s | "
            f"Ensemble={_perf_ensemble}s | "
            f"Alert={_perf_alert}s | "
            f"Commit={_perf_commit}s | "
            f"ML_enqueue={_perf_ml}s | "
            f"Total={_perf_total}s"
        )

        return trx

    # =========================
    # ERROR HANDLING
    # =========================
    except IntegrityError:
        db.rollback()
        return db.query(Transaction).filter(
            Transaction.service_source  == data.get("service_source"),
            Transaction.original_trx_id == data.get("original_trx_id")
        ).first()

    except Exception as e:
        db.rollback()
        logger.error(
            f"Error processing transaction {data.get('original_trx_id', 'UNKNOWN')}: {str(e)}",
            exc_info=True
        )

        if 'trx' in locals() and getattr(trx, 'id', None):
            logger.info(
                f"[FDS] trx_id={trx.id} | score={getattr(trx, 'risk_score', 'N/A')} "
                f"| level={getattr(trx, 'risk_level', 'N/A')} "
                f"| status={getattr(trx, 'final_status', 'N/A')}"
            )
        else:
            logger.info("[FDS] Failed before transaction creation")

        return None