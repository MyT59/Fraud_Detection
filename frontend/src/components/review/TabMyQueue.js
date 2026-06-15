import React, { useState, useEffect, useCallback } from "react";
import PageLoader from "../common/PageLoader";
import AlertModal from "./AlertModal";
import { SeverityBadge, ServiceBadge } from "./ReviewBadges";
import { fmtDate, mapMyQueueAlert, extractItems } from "./reviewHelpers";
import { fetchMyQueue, submitReview } from "../../services/reviewApiService";

/**
 * TabMyQueue.js
 * Tab "My Assigned Cases" — hanya untuk FRAUD_ANALYST & SUPER_ADMIN.
 * Menampilkan alert yang sudah diklaim dan siap direview.
 * Data source: GET /alerts/my-queue
 */
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
        setAlerts(extractItems(response).map(mapMyQueueAlert));
      } catch (err) {
        console.error("[TabMyQueue]", err.message);
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
        // Rollback optimistic update
        setAlerts((prev) => [...prev, alert]);

        // Error message spesifik per HTTP status BE
        const status = err.status ?? err.response?.status ?? 0;
        let message;
        if (status === 409) {
          message =
            "Konflik: Alert ini baru saja diselesaikan oleh analis lain. List akan diperbarui.";
          setRefreshKey((k) => k + 1);
        } else if (status === 403) {
          message =
            "Akses ditolak: Alert ini bukan milik Anda. Mungkin sudah di-release oleh sistem.";
          setRefreshKey((k) => k + 1);
        } else if (status === 400) {
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
      {/* Error banner */}
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

      {/* Info banner */}
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

      {/* Header */}
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

      {/* Empty state */}
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

export default TabMyQueue;
