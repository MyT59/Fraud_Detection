"""
pattern_engine_service.py
=========================
Optimasi P3 + P4:
  - FraudPattern diambil dari cache (get_cached_patterns)
  - window_cache deduplicate query window per field
  - detect_pattern_location_jump: cache last_trx per user_account_id
    menggunakan request-scoped dict (bukan global cache)
  - Tidak ada db.commit() — commit di process_transaction()

FIXES:
  [BUG #1] distinct_account_count: terminal_id diambil dari trx.terminal_id
           (top-level column), bukan dari details JSON yang tidak punya field ini.
  [BUG #2] chain_decline_success_burst: cache_key kini berbasis account_number
           (issuer_account_number) agar konsisten dengan query di dalamnya.
           State machine SUCCESS juga diperbaiki: tidak break saat rc != "00",
           melainkan reset ke DECLINE agar chain multi-wave tetap terdeteksi.
  [BUG #3] tx_count untuk pattern berbasis kartu kini di-query per
           issuer_account_number, bukan per user_account_id, agar konsisten
           dengan field carding lainnya. Cache key juga diubah ke account_number.
  [BUG #4] failure_count / has_success_after_failure: cache key disamakan ke
           account_number agar tidak bertabrakan dengan key tx_count user lain.

REFACTOR — Field Registry (P5):
  Menggantikan rantai if/elif untuk static fields dengan STATIC_FIELD_REGISTRY:
  dict[field_name → resolver(trx, details)].

  Keuntungan:
    - Tambah field baru dari feature_builder cukup daftarkan 1 entry di registry,
      tanpa menyentuh logika engine sama sekali.
    - Setiap resolver bisa diuji unit test secara independen.
    - Engine loop tetap bersih — tidak tumbuh setiap sprint ML menambah fitur baru.

  Field yang masuk registry (static, sudah terkompute di transaction_details):
    Existing  : amount, service_source
    AGENUSA   : PROCESSING_CODE, RESPONSE_CODE, IS_NIGHT_TX, AMOUNT_OVER_AVG_RATIO,
                IS_DECLINED, GAP_MINUTES, dest_account_number, TERMINAL_SWITCH_FAST
    NUSABILL  : PAYMENT_GAP_MINUTES, PAYMENT_TO_BILL_RATIO, CHANNEL, CHANNEL_API_FLAG,
                PAYMENT_DELAY_DAYS, CHANNEL_SWITCH_TO_API

  Window-based fields (butuh DB query + time_window_minutes) tetap dihandle
  di blok `elif window_ms:` yang sudah ada — tidak berubah sama sekali.

  Cara menambah field baru di masa depan:
    Cukup tambahkan satu baris ke STATIC_FIELD_REGISTRY di bawah, contoh:
      "NAMA_FIELD_BARU": lambda trx, det: det.get("nama_field_baru"),
    Engine akan otomatis mengevaluasinya tanpa perubahan lain.
"""

from sqlalchemy import func, distinct
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Callable, Any

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

from app.application.services.activity_log_service import log_activity
from app.application.cache.fraud_cache import get_cached_patterns, invalidate_pattern_cache
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)

# ── Request-scoped Location Jump cache ──────────────────────────────────────
# Dict ini hidup di level module tapi di-reset per proses aggregation.
# Key: user_account_id → (city, country, transaction_time) dari last_trx
_location_cache: dict[str, tuple] = {}


def reset_location_cache():
    """
    Kosongkan location cache.
    Dipanggil di awal DataAggregationService.process_agenusa/nusabill/all()
    agar cache tidak stale antar batch run.
    """
    global _location_cache
    _location_cache.clear()
    logger.debug("[CACHE] Location jump cache reset")


