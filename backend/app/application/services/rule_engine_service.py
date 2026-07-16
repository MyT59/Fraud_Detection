"""
rule_engine_service.py
======================
Optimasi P2 + P4:
  - GlobalRule diambil dari cache (get_cached_rules) bukan query per transaksi
  - Hapus db.commit() — commit dilakukan sekali di process_transaction()
  - logger.info → logger.debug untuk per-rule evaluation log
"""

from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.application.services.activity_log_service import log_activity
from app.application.cache.fraud_cache import get_cached_rules
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


def normalize_rule_action(action):
    action = str(action or "FLAG").upper()
    return "BLOCK" if action == "BLOCK" else "FLAG"


# =========================
# SIMPLE RULE (LEGACY)
# =========================
def evaluate_simple_rule(value, operator, threshold):
    if operator == "=":
        return str(value).strip() == str(threshold).strip()
    elif operator == "!=":
        return str(value).strip() != str(threshold).strip()

    try:
        val = float(value)
        th  = float(threshold)
        if operator == ">":  return val > th
        if operator == "<":  return val < th
        if operator == ">=": return val >= th
        if operator == "<=": return val <= th
    except (ValueError, TypeError):
        return False

    return False


# =========================
# JSON RULE (NEW ENGINE)
# =========================
def evaluate_json_rule(config, trx):
    if not config:
        return False

    # Normalise Pydantic model → dict
    if hasattr(config, "model_dump"):
        config = config.model_dump(exclude_none=True)
    elif hasattr(config, "dict"):
        config = config.dict(exclude_none=True)

    if "AND" in config:
        conditions = config.get("AND") or []
        return all(evaluate_json_rule(c, trx) for c in conditions if c)

    if "OR" in config:
        conditions = config.get("OR") or []
        return any(evaluate_json_rule(c, trx) for c in conditions if c)

    field    = config["field"]
    operator = config["operator"]
    value    = config["value"]

    # Support dot-notation untuk nested JSONB (misal: transaction_details.issuer_bank)
    if "." in field:
        parts      = field.split(".")
        trx_value  = getattr(trx, parts[0], None)
        for part in parts[1:]:
            if isinstance(trx_value, dict):
                trx_value = trx_value.get(part)
            else:
                trx_value = None
                break
    else:
        trx_value = getattr(trx, field, None)

    if trx_value is None:
        return False

    if operator == "=":  return str(trx_value).strip() == str(value).strip()
    if operator == "!=": return str(trx_value).strip() != str(value).strip()

    try:
        val = float(trx_value)
        th  = float(value)
        if operator in (">",  "gt"):  return val > th
        if operator in ("<",  "lt"):  return val < th
        if operator in (">=", "gte"): return val >= th
        if operator in ("<=", "lte"): return val <= th
    except (ValueError, TypeError):
        return False

    return False


def calculate_rule_score(rule):
    base_score = {"CRITICAL": 35, "HIGH": 22, "MEDIUM": 15, "LOW": 6}.get(rule.severity, 15)
    action = normalize_rule_action(rule.action)
    action_multiplier = {"BLOCK": 1.5, "FLAG": 1.2}.get(action, 1.0)
    return int(base_score * action_multiplier)


def get_rule_weight(rule):
    return {"CRITICAL": 1.5, "HIGH": 1.3, "MEDIUM": 1.1, "LOW": 1.0}.get(rule.severity, 1.0)


# =========================
# MAIN RULE ENGINE
# =========================
@log_performance(label="RuleEngine.run_rule_engine")
def run_rule_engine(db, trx):
    violations     = []
    risk_score     = 0
    rule_hit_count = 0
    rule_groups    = set()
    rule_actions   = []

    # ── P4: ambil dari cache, bukan query DB per transaksi ──
    rules = get_cached_rules(db)

    seen_groups = set()
    for rule in rules:
        logger.debug(f"[RULE] Evaluating: {rule.rule_name} | GROUP: {rule.rule_group}")

        if rule.service_scope != "ALL" and rule.service_scope != trx.service_source:
            continue

        if rule.rule_config:
            is_match = evaluate_json_rule(rule.rule_config, trx)
        else:
            value = getattr(trx, rule.condition_field, None)
            if value is None:
                continue
            is_match = evaluate_simple_rule(value, rule.operator, rule.threshold_value)

        if not is_match:
            continue

        group = rule.rule_group if rule.rule_group else rule.condition_field or "GENERAL"
        if group in seen_groups:
            continue

        seen_groups.add(group)
        rule.hit_count = (rule.hit_count or 0) + 1

        action = normalize_rule_action(rule.action)
        violations.append({"type": "RULE", "name": rule.rule_name, "rule_id": rule.id})
        rule_actions.append(action)
        rule_hit_count += 1
        rule_groups.add(group)

        log_severity = {
            "CRITICAL": SeverityLevelEnum.CRITICAL,
            "HIGH":     SeverityLevelEnum.HIGH,
            "MEDIUM":   SeverityLevelEnum.WARNING,
            "LOW":      SeverityLevelEnum.INFO
        }.get(rule.severity, SeverityLevelEnum.WARNING)

        log_activity(
            db=db,
            admin=None,
            action_type=ActivityActionEnum.RULE_TRIGGERED,
            module_source=EventSourceEnum.RULE_ENGINE,
            severity=log_severity,
            target_type="TRANSACTION",
            target_id=str(trx.original_trx_id),
            ip_address=getattr(trx, "ip_address", None),
            details={
                "rule_id":      rule.id,
                "rule_name":    rule.rule_name,
                "action_taken": action,
                "amount":       float(trx.amount) if hasattr(trx, "amount") else None
            }
        )

        base_score     = calculate_rule_score(rule)
        weighted_score = int(base_score * get_rule_weight(rule))
        risk_score    += weighted_score

        # BLOCK: return langsung, commit di process_transaction()
        if action == "BLOCK":
            return violations, risk_score, rule_actions

    if rule_hit_count >= 2: risk_score += 10
    if rule_hit_count >= 3: risk_score += 20
    if len(rule_groups) >= 2: risk_score += 10

    risk_score = min(risk_score, 100)

    # ── TIDAK ada db.commit() di sini ──
    return violations, risk_score, rule_actions
