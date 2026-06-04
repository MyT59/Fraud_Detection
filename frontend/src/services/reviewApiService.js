/**
 * reviewApiService.js
 * ─────────────────────────────────────────────────────────────────
 * Lapisan integrasi API untuk modul Manual Review.
 *
 * Meng-cover seluruh endpoint yang relevan dari API Documentation:
 *  • GET  /alerts/open-queue          → ambil antrian alert terbuka
 *  • GET  /alerts/my-queue            → antrian yang sedang diklaim analis
 *  • POST /alerts/{id}/claim          → klaim alert (lock investigasi)
 *  • POST /alerts/{id}/release        → lepas klaim
 *  • GET  /alerts/{id}                → detail alert
 *  • POST /reviews/                   → submit vonis (SAFE / FRAUD)
 *  • GET  /reviews/history            → riwayat review (paginated)
 *  • GET  /reviews/metrics            → metrik agregat review
 *  • GET  /reviews/analyst-performance→ performa analis
 *  • GET  /reviews/timeline-analytics → timeline analitik
 *  • POST /reviews/{id}/override      → override vonis (admin)
 *  • POST /reviews/transactions/{id}/report-fraud → false-negative report
 * ─────────────────────────────────────────────────────────────────
 */

import api from "../services/apiService.js"; // pakai instance api yang sudah ada (auto token refresh)

// ─── Konstanta ──────────────────────────────────────────────────

/**
 * Mapping confidence level berdasarkan fraud score transaksi.
 * Dipakai untuk mengisi field decision_confidence saat submit review.
 */
export const resolveConfidence = (fraudScore) => {
  if (fraudScore >= 80) return "HIGH";
  if (fraudScore >= 55) return "MEDIUM";
  return "LOW";
};

/**
 * Map status frontend (approved/rejected) → enum backend (SAFE/FRAUD).
 */
export const toBackendDecision = (frontendDecision) => {
  return frontendDecision === "approved" ? "SAFE" : "FRAUD";
};

/**
 * Map enum backend (SAFE/FRAUD) → status frontend (approved/rejected).
 */
export const toFrontendStatus = (backendDecision) => {
  if (!backendDecision) return "pending";
  const d = backendDecision.toUpperCase();
  if (d === "SAFE") return "approved";
  if (d === "FRAUD") return "rejected";
  return "pending";
};

// ─── Alert Queue ─────────────────────────────────────────────────

/**
 * Ambil antrian alert terbuka (OPEN), diurutkan prioritas tertinggi dulu.
 * @param {object} params - { priority?: string, limit?: number }
 * @returns {Promise<Array>} list of alerts
 */
export const fetchOpenQueue = async ({ priority = null, limit = 50 } = {}) => {
  const qs = new URLSearchParams();
  if (priority) qs.set("priority", priority);
  qs.set("limit", String(limit));
  return api.get(`/alerts/open-queue?${qs.toString()}`);
};

/**
 * Ambil antrian yang sedang diinvestigasi analis yang login (IN_PROGRESS).
 * @returns {Promise<Array>} list of in-progress alerts
 */
export const fetchMyQueue = async () => {
  return api.get("/alerts/my-queue");
};

/**
 * Ambil detail sebuah alert berdasarkan ID.
 * @param {number} alertId
 * @returns {Promise<object>} alert detail
 */
export const fetchAlertDetail = async (alertId) => {
  return api.get(`/alerts/${alertId}`);
};

/**
 * Klaim sebuah alert – mengunci ke analis yang sedang login (OPEN → IN_PROGRESS).
 * @param {number} alertId
 * @returns {Promise<object>} { message, alert_id }
 */
export const claimAlert = async (alertId) => {
  return api.post(`/alerts/${alertId}/claim`);
};

/**
 * Lepaskan klaim alert – kembalikan ke antrian umum (IN_PROGRESS → OPEN).
 * @param {number} alertId
 * @returns {Promise<object>} { message, alert_id }
 */
export const releaseAlert = async (alertId) => {
  return api.post(`/alerts/${alertId}/release`);
};

