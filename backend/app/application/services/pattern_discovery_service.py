import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict, Any

# Import fungsi andalanmu untuk simpan pattern ke DB (sudah handle rules_hash & dedup)
from app.application.services.pattern_learning_service import save_generated_patterns

class PatternDiscoveryService:
    def __init__(self):
        # Mapping fitur ML ke format JSON ruleset yang dimengerti oleh `pattern_engine_service.py`
        self._FEATURE_PATTERN_MAP = {
            "agenusa": {
                "IS_BRUTE_PATTERN": {
                    "name": "AI Discovery: Brute Force PIN",
                    "category": "BRUTE_FORCE",
                    "rules": [
                        {"field": "PROCESSING_CODE", "operator": "==", "target": "300000"},
                        {"field": "RESPONSE_CODE", "operator": "==", "target": "55"}
                    ],
                    "risk_score": 85
                },
                "MIDNIGHT_AMOUNT_SPIKE": {
                    "name": "AI Discovery: Midnight Amount Spike",
                    "category": "UNUSUAL_TIME",
                    "rules": [
                        {"field": "IS_NIGHT_TX", "operator": "==", "target": 1},
                        {"field": "AMOUNT_OVER_AVG_RATIO", "operator": ">=", "target": 2.0}
                    ],
                    "risk_score": 75
                },
                "RAPID_RETRY_DECLINED": {
                    "name": "AI Discovery: Rapid Retry Declined",
                    "category": "VELOCITY",
                    "rules": [
                        {"field": "IS_DECLINED", "operator": "==", "target": 1},
                        {"field": "GAP_MINUTES", "operator": "<=", "target": 2.0}
                    ],
                    "risk_score": 80
                }
            },
            "nusabill": {
                "BURST_FLAG": {
                    "name": "AI Discovery: Burst Payment",
                    "category": "BURST_ATTACK",
                    "rules": [
                        {"field": "PAYMENT_GAP_MINUTES", "operator": "<=", "target": 5.0}
                    ],
                    "risk_score": 80
                },
                "HIGH_SPIKE_FLAG": {
                    "name": "AI Discovery: Unusual High Payment",
                    "category": "AMOUNT_ANOMALY",
                    "rules": [
                        {"field": "PAYMENT_TO_BILL_RATIO", "operator": ">", "target": 4.0}
                    ],
                    "risk_score": 70
                }
            }
        }

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
                    discovered_patterns.append({
                        "pattern_name": config["name"],
                        "pattern_category": config["category"],
                        "pattern_rules": config["rules"],
                        "service_source": domain.upper(),
                        "risk_score": config["risk_score"],
                        "action": "FLAG"  # Default aman, biarkan analis yang ubah ke BLOCK
                    })

        # Kirim ke fungsi save yang sudah ada (akan di-hash dan di-insert otomatis ke DB)
        if discovered_patterns:
            saved_count = save_generated_patterns(db, discovered_patterns)
            return saved_count
            
        return 0