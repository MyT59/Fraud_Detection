/**
 * reviewApiService.js
 * ─────────────────────────────────────────────────────────────────
 * Lapisan integrasi API untuk modul Manual Review.
 *
 * Endpoint yang di-cover:
 *  • GET  /alerts/my-queue            → antrian yang sedang diklaim analis
 *  • POST /alerts/{id}/claim          → klaim alert (OPEN → IN_PROGRESS)
 *  • POST /alerts/{id}/release        → lepas klaim (IN_PROGRESS → OPEN)
 *  • GET  /alerts/{id}                → detail alert
 *  • POST /reviews/                   → submit vonis (SAFE / FRAUD)
 *  • GET  /reviews/history            → riwayat review (paginated)
 *  • GET  /reviews/metrics            → metrik agregat review
 *  • GET  /reviews/analyst-performance→ performa analis
 *  • GET  /reviews/timeline-analytics → timeline analitik
 *  • POST /reviews/{id}/override      → override vonis (admin)
 *  • POST /reviews/transactions/{id}/report-fraud → false-negative report
 *
 * CATATAN ARSITEKTUR:
 *  - fetchOpenQueue() DIHAPUS dari file ini → gunakan AlertsService.js
 *  - claimAndSubmitReview() DIHAPUS → claim & review harus dilakukan terpisah
 *  - decision_confidence WAJIB dipilih user (LOW | MEDIUM | HIGH), tidak dihitung otomatis
 *  - decision dikirim langsung sebagai "SAFE" | "FRAUD", tidak perlu mapping
 * ─────────────────────────────────────────────────────────────────
 */

import api from "../services/apiService.js";

// ─── Alert Queue (My Queue only) ─────────────────────────────────

/**
 * Ambil antrian alert yang sedang diinvestigasi oleh analis yang login.
 * Status alert: IN_PROGRESS, diklaim oleh user saat ini.
 * Sumber data untuk halaman Manual Review.
 *
 * @param {object} params - { page?: number, limit?: number }
 * @returns {Promise<object>} { items, total, page, limit }
 */
export const fetchMyQueue = async ({ page = 1, limit = 10 } = {}) => {
  const params = new URLSearchParams({ page, limit });
  return api.get(`/alerts/my-queue?${params.toString()}`);
};

/**
 * Ambil detail sebuah alert berdasarkan ID.
 *
 * @param {number} alertId
 * @returns {Promise<object>} alert detail
 */
export const fetchAlertDetail = async (alertId) => {
  return api.get(`/alerts/${alertId}`);
};

/**
 * Klaim sebuah alert — mengunci ke analis yang sedang login.
 * Mengubah status alert: OPEN → IN_PROGRESS.
 * Hanya bisa dilakukan dari halaman Alerts (Open Queue).
 *
 * @param {number} alertId
 * @returns {Promise<object>} { message, alert_id }
 */
export const claimAlert = async (alertId) => {
  return api.post(`/alerts/${alertId}/claim`);
};

/**
 * Lepaskan klaim alert — kembalikan ke antrian umum.
 * Mengubah status alert: IN_PROGRESS → OPEN.
 *
 * @param {number} alertId
 * @returns {Promise<object>} { message, alert_id }
 */
export const releaseAlert = async (alertId) => {
  return api.post(`/alerts/${alertId}/release`);
};

/**
 * Update status alert (khusus SUPER_ADMIN / RISK_MANAGER).
 *
 * @param {number} alertId
 * @param {string} status - "OPEN" | "IN_PROGRESS" | "RESOLVED"
 * @returns {Promise<object>}
 */
export const updateAlertStatus = async (alertId, status) => {
  return api.patch(`/alerts/${alertId}/status?status=${status}`);
};

// ─── Reviews ─────────────────────────────────────────────────────

/**
 * Submit vonis manual review ke backend.
 *
 * PRE-CONDITION: Alert WAJIB sudah di-claim (status IN_PROGRESS) sebelum
 * fungsi ini dipanggil. Review hanya boleh dilakukan dari My Queue.
 *
 * POST-CONDITION: Backend otomatis mengubah status alert → RESOLVED.
 *
 * @param {object} params
 * @param {number} params.alert_id           - ID alert yang sedang diklaim
 * @param {string} params.decision           - "SAFE" | "FRAUD"
 * @param {string} params.decision_confidence - "LOW" | "MEDIUM" | "HIGH" (dipilih user)
 * @param {string} [params.note]             - catatan opsional, max 500 karakter
 * @returns {Promise<object>} { status, message, review_id }
 */
