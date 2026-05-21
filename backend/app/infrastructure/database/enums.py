import enum

class BlacklistTypeEnum(str, enum.Enum):
    USER_ID = "USER_ID"
    CUSTOMER_ID = "CUSTOMER_ID"
    ACCOUNT_NUMBER = "ACCOUNT_NUMBER"
    DEVICE_ID = "DEVICE_ID"
    TERMINAL_ID = "TERMINAL_ID"
    IP_ADDRESS = "IP_ADDRESS"
    MERCHANT_ID = "MERCHANT_ID"
    INVOICE_NUMBER = "INVOICE_NUMBER"
    RRN = "RRN"
    PAYMENT_CODE = "PAYMENT_CODE"
    BILLER_ID = "BILLER_ID"
    CUSTOMER_PHONE = "CUSTOMER_PHONE"
    CUSTOMER_EMAIL = "CUSTOMER_EMAIL"
    VIRTUAL_ACCOUNT_NUMBER = "VIRTUAL_ACCOUNT_NUMBER"
class TransactionStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    SAFE = "SAFE"
    FRAUD = "FRAUD"
class RuleOperatorEnum(str, enum.Enum):
    EQ = "="
    NEQ = "!="
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="
class ServiceScopeEnum(str, enum.Enum):
    ALL = "ALL"
    AGENUSA = "AGENUSA"
    NUSABILL = "NUSABILL"
class RuleActionEnum(str, enum.Enum):
    BLOCK = "BLOCK"
    REVIEW = "REVIEW"
    FLAG = "FLAG"
class RuleSeverityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
class ReviewDecisionEnum(str, enum.Enum):
    SAFE = "SAFE"
    FRAUD = "FRAUD"
class AlertStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REOPENED = "REOPENED"
    OVERRIDDEN = "OVERRIDDEN"

class ActivityActionEnum(str, enum.Enum):
    # Auth & Sessions
    LOGIN = "LOGIN"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    SESSION_REVOKED = "SESSION_REVOKED"
    TOKEN_REFRESHED = "TOKEN_REFRESHED" 

    # Accounts 
    ACCOUNT_CREATED = "ACCOUNT_CREATED"
    ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED"
    ACCOUNT_ROLE_CHANGED = "ACCOUNT_ROLE_CHANGED"

    # Rules Engine
    RULE_CREATED = "RULE_CREATED"
    RULE_UPDATED = "RULE_UPDATED"
    RULE_DELETED = "RULE_DELETED" 
    RULE_TRIGGERED = "RULE_TRIGGERED" 

    # Patterns (ML & Manual)
    PATTERN_CREATED = "PATTERN_CREATED"
    PATTERN_AUTO_DISABLE = "PATTERN_AUTO_DISABLE"
    PATTERN_AUTO_PROMOTE = "PATTERN_AUTO_PROMOTE"
    PATTERN_REACTIVATED = "PATTERN_REACTIVATED" 
    PATTERN_TRIGGERED = "PATTERN_TRIGGERED" 

    # Blacklist 
    BLACKLIST_ADD = "BLACKLIST_ADD"
    BLACKLIST_REMOVE = "BLACKLIST_REMOVE"
    BLACKLIST_HIT = "BLACKLIST_HIT"

# Alerts & Reviews
    ALERT_CREATED = "ALERT_CREATED"   
    ALERT_CLAIMED = "ALERT_CLAIMED"   
    ALERT_RELEASED = "ALERT_RELEASED"
    REVIEW_APPROVED = "REVIEW_APPROVED"
    REVIEW_REJECTED = "REVIEW_REJECTED"
    REVIEW_OVERRIDDEN = "REVIEW_OVERRIDDEN"

class SeverityLevelEnum(str, enum.Enum):
    # Tingkat keparahan 
    INFO = "INFO"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class EventSourceEnum(str, enum.Enum):
    # Sumber modul yang melakukan aksi 
    AUTH = "AUTH"
    RULE_ENGINE = "RULE_ENGINE"
    PATTERN_ENGINE = "PATTERN_ENGINE"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    BLACKLIST = "BLACKLIST"
    ML = "ML"
    SYSTEM = "SYSTEM"

class TimelineTypeEnum(str, enum.Enum):
    # Standarisasi timeline di dashboard 
    TIMELINE_FRAUD = "TIMELINE_FRAUD"
    TIMELINE_ALERT = "TIMELINE_ALERT"
    TIMELINE_REVIEW = "TIMELINE_REVIEW"
    TIMELINE_SYSTEM = "TIMELINE_SYSTEM"
    TIMELINE_SECURITY = "TIMELINE_SECURITY"