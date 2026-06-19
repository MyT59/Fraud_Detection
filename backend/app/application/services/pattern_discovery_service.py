"""
pattern_discovery_service.py
=============================
Mengekstrak pola fraud dari hasil prediksi ML (anomaly_df) dan menyimpannya
ke tabel fraud_patterns via save_generated_patterns().

FIX — Key "target" → "value":
  Semua kondisi di _FEATURE_PATTERN_MAP sebelumnya memakai key "target",
  sedangkan pattern_engine_service.py membaca cond.get("value") dan
  pattern_learning_service.py juga memakai "value".
  Akibatnya semua pattern AI Discovery selalu evaluate sebagai False
  meski sudah aktif di DB — tidak pernah trigger sama sekali.
  Fix: seragamkan ke "value" agar konsisten dengan engine dan learning service.

FIX — TERMINAL_SWITCH_FAST rules: GAP_MINUTES → flag 0/1:
  Sebelumnya rules hanya cek GAP_MINUTES <= 10.0 — tidak cukup, karena transaksi
  cepat di terminal yang sama bukan impossible travel. Feature_builder sudah
  menghitung flag composite TERMINAL_SWITCH_FAST (1 jika gap <= 10 menit AND
  terminal berbeda dari sebelumnya). Pattern discovery kini memakai flag itu
  langsung agar semantik deteksinya konsisten dengan ML pipeline, dan false
  positive rate-nya jauh lebih rendah.
"""

import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict, Any

# Import fungsi andalanmu untuk simpan pattern ke DB (sudah handle rules_hash & dedup)
from app.application.services.pattern_learning_service import save_generated_patterns
from app.core.logging import get_logger, log_performance
from app.infrastructure.database.enums import PatternSourceEnum

logger = get_logger(__name__)