export const submitReview = async ({
  alert_id,
  decision,
  decision_confidence,
  note = null,
}) => {
  // Validasi enum sebelum kirim ke BE
  const validDecisions = ["SAFE", "FRAUD"];
  const validConfidences = ["LOW", "MEDIUM", "HIGH"];

  if (!validDecisions.includes(decision)) {
    throw new Error(`Invalid decision: "${decision}". Must be SAFE or FRAUD.`);
  }
  if (!validConfidences.includes(decision_confidence)) {
    throw new Error(
      `Invalid confidence: "${decision_confidence}". Must be LOW, MEDIUM, or HIGH.`,
    );
  }

  const payload = {
    alert_id,
    decision,
    note: note || null,
    decision_confidence,
  };

  return api.post("/reviews/", payload);
};

/**
 * Ambil riwayat review milik analis yang sedang login.
 * Endpoint: GET /reviews/my-history
 *
 * @param {object} params - { page?: number, limit?: number }
 * @returns {Promise<{ total, page, limit, items }>}
 */
export const fetchMyReviewHistory = async ({ page = 1, limit = 10 } = {}) => {
  return api.get(`/reviews/my-history?page=${page}&limit=${limit}`);
};

/**
 * Ambil metrics personal milik analis yang sedang login.
 * Endpoint: GET /reviews/my-metrics
 * Berbeda dengan fetchReviewMetrics yang global (seluruh tim).
 *
 * @returns {Promise<MyReviewMetricsResponse>}
 */
export const fetchMyReviewMetrics = async () => {
  return api.get("/reviews/my-metrics");
};

/**
 * Ambil riwayat review (paginated) — global, semua reviewer.
 *
 * Response shape: { total, page, limit, items: ReviewHistoryItem[] }
 * Field per item: id, transaction_id, alert_id, decision, review_note,
 *                 previous_status, final_status, reviewed_by, reviewer_name, created_at
 *
 * @param {object} params - { page?: number, limit?: number }
 * @returns {Promise<{ total, page, limit, items }>}
 */
export const fetchReviewHistory = async ({ page = 1, limit = 10 } = {}) => {
  return api.get(`/reviews/history?page=${page}&limit=${limit}`);
};

/**
 * Ambil metrik agregat review.
 * Hanya bisa diakses oleh SUPER_ADMIN dan RISK_MANAGER.
 *
 * @returns {Promise<ReviewMetricsResponse>}
 */
export const fetchReviewMetrics = async () => {
  return api.get("/reviews/metrics");
};

/**
 * Ambil data performa masing-masing analis.
 * Hanya bisa diakses oleh SUPER_ADMIN dan RISK_MANAGER.
 *
 * @returns {Promise<Array<AnalystPerformanceResponse>>}
 */
export const fetchAnalystPerformance = async () => {
  return api.get("/reviews/analyst-performance");
};

/**
 * Ambil data analitik timeline (reviews/hour, fraud/day, queue growth).
 * Hanya bisa diakses oleh SUPER_ADMIN dan RISK_MANAGER.
 *
 * @returns {Promise<ReviewTimelineAnalyticsResponse>}
 */
export const fetchTimelineAnalytics = async () => {
  return api.get("/reviews/timeline-analytics");
};

/**
 * Override keputusan review (khusus SUPER_ADMIN / RISK_MANAGER).
 *
 * @param {number} reviewId
 * @param {object} params
 * @param {string} params.new_decision - "SAFE" | "FRAUD"
 * @param {string} params.reason       - min 10 karakter, max 1000 karakter
 * @returns {Promise<object>}
 */
export const overrideReview = async (reviewId, { new_decision, reason }) => {
  return api.post(`/reviews/${reviewId}/override`, { new_decision, reason });
};

/**
 * Laporkan transaksi sebagai false negative.
 * Hanya bisa diakses oleh SUPER_ADMIN dan RISK_MANAGER.
 *
 * @param {number} transactionId - numeric transaction ID dari backend
 * @param {string} reason        - min 10 karakter, max 1000 karakter
 * @returns {Promise<object>}
 */
export const reportFalseNegative = async (transactionId, reason) => {
  return api.post(`/reviews/transactions/${transactionId}/report-fraud`, {
    reason,
  });
};

