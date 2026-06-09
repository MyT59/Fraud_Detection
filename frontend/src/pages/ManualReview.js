import React, { useState, useEffect, useCallback } from "react";
import PageLoader from "../components/common/PageLoader";
import useRole from "../hooks/useRole";
import {
  fetchMyQueue,
  fetchReviewMetrics,
  submitReview,
  fetchAnalystPerformance,
  fetchTimelineAnalytics,
  overrideReview,
  reportFalseNegative,
  fetchReviewHistory,
  mapHistoryItems,
} from "../services/reviewApiService";
import api from "../services/apiService";
import "./ManualReview.css";

// ─── Helpers ──────────────────────────────────────────────────────

const fmtDate = (ds) => {
  if (!ds) return "—";
  return new Date(ds).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const mapMyQueueAlert = (alert) => ({
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

// ─── Badges ───────────────────────────────────────────────────────

const SEVERITY_META = {
  CRITICAL: { cls: "sev-critical", icon: "bi-exclamation-octagon-fill" },
  HIGH: { cls: "sev-high", icon: "bi-exclamation-triangle-fill" },
  MEDIUM: { cls: "sev-medium", icon: "bi-exclamation-circle-fill" },
  LOW: { cls: "sev-low", icon: "bi-info-circle-fill" },
};

const SeverityBadge = ({ severity }) => {
  const meta =
    SEVERITY_META[(severity || "LOW").toUpperCase()] || SEVERITY_META.LOW;
  return (
    <span className={`alert-badge ${meta.cls}`}>
      <i className={`bi ${meta.icon}`} /> {severity}
    </span>
  );
};

const ServiceBadge = ({ service }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: ".68rem",
      fontWeight: 700,
      background: service === "AGENUSA" ? "#eff6ff" : "#fdf4ff",
      color: service === "AGENUSA" ? "#1d4ed8" : "#7c3aed",
      border: `1px solid ${service === "AGENUSA" ? "#bfdbfe" : "#e9d5ff"}`,
    }}
  >
    {service || "—"}
  </span>
);

const DecisionBadge = ({ decision }) => {
  const meta =
    decision === "SAFE"
      ? { bg: "#dcfce7", color: "#15803d", icon: "bi-check-circle-fill" }
      : { bg: "#fee2e2", color: "#b91c1c", icon: "bi-x-circle-fill" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".3rem",
        padding: "2px 8px",
        borderRadius: "10px",
        fontSize: ".75rem",
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
      }}
    >
      <i className={`bi ${meta.icon}`} /> {decision}
    </span>
  );
};

// ─── Review Stats Bar ─────────────────────────────────────────────

