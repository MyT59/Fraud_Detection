import React, { useState } from "react";
import { DecisionBadge } from "./ReviewBadges";

/**
 * OverrideModal.js
 * Modal untuk override keputusan review.
 * Hanya bisa diakses oleh RISK_MANAGER & SUPER_ADMIN.
 */
const OverrideModal = ({ item, onClose, onSubmit, pending }) => {
  const [newDecision, setNewDecision] = useState(
    item.decision === "SAFE" ? "FRAUD" : "SAFE",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError("Alasan minimal 10 karakter.");
      return;
    }
    setError(null);
    await onSubmit(item.reviewId, newDecision, reason.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="txn-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-txn-id">
              Override Review #{item.reviewId}
            </span>
            <div style={{ fontSize: ".78rem", color: "#6b7280", marginTop: 2 }}>
              Transaction: {item.transactionId}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="modal-body">
          {/* Current decision warning */}
          <div
            style={{
              padding: ".75rem 1rem",
              background: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              fontSize: ".82rem",
              color: "#92400e",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: ".5rem",
            }}
          >
            <i className="bi bi-exclamation-triangle-fill" />
            Keputusan saat ini: <DecisionBadge decision={item.decision} />
          </div>

          {/* New decision picker */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: ".85rem",
                marginBottom: ".5rem",
              }}
            >
              Ubah Keputusan Menjadi
            </label>
            <div style={{ display: "flex", gap: ".5rem" }}>
              {["SAFE", "FRAUD"].map((d) => (
                <button
                  key={d}
                  onClick={() => setNewDecision(d)}
                  style={{
                    flex: 1,
                    padding: ".6rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: ".85rem",
                    border: `2px solid ${newDecision === d ? (d === "SAFE" ? "#16a34a" : "#dc2626") : "#e2e8f0"}`,
                    background:
                      newDecision === d
                        ? d === "SAFE"
                          ? "#f0fdf4"
                          : "#fef2f2"
                        : "#fff",
                    color:
                      newDecision === d
                        ? d === "SAFE"
                          ? "#15803d"
                          : "#dc2626"
                        : "#6b7280",
                    fontWeight: newDecision === d ? 700 : 500,
                  }}
                >
                  {d === "SAFE" ? "✅ SAFE" : "❌ FRAUD"}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: ".85rem",
                marginBottom: ".5rem",
              }}
            >
              Alasan Override <span style={{ color: "#dc2626" }}>*</span>
              <span
                style={{
                  fontWeight: 400,
                  color: "#94a3b8",
                  fontSize: ".78rem",
                  marginLeft: 4,
                }}
              >
                (min. 10 karakter)
              </span>
            </label>
            <textarea
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan override keputusan ini..."
              style={{
                width: "100%",
                padding: ".75rem",
                border: "1.5px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: ".875rem",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                fontSize: ".72rem",
                color: "#94a3b8",
                textAlign: "right",
              }}
            >
              {reason.length}/1000
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: ".5rem .75rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: ".82rem",
                marginBottom: "1rem",
              }}
            >
              <i
                className="bi bi-exclamation-circle-fill"
                style={{ marginRight: 6 }}
              />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="modal-confirm-row">
            <button
              className="modal-btn-cancel"
              onClick={onClose}
              disabled={pending}
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={pending || reason.trim().length < 10}
              style={{
                padding: ".6rem 1.25rem",
                background: newDecision === "SAFE" ? "#16a34a" : "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: ".875rem",
                cursor: "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? "Menyimpan…" : `Konfirmasi Override → ${newDecision}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverrideModal;
