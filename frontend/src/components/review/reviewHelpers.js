/**
 * reviewHelpers.js
 * Pure utility functions & data mappers untuk Manual Review module.
 * Tidak ada React dependency.
 */

/**
 * Format ISO datetime → string lokal Indonesia
 * @param {string|null} ds
 * @returns {string}
 */
export const fmtDate = (ds) => {
  if (!ds) return "—";
  return new Date(ds).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Map alert dari GET /alerts/my-queue → format display FE.
 * Hanya memetakan field yang tersedia di BE.
 *
 * @param {object} alert - raw alert dari BE
 * @returns {object} mapped alert
 */
export const mapMyQueueAlert = (alert) => ({
  alertId: alert.id,
  transactionId: alert.transaction_id,
  title: alert.title || "Alert",
  message: alert.message || "",
  severity: (alert.severity || "LOW").toUpperCase(),
  priorityLabel: alert.priority_label || "—",
  priority: alert.priority ?? 0,
  alertType: (alert.type || alert.alert_type || "UNKNOWN").toUpperCase(),
  service: (alert.service || "—").toUpperCase(),
  status: (alert.status || "IN_PROGRESS").toUpperCase(),
  createdAt: alert.created_at || null,
});

/**
 * Ekstrak items dari berbagai bentuk response BE.
 * BE bisa return array langsung, { items }, atau { data }.
 *
 * @param {any} response
 * @returns {Array}
 */
export const extractItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};
