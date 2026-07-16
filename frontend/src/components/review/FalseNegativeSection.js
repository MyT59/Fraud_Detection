import React, { useState } from "react";
import { reportFalseNegative } from "../../services/reviewApiService";

const FalseNegativeSection = () => {
  const [transactionId, setTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const isDisabled = submitting || !transactionId || reason.trim().length < 10;

  const handleSubmit = async () => {
    const idNum = parseInt(transactionId.trim(), 10);
    if (!idNum || Number.isNaN(idNum)) {
      setResult({
        type: "error",
        message: "Transaction ID harus berupa angka yang valid.",
      });
      return;
    }
    if (reason.trim().length < 10) {
      setResult({ type: "error", message: "Alasan minimal 10 karakter." });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      await reportFalseNegative(idNum, reason.trim());
      setResult({
        type: "success",
        message: `Transaksi #${idNum} berhasil ditandai sebagai False Negative. Dataset retraining diperbarui.`,
      });
      setTransactionId("");
      setReason("");
    } catch (err) {
      const status = err.status ?? 0;
      let message;
      if (status === 404) message = `Transaksi #${idNum} tidak ditemukan.`;
      else if (status === 400)
        message = err.message || "Transaksi ini sudah berstatus FRAUD.";
      else
        message = err.message || "Gagal melaporkan false negative. Coba lagi.";
      setResult({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="false-negative-panel">
      <div className="false-negative-header">
        <span className="review-panel-icon orange">
          <i className="bi bi-bug-fill" />
        </span>
        <div>
          <h3>Report False Negative</h3>
          <p>
            Laporkan transaksi yang lolos dari deteksi sistem, namun setelah
            investigasi terbukti fraud.
          </p>
        </div>
      </div>

      <div className="false-negative-note">
        <i className="bi bi-exclamation-triangle-fill" />
        <span>
          Gunakan fitur ini hanya untuk transaksi yang benar-benar lolos dari ML,
          rule, dan pattern. Status transaksi akan menjadi FRAUD dan dataset
          retraining akan diperbarui.
        </span>
      </div>

      <div className="false-negative-form">
        <label className="review-field">
          <span>
            Transaction ID <strong>*</strong>
          </span>
          <input
            type="number"
            min="1"
            value={transactionId}
            onChange={(e) => {
              setTransactionId(e.target.value);
              setResult(null);
            }}
            placeholder="Contoh: 12345"
          />
          <small>Numeric ID dari tabel transactions</small>
        </label>

        <label className="review-field review-field-wide">
          <span>
            Alasan <strong>*</strong>
            <em>min. 10, maks. 1000 karakter</em>
          </span>
          <textarea
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setResult(null);
            }}
            placeholder="Jelaskan kenapa transaksi ini seharusnya terdeteksi sebagai fraud..."
          />
          <small className="review-char-count">{reason.length}/1000</small>
        </label>
      </div>

      {result && (
        <div className={`review-form-result ${result.type}`}>
          <i
            className={`bi ${
              result.type === "success"
                ? "bi-check-circle-fill"
                : "bi-exclamation-circle-fill"
            }`}
          />
          {result.message}
        </div>
      )}

      <div className="false-negative-actions">
        <button
          className="review-danger-submit"
          onClick={handleSubmit}
          disabled={isDisabled}
        >
          {submitting ? (
            <>
              <span className="review-spinner" />
              Melaporkan...
            </>
          ) : (
            <>
              <i className="bi bi-bug-fill" />
              Laporkan False Negative
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default FalseNegativeSection;
