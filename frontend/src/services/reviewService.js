import { BASE_URL } from './mlService';

/**
 * Submit hasil review admin ke backend sebagai feedback loop ML.
 * Data ini akan diappend ke review_feedback.csv dan dipakai saat retrain model.
 *
 * @param {object} txn        - Objek transaksi yang sudah dinormalise
 * @param {string} decision   - 'approved' | 'rejected'
 * @param {string} notes      - Catatan reviewer (opsional)
 * @returns {Promise<object>} - Response dari backend
 */
export const submitReview = async (txn, decision, notes = '') => {
  const IS_FRAUD = decision === 'rejected' ? 1 : 0;

  // Bangun raw record sesuai domain
  const record =
    txn.service === 'agenusa'
      ? {
          ACCOUNT_NUMBER:      txn.ACCOUNT_NUMBER,
          TIMESTAMP_DB:        txn.TIMESTAMP_DB,
          AMOUNT:              txn.AMOUNT,
          DEST_ACCOUNT_NUMBER: txn.DEST_ACCOUNT_NUMBER,
          PROCESSING_CODE:     txn.PROCESSING_CODE,
          RESPONSE_CODE:       txn.RESPONSE_CODE,
        }
      : {
          CUSTOMER_ID:     txn.CUSTOMER_ID,
          BILL_ID:         txn.BILL_ID,
          BILL_AMOUNT:     txn.BILL_AMOUNT,
          PAYMENT_AMOUNT:  txn.PAYMENT_AMOUNT,
          CHANNEL:         txn.CHANNEL,
          REFUND_FLAG:     txn.REFUND_FLAG,
        };

  const payload = {
    transaction_id:  txn.id,
    domain:          txn.service,
    is_fraud:        IS_FRAUD,
    reviewer_notes:  notes,
    reviewed_at:     new Date().toISOString(),
    ml_fraud_score:  txn.rawScore,
    matched_patterns: txn.matched_patterns || [],
    record,
  };

  const res = await fetch(`${BASE_URL}/review/submit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Submit review gagal ${res.status}: ${await res.text()}`);
  }

  return res.json();
};