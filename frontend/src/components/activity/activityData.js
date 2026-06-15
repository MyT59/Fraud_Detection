// activityData.js — config only, no static data
// Field names sesuai ActivityLogResponse dari BE

// Action groups inline — tidak import dari service untuk hindari circular dependency
// PENTING: setiap action_type hanya boleh masuk SATU group (no overlap)
const ACTION_GROUPS_MAP = {
  fraud: [
    "ALERT_CREATED",
    "BLACKLIST_HIT",
    "PATTERN_TRIGGERED",
    "RULE_TRIGGERED",
    "FLAG_TRANSACTION",
  ],
  reviews: [
    "ALERT_CLAIMED",
    "ALERT_RELEASED",
    "REVIEW_APPROVED",
    "REVIEW_REJECTED",
    "REVIEW_OVERRIDDEN",
  ],
  system: [
    "LOGIN",
    "LOGIN_FAILED",
    "LOGOUT",
    "SESSION_REVOKED",
    "TOKEN_REFRESHED",
    "MANUAL_RUN_RETRAIN",
  ],
  rules: ["RULE_CREATED", "RULE_UPDATED", "RULE_DELETED"],
  alerts: ["SLA_ESCALATION"],
  patterns: [
    "PATTERN_CREATED",
    "PATTERN_AUTO_DISABLE",
    "PATTERN_AUTO_PROMOTE",
    "PATTERN_REACTIVATED",
    "PATTERN_TRIGGERED",
  ],
  blacklist: ["BLACKLIST_ADD", "BLACKLIST_REMOVE"],
  user_actions: [
    "ACCOUNT_CREATED",
    "ACCOUNT_SUSPENDED",
    "ACCOUNT_ROLE_CHANGED",
  ],
  reports: ["REPORT_GENERATED", "REPORT_DOWNLOADED"],
};

// Mapping action_type → display group
export const getActivityGroup = (action_type) => {
  for (const [group, actions] of Object.entries(ACTION_GROUPS_MAP)) {
    if (actions.includes(action_type)) return group;
  }
  return "system";
};