// ─── Data Transformers ────────────────────────────────────────────

/**
 * Transform item dari GET /reviews/history ke format render ReviewHistory.
 *
 * Hanya memetakan field yang benar-benar dikirim oleh BE (ReviewHistoryItem schema).
 * Field yang tidak ada di BE (analyst_name, analyst_role, service, amount,
 * risk_score) TIDAK dimasukkan untuk menghindari tampilan "—" palsu.
 *
 * @param {object} item - ReviewHistoryItem dari backend
 * @param {number}  item.id
 * @param {number}  item.transaction_id
 * @param {number|null} item.alert_id
 * @param {string}  item.decision         - "SAFE" | "FRAUD"
 * @param {string|null} item.review_note
 * @param {string|null} item.previous_status
 * @param {string}  item.final_status
 * @param {number|null} item.reviewed_by
 * @param {string}  item.created_at       - ISO datetime string
 * @returns {object} mapped history item
 */
export const mapHistoryItem = (item) => ({
  id: item.id,
  transactionId: item.transaction_id
    ? `TRX-${String(item.transaction_id).padStart(6, "0")}`
    : `RVW-${String(item.id).padStart(6, "0")}`,
  transactionIdRaw: item.transaction_id ?? null,
  alertId: item.alert_id ?? null,
  decision: item.decision, // "SAFE" | "FRAUD"
  decisionConfidence: item.decision_confidence ?? null, // "LOW" | "MEDIUM" | "HIGH"
  reviewNote: item.review_note || null,
  previousStatus: item.previous_status || null,
  finalStatus: item.final_status,
  reviewedBy: item.reviewed_by ?? null,
  reviewerName: item.reviewer_name ?? null, // ✅ Snapshot nama — immutable audit trail
  createdAt: item.created_at,
  reviewStartedAt: item.review_started_at ?? null,
  reviewCompletedAt: item.review_completed_at ?? null,

  // Override info
  isOverridden: item.is_overridden ?? false,
  overriddenBy: item.overridden_by ?? null,
  overriddenAt: item.overridden_at ?? null,
  overrideReason: item.override_reason ?? null,

  // Transaction snapshot — data transaksi immutable saat review dilakukan
  transactionSnapshot: item.transaction_snapshot ?? null,
});

/**
 * Transform list items dari /reviews/history.
 *
 * @param {Array} items
 * @returns {Array}
 */
export const mapHistoryItems = (items = []) => items.map(mapHistoryItem);

// ─── Alert Transformer (untuk My Queue) ──────────────────────────

/**
 * Transform objek alert dari /alerts/my-queue ke format yang dipakai
 * halaman Manual Review. Hanya memetakan field yang tersedia di BE.
 *
 * Alert fields dari BE: id, transaction_id, alert_type, severity, priority,
 * priority_label, title, message, status, created_at, type, service
 *
 * @param {object} alert - alert object dari /alerts/my-queue
 * @returns {object} mapped alert for Manual Review page
 */
export const mapMyQueueAlert = (alert) => ({
  alertId: alert.id,
  transactionId: alert.transaction_id,
  title: alert.title || "Untitled Alert",
  message: alert.message || "",
  severity: alert.severity,
  priorityLabel: alert.priority_label,
  priority: alert.priority ?? 0,
  status: alert.status,
  alertType: alert.type || alert.alert_type || "—",
  service: alert.service || "—",
  createdAt: alert.created_at,
});

/**
 * Transform list alerts dari /alerts/my-queue.
 *
 * @param {Array} alerts
 * @returns {Array}
 */
export const mapMyQueueAlerts = (alerts = []) => alerts.map(mapMyQueueAlert);

// ─── Exports ──────────────────────────────────────────────────────

const reviewApiService = {
  // Alert queue
  fetchMyQueue,
  fetchAlertDetail,
  claimAlert,
  releaseAlert,
  updateAlertStatus,

  // Reviews
  submitReview,
  fetchMyReviewHistory,
  fetchMyReviewMetrics,
  fetchReviewHistory,
  fetchReviewMetrics,
  fetchAnalystPerformance,
  fetchTimelineAnalytics,
  overrideReview,
  reportFalseNegative,

  // Transformers
  mapHistoryItem,
  mapHistoryItems,
  mapMyQueueAlert,
  mapMyQueueAlerts,
};

export default reviewApiService;
