"""
simulator_service.py
--------------------
Business logic untuk semua fitur simulator:
  - Live simulation (scenario generator, background task)
  - Manual input single (Agenusa & Nusabill)
  - Bulk input (Agenusa & Nusabill) dengan delay & stop_on_error
  - Scenario injection anomali
  - Replay transaksi (clone + re-process)
  - Reset / cleanup data simulasi
"""

import asyncio
import random
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.infrastructure.database.session import SessionLocal
from app.infrastructure.repositories.switching_log_repository import SwitchingLogRepository
from app.infrastructure.repositories.invoice_transaction_repository import InvoiceTransactionRepository
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.application.mappers.agenusa_mapper import map_agenusa
from app.application.mappers.nusabill_mapper import map_nusabill
from app.application.services.transaction_service import process_transaction

from simulator.agenusa_generator import get_all_scenarios as agenusa_scenarios
from simulator.nusabill_generator import get_all_scenarios as nusabill_scenarios, _to_db as nusabill_to_db

# ============================================================
# GLOBAL STATE
# ============================================================
SIMULATION_STATE = {
    "is_running": False,
    "last_status": "IDLE",
    "last_error": None,
    "processed": 0,
    "total": 0,
}
_simulation_lock = threading.Lock()


# ============================================================
# LIVE SIMULATION (existing — tidak diubah)
# ============================================================

async def run_live_simulation(domain: str, scenario: str | None):
    """Business logic untuk menjalankan simulasi secara live di background."""
    db = SessionLocal()

    try:
        sw_repo  = SwitchingLogRepository(db)
        inv_repo = InvoiceTransactionRepository(db)

        all_records = []

        if domain in ["agenusa", "all"]:
            scen = agenusa_scenarios()
            txs  = scen[scenario] if scenario and scenario in scen else [t for l in scen.values() for t in l]
            all_records.extend([{"src": "agenusa", "data": t} for t in txs])

        if domain in ["nusabill", "all"]:
            scen = nusabill_scenarios()
            txs  = scen[scenario] if scenario and scenario in scen else [t for l in scen.values() for t in l]
            all_records.extend([{"src": "nusabill", "data": t} for t in txs])

        def extract_timestamp(item):
            if item["src"] == "agenusa":
                return item["data"]["timestamp_db"]
            return item["data"]["tanggal_tagihan"]

        all_records.sort(key=extract_timestamp)
        with _simulation_lock:
            SIMULATION_STATE["total"] = len(all_records)

        print(f"🚀 Memulai live simulation untuk {len(all_records)} transaksi...")

        for item in all_records:
            if not SIMULATION_STATE["is_running"]:
                print("🛑 Live Simulation dihentikan oleh user.")
                break

            if item["src"] == "agenusa":
                # `city` dan `country` dibutuhkan oleh mapper untuk membentuk
                # Transaction, tetapi bukan kolom pada tabel switching_logs.
                # Jangan mengubah payload sumber karena payload yang sama dipakai
                # lagi tepat di bawah saat proses mapping.
                source_data = item["data"]
                switching_data = {
                    key: value
                    for key, value in source_data.items()
                    if key not in {"city", "country"}
                }
                log = sw_repo.create(switching_data)
                # Map the generator payload, not the ORM row. It preserves the
                # timezone-aware timestamp instead of relying on a database
                # driver's representation of DateTime values.
                trx = process_transaction(map_agenusa(source_data), db)
                if trx:
                    sw_repo.mark_processed(log.id)
            else:
                raw_data = item["data"]
                log = inv_repo.create(nusabill_to_db(raw_data))
                # Keep the source payload for mapping so both `channel` and
                # timezone-aware bill/payment timestamps survive persistence.
                trx = process_transaction(map_nusabill(raw_data), db)
                if trx:
                    inv_repo.mark_processed(log.id)

            with _simulation_lock:
                SIMULATION_STATE["processed"] += 1

            await asyncio.sleep(random.uniform(0.2, 0.5))

        print("✅ Live simulation selesai.")

        with _simulation_lock:
            if SIMULATION_STATE["is_running"]:
                SIMULATION_STATE["last_status"] = "COMPLETED"

    except Exception as e:
        with _simulation_lock:
            SIMULATION_STATE["last_status"] = "FAILED"
            SIMULATION_STATE["last_error"] = str(e)
        print(f"❌ Error pada live simulation: {e}")
    finally:
        with _simulation_lock:
            SIMULATION_STATE["is_running"] = False
        db.close()


