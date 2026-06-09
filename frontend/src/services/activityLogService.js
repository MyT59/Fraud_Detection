// src/services/activityLogService.js
import { api } from "./apiService";

export const ACTION_GROUPS = {
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
};

export const AUDIT_LOG_ACTIONS = ACTION_GROUPS.user_actions;

const PAGE_LIMIT = 30; // item per page untuk infinite scroll

const activityLogService = {
  /**
   * GET /activity-logs/
   * @param {Object} params
   * @param {number}   params.page
   * @param {number}   params.limit
   * @param {string[]} [params.action_types]  - multi action type filter (BE baru)
   * @param {string}   [params.email]
   * @param {string}   [params.start_date]
   * @param {string}   [params.end_date]
   */
  getLogs: async ({
    page = 1,
    limit = PAGE_LIMIT,
    action_types,
    search, // ganti dari email — global search
    email, // tetap ada untuk Audit Log filter by email
    start_date,
    end_date,
  } = {}) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);

    if (action_types && action_types.length > 0) {
      action_types.forEach((t) => params.append("action_types", t));
    }
    if (search) params.append("search", search);
    if (email) params.append("email", email);
    if (start_date) params.append("start_date", start_date);
    if (end_date) params.append("end_date", end_date);

    return api.get(`/activity-logs/?${params.toString()}`);
  },

  getTimelineLogs: (params = {}) => activityLogService.getLogs(params),
  getAuditLogs: (params = {}) => activityLogService.getLogs(params),

  exportToCSV: (logs, filename = "activity_log") => {
    if (!logs || logs.length === 0) return;

    const headers = [
      "ID",
      "Tanggal",
      "Action Type",
      "Module",
      "Severity",
      "Admin",
      "Email",
      "Target Type",
      "Target ID",
      "IP Address",
      "Device",
      "Browser",
      "Details",
    ];

    const escape = (val) => {
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const formatDate = (ds) => {
      if (!ds) return "";
      return new Date(ds).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const rows = logs.map((log) => [
      escape(log.id),
      escape(formatDate(log.created_at)),
      escape(log.action_type),
      escape(log.module_source),
      escape(log.severity),
      escape(log.admin_name),
      escape(log.admin_email),
      escape(log.target_type),
      escape(log.target_id),
      escape(log.ip_address),
      escape(log.device),
      escape(log.browser),
      escape(log.details),
    ]);

    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export default activityLogService;
