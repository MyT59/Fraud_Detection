from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import func

from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.application.services.activity_log_service import log_activity
from app.application.cache.fraud_cache import get_cached_rules
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)
BUSINESS_TIMEZONE = ZoneInfo("Asia/Jakarta")


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


def _evaluate_datetime(value, operator, threshold):
    """Compare timestamps using WIB for business-time conditions."""
    if not isinstance(value, datetime):
        return None

    # PostgreSQL preserves UTC offsets, while some local/dev databases return
    # a naive UTC datetime. Normalize both forms before applying a time rule.
    left_business = value
    if left_business.tzinfo is None:
        left_business = left_business.replace(tzinfo=timezone.utc)
    left_business = left_business.astimezone(BUSINESS_TIMEZONE)

    raw = str(threshold).strip()
    try:
        target = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if target.tzinfo is None:
            target = target.replace(tzinfo=BUSINESS_TIMEZONE)
        else:
            target = target.astimezone(BUSINESS_TIMEZONE)
        left, right = left_business, target
    except ValueError:
        # `24:00` is a common business-rule notation for the end of a day,
        # but Python's time type only accepts 00:00 through 23:59:59.
        if raw in {"24:00", "24:00:00"}:
            target_time = time.max
        else:
            try:
                target_time = time.fromisoformat(raw)
            except ValueError:
                return False
        left, right = left_business.timetz().replace(tzinfo=None), target_time

    if operator == "=": return left == right
    if operator == "!=": return left != right
    if operator in (">", "gt"): return left > right
    if operator in ("<", "lt"): return left < right
    if operator in (">=", "gte"): return left >= right
    if operator in ("<=", "lte"): return left <= right
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

    group_keys = [
        key for key in ("AND", "OR")
        if isinstance(config.get(key), list)
    ]
    if group_keys:
        # Older rows were serialized as {"AND": [...], "OR": null}.
        # Treat null as absent, but still fail closed if both groups contain
        # conditions or if the selected group is empty.
        if len(group_keys) != 1:
            return False
        logic = group_keys[0]
        conditions = config[logic]
        if not isinstance(conditions, list) or not conditions:
            return False
        if logic == "AND":
            return all(evaluate_json_rule(condition, trx) for condition in conditions)
        return any(evaluate_json_rule(condition, trx) for condition in conditions)

    if "AND" in config or "OR" in config:
        return False

    if not {"field", "operator", "value"}.issubset(config):
        logger.warning("[RULE] Ignoring malformed rule_config: %s", config)
        return False

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

    datetime_result = _evaluate_datetime(trx_value, operator, value)
    if datetime_result is not None:
        return datetime_result

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
    rule_groups    = set()
    rule_actions   = []

    rules = get_cached_rules(db)

    seen_groups = set()
    for rule in rules:
        logger.debug(f"[RULE] Evaluating: {rule.rule_name} | GROUP: {rule.rule_group}")

        if rule.service_scope != "ALL" and rule.service_scope != trx.service_source:
            continue

        if rule.rule_config:
            rule_config = rule.rule_config
            if rule.rule_key == "rule_agenusa_suspended_bank":
                rule_config = {**rule_config, "operator": "="}
            is_match = evaluate_json_rule(rule_config, trx)
        else:
            value = getattr(trx, rule.condition_field, None)
            if value is None:
                continue
            is_match = evaluate_simple_rule(value, rule.operator, rule.threshold_value)

        if not is_match:
            continue

        # Only an explicit group is mutually exclusive. JSON rules have no
        # condition_field, so treating all of them as GENERAL hides valid hits.
        group = rule.rule_group.strip() if rule.rule_group else None
        if group and group in seen_groups:
            continue

        if group:
            seen_groups.add(group)
        db.query(GlobalRule).filter(GlobalRule.id == rule.id).update(
            {
                "hit_count": func.coalesce(GlobalRule.hit_count, 0) + 1,
                GlobalRule.updated_at: GlobalRule.updated_at,
            },
            synchronize_session=False,
        )

        action = normalize_rule_action(rule.action)
        violations.append({"type": "RULE", "name": rule.rule_name, "rule_id": rule.id})
        rule_actions.append(action)
        if group:
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

    # Reward independent fraud signals from explicitly configured groups.
    # Rules in the same explicit group are already mutually exclusive above.
    if len(rule_groups) >= 3:
        risk_score += 20
    elif len(rule_groups) >= 2:
        risk_score += 10

    risk_score = min(risk_score, 100)

    return violations, risk_score, rule_actions