def reserve_simulation_service() -> bool:
    """Atomically reserve the only live-simulation slot before task scheduling."""
    with _simulation_lock:
        if SIMULATION_STATE["is_running"]:
            return False
        SIMULATION_STATE.update(
            is_running=True,
            last_status="RUNNING",
            last_error=None,
            processed=0,
            total=0,
        )
        return True


def stop_simulation_service() -> bool:
    with _simulation_lock:
        if not SIMULATION_STATE["is_running"]:
            return False
        SIMULATION_STATE["is_running"] = False
        SIMULATION_STATE["last_status"] = "STOPPED"
        return True


def get_simulation_status_service() -> dict:
    with _simulation_lock:
        return dict(SIMULATION_STATE)


# ============================================================
# ANOMALY INJECTION HELPERS
# ============================================================

# IP ranges luar negeri untuk simulasi FOREIGN_IP
_FOREIGN_IP_POOLS = [
    "203.0.113.",   # TEST-NET-3 (RFC 5737) — aman untuk simulasi
    "198.51.100.",  # TEST-NET-2
    "192.0.2.",     # TEST-NET-1
]

_CITIES = [
    "Surabaya", "Medan", "Bandung", "Makassar",
    "Semarang", "Palembang", "Balikpapan", "Denpasar",
]
_AGENUSA_ANOMALIES = {"HIGH_AMOUNT", "UNUSUAL_HOUR", "RAPID_FIRE", "FOREIGN_IP", "DIFF_CITY"}
_NUSABILL_ANOMALIES = {"HIGH_AMOUNT", "UNUSUAL_HOUR", "RAPID_FIRE", "UNDERPAYMENT", "OVERPAYMENT", "FOREIGN_IP"}


