import asyncio
import logging
import requests  # Ditambahkan untuk GeoIP Enrichment
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.enums import TransactionStatusEnum

from app.application.services.alert_service import create_alert
from app.application.services.rule_engine_service import run_rule_engine
from app.application.services.pattern_engine_service import run_pattern_engine, detect_pattern_location_jump # Pastikan fungsi ini di-import
from app.application.services.blacklist_service import run_blacklist_check
from app.application.services.ensemble_engine_service import run_ensemble_engine
from app.application.services.activity_log_service import log_activity
from app.application.services.ml_realtime_service import process_transaction_ml_async
from app.domain.entities.target_type import TargetType
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.database.models.global_rule_model import GlobalRule

logger = logging.getLogger(__name__)


# =========================
# HELPER FUNCTIONS
# =========================
def normalize(value: str | None, to_lower: bool = True):
    if value is None:
        return None
    value = str(value).strip()
    return value.lower() if to_lower else value

def _enqueue_ml(db: Session, trx: Transaction):
    """
    Memicu ML scoring sebagai async background task (non-blocking).

    ML hanya mengupdate field: anomaly_score, is_flagged_ml, score_breakdown.
    Field keputusan utama (risk_score, risk_level, final_status) TIDAK disentuh ML,
    sehingga kalau ML gagal, status transaksi tetap valid dari Rule/Pattern/Ensemble.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(
                process_transaction_ml_async(transaction_id=trx.id)
            )
            logger.info(f"[ML] Async task created untuk trx {trx.id}")
        else:
            logger.warning(
                f"[ML] Event loop tidak aktif untuk trx {trx.id}, ML dilewati. "
                f"Pastikan dipanggil dari async context FastAPI."
            )
    except RuntimeError as e:
        logger.warning(f"[ML] RuntimeError saat enqueue trx {trx.id}: {str(e)}")
    except Exception as e:
        logger.error(f"[ML] Gagal enqueue ML untuk trx {trx.id}: {str(e)}")

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
        action_type="FLAG_TRANSACTION",
        target_type=TargetType.TRANSACTION,
        target_id=trx.id,
        details=f"Risk score={trx.risk_score}, level={trx.risk_level} (HARD BLOCK)"
    )
    
    db.commit()
    db.refresh(trx)

    # Panggil helper baru
    _enqueue_ml(db, trx)
    
    return trx
    

def _determine_risk_level(score: int) -> str:
    """Mapping score ke risk level dengan lebih rapi"""
    if score >= 80: return "CRITICAL"
    if score >= 60: return "HIGH"
    if score >= 40: return "MEDIUM"
    if score >= 20: return "LOW"
    return "SAFE"

# =========================
# HELPER: GEOIP ENRICHMENT
# =========================
def enrich_geoip_location(ip_address: str) -> tuple[str, str]:
    """
    Mengubah IP Address menjadi nama Kota dan Negara menggunakan GeoIP.
    Return: (city, country)
    """
    if not ip_address or ip_address in ["127.0.0.1", "localhost", "0.0.0.0"]:
        return None, None
        
    try:
        # Menggunakan layanan gratis ip-api.com untuk Capstone
        response = requests.get(f"http://ip-api.com/json/{ip_address}?fields=status,city,countryCode", timeout=2)
        data = response.json()
        
        if data.get("status") == "success":
            return data.get("city"), data.get("countryCode")
    except Exception as e:
        logger.warning(f"GeoIP Lookup failed for IP {ip_address}: {str(e)}")
        
    return None, None


# =========================
# MAIN PROCESS
# =========================
def process_transaction(data: dict, db: Session):
    try:
        # =========================
        # 1. VALIDATION & IDEMPOTENCY
        # =========================
        original_trx_id = data.get("original_trx_id")
        service_source = data.get("service_source").upper()
        user_account_id = data.get("user_account_id")
        amount = data.get("amount")

        if not original_trx_id or not service_source or not user_account_id:
            raise ValueError("original_trx_id, service_source, and user_account_id are required")

        if not isinstance(amount, (int, float)):
            raise ValueError("amount must be a number")

        repo = TransactionRepository(db)
        existing = repo.get_by_original(service_source, original_trx_id)

        if existing:
            return existing

        # =========================
        # 2. CREATE TRANSACTION
        # =========================
        trx = Transaction(
            original_trx_id=original_trx_id,
            service_source = data.get("service_source").upper(),
            user_account_id=normalize(user_account_id),
            amount=amount,
            transaction_time=data.get("transaction_time") or datetime.now(timezone.utc),
            transaction_status="SUCCESS",
            final_status=TransactionStatusEnum.PENDING,
            ip_address=data.get("ip_address"),
            terminal_id=data.get("terminal_id"),
            merchant_id=data.get("merchant_id"),
            account_number=data.get("account_number"),
            transaction_details=data.get("transaction_details"),
            risk_score=0 # Inisialisasi awal agar bisa ditambah
        )

        # 🚀 DATA ENRICHMENT: Terjemahkan IP ke Lokasi Fisik
        if trx.ip_address:
            city, country = enrich_geoip_location(trx.ip_address)
            # Pastikan model Transaction di database memiliki kolom 'city' dan 'country'
            trx.city = city
            trx.country = country

        # 🚀 DETEKSI PATTERN LOCATION JUMP MENGGUNAKAN GEOIP
        is_jump, jump_reason = detect_pattern_location_jump(db, trx)
        
        if is_jump:
            trx.risk_level = "HIGH"
            trx.risk_score += 80.0
            
            # Pastikan model Transaction memiliki kolom 'anomaly_score' jika ingin menyimpannya
            trx.anomaly_score = 0.99 
            
            trx.final_status = TransactionStatusEnum.UNDER_REVIEW # Tahan transaksi
            
            # Catat alasan pelanggarannya
            if getattr(trx, 'violation_reason', None):
                trx.violation_reason += f" | {jump_reason}"
            else:
                trx.violation_reason = jump_reason

        repo.create(trx)

        violations = []

        # Masukkan pelanggaran Location Jump ke dalam list violations jika terjadi
        if is_jump:
            violations.append({
                "type": "PATTERN",
                "name": "Location Jump Detected",
                "details": jump_reason
            })

        # =========================
        # 3. BLACKLIST ENGINE
        # =========================
        is_blacklisted, bl_violations, bl_score = run_blacklist_check(db, trx)
        violations.extend(bl_violations)

        if is_blacklisted:
            return _apply_hard_block(trx, violations, db, bl_score)

        # =========================
        # 4. RULE ENGINE
        # =========================
        rule_violations, rule_score, rule_actions = run_rule_engine(db, trx)
        violations.extend(rule_violations)
        trx.violation_rule_ids = [
            v["rule_id"] for v in rule_violations
            if "rule_id" in v
        ]   

        if isinstance(rule_actions, str): 
            rule_actions = [rule_actions]

        if "BLOCK" in rule_actions:
            return _apply_hard_block(trx, violations, db, bl_score)

        # =========================
        # 5. PATTERN ENGINE
        # =========================
        pattern_violations, pattern_ids, pattern_score, pattern_actions = run_pattern_engine(db, trx)
        violations.extend(pattern_violations)

        if isinstance(pattern_actions, str): 
            pattern_actions = [pattern_actions]

        # =========================
        # 6. ENSEMBLE ENGINE
        # =========================
        ml_score = 0
        ensemble = run_ensemble_engine(
            rule_score, rule_actions, pattern_score, pattern_actions, ml_score
        )

        # Menggabungkan base risk_score (dari location jump) dengan ensemble score
        trx.risk_score = max(trx.risk_score, ensemble.get("final_score", 0))
        
        # Jika status belum di-override oleh Location Jump menjadi UNDER_REVIEW, gunakan hasil ensemble
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
        # 8. FINALIZE TRANSACTION DATA
        # =========================
        trx.risk_level = _determine_risk_level(trx.risk_score)
        trx.violation_pattern_ids = pattern_ids
        
        if violations:
            trx.violation_reason = " | ".join(list(dict.fromkeys([f"{v['type']}:{v['name']}" for v in violations])))

        # score_breakdown di-set di sini (setelah semua escalation)
        # agar final_score selalu mencerminkan nilai akhir yang sebenarnya
        trx.score_breakdown = {
            "rule_score": rule_score,
            "pattern_score": pattern_score,
            "ml_score": ml_score,
            "final_score": trx.risk_score,
            "pattern_names": [v["name"] for v in violations if v["type"] == "PATTERN"],
            "rule_names": [v["name"] for v in violations if v["type"] == "RULE"],
        }

        # =========================
        # 9. ALERT & COMMIT (FINAL STATE)
        # =========================
        if trx.final_status in [TransactionStatusEnum.UNDER_REVIEW, TransactionStatusEnum.FRAUD]:
            trx.is_flagged_ml = True
            create_alert(db, trx)
            
            log_activity(
                db=db,
                admin=None,
                action_type="FLAG_TRANSACTION",
                target_type=TargetType.TRANSACTION,
                target_id=trx.id,
                details=f"Risk score={trx.risk_score}, level={trx.risk_level}"
            )

        db.commit()
        db.refresh(trx)

        # =========================================================
        # ASYNC ML RUNTIME PROCESSING (Semua Transaksi)
        # =========================================================
        _enqueue_ml(db, trx)

        return trx

    # =========================
    # ERROR HANDLING
    # =========================
    except IntegrityError:
        db.rollback()
        return db.query(Transaction).filter(
            Transaction.service_source == data.get("service_source"),
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