// Mapping action_type → icon, color, title
export const ACTION_META = {
  ALERT_CREATED: {
    icon: "bi-shield-exclamation",
    color: "red",
    title: "Alert Created",
  },
  BLACKLIST_HIT: { icon: "bi-ban", color: "red", title: "Blacklist Hit" },
  PATTERN_TRIGGERED: {
    icon: "bi-diagram-3",
    color: "red",
    title: "Pattern Triggered",
  },
  RULE_TRIGGERED: {
    icon: "bi-lightning-charge",
    color: "orange",
    title: "Rule Triggered",
  },
  REVIEW_APPROVED: {
    icon: "bi-check-circle",
    color: "green",
    title: "Review Approved",
  },
  REVIEW_REJECTED: {
    icon: "bi-x-circle",
    color: "red",
    title: "Review Rejected",
  },
  REVIEW_OVERRIDDEN: {
    icon: "bi-arrow-repeat",
    color: "orange",
    title: "Review Overridden",
  },
  ALERT_CLAIMED: {
    icon: "bi-person-check",
    color: "green",
    title: "Alert Claimed",
  },
  ALERT_RELEASED: {
    icon: "bi-person-dash",
    color: "gray",
    title: "Alert Released",
  },
  RULE_CREATED: {
    icon: "bi-plus-circle",
    color: "blue",
    title: "Rule Created",
  },
  RULE_UPDATED: { icon: "bi-gear", color: "blue", title: "Rule Updated" },
  RULE_DELETED: { icon: "bi-trash", color: "orange", title: "Rule Deleted" },
  PATTERN_CREATED: {
    icon: "bi-diagram-3",
    color: "blue",
    title: "Pattern Created",
  },
  PATTERN_AUTO_DISABLE: {
    icon: "bi-pause-circle",
    color: "orange",
    title: "Pattern Auto-Disabled",
  },
  PATTERN_AUTO_PROMOTE: {
    icon: "bi-arrow-up-circle",
    color: "green",
    title: "Pattern Promoted",
  },
  PATTERN_REACTIVATED: {
    icon: "bi-play-circle",
    color: "green",
    title: "Pattern Reactivated",
  },
  BLACKLIST_ADD: {
    icon: "bi-shield-plus",
    color: "orange",
    title: "Blacklist Added",
  },
  BLACKLIST_REMOVE: {
    icon: "bi-shield-minus",
    color: "gray",
    title: "Blacklist Removed",
  },
  LOGIN: { icon: "bi-box-arrow-in-right", color: "green", title: "Login" },
  LOGIN_FAILED: {
    icon: "bi-exclamation-triangle",
    color: "red",
    title: "Login Failed",
  },
  LOGOUT: { icon: "bi-box-arrow-right", color: "gray", title: "Logout" },
  SESSION_REVOKED: {
    icon: "bi-slash-circle",
    color: "orange",
    title: "Session Revoked",
  },
  TOKEN_REFRESHED: {
    icon: "bi-arrow-clockwise",
    color: "blue",
    title: "Token Refreshed",
  },
  ACCOUNT_CREATED: {
    icon: "bi-person-plus",
    color: "green",
    title: "Account Created",
  },
  ACCOUNT_SUSPENDED: {
    icon: "bi-person-slash",
    color: "red",
    title: "Account Suspended",
  },
  ACCOUNT_ROLE_CHANGED: {
    icon: "bi-person-gear",
    color: "blue",
    title: "Role Changed",
  },
  // Extra — dari DB
  FLAG_TRANSACTION: {
    icon: "bi-flag-fill",
    color: "red",
    title: "Transaction Flagged",
  },
  SLA_ESCALATION: { icon: "bi-alarm", color: "orange", title: "SLA Escalated" },
  MANUAL_RUN_RETRAIN: {
    icon: "bi-cpu",
    color: "blue",
    title: "Manual Retrain",
  },
  // Reports
  REPORT_GENERATED: {
    icon: "bi-file-earmark-text",
    color: "blue",
    title: "Report Generated",
  },
  REPORT_DOWNLOADED: {
    icon: "bi-download",
    color: "green",
    title: "Report Downloaded",
  },
};

export const DEFAULT_META = {
  icon: "bi-activity",
  color: "gray",
  title: "System Event",
};

export const FILTER_CONFIG = [
  { label: "All", value: "all", icon: "bi-grid", color: "all", dot: null },
  {
    label: "Fraud",
    value: "fraud",
    icon: "bi-shield-exclamation",
    color: "fraud",
    dot: "red",
  },
  {
    label: "Reviews",
    value: "reviews",
    icon: "bi-eye",
    color: "review",
    dot: "green",
  },
  {
    label: "System",
    value: "system",
    icon: "bi-cpu",
    color: "system",
    dot: "blue",
  },
  {
    label: "Rules",
    value: "rules",
    icon: "bi-gear",
    color: "rule",
    dot: "blue",
  },
  {
    label: "Alerts",
    value: "alerts",
    icon: "bi-exclamation-triangle",
    color: "alert",
    dot: "orange",
  },
  {
    label: "Patterns",
    value: "patterns",
    icon: "bi-diagram-3",
    color: "report",
    dot: "purple",
  },
  {
    label: "Blacklist",
    value: "blacklist",
    icon: "bi-ban",
    color: "rule",
    dot: "orange",
  },
  {
    label: "User Actions",
    value: "user_actions",
    icon: "bi-person-gear",
    color: "user",
    dot: "gray",
  },
  {
    label: "Reports",
    value: "reports",
    icon: "bi-file-earmark-text",
    color: "system",
    dot: "blue",
  },
];