const ReviewStatsBar = ({ metrics, loading }) => {
  if (loading || !metrics) return null;
  const stats = [
    {
      label: "Open Alerts",
      value: metrics.open_alerts ?? "—",
      icon: "bi-inbox-fill",
      color: "#f59e0b",
    },
    {
      label: "In Progress",
      value: metrics.in_progress_alerts ?? "—",
      icon: "bi-hourglass-split",
      color: "#3b82f6",
    },
    {
      label: "Total Reviewed",
      value: metrics.total_reviews ?? "—",
      icon: "bi-clipboard-check",
      color: "#8b5cf6",
    },
    {
      label: "Fraud Rate",
      value:
        metrics.fraud_confirmation_rate != null
          ? `${metrics.fraud_confirmation_rate.toFixed(1)}%`
          : "—",
      icon: "bi-shield-exclamation",
      color: "#ef4444",
    },
    {
      label: "Avg. Review Time",
      value:
        metrics.avg_review_duration_minutes != null
          ? `${metrics.avg_review_duration_minutes.toFixed(1)} min`
          : "—",
      icon: "bi-stopwatch",
      color: "#10b981",
    },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: ".75rem",
        flexWrap: "wrap",
        marginBottom: "1.25rem",
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            flex: "1 1 120px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: ".75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: `${s.color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: s.color,
              fontSize: "1.1rem",
              flexShrink: 0,
            }}
          >
            <i className={`bi ${s.icon}`} />
          </div>
          <div>
            <div
              style={{ fontSize: ".72rem", color: "#64748b", fontWeight: 500 }}
            >
              {s.label}
            </div>
            <div
              style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}
            >
              {s.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Alert Review Modal ───────────────────────────────────────────

const AlertModal = ({ alert, onClose, onReview }) => {
  const [decision, setDecision] = useState("");
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleDecide = (d) => {
    setDecision(d);
    setConfirming(true);
    setError(null);
  };
  const handleCancel = () => {
    setDecision("");
    setConfidence("");
    setConfirming(false);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!confidence) {
      setError("Pilih tingkat keyakinan (Confidence) sebelum submit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReview(alert, decision, confidence, notes);
      // Jika berhasil, modal akan ditutup oleh parent (optimistic update)
    } catch (err) {
      const msg = err.message || "Terjadi kesalahan.";

      // Tentukan apakah error ini perlu tutup modal (data sudah tidak valid)
      const shouldClose =
        msg.includes("analis lain") || msg.includes("tidak ditemukan");

      if (shouldClose) {
        // Tutup modal karena alert sudah tidak relevan, tampilkan notif di luar
        setSubmitting(false);
        // Biarkan parent handle via refreshKey, cukup close modal
        return;
      }

      setError(msg);
      setSubmitting(false);
    }
  };

  const dc = decision === "SAFE" ? "#15803d" : "#dc2626";
  const db = decision === "SAFE" ? "#f0fdf4" : "#fef2f2";
  const dd = decision === "SAFE" ? "#bbf7d0" : "#fecaca";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="txn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".6rem",
              flexWrap: "wrap",
            }}
          >
            <span className="modal-txn-id">Alert #{alert.alertId}</span>
            <ServiceBadge service={alert.service} />
            <SeverityBadge severity={alert.severity} />
            <span
              style={{
                fontSize: ".7rem",
                background: "#e0f2fe",
                color: "#0369a1",
                border: "1px solid #bae6fd",
                borderRadius: "4px",
                padding: "2px 7px",
                fontWeight: 700,
              }}
            >
              IN PROGRESS
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-info-block" style={{ marginBottom: "1.25rem" }}>
            <div className="modal-block-title">
              <i className="bi bi-bell-fill" /> Detail Alert
            </div>
            {[
              ["Alert ID", `#${alert.alertId}`],
              ["Transaction ID", `#${alert.transactionId ?? "—"}`],
              ["Tipe Alert", alert.alertType],
              [
                "Prioritas",
                `${alert.priorityLabel} (${alert.priority?.toFixed(2) ?? "—"})`,
              ],
              ["Dibuat", fmtDate(alert.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="modal-field-row">
                <span className="modal-field-label">{label}</span>
                <span className="modal-field-value mono">{value}</span>
              </div>
            ))}
          </div>
          {alert.message && (
            <div
              style={{
                padding: ".75rem 1rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderLeft: "3px solid #2563eb",
                borderRadius: "8px",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: ".72rem",
                  fontWeight: 700,
                  color: "#2563eb",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  marginBottom: ".4rem",
                }}
              >
                <i className="bi bi-card-text" style={{ marginRight: 4 }} />{" "}
                Pesan
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: ".875rem",
                  color: "#374151",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {alert.message}
              </p>
            </div>
          )}
          {error && (
            <div
              style={{
                padding: ".6rem .9rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: ".82rem",
                fontWeight: 600,
                marginBottom: "1rem",
              }}
            >
              <i className="bi bi-exclamation-circle-fill" /> {error}
            </div>
          )}
          <div className="modal-decision">
            <div className="modal-decision-title">Buat Keputusan Review</div>
            <div
              style={{
                padding: ".5rem .75rem",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                fontSize: ".78rem",
                color: "#0369a1",
                marginBottom: ".75rem",
              }}
            >
              <i className="bi bi-info-circle-fill" /> Alert sudah diklaim.
              Submit keputusan untuk menyelesaikannya.
            </div>
            {!confirming ? (
              <div className="modal-decision-btns">
                <button
                  className="modal-btn-approve"
                  onClick={() => handleDecide("SAFE")}
                >
                  <i className="bi bi-check-circle" /> Tandai SAFE
                </button>
                <button
                  className="modal-btn-reject"
                  onClick={() => handleDecide("FRAUD")}
                >
                  <i className="bi bi-x-circle" /> Tandai FRAUD
                </button>
              </div>
            ) : (
              <div className="modal-confirm-section">
                <div
                  style={{
                    padding: ".5rem .75rem",
                    background: db,
                    border: `1px solid ${dd}`,
                    borderRadius: "6px",
                    fontSize: ".82rem",
                    fontWeight: 600,
                    color: dc,
                    marginBottom: ".75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: ".4rem",
                  }}
                >
                  <i
                    className={`bi ${decision === "SAFE" ? "bi-check-circle-fill" : "bi-x-circle-fill"}`}
                  />
                  Konfirmasi:{" "}
                  {decision === "SAFE"
                    ? "Transaksi AMAN (SAFE)"
                    : "Transaksi PENIPUAN (FRAUD)"}
                </div>
                <div style={{ marginBottom: ".75rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: ".8rem",
                      fontWeight: 700,
                      color: "#374151",
                      marginBottom: ".4rem",
                    }}
                  >
                    Tingkat Keyakinan{" "}
                    <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: ".5rem" }}>
                    {["LOW", "MEDIUM", "HIGH"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setConfidence(c)}
                        style={{
                          flex: 1,
                          padding: ".5rem",
                          border: `2px solid ${confidence === c ? (c === "HIGH" ? "#16a34a" : c === "MEDIUM" ? "#d97706" : "#64748b") : "#e2e8f0"}`,
                          borderRadius: "8px",
                          background:
                            confidence === c
                              ? c === "HIGH"
                                ? "#f0fdf4"
                                : c === "MEDIUM"
                                  ? "#fffbeb"
                                  : "#f8fafc"
                              : "#fff",
                          color:
                            confidence === c
                              ? c === "HIGH"
                                ? "#15803d"
                                : c === "MEDIUM"
                                  ? "#92400e"
                                  : "#374151"
                              : "#6b7280",
                          fontWeight: confidence === c ? 700 : 500,
                          fontSize: ".82rem",
                          cursor: "pointer",
                        }}
                      >
                        {c === "HIGH"
                          ? "🟢 HIGH"
                          : c === "MEDIUM"
                            ? "🟡 MEDIUM"
                            : "🔴 LOW"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="modal-notes-input">
                  <label>Catatan (Opsional, maks. 500 karakter)</label>
                  <textarea
                    rows="3"
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tambahkan catatan..."
                  />
                  <div
                    style={{
                      fontSize: ".72rem",
                      color: "#94a3b8",
                      textAlign: "right",
                    }}
                  >
                    {notes.length}/500
                  </div>
                </div>
                <div className="modal-confirm-row">
                  <button
                    className="modal-btn-cancel"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Batal
                  </button>
                  <button
                    className={
                      decision === "SAFE"
                        ? "modal-btn-confirm-approve"
                        : "modal-btn-confirm-reject"
                    }
                    onClick={handleConfirm}
                    disabled={submitting || !confidence}
                  >
                    {submitting ? "Menyimpan..." : `Konfirmasi ${decision}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Override Modal ───────────────────────────────────────────────

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
                    border: `2px solid ${newDecision === d ? (d === "SAFE" ? "#16a34a" : "#dc2626") : "#e2e8f0"}`,
                    borderRadius: "8px",
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
                    cursor: "pointer",
                    fontSize: ".85rem",
                  }}
                >
                  {d === "SAFE" ? "✅ SAFE" : "❌ FRAUD"}
                </button>
              ))}
            </div>
          </div>
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

// ─── Tab: My Assigned Cases ───────────────────────────────────────

const TabMyQueue = ({ onRefreshMetrics }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setApiError(false);
        const response = await fetchMyQueue({ page: 1, limit: 50 });
        let items = Array.isArray(response)
          ? response
          : Array.isArray(response?.items)
            ? response.items
            : Array.isArray(response?.data)
              ? response.data
              : [];
        setAlerts(items.map(mapMyQueueAlert));
      } catch (err) {
        console.error("[MyQueue]", err.message);
        setApiError(true);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const handleReview = useCallback(
    async (alert, decision, confidence, notes) => {
      // Optimistic: langsung sembunyikan dari list
      setAlerts((prev) => prev.filter((a) => a.alertId !== alert.alertId));
      setSelectedAlert(null);
      try {
        await submitReview({
          alert_id: alert.alertId,
          decision,
          decision_confidence: confidence,
          note: notes || null,
        });
        setRefreshKey((k) => k + 1);
        onRefreshMetrics?.();
      } catch (err) {
        // Rollback optimistic update — kembalikan alert ke list
        setAlerts((prev) => [...prev, alert]);

        // Beri error message yang spesifik berdasarkan HTTP status dari BE
        const status = err.status ?? err.response?.status ?? 0;
        let message;

        if (status === 409) {
          // Race condition — alert baru saja di-submit analis lain
          message =
            "Konflik: Alert ini baru saja diselesaikan oleh analis lain. List akan diperbarui.";
          // Refresh otomatis agar My Queue sinkron
          setRefreshKey((k) => k + 1);
        } else if (status === 403) {
          message =
            "Akses ditolak: Alert ini bukan milik Anda. Mungkin sudah di-release oleh sistem.";
          setRefreshKey((k) => k + 1);
        } else if (status === 400) {
          // Bisa: "Alert must be claimed first", "Alert already reviewed", dll
          message =
            err.message ||
            "Permintaan tidak valid. Pastikan alert masih IN_PROGRESS.";
        } else if (status === 404) {
          message = "Alert tidak ditemukan. Mungkin sudah dihapus.";
          setRefreshKey((k) => k + 1);
        } else {
          message =
            err.message ||
            "Terjadi kesalahan saat submit review. Silakan coba lagi.";
        }

        throw new Error(message);
      }
    },
    [onRefreshMetrics],
  );

  if (loading) return <PageLoader message="Memuat My Queue..." />;

  return (
    <div>
      {apiError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#b91c1c",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            <i className="bi bi-wifi-off" style={{ marginRight: 8 }} />
            <strong>Gagal memuat My Queue.</strong>
          </span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "10px 16px",
          marginBottom: "16px",
          fontSize: ".82rem",
          color: "#1d4ed8",
        }}
      >
        <i className="bi bi-info-circle-fill" style={{ marginRight: 6 }} />
        Halaman ini menampilkan alert yang sudah Anda <strong>claim</strong>.
        Untuk mengambil kasus baru, pergi ke{" "}
        <strong>Alerts → Open Queue</strong>.
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          <i
            className="bi bi-person-check-fill"
            style={{ marginRight: 8, color: "#2563eb" }}
          />
          My Assigned Cases{" "}
          <span
            style={{ fontWeight: 400, color: "#6b7280", fontSize: ".85rem" }}
          >
            ({alerts.length} kasus)
          </span>
        </h2>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".35rem",
            padding: ".4rem .75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "7px",
            background: "#fff",
            fontSize: ".8rem",
            fontWeight: 600,
            color: "#374151",
            cursor: "pointer",
          }}
        >
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>
      {alerts.length === 0 ? (
        <div className="txn-empty">
          <i
            className="bi bi-inbox"
            style={{
              fontSize: "2.5rem",
              color: "#94a3b8",
              display: "block",
              marginBottom: "12px",
            }}
          />
          <p style={{ color: "#374151", fontWeight: 600, margin: "0 0 4px" }}>
            Tidak ada kasus yang ditugaskan
          </p>
          <p style={{ color: "#9ca3af", fontSize: ".875rem", margin: 0 }}>
            Klaim alert dari <strong>Alerts → Open Queue</strong> untuk mulai
            review.
          </p>
        </div>
      ) : (
        <div className="txn-table-wrapper">
          <table className="txn-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Alert ID</th>
                <th>Transaction ID</th>
                <th>Tipe</th>
                <th>Severity</th>
                <th>Prioritas</th>
                <th>Dibuat</th>
                <th className="col-action">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.alertId}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <td>
                    <ServiceBadge service={alert.service} />
                  </td>
                  <td>
                    <span className="cell-id">#{alert.alertId}</span>
                  </td>
                  <td>
                    <span className="cell-id">
                      #{alert.transactionId ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: ".82rem" }}>
                      {alert.alertType}
                    </span>
                  </td>
                  <td>
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td>
                    <span style={{ fontSize: ".82rem", fontWeight: 600 }}>
                      {alert.priorityLabel}
                    </span>
                  </td>
                  <td>
                    <span className="cell-date">
                      {fmtDate(alert.createdAt)}
                    </span>
                  </td>
                  <td
                    className="col-action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="btn-aksi"
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <i className="bi bi-eye" /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onReview={handleReview}
        />
      )}
    </div>
  );
};

// ─── Tab: Analyst Performance ─────────────────────────────────────

const TabAnalystPerformance = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchAnalystPerformance();
        setData(Array.isArray(res) ? res : (res?.data ?? []));
      } catch (err) {
        console.error("[AnalystPerf]", err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader message="Memuat performa analis..." />;
  if (error)
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "#b91c1c" }}>
        <i
          className="bi bi-wifi-off"
          style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}
        />
        <p style={{ fontWeight: 600 }}>Gagal memuat data performa.</p>
      </div>
    );

  return (
    <div>
      <h2
        style={{
          margin: "0 0 1rem",
          fontSize: "1rem",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        <i
          className="bi bi-people-fill"
          style={{ marginRight: 8, color: "#7c3aed" }}
        />
        Analyst Performance{" "}
        <span style={{ fontWeight: 400, color: "#6b7280", fontSize: ".85rem" }}>
          ({data.length} analis)
        </span>
      </h2>
      {data.length === 0 ? (
        <div className="txn-empty">
          <i
            className="bi bi-people"
            style={{
              fontSize: "2.5rem",
              color: "#94a3b8",
              display: "block",
              marginBottom: "12px",
            }}
          />
          <p style={{ color: "#374151", fontWeight: 600 }}>
            Belum ada data performa analis.
          </p>
        </div>
      ) : (
        <div className="txn-table-wrapper">
          <table className="txn-table">
            <thead>
              <tr>
                <th>Analis</th>
                <th>Email</th>
                <th>Reviews</th>
                <th>Avg. Waktu</th>
                <th>Fraud Terdeteksi</th>
                <th>Fraud Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => {
                const avgMin =
                  a.avg_review_seconds > 0
                    ? (a.avg_review_seconds / 60).toFixed(1)
                    : "—";
                const fraudRate =
                  a.reviews_completed > 0
                    ? ((a.fraud_detected / a.reviews_completed) * 100).toFixed(
                        1,
                      )
                    : "0.0";
                return (
                  <tr key={a.analyst_id ?? i}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: ".6rem",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg,#7c3aed,#4f46e5)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: ".7rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {(a.analyst_name || "A")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: ".875rem" }}>
                          {a.analyst_name || `Analyst #${a.analyst_id}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: ".82rem", color: "#6b7280" }}>
                        {a.analyst_email || "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700 }}>
                        {a.reviews_completed}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: ".82rem" }}>{avgMin} min</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: "#dc2626" }}>
                        <i
                          className="bi bi-exclamation-triangle-fill"
                          style={{ fontSize: ".75rem", marginRight: 4 }}
                        />
                        {a.fraud_detected}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: ".5rem",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "#f3f4f6",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(parseFloat(fraudRate), 100)}%`,
                              height: "100%",
                              background:
                                parseFloat(fraudRate) > 50
                                  ? "#dc2626"
                                  : parseFloat(fraudRate) > 20
                                    ? "#f59e0b"
                                    : "#10b981",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: ".78rem",
                            fontWeight: 600,
                            minWidth: 36,
                          }}
                        >
                          {fraudRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Timeline Analytics ──────────────────────────────────────

const TabTimeline = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchTimelineAnalytics();
        setData(res?.data ?? res ?? null);
      } catch (err) {
        console.error("[Timeline]", err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader message="Memuat timeline analytics..." />;
  if (error || !data)
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "#b91c1c" }}>
        <i
          className="bi bi-wifi-off"
          style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}
        />
        <p style={{ fontWeight: 600 }}>Gagal memuat timeline.</p>
      </div>
    );

  const Section = ({
    title,
    icon,
    color,
    items,
    labelKey,
    valueKey,
    valueLabel,
  }) => {
    const maxVal = Math.max(...(items || []).map((x) => x[valueKey] ?? 0), 1);
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
          marginBottom: "1.25rem",
        }}
      >
        <div
          style={{
            padding: ".875rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <i className={`bi ${icon}`} style={{ color, fontSize: "1.1rem" }} />
          <span
            style={{ fontWeight: 700, fontSize: ".9rem", color: "#111827" }}
          >
            {title}
          </span>
        </div>
        <table className="txn-table">
          <thead>
            <tr>
              <th>{labelKey === "hour" ? "Jam" : "Hari"}</th>
              <th>{valueLabel}</th>
              <th>Visualisasi</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item, i) => {
              const val = item[valueKey] ?? 0;
              return (
                <tr key={i}>
                  <td>
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: ".82rem",
                      }}
                    >
                      {item[labelKey]}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>{val}</span>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".5rem",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "#f3f4f6",
                          borderRadius: 4,
                          overflow: "hidden",
                          minWidth: 80,
                        }}
                      >
                        <div
                          style={{
                            width: `${(val / maxVal) * 100}%`,
                            height: "100%",
                            background: color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: ".72rem",
                          color: "#94a3b8",
                          minWidth: 30,
                        }}
                      >
                        {Math.round((val / maxVal) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <h2
        style={{
          margin: "0 0 1rem",
          fontSize: "1rem",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        <i
          className="bi bi-graph-up-arrow"
          style={{ marginRight: 8, color: "#2563eb" }}
        />{" "}
        Timeline Analytics
      </h2>
      <Section
        title="Reviews per Jam (24 Jam Terakhir)"
        icon="bi-clock"
        color="#3b82f6"
        items={data.reviews_per_hour_24h}
        labelKey="hour"
        valueKey="count"
        valueLabel="Jumlah Review"
      />
      <Section
        title="Fraud per Hari (7 Hari Terakhir)"
        icon="bi-exclamation-triangle-fill"
        color="#dc2626"
        items={data.fraud_per_day_7d}
        labelKey="day"
        valueKey="count"
        valueLabel="Fraud Terdeteksi"
      />
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: ".875rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <i
            className="bi bi-bar-chart-fill"
            style={{ color: "#8b5cf6", fontSize: "1.1rem" }}
          />
          <span
            style={{ fontWeight: 700, fontSize: ".9rem", color: "#111827" }}
          >
            Queue Growth (7 Hari Terakhir)
          </span>
        </div>
        <table className="txn-table">
          <thead>
            <tr>
              <th>Hari</th>
              <th>Alert Masuk</th>
              <th>Alert Resolved</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {(data.queue_growth_7d || []).map((item, i) => {
              const net = item.incoming_alerts - item.resolved_alerts;
              return (
                <tr key={i}>
                  <td>
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: ".82rem",
                      }}
                    >
                      {item.day}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#dc2626" }}>
                      {item.incoming_alerts}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#10b981" }}>
                      {item.resolved_alerts}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color: net > 0 ? "#dc2626" : "#10b981",
                      }}
                    >
                      {net > 0 ? "+" : ""}
                      {net}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── False Negative Section ──────────────────────────────────────
// Untuk melaporkan transaksi yang lolos deteksi (false negative).
// POST /reviews/transactions/{id}/report-fraud
// Hanya SUPER_ADMIN & RISK_MANAGER.

const FalseNegativeSection = () => {
  const [transactionId, setTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: "success"|"error", message }

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
            disabled={submitting || !transactionId || reason.trim().length < 10}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".5rem",
              padding: ".625rem 1.25rem",
              background:
                submitting || !transactionId || reason.trim().length < 10
                  ? "#f3f4f6"
                  : "#ea580c",
              color:
                submitting || !transactionId || reason.trim().length < 10
                  ? "#9ca3af"
                  : "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: ".875rem",
              cursor:
                submitting || !transactionId || reason.trim().length < 10
                  ? "not-allowed"
                  : "pointer",
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
                />{" "}
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

// ─── Tab: Review Management ───────────────────────────────────────

const TabReviewManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingOp, setPendingOp] = useState({});
  const [overrideModal, setOverrideModal] = useState(null);
  const LIMIT = 10;

  const load = useCallback(async (p) => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetchReviewHistory({ page: p, limit: LIMIT });
      setItems(mapHistoryItems(res?.items ?? []));
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error("[ReviewMgmt]", err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const handleDelete = async (reviewId) => {
    if (
      !window.confirm(
        `Soft delete Review #${reviewId}? Tindakan ini dicatat untuk audit.`,
      )
    )
      return;
    setPendingOp((p) => ({ ...p, [reviewId]: "deleting" }));
    try {
      await api.del(`/reviews/${reviewId}`);
      setItems((prev) => prev.filter((i) => i.reviewId !== reviewId));
    } catch (err) {
      alert(`Gagal menghapus review: ${err.message}`);
    } finally {
      setPendingOp((p) => {
        const n = { ...p };
        delete n[reviewId];
        return n;
      });
    }
  };

  const handleOverrideSubmit = async (reviewId, newDecision, reason) => {
    setPendingOp((p) => ({ ...p, [reviewId]: "overriding" }));
    try {
      await overrideReview(reviewId, { new_decision: newDecision, reason });
      setItems((prev) =>
        prev.map((i) =>
          i.reviewId === reviewId ? { ...i, decision: newDecision } : i,
        ),
      );
      setOverrideModal(null);
    } catch (err) {
      alert(`Gagal override: ${err.message}`);
    } finally {
      setPendingOp((p) => {
        const n = { ...p };
        delete n[reviewId];
        return n;
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          <i
            className="bi bi-shield-fill-exclamation"
            style={{ marginRight: 8, color: "#dc2626" }}
          />
          Review Management{" "}
          <span
            style={{ fontWeight: 400, color: "#6b7280", fontSize: ".85rem" }}
          >
            Override & Delete
          </span>
        </h2>
        <button
          onClick={() => load(page)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".35rem",
            padding: ".4rem .75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "7px",
            background: "#fff",
            fontSize: ".8rem",
            fontWeight: 600,
            color: "#374151",
            cursor: "pointer",
          }}
        >
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          padding: "10px 16px",
          marginBottom: "16px",
          fontSize: ".82rem",
          color: "#92400e",
        }}
      >
        <i
          className="bi bi-exclamation-triangle-fill"
          style={{ marginRight: 6 }}
        />
        Override dan Delete hanya untuk alasan compliance. Semua tindakan
        dicatat di Audit Log.
      </div>
      {error ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#b91c1c" }}>
          <i
            className="bi bi-wifi-off"
            style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}
          />
          <p style={{ fontWeight: 600 }}>Gagal memuat data.</p>
        </div>
      ) : loading ? (
        <PageLoader message="Memuat review..." />
      ) : (
        <>
          <div className="txn-table-wrapper">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Review ID</th>
                  <th>Transaction ID</th>
                  <th>Alert ID</th>
                  <th>Decision</th>
                  <th>Status</th>
                  <th>Waktu</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ opacity: pendingOp[item.reviewId] ? 0.5 : 1 }}
                  >
                    <td>
                      <span className="cell-id">#{item.reviewId}</span>
                    </td>
                    <td>
                      <span className="cell-id">{item.transactionId}</span>
                    </td>
                    <td>
                      <span className="cell-id">
                        {item.alertId != null ? `#${item.alertId}` : "—"}
                      </span>
                    </td>
                    <td>
                      <DecisionBadge decision={item.decision} />
                    </td>
                    <td>
                      <span style={{ fontSize: ".75rem", color: "#6b7280" }}>
                        {item.previousStatus || "—"} → {item.finalStatus || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="cell-date">
                        {fmtDate(item.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: ".4rem" }}>
                        <button
                          className="btn-aksi"
                          onClick={() => setOverrideModal(item)}
                          disabled={!!pendingOp[item.reviewId]}
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            borderColor: "#bfdbfe",
                          }}
                        >
                          <i className="bi bi-arrow-repeat" /> Override
                        </button>
                        <button
                          className="btn-aksi"
                          onClick={() => handleDelete(item.reviewId)}
                          disabled={!!pendingOp[item.reviewId]}
                          style={{
                            background: "#fef2f2",
                            color: "#dc2626",
                            borderColor: "#fecaca",
                          }}
                        >
                          {pendingOp[item.reviewId] === "deleting" ? (
                            "Deleting…"
                          ) : (
                            <>
                              <i className="bi bi-trash3" /> Delete
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        color: "#94a3b8",
                      }}
                    >
                      Tidak ada data review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: ".5rem",
                marginTop: "1rem",
              }}
            >
              <button
                className="page-btn nav"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                <i className="bi bi-chevron-left" />
              </button>
              {Array.from(
                { length: Math.min(totalPages, 7) },
                (_, i) => i + 1,
              ).map((p) => (
                <button
                  key={p}
                  className={`page-btn${p === page ? " active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="page-btn nav"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
      {overrideModal && (
        <OverrideModal
          item={overrideModal}
          onClose={() => setOverrideModal(null)}
          onSubmit={handleOverrideSubmit}
          pending={!!pendingOp[overrideModal.reviewId]}
        />
      )}

      {/* Section: Report False Negative */}
      <FalseNegativeSection />
    </div>
  );
};

// ─── Komponen Utama ───────────────────────────────────────────────

const ManualReview = () => {
  const { canReview, canManage, canViewAnalytics } = useRole();
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsKey, setMetricsKey] = useState(0);

  // Default tab berdasarkan role
  const defaultTab = canReview ? "my-queue" : "performance";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const load = async () => {
      try {
        setMetricsLoading(true);
        const data = await fetchReviewMetrics();
        setMetrics(data?.data ?? data ?? null);
      } catch {
        /* tidak kritis */
      } finally {
        setMetricsLoading(false);
      }
    };
    load();
  }, [metricsKey]);

  const tabs = [
    ...(canReview
      ? [
          {
            id: "my-queue",
            label: "My Assigned Cases",
            icon: "bi-person-check-fill",
            color: "#2563eb",
          },
        ]
      : []),
    ...(canViewAnalytics
      ? [
          {
            id: "performance",
            label: "Analyst Performance",
            icon: "bi-people-fill",
            color: "#7c3aed",
          },
          {
            id: "timeline",
            label: "Timeline Analytics",
            icon: "bi-graph-up-arrow",
            color: "#2563eb",
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            id: "management",
            label: "Review Management",
            icon: "bi-shield-fill-exclamation",
            color: "#dc2626",
          },
        ]
      : []),
  ];

  return (
    <div className="manual-review-page">
      <div className="review-header">
        <div className="header-content">
          <h1>Manual Review</h1>
          <p className="subtitle">
            {canReview && canManage
              ? "Dashboard review lengkap"
              : canReview
                ? "Alert yang sudah Anda klaim — siap untuk direview"
                : "Analytics & manajemen proses review"}
          </p>
        </div>
      </div>

      <ReviewStatsBar metrics={metrics} loading={metricsLoading} />

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "20px",
          borderBottom: "2px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 16px",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: ".875rem",
              color: activeTab === tab.id ? tab.color : "#6b7280",
              borderBottom:
                activeTab === tab.id
                  ? `2px solid ${tab.color}`
                  : "2px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: ".4rem",
              transition: "all .15s",
              whiteSpace: "nowrap",
            }}
          >
            <i className={`bi ${tab.icon}`} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="review-section">
        {activeTab === "my-queue" && (
          <TabMyQueue onRefreshMetrics={() => setMetricsKey((k) => k + 1)} />
        )}
        {activeTab === "performance" && <TabAnalystPerformance />}
        {activeTab === "timeline" && <TabTimeline />}
        {activeTab === "management" && <TabReviewManagement />}
      </div>
    </div>
  );
};

export default ManualReview;