# ── Static Field Registry ────────────────────────────────────────────────────
# Memetakan nama field (string) ke resolver function: (trx, details) → value.
#
# Digunakan oleh engine untuk field yang nilainya sudah tersedia secara langsung
# tanpa perlu query DB tambahan (tidak bergantung pada time_window_minutes).
#
# Konvensi resolver:
#   - Kembalikan None jika field tidak tersedia → engine akan evaluate sebagai False.
#   - Cast eksplisit (float/int) untuk field numerik agar evaluate_condition bekerja
#     benar saat membandingkan dengan target bertipe str dari JSON rules.
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │ CARA MENAMBAH FIELD BARU                                                │
# │ Daftarkan satu entry di dict ini. Engine tidak perlu disentuh.         │
# │                                                                         │
# │ Contoh field numerik dari details:                                      │
# │   "NAMA_FIELD": lambda trx, det: _to_float(det.get("nama_field")),     │
# │                                                                         │
# │ Contoh field string dari details:                                       │
# │   "NAMA_FIELD": lambda trx, det: det.get("nama_field"),                │
# │                                                                         │
# │ Contoh field dari kolom top-level trx:                                  │
# │   "NAMA_FIELD": lambda trx, det: trx.nama_kolom,                       │
# └─────────────────────────────────────────────────────────────────────────┘

def _to_float(v) -> float | None:
    """Cast nilai ke float. Kembalikan None jika None atau tidak bisa di-cast."""
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None

def _to_int(v) -> int | None:
    """Cast nilai ke int. Kembalikan None jika None atau tidak bisa di-cast."""
    if v is None:
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


# Tipe resolver: menerima (trx, details) dan mengembalikan value apapun atau None.
_FieldResolver = Callable[[Any, dict], Any]

STATIC_FIELD_REGISTRY: dict[str, _FieldResolver] = {

    # ── Existing static fields ───────────────────────────────────────────────
    "amount":          lambda trx, det: _to_float(trx.amount),
    "service_source":  lambda trx, det: trx.service_source,

    # ── AGENUSA: field dari feature_builder ─────────────────────────────────
    # Digunakan oleh pattern AI Discovery baru di PatternDiscoveryService.

    # Kode jenis transaksi ISO-8583 (e.g. "300000" = PIN change/inquiry)
    "PROCESSING_CODE":      lambda trx, det: det.get("processing_code"),

    # Response code ISO-8583 (e.g. "55" = wrong PIN, "00" = approved)
    "RESPONSE_CODE":        lambda trx, det: det.get("response_code"),

    # 1 jika transaksi terjadi antara jam 00:00–05:00, else 0
    "IS_NIGHT_TX":          lambda trx, det: _to_int(det.get("is_night_tx")),

    # Rasio amount transaksi ini terhadap rata-rata historis user
    # Contoh: 2.5 berarti 2.5x lebih besar dari rata-rata
    "AMOUNT_OVER_AVG_RATIO": lambda trx, det: _to_float(det.get("amount_over_avg_ratio")),

    # 1 jika transaksi ini ditolak (response_code != "00"), else 0
    "IS_DECLINED":          lambda trx, det: _to_int(det.get("is_declined")),

    # Selisih waktu (menit) antara transaksi ini dan transaksi sebelumnya
    # pada kartu/akun yang sama. None jika transaksi pertama.
    "GAP_MINUTES":          lambda trx, det: _to_float(det.get("gap_minutes")),

    # Rekening tujuan transfer (untuk deteksi money mule destination)
    "dest_account_number":  lambda trx, det: det.get("dest_account_number"),

    # ── NUSABILL: field dari feature_builder ────────────────────────────────
    # Digunakan oleh pattern AI Discovery baru di PatternDiscoveryService.

    # Selisih waktu (menit) antar pembayaran tagihan pada biller yang sama
    "PAYMENT_GAP_MINUTES":  lambda trx, det: _to_float(det.get("payment_gap_minutes")),

    # Rasio jumlah pembayaran terhadap nominal tagihan
    # Contoh: 0.2 berarti bayar 20% dari tagihan; 5.0 berarti 5x tagihan
    "PAYMENT_TO_BILL_RATIO": lambda trx, det: _to_float(det.get("payment_to_bill_ratio")),

    # Channel transaksi (e.g. "API", "WEB", "MOBILE", "ATM")
    "CHANNEL":              lambda trx, det: det.get("channel"),

    # 1 jika channel saat ini adalah API DAN channel sebelumnya bukan API
    # (mendeteksi sudden switch ke API — indikasi akun diambil alih via bot)
    "CHANNEL_API_FLAG":     lambda trx, det: _to_int(det.get("channel_api_flag")),

    # Selisih hari antara tanggal pembayaran dan tanggal jatuh tempo
    # Nilai negatif = bayar lebih awal dari jatuh tempo
    # Contoh: -2.0 berarti bayar 2 hari sebelum jatuh tempo
    "PAYMENT_DELAY_DAYS":   lambda trx, det: _to_float(det.get("payment_delay_days")),

    # ── AGENUSA: flag composite dari feature_builder ─────────────────────────
    # 1 jika GAP_MINUTES <= 10.0 AND terminal berbeda dari transaksi sebelumnya.
    # Menggunakan flag pre-computed dari feature_builder (bukan evaluasi ulang
    # dua kondisi terpisah) agar konsisten dengan logika deteksi di ML pipeline.
    # Disimpan ke transaction_details oleh ml_realtime_service saat snapshot processing.
    "TERMINAL_SWITCH_FAST": lambda trx, det: _to_int(det.get("terminal_switch_fast")),

    # ── NUSABILL: flag composite dari feature_builder ────────────────────────
    # 1 jika prev_channel != "API" AND current channel == "API".
    # Lebih presisi dari CHANNEL_API_FLAG karena membedakan user yang memang
    # selalu pakai API vs user yang tiba-tiba beralih ke API (indikasi ATO via bot).
    "CHANNEL_SWITCH_TO_API": lambda trx, det: _to_int(det.get("channel_switch_to_api")),
}