export const STATS_BAR = [
  {
    label: "Fraud Events",
    key: "fraud",
    icon: "bi-shield-exclamation",
    color: "red",
  },
  { label: "Reviews", key: "reviews", icon: "bi-eye", color: "green" },
  { label: "System Events", key: "system", icon: "bi-cpu", color: "blue" },
  { label: "Alerts", key: "alerts", icon: "bi-bell", color: "orange" },
  { label: "Patterns", key: "patterns", icon: "bi-diagram-3", color: "purple" },
  {
    label: "User Actions",
    key: "user_actions",
    icon: "bi-person",
    color: "gray",
  },
];

export const GROUP_BADGE_CLASS = {
  fraud: "tf-type-fraud",
  reviews: "tf-type-review",
  system: "tf-type-system",
  rules: "tf-type-rule",
  alerts: "tf-type-alert",
  patterns: "tf-type-report",
  blacklist: "tf-type-rule",
  user_actions: "tf-type-user",
};

export const GROUP_LABEL = {
  fraud: "Fraud",
  reviews: "Review",
  system: "System",
  rules: "Rule",
  alerts: "Alert",
  patterns: "Pattern",
  blacklist: "Blacklist",
  user_actions: "User",
};

// Fallback data saat BE offline — BE field names
export const FALLBACK_ACTIVITIES = [
  {
    id: 1,
    action_type: "ALERT_CREATED",
    module_source: "RULE_ENGINE",
    severity: "HIGH",
    admin_name: "System",
    admin_email: null,
    target_type: "TRANSACTION",
    target_id: "TRX001234",
    details: { amount: "Rp 25.000.000", user: "USR12345" },
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: 2,
    action_type: "REVIEW_APPROVED",
    module_source: "MANUAL_REVIEW",
    severity: "INFO",
    admin_name: "Admin User",
    admin_email: "admin@fds.id",
    target_type: "TRANSACTION",
    target_id: "TRX001230",
    details: { review_time: "3 minutes" },
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 3,
    action_type: "RULE_UPDATED",
    module_source: "RULE_ENGINE",
    severity: "INFO",
    admin_name: "Security Team",
    admin_email: null,
    target_type: "RULE",
    target_id: "Velocity Check",
    details: { old_value: "8", new_value: "10" },
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: 4,
    action_type: "LOGIN_FAILED",
    module_source: "AUTH",
    severity: "WARNING",
    admin_name: "System",
    admin_email: null,
    target_type: "ADMIN",
    target_id: "USR67890",
    details: { attempts: 5, location: "Jakarta" },
    created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
  },
  {
    id: 5,
    action_type: "PATTERN_TRIGGERED",
    module_source: "PATTERN_ENGINE",
    severity: "HIGH",
    admin_name: "System",
    admin_email: null,
    target_type: "TRANSACTION",
    target_id: "TRX001225",
    details: { location: "Unknown" },
    created_at: new Date(Date.now() - 6 * 60 * 60000).toISOString(),
  },
  {
    id: 6,
    action_type: "ACCOUNT_CREATED",
    module_source: "SYSTEM",
    severity: "INFO",
    admin_name: "Super Admin",
    admin_email: "superadmin@fds.id",
    target_type: "ADMIN",
    target_id: "new_analyst",
    details: { role: "Fraud Analyst" },
    created_at: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
  },
  {
    id: 7,
    action_type: "BLACKLIST_ADD",
    module_source: "BLACKLIST",
    severity: "WARNING",
    admin_name: "Security Team",
    admin_email: null,
    target_type: "IP_ADDRESS",
    target_id: "192.168.x.x",
    details: { reason: "Fraud pattern" },
    created_at: new Date(Date.now() - 12 * 60 * 60000).toISOString(),
  },
  {
    id: 8,
    action_type: "PATTERN_AUTO_PROMOTE",
    module_source: "ML",
    severity: "INFO",
    admin_name: "System",
    admin_email: null,
    target_type: "PATTERN",
    target_id: "PAT-042",
    details: { accuracy: "98.9%", samples: 5000 },
    created_at: new Date(Date.now() - 8 * 60 * 60000).toISOString(),
  },
];