class PatternDiscoveryService:
    def __init__(self):
        # Mapping fitur ML ke format JSON ruleset yang dimengerti oleh `pattern_engine_service.py`
        self._FEATURE_PATTERN_MAP = {
            "agenusa": {
                "IS_BRUTE_PATTERN": {
                    "name": "AI Discovery: Brute Force PIN",
                    "category": "BRUTE_FORCE",
                    "rules": [
                        {"field": "PROCESSING_CODE", "operator": "==", "value": "300000"},
                        {"field": "RESPONSE_CODE", "operator": "==", "value": "55"}
                    ],
                    "risk_score": 85
                },
                "MIDNIGHT_AMOUNT_SPIKE": {
                    "name": "AI Discovery: Midnight Amount Spike",
                    "category": "UNUSUAL_TIME",
                    "rules": [
                        {"field": "IS_NIGHT_TX", "operator": "==", "value": 1},
                        {"field": "AMOUNT_OVER_AVG_RATIO", "operator": ">=", "value": 2.0}
                    ],
                    "risk_score": 75
                },
                "RAPID_RETRY_DECLINED": {
                    "name": "AI Discovery: Rapid Retry Declined",
                    "category": "VELOCITY",
                    "rules": [
                        {"field": "IS_DECLINED", "operator": "==", "value": 1},
                        {"field": "GAP_MINUTES", "operator": "<=", "value": 2.0}
                    ],
                    "risk_score": 80
                },
                # [NEW] IS_MONEY_MULE_DEST
                # feature_builder: current_tx.dest_account_number == "DST999999"
                # Transaksi ke rekening tujuan yang teridentifikasi sebagai money mule.
                # risk_score 90 karena ini indikator kuat fraud terorganisir.
                "IS_MONEY_MULE_DEST": {
                    "name": "AI Discovery: Money Mule Destination",
                    "category": "NETWORK_FAN_OUT",
                    "rules": [
                        {"field": "dest_account_number", "operator": "==", "value": "DST999999"}
                    ],
                    "risk_score": 90
                },
                # [NEW] TERMINAL_SWITCH_FAST
                # feature_builder: GAP_MINUTES <= 10.0 AND terminal berbeda dari sebelumnya.
                # Flag composite ini sudah dihitung oleh feature_builder — lebih akurat
                # daripada hanya cek GAP_MINUTES karena transaksi cepat di terminal
                # yang sama bukan indikasi impossible travel / card cloning.
                # False positive rate jauh lebih rendah dibanding cek GAP_MINUTES saja.
                "TERMINAL_SWITCH_FAST": {
                    "name": "AI Discovery: Fast Terminal Switch",
                    "category": "LOCATION",
                    "rules": [
                        {"field": "TERMINAL_SWITCH_FAST", "operator": "==", "value": 1}
                    ],
                    "risk_score": 80
                },
                # [NEW] IS_HIGH_AMOUNT_PATTERN
                # feature_builder: AMOUNT_OVER_AVG_RATIO >= 8.0
                # Amount transaksi >= 8x rata-rata historis — spike ekstrem.
                "IS_HIGH_AMOUNT_PATTERN": {
                    "name": "AI Discovery: Extreme Amount Spike",
                    "category": "AMOUNT_ANOMALY",
                    "rules": [
                        {"field": "AMOUNT_OVER_AVG_RATIO", "operator": ">=", "value": 8.0}
                    ],
                    "risk_score": 80
                },
            },
            "nusabill": {
                "BURST_FLAG": {
                    "name": "AI Discovery: Burst Payment",
                    "category": "BURST_ATTACK",
                    "rules": [
                        {"field": "PAYMENT_GAP_MINUTES", "operator": "<=", "value": 5.0}
                    ],
                    "risk_score": 80
                },
                "HIGH_SPIKE_FLAG": {
                    "name": "AI Discovery: Unusual High Payment",
                    "category": "AMOUNT_ANOMALY",
                    "rules": [
                        {"field": "PAYMENT_TO_BILL_RATIO", "operator": ">", "value": 4.0}
                    ],
                    "risk_score": 70
                },
                # [NEW] UNDERPAY_FLAG
                # feature_builder: PAYMENT_TO_BILL_RATIO < 0.3
                # Pembayaran kurang dari 30% tagihan — indikasi manipulasi nominal pembayaran.
                "UNDERPAY_FLAG": {
                    "name": "AI Discovery: Underpayment Anomaly",
                    "category": "AMOUNT_ANOMALY",
                    "rules": [
                        {"field": "PAYMENT_TO_BILL_RATIO", "operator": "<", "value": 0.3}
                    ],
                    "risk_score": 70
                },
                # [NEW] CHANNEL_SWITCH_TO_API
                # feature_builder: prev_channel != "API" AND current channel == "API"
                # Tiba-tiba switch ke channel API setelah sebelumnya pakai channel lain
                # — indikasi akun diambil alih dan diakses via script/bot.
                # Memakai flag CHANNEL_SWITCH_TO_API yang sudah dihitung feature_builder
                # (bukan CHANNEL_API_FLAG yang hanya cek current channel == "API").
                # CHANNEL_API_FLAG tidak membedakan user yang memang selalu pakai API
                # vs user yang tiba-tiba beralih ke API — false positive rate tinggi.
                "CHANNEL_SWITCH_TO_API": {
                    "name": "AI Discovery: Sudden Channel Switch to API",
                    "category": "BEHAVIORAL",
                    "rules": [
                        {"field": "CHANNEL_SWITCH_TO_API", "operator": "==", "value": 1}
                    ],
                    "risk_score": 75
                },
                # [NEW] EARLY_PAYMENT_ANOMALY
                # feature_builder: PAYMENT_DELAY_DAYS < -1.0
                # Pembayaran dilakukan > 1 hari sebelum tanggal jatuh tempo
                # — anomali karena tidak lazim secara perilaku, bisa indikasi
                # manipulasi tanggal atau pengujian akun.
                "EARLY_PAYMENT_ANOMALY": {
                    "name": "AI Discovery: Early Payment Date Anomaly",
                    "category": "BEHAVIORAL",
                    "rules": [
                        {"field": "PAYMENT_DELAY_DAYS", "operator": "<", "value": -1.0}
                    ],
                    "risk_score": 60
                },
                # REFUND_FLAG: tidak di-cover karena layanan Nusabill tidak memiliki
                # fitur refund — field ini selalu 0 di feature_builder.
            }
        }

    @log_performance(label="PatternDiscoveryService.extract_and_save_patterns")
    def extract_and_save_patterns(self, db: Session, domain: str, anomaly_df: pd.DataFrame) -> int:
        """
        Menganalisa dataframe berisi data-data yang diprediksi FRAUD/ANOMALI oleh ML,
        mengekstrak polanya, dan menyimpannya ke tabel `fraud_patterns`.
        """
        if domain not in self._FEATURE_PATTERN_MAP:
            return 0
            
        if anomaly_df.empty:
            return 0

        map_config = self._FEATURE_PATTERN_MAP[domain]
        discovered_patterns: List[Dict[str, Any]] = []

        # Analisis setiap fitur di map config
        for feature, config in map_config.items():
            if feature in anomaly_df.columns:
                # Hitung persentase seberapa sering fitur ini memicu anomali (Hit Rate)
                # (Karena di feature_builder nilainya 1/0, kita bisa pakai mean)
                hit_rate = anomaly_df[feature].mean()
                
                # Threshold ML: Jika fitur ini dominan (muncul > 30% pada data anomali)
                if hit_rate > 0.3:
                    # Wrap rules list ke format dict standar yang dimengerti engine.
                    # Tanpa ini, rules_hash bisa tidak konsisten antara list dan dict
                    # sehingga dedup di save_generated_patterns tidak bekerja dengan benar.
                    pattern_rules = {
                        "logic": "AND",
                        "conditions": config["rules"],
                        "time_window_minutes": None
                    }
                    discovered_patterns.append({
                        "pattern_name": config["name"],
                        "pattern_category": config["category"],
                        "pattern_rules": pattern_rules,
                        "service_source": domain.upper(),
                        "risk_score": config["risk_score"],
                        "action": "FLAG"  # Default aman, biarkan analis yang ubah ke BLOCK
                    })

        # Kirim ke fungsi save yang sudah ada (akan di-hash dan di-insert otomatis ke DB)
        if discovered_patterns:
            saved_count = save_generated_patterns(
                db, 
                discovered_patterns, 
                source=PatternSourceEnum.RETRAIN_ML  # ← tambah ini
            )
            return saved_count
            
        return 0