def evaluate_condition(value, operator, target):
    if value is None:
        return False
    try:
        if isinstance(value, (int, float)) and isinstance(target, str):
            target = float(target)

        if operator == "==":       return value == target
        elif operator == "!=":     return value != target
        elif operator == ">":      return value > target
        elif operator == "<":      return value < target
        elif operator == ">=":     return value >= target
        elif operator == "<=":     return value <= target
        elif operator == "IN":     return isinstance(target, (list, set, tuple)) and value in target
        elif operator == "NOT_IN": return isinstance(target, (list, set, tuple)) and value not in target
    except (ValueError, TypeError):
        return False
    return False


def detect_pattern_location_jump(db: Session, current_trx: Transaction) -> tuple[bool, str]:
    """
    Mendeteksi 'Pattern Location Jump' (Impossible Travel) menggunakan data GeoIP.
    """
    if not current_trx.ip_address or current_trx.country is None or current_trx.city is None:
        return False, ""

    user_id = current_trx.user_account_id

    if user_id in _location_cache:
        last_city, last_country, last_time = _location_cache[user_id]
    else:
        last_trx = db.query(Transaction).filter(
            Transaction.user_account_id == user_id,
            Transaction.id != current_trx.id,
            Transaction.country.isnot(None),
            Transaction.city.isnot(None)
        ).order_by(Transaction.transaction_time.desc()).first()

        if not last_trx:
            _location_cache[user_id] = (None, None, None)
            return False, ""

        last_city    = last_trx.city
        last_country = last_trx.country
        last_time    = last_trx.transaction_time
        _location_cache[user_id] = (last_city, last_country, last_time)

    if last_country is None or last_city is None:
        return False, ""

    t1        = current_trx.transaction_time.replace(tzinfo=None)
    t2        = last_time.replace(tzinfo=None)
    time_diff = t1 - t2

    if current_trx.country != last_country:
        if time_diff < timedelta(hours=12):
            reason = f"Impossible Travel: {last_country} to {current_trx.country} in {time_diff}"
            _location_cache[user_id] = (current_trx.city, current_trx.country, current_trx.transaction_time)
            return True, reason

    if current_trx.city != last_city and current_trx.country == last_country:
        if time_diff < timedelta(hours=1):
            reason = f"Fast City Jump: {last_city} to {current_trx.city} in {time_diff}"
            _location_cache[user_id] = (current_trx.city, current_trx.country, current_trx.transaction_time)
            return True, reason

    _location_cache[user_id] = (current_trx.city, current_trx.country, current_trx.transaction_time)
    return False, ""


