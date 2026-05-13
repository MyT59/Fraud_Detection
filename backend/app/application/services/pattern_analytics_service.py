from sqlalchemy.orm import Session
from sqlalchemy import func

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern


def get_pattern_statistics(db: Session):
    patterns = db.query(FraudPattern).all()

    results = []

    total_flagged = db.query(func.count(Transaction.id)).filter(
        Transaction.is_flagged_ml == True
    ).scalar() or 0

    for pattern in patterns:

        tx_count = db.query(func.count(Transaction.id)).filter(
            Transaction.violation_pattern_ids.contains([pattern.id])
        ).scalar() or 0

        avg_amount = db.query(func.avg(Transaction.amount)).filter(
            Transaction.violation_pattern_ids.contains([pattern.id])
        ).scalar()

        trend = round(
            (tx_count / max(total_flagged, 1)) * 100,
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

            "occurrences": tx_count,
            "avg_amount": float(avg_amount or 0),

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