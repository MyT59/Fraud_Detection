/**
 * reviewService.js
 * ─────────────────
 * Dua fungsi utama:
 *   submitReview   → POST /review/submit  (simpan ke review_feedback.csv)
 *   postFraudAlert → POST /alerts          (simpan alert ke alerts_log.json)
 *
 * Keduanya dipanggil dari ManualReview.js → handleReview() setelah
 * analyst membuat keputusan approve / reject.
 */

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);

const buildRecord = (txn) =>
  txn.service === "agenusa"
    ? {
        ACCOUNT_NUMBER:      txn.ACCOUNT_NUMBER,
        DEST_ACCOUNT_NUMBER: txn.DEST_ACCOUNT_NUMBER,
        TIMESTAMP_DB:        txn.TIMESTAMP_DB,
        AMOUNT:              txn.AMOUNT,
        PROCESSING_CODE:     txn.PROCESSING_CODE,
        RESPONSE_CODE:       txn.RESPONSE_CODE,
      }
    : {
        CUSTOMER_ID:    txn.CUSTOMER_ID,
        BILL_ID:        txn.BILL_ID,
        BILL_AMOUNT:    txn.BILL_AMOUNT,
        PAYMENT_AMOUNT: txn.PAYMENT_AMOUNT,
        CHANNEL:        txn.CHANNEL,
        REFUND_FLAG:    txn.REFUND_FLAG,
      };

/* ── 1. submitReview ─────────────────────────────────────────────────────── */
/**
 * Kirim keputusan review ke backend untuk disimpan ke review_feedback.csv
 * (feedback loop retrain model).
 *
 * @param {object} txn      - objek transaksi yang sedang di-review
 * @param {string} decision - "approved" | "rejected"
 * @param {string} notes    - catatan opsional dari reviewer
 */
export const submitReview = async (txn, decision, notes = "") => {
  const payload = {
    transaction_id:   txn.id,
    domain:           txn.service,
    decision,
    reviewer_notes:   notes,
    reviewed_at:      new Date().toISOString(),
    ml_fraud_score:   txn.rawScore ?? 0,
    matched_patterns: txn.matched_patterns || [],
    record:           buildRecord(txn),
  };

  const res = await fetch(`${API_BASE}/review/submit`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`submitReview HTTP ${res.status}`);
  return res.json();
};

/* ── 2. postFraudAlert ───────────────────────────────────────────────────── */
/**
 * Buat alert baru di Alerts Log setiap kali reviewer membuat keputusan.
 *
 * Aturan severity:
 *   rejected  → ikut riskLevel transaksi (critical / high / medium / low)
 *   approved  → selalu "low"  (false positive — tidak mendesak)
 *
 * Aturan type:
 *   rejected  → "fraud"
 *   approved  → "review"
 *
 * @param {object} txn      - objek transaksi yang sudah di-normalise()
 * @param {string} decision - "approved" | "rejected"
 * @param {string} notes    - catatan reviewer
 */
export const postFraudAlert = async (txn, decision, notes = "") => {
  const amount = txn.service === "agenusa" ? txn.AMOUNT : txn.BILL_AMOUNT;
  const patterns = txn.anomalies?.slice(0, 2) || [];

  /* ── Severity ── */
  const severity =
    decision === "rejected"
      ? txn.riskLevel || "high"   // critical | high | medium | low
      : "low";

  /* ── Title ── */
  const title =
    decision === "rejected"
      ? `Fraud Dikonfirmasi — ${txn.id}`
      : `Transaksi Disetujui — ${txn.id}`;

  /* ── Message ── */
  const patternStr =
    patterns.length > 0 ? `Pattern: ${patterns.join(", ")}.` : "";

  const message =
    decision === "rejected"
      ? `Transaksi ${txn.id} (${txn.service.toUpperCase()}) ditolak setelah manual review. ` +
        `Fraud score: ${txn.fraudScore}/100. ` +
        `Jumlah: ${fmt(amount)}. ` +
        patternStr +
        (notes ? ` Catatan: ${notes}` : "")
      : `Transaksi ${txn.id} (${txn.service.toUpperCase()}) diverifikasi dan disetujui. ` +
        `Akun: ${txn.accountId}. ` +
        `ML score: ${txn.fraudScore}/100. ` +
        (notes ? `Catatan: ${notes}` : "False positive — tidak perlu tindakan lanjut.");

  const payload = {
    type:     decision === "rejected" ? "fraud" : "review",
    severity,
    title,
    message,
    txnId:  txn.id,
    status: decision === "rejected" ? "unread" : "resolved",
  };

  const res = await fetch(`${API_BASE}/alerts`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`postFraudAlert HTTP ${res.status}`);
  return res.json();
};