@log_performance(label="PatternEngine.run_pattern_engine")
def run_pattern_engine(db, trx):
    violations  = []
    pattern_ids = []
    risk_score  = 0
    actions     = []

    if not trx.transaction_time:
        return [], [], 0, []

    patterns = get_cached_patterns(db)

    if not patterns:
        return [], [], 0, []

    window_cache = {}
    details      = trx.transaction_details or {}

    # Ambil issuer_account_number sekali, dipakai oleh banyak field di bawah
    issuer_account_number = details.get("issuer_account_number")

    for pattern in patterns:
        # [FIX #8] Filter service_source — pattern hanya berlaku untuk service-nya
        # sendiri atau ALL. Mencegah pattern NUSABILL trigger di transaksi AGENUSA.
        pattern_service = (pattern.service_source or "ALL").upper()
        trx_service     = (trx.service_source or "").upper()
        if pattern_service != "ALL" and pattern_service != trx_service:
            continue

        rules = pattern.pattern_rules or {}

        if isinstance(rules, list):
            rules = {"logic": "AND", "conditions": rules, "time_window_minutes": None}

        if not isinstance(rules, dict):
            continue

        logic      = rules.get("logic", "AND")
        conditions = rules.get("conditions", [])
        window_ms  = rules.get("time_window_minutes")
        results    = []

        for cond in conditions:
            field         = cond.get("field")
            operator      = cond.get("operator")
            target        = cond.get("value")
            current_value = None

            # ── ZONA 1: Static Field Registry ────────────────────────────────
            # Field yang nilainya sudah tersedia langsung dari trx atau details
            # tanpa perlu query DB. Resolver dipanggil dan hasilnya dievaluasi.
            #
            # Untuk menambah field baru: daftar di STATIC_FIELD_REGISTRY di atas.
            # Engine di sini tidak perlu diubah sama sekali.
            if field in STATIC_FIELD_REGISTRY:
                try:
                    current_value = STATIC_FIELD_REGISTRY[field](trx, details)
                except Exception as e:
                    logger.warning(
                        f"[PatternEngine] Resolver error field='{field}' "
                        f"pattern='{pattern.pattern_name}': {e}"
                    )
                    current_value = None

            # ── ZONA 2: Dynamic Window Features ──────────────────────────────
            # Field yang memerlukan agregasi query DB dalam time window.
            # Semua hasil di-cache di window_cache untuk deduplicate antar
            # kondisi dalam satu pattern maupun antar pattern berbeda.
            elif window_ms:
                time_thresh = trx.transaction_time - timedelta(minutes=window_ms)

                # ── tx_count ──────────────────────────────────────────────────
                # [FIX #5] tx_count sadar konteks pattern:
                # - Kalau pattern berbasis terminal (ada distinct_account_count)
                #   → hitung tx per terminal_id agar konsisten dengan Fan-In/EDC
                # - Kalau pattern berbasis kartu → hitung per issuer_account_number
                # - Fallback → hitung per user_account_id
                if field == "tx_count":
                    is_terminal_based = any(
                        c.get("field") == "distinct_account_count"
                        for c in conditions
                    )

                    if is_terminal_based and trx.terminal_id:
                        cache_key = (field, window_ms, "terminal", trx.terminal_id)
                        if cache_key not in window_cache:
                            res = db.query(func.count(Transaction.id)).filter(
                                Transaction.terminal_id == trx.terminal_id,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = res
                    elif issuer_account_number:
                        cache_key = (field, window_ms, issuer_account_number)
                        if cache_key not in window_cache:
                            res = db.query(func.count(Transaction.id)).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == issuer_account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = res
                    else:
                        # Fallback: tidak ada kartu → hitung per user
                        cache_key = (field, window_ms, trx.user_account_id)
                        if cache_key not in window_cache:
                            res = db.query(func.count(Transaction.id)).filter(
                                Transaction.user_account_id == trx.user_account_id,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = res

                # ── total_amount ───────────────────────────────────────────────
                elif field == "total_amount":
                    # [FIX #6] total_amount sadar konteks pattern:
                    # - Kalau pattern berbasis kartu (ada failure_count/has_success_after_failure)
                    #   → hitung per issuer_account_number agar akumulasi benar (Super Pattern)
                    # - Kalau pattern berbasis terminal → hitung per terminal_id
                    # - Fallback → hitung per user_account_id
                    is_card_based = any(
                        c.get("field") in ("failure_count", "has_success_after_failure")
                        for c in conditions
                    )
                    is_terminal_based = any(
                        c.get("field") == "distinct_account_count"
                        for c in conditions
                    )

                    if is_card_based and issuer_account_number:
                        cache_key = (field, window_ms, "card", issuer_account_number)
                        if cache_key not in window_cache:
                            res = db.query(func.sum(Transaction.amount)).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == issuer_account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = float(res)
                    elif is_terminal_based and trx.terminal_id:
                        cache_key = (field, window_ms, "terminal", trx.terminal_id)
                        if cache_key not in window_cache:
                            res = db.query(func.sum(Transaction.amount)).filter(
                                Transaction.terminal_id == trx.terminal_id,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = float(res)
                    else:
                        cache_key = (field, window_ms, trx.user_account_id)
                        if cache_key not in window_cache:
                            res = db.query(func.sum(Transaction.amount)).filter(
                                Transaction.user_account_id == trx.user_account_id,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = float(res)

                # ── distinct_account_count ────────────────────────────────────
                # [FIX #1] terminal_id diambil dari trx.terminal_id (kolom
                # top-level), bukan dari details JSON — map_agenusa() tidak
                # menaruh terminal_id ke dalam transaction_details.
                elif field == "distinct_account_count":
                    terminal_id = trx.terminal_id
                    cache_key   = (field, window_ms, terminal_id)
                    if cache_key not in window_cache:
                        if terminal_id:
                            res = db.query(func.count(distinct(
                                Transaction.transaction_details["issuer_account_number"].astext
                            ))).filter(
                                Transaction.terminal_id == terminal_id,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = res
                        else:
                            window_cache[cache_key] = 0

                # ── distinct_customer_count ───────────────────────────────────
                elif field == "distinct_customer_count":
                    cache_key = (field, window_ms, trx.user_account_id)
                    if cache_key not in window_cache:
                        res = db.query(func.count(distinct(
                            Transaction.transaction_details["nama_customer"].astext
                        ))).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = res

                # ── failure_count + has_success_after_failure ─────────────────
                # [FIX #4] Cache key berbasis account_number, bukan user_account_id,
                # agar tidak bertabrakan dengan key dari transaksi user lain.
                elif field in ["failure_count", "has_success_after_failure"]:
                    f_key = ("failure_count", window_ms, issuer_account_number)
                    s_key = ("has_success_after_failure", window_ms, issuer_account_number)

                    if f_key not in window_cache:
                        f_count = 0
                        s_found = False

                        if issuer_account_number:
                            # [FIX #7] limit dinaikkan 100 agar tidak kehabisan slot
                            # untuk pattern dengan banyak tx (Super Pattern = 16 tx)
                            recent_trxs = db.query(Transaction).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == issuer_account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).order_by(Transaction.transaction_time.asc()).limit(100).all()

                            last_decline_streak = 0
                            for t in recent_trxs:
                                rc = (t.transaction_details or {}).get("response_code")
                                if rc != "00":
                                    last_decline_streak += 1
                                    f_count += 1
                                else:
                                    # success setelah minimal 3 decline berturut-turut
                                    if last_decline_streak >= 3:
                                        s_found = True
                                    last_decline_streak = 0  # reset streak, lanjut iterasi

                        window_cache[f_key] = f_count
                        window_cache[s_key] = s_found

                    cache_key = f_key if field == "failure_count" else s_key

                # ── chain_decline_success_burst ────────────────────────────────
                # [FIX #2] cache_key berbasis issuer_account_number (konsisten
                # dengan query). State machine SUCCESS diperbaiki: jika ada
                # decline di tengah burst, reset ke DECLINE (bukan break) agar
                # chain multi-wave tetap bisa terdeteksi.
                elif field == "chain_decline_success_burst":
                    cache_key = (field, window_ms, issuer_account_number)
                    if cache_key not in window_cache:
                        chain_detected = False

                        if issuer_account_number:
                            recent_trxs = db.query(Transaction).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == issuer_account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).order_by(Transaction.transaction_time.asc()).all()

                            state         = "START"
                            failure_count = 0
                            burst_count   = 0

                            for t in recent_trxs:
                                rc = (t.transaction_details or {}).get("response_code")

                                if state == "START":
                                    if rc != "00":
                                        state = "DECLINE"
                                        failure_count = 1

                                elif state == "DECLINE":
                                    if rc != "00":
                                        failure_count += 1
                                    elif failure_count >= 3:
                                        # Cukup decline, masuk fase success pertama
                                        state       = "SUCCESS"
                                        burst_count = 0
                                    else:
                                        # Success tapi decline belum cukup, reset
                                        state         = "START"
                                        failure_count = 0

                                elif state == "SUCCESS":
                                    if rc == "00":
                                        burst_count += 1
                                        if burst_count >= 3:
                                            chain_detected = True
                                            break
                                    else:
                                        # Ada decline di tengah burst → reset
                                        state         = "DECLINE"
                                        failure_count = 1
                                        burst_count   = 0

                        window_cache[cache_key] = chain_detected

                else:
                    # Field window-based tidak dikenal.
                    # Pastikan cache_key terdefinisi agar current_value = None
                    # dan kondisi di-evaluate sebagai False (bukan crash).
                    cache_key = (field, window_ms, trx.user_account_id)
                    if cache_key not in window_cache:
                        logger.debug(
                            f"[PatternEngine] Window field tidak dikenal: '{field}' "
                            f"(pattern='{pattern.pattern_name}'). Dievaluasi sebagai False."
                        )
                        window_cache[cache_key] = None

                current_value = window_cache.get(cache_key)

            else:
                # ── ZONA 3: Field tidak dikenal sama sekali ───────────────────
                # Bukan static field (tidak ada di registry) dan tidak punya
                # time_window_minutes. Log warning agar mudah di-debug saat
                # ada field baru dari feature_builder yang belum didaftarkan.
                logger.warning(
                    f"[PatternEngine] Field tidak terdaftar: '{field}' "
                    f"(pattern='{pattern.pattern_name}'). "
                    f"Daftarkan di STATIC_FIELD_REGISTRY jika ini static field."
                )
                current_value = None

            # ── Evaluate hasil field ini ──────────────────────────────────────
            # Khusus boolean False: tetap di-evaluate, jangan skip hanya karena
            # "if current_value is not None" — False adalah nilai valid untuk
            # field seperti chain_decline_success_burst dan has_success_after_failure.
            if current_value is not None:
                results.append(evaluate_condition(current_value, operator, target))
            else:
                results.append(False)

        if logic == "AND":
            matched = all(results) if results else False
        elif logic == "OR":
            matched = any(results) if results else False
        else:
            matched = False

        if matched:
            violations.append({"type": "PATTERN", "name": pattern.pattern_name, "score": pattern.risk_score})
            pattern_ids.append(pattern.id)
            risk_score = max(risk_score, pattern.risk_score)

            action = str(pattern.action or "FLAG").upper()
            if action == "REVIEW":
                action = "FLAG"
            if action:
                actions.append(action)

            # ── Update hit_count di tabel fraud_patterns ──────────────────────
            try:
                db.query(FraudPattern).filter(FraudPattern.id == pattern.id).update(
                    {"hit_count": FraudPattern.hit_count + 1},
                    synchronize_session=False
                )
            except Exception as e:
                logger.warning(f"[PatternEngine] Gagal update hit_count pattern_id={pattern.id}: {e}")

            log_activity(
                db=db, admin=None,
                action_type=ActivityActionEnum.PATTERN_TRIGGERED,
                module_source=EventSourceEnum.PATTERN_ENGINE,
                severity=SeverityLevelEnum.HIGH,
                target_type="TRANSACTION",
                target_id=str(trx.original_trx_id),
                ip_address=getattr(trx, "ip_address", None),
                details={
                    "pattern_id":      pattern.id,
                    "pattern_name":    pattern.pattern_name,
                    "category":        pattern.pattern_category,
                    "action_executed": action,
                    "score_assigned":  pattern.risk_score
                }
            )

    # [FIX] Invalidate cache setelah loop selesai jika ada pattern yang matched
    # dan hit_count diupdate. Dipanggil sekali di luar loop (bukan per pattern)
    # agar tidak redundant. Cache akan di-reload fresh pada transaksi berikutnya
    # sehingga hit_count yang ditampilkan di PatternDiagnostics FE tidak stale.
    if pattern_ids:
        invalidate_pattern_cache()

    return violations, pattern_ids, risk_score, actions


def detect_suppressed_patterns(db: Session, trx: Transaction) -> list:
    """Evaluate inactive (suppressed/disabled) patterns against `trx`.

    Returns a list of pattern summary dicts for inactive patterns that
    would match this transaction. This is used to show Additional Signals
    in the UI without re-activating those patterns.
    """
    suppressed = []

    if not trx.transaction_time:
        return suppressed

    # Load inactive patterns directly from DB (do not use cached active set)
    inactive_patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == False,
        FraudPattern.is_deleted == False,
    ).all()

    if not inactive_patterns:
        return suppressed

    window_cache = {}
    details = trx.transaction_details or {}
    issuer_account_number = details.get("issuer_account_number")

    for pattern in inactive_patterns:
        # Respect service_source filter like run_pattern_engine
        pattern_service = (pattern.service_source or "ALL").upper()
        trx_service = (trx.service_source or "").upper()
        if pattern_service != "ALL" and pattern_service != trx_service:
            continue

        rules = pattern.pattern_rules or {}
        if isinstance(rules, list):
            rules = {"logic": "AND", "conditions": rules, "time_window_minutes": None}
        if not isinstance(rules, dict):
            continue

        logic = rules.get("logic", "AND")
        conditions = rules.get("conditions", [])
        window_ms = rules.get("time_window_minutes")
        results = []

        for cond in conditions:
            field = cond.get("field")
            operator = cond.get("operator")
            target = cond.get("value")
            current_value = None

            if field in STATIC_FIELD_REGISTRY:
                try:
                    current_value = STATIC_FIELD_REGISTRY[field](trx, details)
                except Exception:
                    current_value = None
            elif window_ms:
                # Reuse same window logic as engine for common fields
                time_thresh = trx.transaction_time - timedelta(minutes=window_ms)
                cache_key = (field, window_ms, getattr(trx, 'id', None))
                # For brevity reuse subset of windowed computations similar to run_pattern_engine
                if field == "tx_count":
                    if issuer_account_number:
                        cache_key = (field, window_ms, issuer_account_number)
                        if cache_key not in window_cache:
                            res = db.query(func.count(Transaction.id)).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == issuer_account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = res
                else:
                    # fallback: try a simple count per user
                    cache_key = (field, window_ms, trx.user_account_id)
                    if cache_key not in window_cache:
                        res = db.query(func.count(Transaction.id)).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = res

                current_value = window_cache.get(cache_key)
            else:
                current_value = None

            if current_value is not None:
                results.append(evaluate_condition(current_value, operator, target))
            else:
                results.append(False)

        if logic == "AND":
            matched = all(results) if results else False
        elif logic == "OR":
            matched = any(results) if results else False
        else:
            matched = False

        if matched:
            suppressed.append({
                "id": pattern.id,
                "name": pattern.pattern_name,
                "category": pattern.pattern_category,
            })

    return suppressed