/**
 * Update status alert (khusus SUPER_ADMIN / RISK_MANAGER).
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
 * Flow yang benar sesuai dokumentasi:
 *  1. Alert wajib sudah di-CLAIM (status IN_PROGRESS) sebelum submit.
 *  2. Keputusan: SAFE (approve) atau FRAUD (reject).
 *  3. Setelah submit, backend otomatis set alert → RESOLVED.
 *
 * @param {object} params
 * @param {number}  params.alertId          - ID alert yang sedang diklaim
 * @param {string}  params.frontendDecision - "approved" | "rejected"
 * @param {string}  [params.note]           - catatan opsional (max 500 char)
 * @param {number}  [params.fraudScore]     - skor fraud untuk resolve confidence
 * @returns {Promise<object>} { status, message, review_id }
 */
export const submitReview = async ({
  alertId,
  frontendDecision,
  note = "",
  fraudScore = 50,
}) => {
  const decision = toBackendDecision(frontendDecision);
  const decision_confidence = resolveConfidence(fraudScore);

  const payload = {
    alert_id: alertId,
    decision,
    note: note || null,
    decision_confidence,
  };

  return api.post("/reviews/", payload);
};

/**
 * Ambil riwayat review (paginated).
 * @param {object} params - { page?: number, limit?: number }
 * @returns {Promise<{ total, page, limit, items }>}
 */
export const fetchReviewHistory = async ({ page = 1, limit = 10 } = {}) => {
  return api.get(`/reviews/history?page=${page}&limit=${limit}`);
};

/**
 * Ambil metrik agregat review hari ini.
 * @returns {Promise<ReviewMetricsResponse>}
 */
export const fetchReviewMetrics = async () => {
  return api.get("/reviews/metrics");
};

/**
 * Ambil data performa masing-masing analis.
 * @returns {Promise<Array<AnalystPerformanceResponse>>}
 */
export const fetchAnalystPerformance = async () => {
  return api.get("/reviews/analyst-performance");
};

/**
 * Ambil data analitik timeline (reviews/hour, fraud/day, queue growth).
 * @returns {Promise<ReviewTimelineAnalyticsResponse>}
 */
export const fetchTimelineAnalytics = async () => {
  return api.get("/reviews/timeline-analytics");
};

/**
 * Override keputusan review (khusus SUPER_ADMIN / RISK_MANAGER).
 * @param {number} reviewId
 * @param {object} params - { new_decision: "SAFE"|"FRAUD", reason: string }
 * @returns {Promise<object>}
 */
export const overrideReview = async (reviewId, { new_decision, reason }) => {
  return api.post(`/reviews/${reviewId}/override`, { new_decision, reason });
};

/**
 * Laporkan transaksi sebagai false negative (lolos tapi sebenarnya fraud).
 * @param {number} transactionId - numeric transaction ID dari backend
 * @param {string} reason        - min 10 karakter
 * @returns {Promise<object>}
 */
export const reportFalseNegative = async (transactionId, reason) => {
  return api.post(
    `/reviews/transactions/${transactionId}/report-fraud`,
    { reason },
  );
};

// ─── Alur lengkap: Claim → Submit ────────────────────────────────

/**
 * Alur satu fungsi: klaim alert lalu langsung submit vonis.
 * Berguna untuk bulk action atau submit cepat dari modal.
 *
 * @param {object} params
 * @param {number} params.alertId
 * @param {string} params.frontendDecision  - "approved" | "rejected"
 * @param {string} [params.note]
 * @param {number} [params.fraudScore]
 * @returns {Promise<{ claimResult, reviewResult }>}
 */
export const claimAndSubmitReview = async ({
  alertId,
  frontendDecision,
  note = "",
  fraudScore = 50,
}) => {
  // Step 1: klaim alert
  const claimResult = await claimAlert(alertId);

  // Step 2: submit vonis
  const reviewResult = await submitReview({
    alertId,
    frontendDecision,
    note,
    fraudScore,
  });

  return { claimResult, reviewResult };
};

// ─── Transformasi data alert → format txn frontend ───────────────

/**
 * Ubah objek alert dari backend menjadi format transaksi yang dipakai frontend.
 *
 * Backend alert memiliki field: id, transaction_id, service, severity, priority,
 * status, title, description, trx_id, badge, type, etc.
 *
 * Fungsi ini mengambil alert + data transaksi (dari alert detail) dan
 * mengembalikan objek yang kompatibel dengan normalise() dan render tabel.
 *
 * @param {object} alert   - objek alert dari /alerts/open-queue atau /alerts/{id}
 * @param {object} [txnData] - data transaksi tambahan (opsional, jika sudah ada)
 * @returns {object} transaksi dalam format frontend
 */
