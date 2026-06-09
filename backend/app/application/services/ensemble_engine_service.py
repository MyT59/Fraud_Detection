from app.infrastructure.database.enums import TransactionStatusEnum


def run_ensemble_engine(
    rule_score=0,
    rule_actions=None,
    pattern_score=0,
    pattern_actions=None,
    ml_score=0,
    pattern_violations=None
):
    rule_actions = rule_actions or []
    pattern_actions = pattern_actions or []
    pattern_violations = pattern_violations or []

    actions = rule_actions + pattern_actions

    # =========================================================================
    # PRIORITY: HARD BLOCK FROM ENGINES
    # =========================================================================
    if "BLOCK" in pattern_actions:
        return {
            "final_score": 100,
            "final_status": "FRAUD",
            "reason": "PATTERN_BLOCK"
        }
    
    if "BLOCK" in rule_actions:
        return {
            "final_score": 95,
            "final_status": "FRAUD",
            "reason": "RULE_BLOCK"
        }
    
    pattern_names = [v.get("name", "") for v in pattern_violations]

    if any("Decline Velocity" in p for p in pattern_names):
        # Abaikan rule konvensional jika pola fraud velocity sudah sangat jelas
        rule_score = 0
        rule_actions = []

    # =========================================================================
    # COMBINE SCORE (Rule + Pattern + Scaled ML Anomaly Indicator)
    # =========================================================================
    total_score = int(rule_score + pattern_score + ml_score)
    total_score = max(0, min(total_score, 100))

    # =========================================================================
    # ENSEMBLE DECISION LOGIC
    # =========================================================================
    # Tentukan status dasar dari total akumulasi skor risiko murni
    if total_score >= 80:
        status = "FRAUD"
    elif total_score >= 50:
        status = TransactionStatusEnum.UNDER_REVIEW.value
    else:
        status = "SAFE"

    # Business Logic Adjustment: 
    # Jika skor tinggi (terdeteksi anomali/pattern berat) tapi rule tidak melakukan BLOCK,
    # alihkan status menjadi UNDER_REVIEW agar ditinjau analis, tanpa merusak nilai skor aslinya.
    if total_score > 85 and "BLOCK" not in actions:
        status = TransactionStatusEnum.UNDER_REVIEW.value

    return {
        "final_score": total_score,
        "final_status": status,
        "reason": "COMBINED_ENSEMBLE_EVALUATION"
    }