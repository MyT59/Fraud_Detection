import logging

from app.infrastructure.database.models.global_rule_model import GlobalRule

logger = logging.getLogger(__name__)


# =========================
# SIMPLE RULE (LEGACY)
# =========================
def evaluate_simple_rule(value, operator, threshold):
    # Equality check pertama untuk menangani string non-numeric
    if operator == "=":
        return str(value).strip() == str(threshold).strip()

    try:
        val = float(value)
        th = float(threshold)
        
        if operator == ">":
            return val > th
        elif operator == "<":
            return val < th
        elif operator == ">=":
            return val >= th
        elif operator == "<=":
            return val <= th
    except (ValueError, TypeError):
        return False

    return False


# =========================
# JSON RULE (NEW ENGINE)
# =========================

def evaluate_json_rule(config, trx):
    if not config:
        return False
    
    if "AND" in config:
        conditions = config.get("AND") or []
        return all(evaluate_json_rule(c, trx) for c in conditions if c)

    if "OR" in config:
        conditions = config.get("OR") or []
        return any(evaluate_json_rule(c, trx) for c in conditions if c)

    # leaf
    field = config["field"]
    operator = config["operator"] # Sekarang konsisten menggunakan simbol: >, <, =, >=, <=
    value = config["value"]

    trx_value = getattr(trx, field, None)
    if trx_value is None:
        return False

    # Handle Equality (String/Universal)
    if operator == "=":
        return str(trx_value).strip() == str(value).strip()

    # Handle Numeric Comparisons dengan Type Safety
    try:
        val = float(trx_value)
        th = float(value)
        
        if operator == ">":
            return val > th
        if operator == "<":
            return val < th
        if operator == ">=":
            return val >= th
        if operator == "<=":
            return val <= th
    except (ValueError, TypeError):
        # Jika bukan angka tapi pakai operator pembanding, anggap tidak match (aman)
        return False

    return False

def calculate_rule_score(rule):
    base_score = {
        "HIGH": 22,
        "MEDIUM": 15,
        "LOW": 6
    }.get(rule.severity, 15)

    action_multiplier = {
        "BLOCK": 1.5,
        "REVIEW": 1.2,
        "FLAG": 1.0
    }.get(rule.action, 1.0)

    return int(base_score * action_multiplier)

def get_rule_weight(rule):
    return {
        "HIGH": 1.3,
        "MEDIUM": 1.1,
        "LOW": 1.0
    }.get(rule.severity, 1.0)

# =========================
# MAIN RULE ENGINE
# =========================
def run_rule_engine(db, trx):
    violations = []
    risk_score = 0
    review_count = 0
    rule_hit_count = 0
    rule_groups = set()
    rule_actions = [] 

    rules = db.query(GlobalRule).filter(
        GlobalRule.is_active == True
    ).order_by(GlobalRule.priority.desc()).limit(50).all()
    seen_groups = set()
    for rule in rules:
        logger.info(f"Evaluating RULE: {rule.rule_name} | GROUP: {rule.rule_group}")

        # Filter service
        if rule.service_scope != "ALL" and rule.service_scope != trx.service_source:
            continue

        # PRIORITY 1 → JSON RULE
        if rule.rule_config:
            is_match = evaluate_json_rule(rule.rule_config, trx)

        # PRIORITY 2 → SIMPLE RULE
        else:
            value = getattr(trx, rule.condition_field, None)
            if value is None:
                continue

            is_match = evaluate_simple_rule(
                value,
                rule.operator,
                rule.threshold_value
            )

        if is_match:
            group = rule.rule_group if rule.rule_group else rule.condition_field or "GENERAL"

            # ❌ skip kalau group sudah pernah kena
            if group in seen_groups:
                continue

            seen_groups.add(group)

            rule.hit_count += 1

            violations.append({
                "type": "RULE",
                "name": rule.rule_name,
                "rule_id": rule.id
            })

            rule_actions.append(rule.action)

            rule_hit_count += 1
            rule_groups.add(group)

            base_score = calculate_rule_score(rule)
            weighted_score = int(base_score * get_rule_weight(rule))

            risk_score += weighted_score

            # 🔥 TRACK REVIEW
            if rule.action == "REVIEW":
                review_count += 1

            # 🔥 HARD STOP
            if rule.action == "BLOCK":
                return violations, risk_score, rule_actions

    # =========================
    # ADVANCED CHAINING
    # =========================

    rule_score_total = risk_score

    if rule_hit_count >= 2:
        risk_score += 10

    if rule_hit_count >= 3:
        risk_score += 20

    # GROUP ESCALATION (lebih kecil)
    if len(rule_groups) >= 2:
        risk_score += 10

    # optional cap
    risk_score = min(risk_score, 100)

    return violations, risk_score, rule_actions