export const mapAlertToTransaction = (alert, txnData = null) => {
  const service =
    (alert.service || "").toLowerCase() === "nusabill" ? "nusabill" : "agenusa";

  // Parse anomalies/patterns dari message/description alert
  const parseAnomalies = (msg = "") => {
    const lines = msg.split("\n").filter((l) => l.includes("Pattern"));
    return lines
      .map((l) => l.replace(/.*Pattern[:\s]*/i, "").trim())
      .filter(Boolean);
  };

  const rawScore =
    alert.priority != null ? Math.min(alert.priority / 100, 1) : 0.5;
  const fraudScore = Math.round(rawScore * 100);

  const scoreToRisk = (score) => {
    if (score >= 88) return "critical";
    if (score >= 70) return "high";
    if (score >= 50) return "medium";
    return "low";
  };

  const base = {
    // ID frontend: pakai trx_id dari alert kalau ada, fallback ke alert.id
    id: alert.trx_id || String(alert.transaction_id || alert.id),
    _alertId: alert.id,           // simpan alert ID asli untuk claim/submit
    _transactionId: alert.transaction_id,
    service,
    status: "pending",            // alert terbuka selalu pending di frontend
    rawScore,
    fraudScore,
    riskLevel: scoreToRisk(fraudScore),
    anomalies: parseAnomalies(alert.description || alert.message_raw || ""),
    matched_patterns: [],
    dateTime: alert.created_at || null,
    _alertData: alert,            // simpan seluruh data alert asli
  };

  // Jika ada txnData spesifik dari detail alert, map field-nya
  if (txnData) {
    return { ...base, ...txnData };
  }

  // Estimasi field minimal dari data alert yang ada
  if (service === "agenusa") {
    return {
      ...base,
      ACCOUNT_NUMBER: alert.user_account || "—",
      DEST_ACCOUNT_NUMBER: "—",
      TIMESTAMP_DB: alert.created_at,
      AMOUNT: 0,
      PROCESSING_CODE: 10000,
      RESPONSE_CODE: 0,
      accountId: alert.user_account || "—",
      amount: 0,
      amountNote: null,
      destOrBill: "—",
      typeOrChannel: "Transfer",
    };
  } else {
    return {
      ...base,
      CUSTOMER_ID: alert.user_account || "—",
      BILL_ID: "—",
      BILL_AMOUNT: 0,
      PAYMENT_AMOUNT: 0,
      CHANNEL: "—",
      REFUND_FLAG: 0,
      accountId: alert.user_account || "—",
      amount: 0,
      amountNote: null,
      destOrBill: "—",
      typeOrChannel: "—",
    };
  }
};

/**
 * Ubah list alert dari open-queue menjadi list transaksi frontend.
 * @param {Array} alerts
 * @returns {Array} transaksi siap render
 */
export const mapAlertsToTransactions = (alerts = []) => {
  return alerts.map((a) => mapAlertToTransaction(a));
};

// ─── Review History transform ─────────────────────────────────────

/**
 * Transform item dari /reviews/history ke format yang dipakai ReviewHistory.js
 * @param {object} item - ReviewHistoryItem dari backend
 * @returns {object}
 */
export const mapHistoryItem = (item) => ({
  id: item.id,
  transactionId: String(item.transaction_id),
  alertId: item.alert_id,
  action: toFrontendStatus(item.decision), // "approved" | "rejected"
  decision: item.decision,                  // "SAFE" | "FRAUD"
  notes: item.review_note || "",
  previousStatus: item.previous_status,
  finalStatus: item.final_status,
  reviewedBy: item.reviewed_by,
  timestamp: item.created_at,
  // field opsional yang mungkin tidak ada tergantung backend response
  reviewer: item.analyst_name || "—",
  reviewerRole: item.analyst_role || "Analyst",
});

export default {
  fetchOpenQueue,
  fetchMyQueue,
  fetchAlertDetail,
  claimAlert,
  releaseAlert,
  updateAlertStatus,
  submitReview,
  claimAndSubmitReview,
  fetchReviewHistory,
  fetchReviewMetrics,
  fetchAnalystPerformance,
  fetchTimelineAnalytics,
  overrideReview,
  reportFalseNegative,
  mapAlertToTransaction,
  mapAlertsToTransactions,
  mapHistoryItem,
  toBackendDecision,
  toFrontendStatus,
  resolveConfidence,
};