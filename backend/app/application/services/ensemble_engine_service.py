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

    # =========================
    # PRIORITY: BLOCK
    # =========================
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
        # ignore rule kalau sudah jelas fraud behavior
        rule_score = 0
        rule_actions = []

    # =========================
    # COMBINE SCORE
    # =========================
    total_score = int(rule_score + pattern_score + ml_score)
    total_score = min(total_score, 100)

    # =========================
    # DECISION
    # =========================
    if total_score > 85 and "BLOCK" not in (rule_actions + pattern_actions):
        total_score = 75
    if total_score >= 80:
        status = "FRAUD"
    elif total_score >= 50:
        status = "REVIEW"
    else:
        status = "SAFE"

    if total_score > 80 and "BLOCK" not in actions:
        total_score = 70

    return {
        "final_score": total_score,
        "final_status": status,
        "reason": "SCORE_BASED"
    }