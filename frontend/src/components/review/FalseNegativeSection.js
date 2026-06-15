import React, { useState } from "react";
import { reportFalseNegative } from "../../services/reviewApiService";

/**
 * FalseNegativeSection.js
 * Form untuk melaporkan transaksi yang lolos deteksi (false negative).
 * Endpoint: POST /reviews/transactions/{id}/report-fraud
 * Hanya RISK_MANAGER & SUPER_ADMIN.
 */
const FalseNegativeSection = () => {
  const [transactionId, setTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: "success"|"error", message }

  const isDisabled = submitting || !transactionId || reason.trim().length < 10;

  const handleSubmit = async () => {
    const idNum = parseInt(transactionId.trim(), 10);
    if (!idNum || isNaN(idNum)) {
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
    <div style={{ marginTop: "2rem" }}>
      {/* Divider */}
      <div style={{ borderTop: "2px dashed #e2e8f0", margin: "0 0 1.5rem" }} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".6rem",
          marginBottom: ".75rem",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ea580c",
            fontSize: "1.1rem",
            flexShrink: 0,
          }}
        >
          <i className="bi bi-bug-fill" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#111827" }}>
            Report False Negative
          </div>
          <div style={{ fontSize: ".75rem", color: "#6b7280" }}>
            Laporkan transaksi yang lolos deteksi sistem namun sebenarnya fraud
          </div>
        </div>
      </div>

      {/* Warning */}
      <div
        style={{
          padding: ".75rem 1rem",
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "8px",
          fontSize: ".82rem",
          color: "#c2410c",
          marginBottom: "1.25rem",
          display: "flex",
          gap: ".5rem",
        }}
      >
        <i
          className="bi bi-exclamation-triangle-fill"
          style={{ flexShrink: 0, marginTop: 1 }}
        />
        <span>
          Fitur ini untuk melaporkan transaksi yang{" "}
          <strong>lolos dari semua sistem deteksi</strong> (ML, Rule, Pattern)
          namun terbukti fraud. Tindakan ini akan mengubah status transaksi
          menjadi <strong>FRAUD</strong> dan memperbarui dataset retraining
          model ML.
        </span>
      </div>

      {/* Form */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          {/* Transaction ID */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: ".82rem",
                color: "#374151",
                marginBottom: ".4rem",
              }}
            >
              Transaction ID <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="number"
              min="1"
              value={transactionId}
              onChange={(e) => {
                setTransactionId(e.target.value);
                setResult(null);
              }}
              placeholder="Contoh: 12345"
              style={{
                width: "100%",
                padding: ".6rem .875rem",
                border: "1.5px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: ".875rem",
                color: "#0f172a",
                background: "#f8fafc",
                boxSizing: "border-box",
                fontFamily: "IBM Plex Mono, monospace",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#ea580c";
                e.target.style.background = "#fff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.background = "#f8fafc";
              }}
            />
            <div
              style={{
                fontSize: ".7rem",
                color: "#94a3b8",
                marginTop: ".25rem",
              }}
            >
              Numeric ID dari tabel transactions
            </div>
          </div>

          {/* Reason */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: ".82rem",
                color: "#374151",
                marginBottom: ".4rem",
              }}
            >
              Alasan <span style={{ color: "#dc2626" }}>*</span>
              <span
                style={{
                  fontWeight: 400,
                  color: "#94a3b8",
                  fontSize: ".75rem",
                  marginLeft: 4,
                }}
              >
                (min. 10, maks. 1000 karakter)
              </span>
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setResult(null);
              }}
              placeholder="Jelaskan mengapa transaksi ini seharusnya terdeteksi sebagai fraud..."
              style={{
                width: "100%",
                padding: ".6rem .875rem",
                border: "1.5px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: ".875rem",
                color: "#0f172a",
                background: "#f8fafc",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#ea580c";
                e.target.style.background = "#fff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.background = "#f8fafc";
              }}
            />
            <div
              style={{
                fontSize: ".72rem",
                color: "#94a3b8",
                textAlign: "right",
                marginTop: ".2rem",
              }}
            >
              {reason.length}/1000
            </div>
          </div>
        </div>

        {/* Result feedback */}
        {result && (
          <div
            style={{
              padding: ".6rem 1rem",
              borderRadius: "8px",
              fontSize: ".82rem",
              fontWeight: 600,
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: ".5rem",
              background: result.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${result.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              color: result.type === "success" ? "#15803d" : "#dc2626",
            }}
          >
            <i
              className={`bi ${result.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`}
            />
            {result.message}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".5rem",
              padding: ".625rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: ".875rem",
              border: "none",
              background: isDisabled ? "#f3f4f6" : "#ea580c",
              color: isDisabled ? "#9ca3af" : "#fff",
              cursor: isDisabled ? "not-allowed" : "pointer",
              transition: "all .15s",
            }}
          >
            {submitting ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin .6s linear infinite",
                  }}
                />
                Melaporkan...
              </>
            ) : (
              <>
                <i className="bi bi-bug-fill" /> Laporkan False Negative
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FalseNegativeSection;