def _response_value(value):
    """Ubah nilai payload menjadi bentuk aman untuk response JSON."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _build_anomaly_changes(before: dict, after: dict) -> dict:
    """Field yang benar-benar berubah setelah anomaly diterapkan."""
    return {
        key: {
            "before": _response_value(before.get(key)),
            "after": _response_value(after.get(key)),
        }
        for key in sorted(set(before) | set(after))
        if before.get(key) != after.get(key)
    }


def _apply_anomaly_agenusa(payload: dict, anomaly: str) -> dict:
    """
    Mutasi payload Agenusa sesuai jenis anomali.
    Return payload yang sudah dimodifikasi (copy, tidak mutasi in-place).
    """
    if anomaly not in _AGENUSA_ANOMALIES:
        raise ValueError(f"Anomaly '{anomaly}' tidak didukung untuk Agenusa.")
    p = payload.copy()

    if anomaly == "HIGH_AMOUNT":
        p["amount"] = float(random.randint(50_000_000, 500_000_000))

    elif anomaly == "UNUSUAL_HOUR":
        # Paksa jam ke 01:00–04:00 WIB (UTC+7 → UTC: 18:00–21:00 prev day)
        base: datetime = p.get("timestamp_db") or datetime.now(timezone.utc)
        unusual_hour_utc = random.randint(18, 20)   # 01–03 WIB
        p["timestamp_db"] = base.replace(hour=unusual_hour_utc, minute=random.randint(0, 59))

    elif anomaly == "RAPID_FIRE":
        # Untuk single: tidak ada yang perlu diubah — efek RAPID_FIRE muncul
        # dari kombinasi banyak transaksi berurutan cepat (delay_ms=0 di bulk).
        # Di sini cukup pastikan timestamp = sekarang agar terdeteksi velocity.
        p["timestamp_db"] = datetime.now(timezone.utc)

    elif anomaly == "FOREIGN_IP":
        prefix = random.choice(_FOREIGN_IP_POOLS)
        p["ip_address"] = f"{prefix}{random.randint(1, 254)}"
        # TEST-NET tidak memiliki lokasi GeoIP nyata; tandai eksplisit sebagai
        # lokasi luar negeri simulasi agar tidak mewarisi Jakarta/ID.
        p["city"] = "Simulated Foreign"
        p["country"] = "US"

    elif anomaly == "DIFF_CITY":
        p["city"] = random.choice(_CITIES)

    return p


def _apply_anomaly_nusabill(payload: dict, anomaly: str) -> dict:
    """
    Mutasi payload Nusabill sesuai jenis anomali.
    """
    if anomaly not in _NUSABILL_ANOMALIES:
        raise ValueError(f"Anomaly '{anomaly}' tidak didukung untuk Nusabill.")
    p = payload.copy()

    if anomaly == "HIGH_AMOUNT":
        spike = float(random.randint(50_000_000, 500_000_000))
        p["total_tagihan"]  = spike
        p["payment_amount"] = spike

    elif anomaly == "UNDERPAYMENT":
        total = float(p.get("total_tagihan", 1_000_000))
        p["payment_amount"] = round(total * 0.5, 2)   # bayar 50%

    elif anomaly == "OVERPAYMENT":
        total = float(p.get("total_tagihan", 1_000_000))
        p["payment_amount"] = round(total * 1.5, 2)   # bayar 150%

    elif anomaly == "UNUSUAL_HOUR":
        base: datetime = p.get("tanggal_tagihan") or datetime.now(timezone.utc)
        unusual_hour_utc = random.randint(18, 20)
        p["tanggal_tagihan"]    = base.replace(hour=unusual_hour_utc, minute=random.randint(0, 59))
        p["tanggal_pembayaran"] = p["tanggal_tagihan"]

    elif anomaly == "RAPID_FIRE":
        p["tanggal_tagihan"]    = datetime.now(timezone.utc)
        p["tanggal_pembayaran"] = p["tanggal_tagihan"]

    elif anomaly == "FOREIGN_IP":
        prefix = random.choice(_FOREIGN_IP_POOLS)
        p["ip_address"] = f"{prefix}{random.randint(1, 254)}"
        p["city"] = "Simulated Foreign"
        p["country"] = "US"

    return p


# ============================================================
# MANUAL INPUT — SINGLE AGENUSA
# ============================================================

def _normalize_agenusa_transaction_semantics(payload: dict) -> dict:
    """Keep simulator payloads aligned with Agenusa transaction semantics."""
    msg_type = str(payload.get("msg_type") or "TRANSFER").upper()
    payload["msg_type"] = msg_type
    if msg_type != "TRANSFER":
        payload["dest_account_number"] = None
        payload["dest_bank_code"] = None
    if msg_type == "CEK_SALDO":
        payload["amount"] = 0
    return payload


async def manual_input_agenusa(payload: dict, db: Session) -> dict:
    """
    Flow: inject anomali (jika ada) → switching_logs → map → transactions_feed → ML.
    """
    from app.application.services.pattern_engine_service import reset_location_cache
    reset_location_cache()

    anomaly = payload.pop("inject_anomaly", None)
    payload_before_anomaly = payload.copy()
    if anomaly:
        payload = _apply_anomaly_agenusa(payload, anomaly)
    payload = _normalize_agenusa_transaction_semantics(payload)
    anomaly_changes = _build_anomaly_changes(payload_before_anomaly, payload)

    # city/country bukan kolom switching_logs, tetapi tetap diperlukan mapper.
    city = payload.pop("city", None)
    country = payload.pop("country", None)

    sw_repo = SwitchingLogRepository(db)
    raw_log = sw_repo.create(payload)

    # `timestamp_db` sent by the frontend is aware UTC (derived from a WIB
    # input). Mapping the ORM row can lose that offset in some DB drivers and
    # makes the displayed time appear seven hours earlier.
    normalized = map_agenusa({**payload, "city": city, "country": country})
    trx = process_transaction(normalized, db)

    if not trx:
        raise ValueError(
            f"Transaksi Agenusa RRN={payload.get('rrn')} gagal — kemungkinan duplikat."
        )

    sw_repo.mark_processed(raw_log.id)

    return {
        "raw_id":          raw_log.id,
        "transaction_id":  trx.id,
        "original_trx_id": trx.original_trx_id,
        "service_source":  trx.service_source,
        "amount":          float(trx.amount),
        "transaction_time": trx.transaction_time.isoformat() if trx.transaction_time else None,
        "risk_score":      trx.risk_score,
        "risk_level":      trx.risk_level,
        "final_status":    trx.final_status.value if trx.final_status else "FLAGGED",
        "anomaly_injected": anomaly,
        "anomaly_changes": anomaly_changes,
        "ml_triggered":    True,
    }


# ============================================================
# MANUAL INPUT — SINGLE NUSABILL
# ============================================================

async def manual_input_nusabill(payload: dict, db: Session) -> dict:
    """
    Flow: inject anomali (jika ada) → invoice_transactions → map → transactions_feed → ML.
    """
    from app.application.services.pattern_engine_service import reset_location_cache
    reset_location_cache()

    anomaly = payload.pop("inject_anomaly", None)
    payload_before_anomaly = payload.copy()
    if anomaly:
        payload = _apply_anomaly_nusabill(payload, anomaly)
    anomaly_changes = _build_anomaly_changes(payload_before_anomaly, payload)

    # Field berikut bukan kolom invoice_transactions. Channel adalah feature
    # mapper, sementara city/country adalah hasil resolusi IP yang hanya
    # disimpan pada canonical transaction untuk kebutuhan audit.
    channel = payload.pop("channel", "API")
    city = payload.pop("city", None)
    country = payload.pop("country", None)

    inv_repo    = InvoiceTransactionRepository(db)
    raw_invoice = inv_repo.create(payload)

    normalized = map_nusabill({
        **payload,
        "channel": channel,
        "city": city,
        "country": country,
    })
    trx = process_transaction(normalized, db)

    if not trx:
        raise ValueError(
            f"Transaksi Nusabill no_invoice={payload.get('no_invoice')} gagal — kemungkinan duplikat."
        )

    inv_repo.mark_processed(raw_invoice.id)

    return {
        "raw_id":          raw_invoice.id,
        "transaction_id":  trx.id,
        "original_trx_id": trx.original_trx_id,
        "service_source":  trx.service_source,
        "amount":          float(trx.amount),
        "transaction_time": trx.transaction_time.isoformat() if trx.transaction_time else None,
        "risk_score":      trx.risk_score,
        "risk_level":      trx.risk_level,
        "final_status":    trx.final_status.value if trx.final_status else "FLAGGED",
        "anomaly_injected": anomaly,
        "anomaly_changes": anomaly_changes,
        "ml_triggered":    True,
    }


# ============================================================
# BULK INPUT — AGENUSA
# ============================================================

async def bulk_input_agenusa(
    transactions: list[dict],
    delay_ms: int,
    stop_on_error: bool,
    db: Session,
) -> dict:
    """
    Proses list transaksi Agenusa satu per satu dengan delay antar transaksi.
    Setiap item sudah berupa dict (dari AgenusaManualInput.model_dump()).
    """
    results      = []
    succeeded    = 0
    failed       = 0
    skipped      = 0
    delay_sec    = delay_ms / 1000

    for i, payload in enumerate(transactions):
        try:
            result = await manual_input_agenusa(payload, db)
            result["index"] = i
            results.append({"index": i, "status": "success", "data": result})
            succeeded += 1
        except Exception as e:
            results.append({"index": i, "status": "failed", "error": str(e)})
            failed += 1
            if stop_on_error:
                skipped = len(transactions) - i - 1
                break

        if delay_sec > 0 and i < len(transactions) - 1:
            await asyncio.sleep(delay_sec)

    return {
        "total":      len(transactions),
        "succeeded":  succeeded,
        "failed":     failed,
        "skipped":    skipped,
        "results":    results,
    }


# ============================================================
# BULK INPUT — NUSABILL
# ============================================================

async def bulk_input_nusabill(
    transactions: list[dict],
    delay_ms: int,
    stop_on_error: bool,
    db: Session,
) -> dict:
    """
    Proses list transaksi Nusabill satu per satu dengan delay antar transaksi.
    """
    results   = []
    succeeded = 0
    failed    = 0
    skipped   = 0
    delay_sec = delay_ms / 1000

    for i, payload in enumerate(transactions):
        try:
            result = await manual_input_nusabill(payload, db)
            result["index"] = i
            results.append({"index": i, "status": "success", "data": result})
            succeeded += 1
        except Exception as e:
            results.append({"index": i, "status": "failed", "error": str(e)})
            failed += 1
            if stop_on_error:
                skipped = len(transactions) - i - 1
                break

        if delay_sec > 0 and i < len(transactions) - 1:
            await asyncio.sleep(delay_sec)

    return {
        "total":     len(transactions),
        "succeeded": succeeded,
        "failed":    failed,
        "skipped":   skipped,
        "results":   results,
    }


# ============================================================
# REPLAY TRANSAKSI
# ============================================================

async def replay_transaction(
    transaction_id: int,
    override_amount: Optional[float],
    override_timestamp: Optional[datetime],
    inject_anomaly: Optional[str],
    db: Session,
) -> dict:
    """
    Clone transaksi dari transactions_feed, generate ID baru,
    apply override / anomali, lalu re-process full pipeline.

    Cara kerja:
      1. Fetch transaksi original dari transactions_feed
      2. Tentukan service_source (AGENUSA / NUSABILL)
      3. Buat payload raw dari transaction_details + field utama
      4. Apply override & anomali
      5. Jalankan manual_input_agenusa / manual_input_nusabill
    """
    import uuid as _uuid

    trx_repo = TransactionRepository(db)
    original  = trx_repo.get_by_id(transaction_id)

    if not original:
        raise ValueError(f"Transaksi ID={transaction_id} tidak ditemukan di transactions_feed.")

    source  = (original.service_source or "").upper()
    details = original.transaction_details or {}

    # ── Build raw payload dari data original ──────────────────

    if source == "AGENUSA":
        payload = {
            # Generate ID baru agar tidak duplikat
            "rrn":                  _gen_rrn(),
            "amount":               override_amount or float(original.amount),
            "timestamp_db":         override_timestamp or datetime.now(timezone.utc),
            "msg_type":             details.get("msg_type") or "TRANSFER",
            "mti":                  details.get("mti"),
            "processing_code":      details.get("processing_code"),
            "response_code":        details.get("response_code", "00"),
            "stan":                 details.get("stan"),
            "account_number":       original.account_number or f"9{_uuid.uuid4().int % 10**14:014d}",
            "dest_account_number":  details.get("dest_account_number"),
            "customer_ref_number":  original.user_account_id,
            "issuer_bank":          details.get("issuer_bank", "BCA"),
            "dest_bank_code":       details.get("dest_bank_code"),
            "acquirer_code":        details.get("acquirer_code", "AGENUSA"),
            "terminal_id":          original.terminal_id or f"TRM-{_uuid.uuid4().hex[:6].upper()}",
            "merchant_id":          original.merchant_id or f"MRC-{_uuid.uuid4().hex[:6].upper()}",
            "ip_address":           original.ip_address or "127.0.0.1",
            "city":                 original.city or "Jakarta",
            "country":              original.country or "ID",
            "fep_id":               details.get("fep_id"),
            "de7":                  details.get("de7"),
            "de12":                 details.get("de12"),
            "de13":                 details.get("de13"),
            "msg_raw":              details.get("msg_raw"),
            "issuer_account_number": details.get("issuer_account_number"),
            "inject_anomaly":       inject_anomaly,
        }
        result = await manual_input_agenusa(payload, db)

    elif source == "NUSABILL":
        total_tagihan = override_amount or float(original.amount)
        payload = {
            "no_invoice":       _gen_invoice(),
            "customer_id":      original.user_account_id,
            "nama_customer":    details.get("nama_customer", "Replay Customer"),
            "total_tagihan":    total_tagihan,
            "payment_amount":   total_tagihan,
            "tanggal_tagihan":  override_timestamp or datetime.now(timezone.utc),
            "tanggal_pembayaran": override_timestamp or datetime.now(timezone.utc),
            "kode_pembayaran":  details.get("kode_pembayaran"),
            "sof":              details.get("sof", "VA_BANK"),
            "channel":          details.get("channel", "API"),
            "biaya_admin":      details.get("biaya_admin", 0),
            "status_tagihan":   details.get("status_tagihan", "LUNAS"),
            "status_akhir":     details.get("status_akhir", "SUKSES"),
            "keterangan":       f"[REPLAY dari trx_id={transaction_id}]",
            "ip_address":       original.ip_address or "127.0.0.1",
            "utc_reference":    details.get("utc_reference"),
            "inject_anomaly":   inject_anomaly,
        }
        result = await manual_input_nusabill(payload, db)

    else:
        raise ValueError(f"service_source '{source}' tidak dikenali untuk replay.")

    result["replayed_from"] = transaction_id
    return result


# ============================================================
# RESET / CLEANUP
# ============================================================

def reset_simulator_data(target: str, db: Session) -> dict:
    """
    Hapus data simulasi dari table yang ditentukan oleh `target`.

    target options:
      'all'               → switching_logs + invoice_transactions + transactions_feed
      'agenusa'           → switching_logs + baris AGENUSA di transactions_feed
      'nusabill'          → invoice_transactions + baris NUSABILL di transactions_feed
      'transactions_feed' → hanya transactions_feed (semua service_source)

    Return dict berisi jumlah baris yang dihapus per table.
    """
    deleted = {
        "switching_logs":        0,
        "invoice_transactions":  0,
        "transactions_feed":     0,
    }

    try:
        if target in ("all", "agenusa"):
            result = db.execute(text("DELETE FROM switching_logs"))
            deleted["switching_logs"] = result.rowcount

        if target in ("all", "nusabill"):
            result = db.execute(text("DELETE FROM invoice_transactions"))
            deleted["invoice_transactions"] = result.rowcount

        if target == "all":
            result = db.execute(text("DELETE FROM transactions_feed"))
            deleted["transactions_feed"] = result.rowcount

        elif target == "agenusa":
            result = db.execute(
                text("DELETE FROM transactions_feed WHERE service_source = 'AGENUSA'")
            )
            deleted["transactions_feed"] = result.rowcount

        elif target == "nusabill":
            result = db.execute(
                text("DELETE FROM transactions_feed WHERE service_source = 'NUSABILL'")
            )
            deleted["transactions_feed"] = result.rowcount

        elif target == "transactions_feed":
            result = db.execute(text("DELETE FROM transactions_feed"))
            deleted["transactions_feed"] = result.rowcount

        db.commit()

    except Exception as e:
        db.rollback()
        raise RuntimeError(f"Reset gagal: {e}")

    return deleted


# ── helper alias (dipanggil dari schema helpers) ──────────────
def _gen_rrn() -> str:
    return str(random.randint(100_000_000_000, 999_999_999_999))

def _gen_invoice() -> str:
    import uuid as _uuid
    ts     = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = _uuid.uuid4().hex[:6].upper()
    return f"INV-{ts}-{suffix}"
