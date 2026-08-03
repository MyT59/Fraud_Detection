import asyncio
import time
import requests
import math
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
def _apply_hard_block(
    trx: Transaction,
    violations: list,
    db: Session,
    bl_score: float = None,
    rule_score: float = 0,
):
    trx.risk_score = min(100, max(100, float(bl_score or 100)))
    trx.final_status = TransactionStatusEnum.FRAUD
    trx.risk_level = "CRITICAL"

    if violations:
        trx.violation_reason = " | ".join([f"{v['type']}:{v['name']}" for v in violations])

    # Hard-blocks return before the regular finalization block. Persist a
    # complete score audit so the transaction detail page does not show blanks.
    score_breakdown = dict(trx.score_breakdown or {})
    score_breakdown.update({
        "rule_score": rule_score or 0,
        "pattern_score": 0,
        "ml_runtime_status": "QUEUED",
        "final_score": trx.risk_score,
        "rule_names": [v["name"] for v in violations if v.get("type") == "RULE"],
        "pattern_names": [],
        "pattern_ids": [],
    })

    # Preserve blacklist evidence for the transaction detail view.
    blacklist_matches = [
        {
            "blacklist_id": violation.get("blacklist_id"),
            "identifier_type": violation.get("identifier_type"),
            "value": violation.get("value"),
            "name": violation.get("name"),
        }
        for violation in violations
        if violation.get("type") == "BLACKLIST"
    ]
    if blacklist_matches:
        score_breakdown["blacklist_matches"] = blacklist_matches
    trx.score_breakdown = score_breakdown

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
    return "LOW"


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
            timeout=0.75
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
        original_trx_id = str(data.get("original_trx_id") or "").strip()
        service_source  = str(data.get("service_source") or "").strip().upper()
        user_account_id = normalize(data.get("user_account_id"))
        amount          = data.get("amount")
        transaction_details = data.get("transaction_details") or {}

        if not original_trx_id or not service_source or not user_account_id:
            raise ValueError("original_trx_id, service_source, and user_account_id are required")

        if service_source not in {"AGENUSA", "NUSABILL"}:
            raise ValueError("service_source must be AGENUSA or NUSABILL")

        is_balance_inquiry = (
            service_source == "AGENUSA"
            and str(transaction_details.get("msg_type") or "").upper() == "CEK_SALDO"
        )
        if (
            isinstance(amount, bool)
            or not isinstance(amount, (int, float))
            or not math.isfinite(float(amount))
            or amount < 0
            or (amount == 0 and not is_balance_inquiry)
        ):
            raise ValueError(
                "amount must be a positive finite number, except 0 for Agenusa CEK_SALDO"
            )

        transaction_time = data.get("transaction_time") or datetime.now(timezone.utc)
        if not isinstance(transaction_time, datetime):
            raise ValueError("transaction_time must be a datetime")
        if transaction_time.tzinfo is None:
            transaction_time = transaction_time.replace(tzinfo=timezone.utc)

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
            user_account_id    = user_account_id,
            amount             = amount,
            transaction_time   = transaction_time,
            transaction_status = data.get("transaction_status") or "INGESTED",
            final_status       = TransactionStatusEnum.FLAGGED,
            ip_address         = data.get("ip_address"),
            terminal_id        = data.get("terminal_id"),
            merchant_id        = data.get("merchant_id"),
            account_number     = data.get("account_number"),
            city               = data.get("city"),
            country            = data.get("country"),
            transaction_details= data.get("transaction_details"),
            risk_score         = 0
        )

        # ── GeoIP (cached) ───────────────────────────────────
        _tick("geoip")
        # Lokasi dari source lebih dipercaya; GeoIP hanya melengkapi field yang
        # belum tersedia agar ingest tidak terblokir network call yang sia-sia.
        if trx.ip_address and (not trx.city or not trx.country):
            city, country = enrich_geoip_location(trx.ip_address)
            if city and not trx.city:
                trx.city = city
            if country and not trx.country:
                trx.country = country
        _perf_geoip = _tock("geoip")

        # ── Location Jump ────────────────────────────────────
        is_jump, jump_reason = detect_pattern_location_jump(db, trx)
        if is_jump:
            trx.risk_level    = "HIGH"
            trx.risk_score   += 80.0
            trx.final_status  = TransactionStatusEnum.FLAGGED
            trx.violation_reason = jump_reason

        repo.create(trx)

        violations = []
        if is_jump:
            violations.append({
                "type": "PATTERN",
                "name": f"Location Jump Detected ({jump_reason})",
                "details": jump_reason,
            })

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
            return _apply_hard_block(
                trx,
                violations,
                db,
                bl_score,
                rule_score=rule_score,
            )

        # =========================
        # =========================
        # 5. PATTERN ENGINE
        # Before running pattern engine, build and persist a small set of
        # deterministic features synchronously so pattern resolvers (which
        # read `transaction.transaction_details`) can evaluate them on the
        # same request. Heavy ML scoring remains async.
        # =========================
        try:
            # lazy import to avoid pulling heavy ML libs into hot path
            from app.application.services.transaction_feature_snapshot_service import build_transaction_snapshot
            from app.infrastructure.ml.feature_builder import build_features_from_snapshot

            snapshot = build_transaction_snapshot(db, trx.id)
            if snapshot:
                features = build_features_from_snapshot(snapshot.get("transaction", {}).get("domain"), snapshot)

                # map UPPERCASE feature keys -> lower-case keys used in transaction_details
                feature_map = {
                    # Agenusa
                    "IS_NIGHT_TX": "is_night_tx",
                    "AMOUNT_OVER_AVG_RATIO": "amount_over_avg_ratio",
                    "IS_DECLINED": "is_declined",
                    "GAP_MINUTES": "gap_minutes",
                    "DEST_ACCOUNT_NUMBER": "dest_account_number",
                    "TERMINAL_SWITCH_FAST": "terminal_switch_fast",

                    # Nusabill
                    "PAYMENT_GAP_MINUTES": "payment_gap_minutes",
                    "PAYMENT_TO_BILL_RATIO": "payment_to_bill_ratio",
                    "CHANNEL": "channel",
                    "CHANNEL_API_FLAG": "channel_api_flag",
                    "PAYMENT_DELAY_DAYS": "payment_delay_days",
                    "CHANNEL_SWITCH_TO_API": "channel_switch_to_api",
                }

                existing_details = dict(trx.transaction_details or {})
                for k_src, k_dst in feature_map.items():
                    if k_src in features:
                        val = features.get(k_src)
                        # primitive types only
                        if isinstance(val, (int, float, str)) or val is None:
                            existing_details[k_dst] = val
                        else:
                            try:
                                existing_details[k_dst] = int(val)
                            except Exception:
                                existing_details[k_dst] = val

                trx.transaction_details = existing_details
        except Exception as e:
            logger.exception(f"[SYNC_FEATURE_BUILD] gagal menyimpan fitur sinkron ke transaction_details: {e}")

        _tick("pattern")
        pattern_violations, pattern_ids, pattern_score, pattern_actions = run_pattern_engine(db, trx)
        violations.extend(pattern_violations)
        _perf_pattern = _tock("pattern")

        # If pattern engine or other processors mark some patterns as
        # suppressed (e.g. {'suppressed': True} in the violation dict),
        # persist them into `transaction_details` so the frontend can show
        # Additional Signals for forensic review. This is intentionally
        # permissive: if no suppressed flags are present, nothing changes.
        try:
            suppressed = [v for v in pattern_violations if v.get("suppressed")]
            if suppressed:
                existing_details = dict(trx.transaction_details or {})
                # store full objects (if provided) and a list of ids when available
                existing_details["suppressed_patterns"] = suppressed
                existing_details["suppressed_pattern_ids"] = [
                    v.get("id") for v in suppressed if v.get("id") is not None
                ]
                trx.transaction_details = existing_details
        except Exception as e:
            logger.warning(f"[SUPPRESS] gagal menyimpan suppressed patterns: {e}")

        # Additionally, detect patterns that are currently disabled (is_active==False)
        # but would match this transaction — surface them as suppressed signals
        # for analysts without changing DB state.
        try:
            from app.application.services.pattern_engine_service import detect_suppressed_patterns

            inactive_matches = detect_suppressed_patterns(db, trx)
            if inactive_matches:
                existing_details = dict(trx.transaction_details or {})
                prev = existing_details.get("suppressed_patterns") or []
                prev_ids = set(existing_details.get("suppressed_pattern_ids") or [])

                # merge while avoiding duplicates
                for m in inactive_matches:
                    if m.get("id") not in prev_ids:
                        prev.append(m)
                        if m.get("id") is not None:
                            prev_ids.add(m.get("id"))

                existing_details["suppressed_patterns"] = prev
                existing_details["suppressed_pattern_ids"] = list(prev_ids)
                trx.transaction_details = existing_details
        except Exception as e:
            logger.warning(f"[SUPPRESS_INACTIVE] gagal mendeteksi suppressed inactive patterns: {e}")

        if isinstance(pattern_actions, str):
            pattern_actions = [pattern_actions]
        has_block_action = "BLOCK" in set((rule_actions or []) + (pattern_actions or []))

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

        # A Location Jump is a direct behavioural signal with its own risk
        # escalation. An empty rule/pattern ensemble must not downgrade it to
        # SAFE, otherwise the alert creation step is skipped.
        ensemble_status = ensemble.get("final_status", TransactionStatusEnum.SAFE)
        if ensemble_status == TransactionStatusEnum.FRAUD:
            trx.final_status = TransactionStatusEnum.FRAUD
        elif is_jump or ensemble_status == TransactionStatusEnum.FLAGGED:
            trx.final_status = TransactionStatusEnum.FLAGGED
        else:
            trx.final_status = TransactionStatusEnum.SAFE

        # =========================
        # 7. RISK ESCALATION
        # =========================
        if len(pattern_ids) >= 2:
            trx.risk_score = min(100, trx.risk_score + 10)

        if any("Super" in v["name"] or "Decline + Velocity" in v["name"] for v in violations):
            trx.risk_score = min(100, trx.risk_score + 20)

        if any("Fan-In" in v["name"] or "Syndicate" in v["name"] for v in violations):
            trx.risk_score = min(100, trx.risk_score + 10)

        if trx.risk_score >= 90 and has_block_action:
            trx.final_status = TransactionStatusEnum.FRAUD
        elif trx.risk_score >= 90 and trx.final_status != TransactionStatusEnum.FRAUD:
            trx.final_status = TransactionStatusEnum.FLAGGED

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
            "ml_runtime_status": "QUEUED",
            "final_score":   trx.risk_score,
            "pattern_names": [v["name"] for v in violations if v["type"] == "PATTERN"],
            "pattern_ids":   pattern_ids,
            "rule_names":    [v["name"] for v in violations if v["type"] == "RULE"],
        }

        # =========================
        # 9. ALERT & COMMIT
        # =========================
        _tick("alert")
        if trx.final_status in [TransactionStatusEnum.FLAGGED, TransactionStatusEnum.FRAUD]:
            create_alert(db, trx)
            log_activity(
                db=db,
                admin=None,
                action_type=ActivityActionEnum.FLAG_TRANSACTION,
                module_source=EventSourceEnum.SYSTEM,
                severity=SeverityLevelEnum.WARNING if trx.final_status == TransactionStatusEnum.FLAGGED else SeverityLevelEnum.CRITICAL,
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
            Transaction.service_source  == str(data.get("service_source") or "").strip().upper(),
            Transaction.original_trx_id == str(data.get("original_trx_id") or "").strip()
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
