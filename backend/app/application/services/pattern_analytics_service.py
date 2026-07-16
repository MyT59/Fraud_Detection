from sqlalchemy.orm import Session
from sqlalchemy import func

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.repositories.pattern_repository import PatternRepository
from app.core.config import settings
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


@log_performance(label="PatternAnalytics.get_pattern_statistics")
def get_pattern_statistics(db: Session):
    patterns = db.query(FraudPattern).filter(FraudPattern.is_deleted == False).all()

    results = []

    total_flagged = db.query(func.count(Transaction.id)).filter(
        Transaction.is_flagged_ml == True
    ).scalar() or 0

    # Pre-aggregate tx_count dan avg_amount per pattern_id dalam satu query
    # menghindari N+1 query (2 query per pattern × jumlah pattern)
    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB

    agg_rows = db.query(
        func.jsonb_array_elements_text(Transaction.violation_pattern_ids).label("pid"),
        func.count(Transaction.id).label("tx_count"),
        func.avg(Transaction.amount).label("avg_amount")
    ).filter(
        Transaction.violation_pattern_ids.isnot(None)
    ).group_by("pid").all()

    agg_map = {int(r.pid): {"tx_count": r.tx_count, "avg_amount": float(r.avg_amount or 0)} for r in agg_rows}

    # [FIX] Basis perhitungan trend per pattern.
    # Sebelumnya trend = tx_count / total_flagged (is_flagged_ml), padahal
    # tx_count berasal dari domain violation_pattern_ids (pattern engine).
    # Dua domain berbeda (ML async vs pattern engine sync) menyebabkan trend
    # bisa >100% atau tidak masuk akal jika kedua flag tidak overlap konsisten.
    #
    # total_pattern_flagged dihitung dari domain yang sama dengan tx_count:
    # jumlah baris transaksi yang punya minimal satu violation_pattern_ids
    # (yaitu jumlah seluruh "kemunculan" pattern di semua transaksi).
    # Dihitung dari agg_map agar tidak perlu query tambahan ke DB.
    total_pattern_flagged = sum(a["tx_count"] for a in agg_map.values())

    for pattern in patterns:
        agg = agg_map.get(pattern.id, {"tx_count": 0, "avg_amount": 0.0})
        tx_count = agg["tx_count"]

        # [FIX] trend = share pattern ini terhadap total kemunculan pattern
        # violation di seluruh transaksi (domain sama dengan tx_count).
        trend = round(
            (tx_count / max(total_pattern_flagged, 1)) * 100,
            1
        )

        results.append({
            "id": pattern.id,
            "pattern_name": pattern.pattern_name,
            "category": pattern.pattern_category,
            "risk_score": pattern.risk_score,
            "action": pattern.action,
            "service_source": pattern.service_source,
            "is_active": pattern.is_active,
            "is_deleted": pattern.is_deleted,

            "occurrences": tx_count,
            "avg_amount": agg["avg_amount"],

            "accuracy": pattern.accuracy_score,
            "false_positive_rate": pattern.false_positive_rate,

            "hit_count": pattern.hit_count,
            "trend": trend,
        })

    results.sort(
        key=lambda x: x["occurrences"],
        reverse=True
    )

    return {
        "patterns": results,
        "total_patterns": len(results),
        "total_flagged_transactions": total_flagged,
    }

@log_performance(label="PatternAnalytics.get_pattern_effectiveness_service")
def get_pattern_effectiveness_service(db):
    pattern_repo = PatternRepository(db)
    patterns = pattern_repo.get_all_patterns()
    
    return [
        {
            "pattern_name": p.pattern_name,
            "true_positive": p.true_positive or 0,
            "false_positive": p.false_positive or 0,
            "accuracy_score": round(p.accuracy_score or 0.0, 2)
        }
        for p in patterns
    ]

@log_performance(label="PatternAnalytics.get_pattern_diagnostics_service")
def get_pattern_diagnostics_service(db):
    # Mengagregasi performa diagnostik ruleset untuk menemukan anomali false positive 
    # dan memberikan rekomendasi aktivasi otomatis terhadap kluster pattern kandidat.

    pattern_repo = PatternRepository(db)
    all_patterns = pattern_repo.get_all_patterns()

    # 1. Cari Top 5 Pola False Positive Tertinggi
    noisy_patterns = sorted(all_patterns, key=lambda x: x.false_positive or 0, reverse=True)[:5]
    
    # 2. Cari Top 5 Pola dengan Akurasi Terburuk
    worst_patterns = sorted(all_patterns, key=lambda x: x.accuracy_score or 0.0, reverse=False)[:5]

    # 3. AUTO SUGGESTION LOOP: Menggunakan nilai ambang batas dinamis dari Settings
    suggestions = []
    inactive_candidates = [p for p in all_patterns if not p.is_active]

    for p in inactive_candidates:
        if (p.hit_count or 0) >= settings.AUTO_PATTERN_ACTIVATION_THRESHOLD:
            suggestions.append({
                "pattern_id": p.id,
                "pattern_name": p.pattern_name,
                "suggestion_type": "SUGGEST_ACTIVATION",
                "reason": (
                    f"Sistem mendeteksi pola kluster otomatis ini berhasil menjaring sebanyak {p.hit_count} hit "
                    f"pada basis data manual review (Ambang batas konfigurasi saat ini: {settings.AUTO_PATTERN_ACTIVATION_THRESHOLD} hit). "
                    f"Direkomendasikan untuk segera diaktifkan ke status LIVE."
                )
            })

    return {
        "noisy_patterns": [
            {"id": p.id, "name": p.pattern_name, "false_positives": p.false_positive or 0} 
            for p in noisy_patterns if (p.false_positive or 0) > 0
        ],
        "worst_accuracy_patterns": [
            {"id": p.id, "name": p.pattern_name, "accuracy": round(p.accuracy_score or 0.0, 2)} 
            for p in worst_patterns if p.accuracy_score is not None
        ],
        "system_suggestions": suggestions
    }
