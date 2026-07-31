import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import PageLoader from "../common/PageLoader";
import AlertModal from "./AlertModal";
import { SeverityBadge, ServiceBadge } from "./ReviewBadges";
import {
  fmtDate,
  getAlertCaseType,
  mapMyQueueAlert,
  extractItems,
} from "./reviewHelpers";
import { fetchMyQueue, submitReview } from "../../services/reviewApiService";

const FILTERS = [
  { value: "ALL", label: "Semua" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const priorityRank = (label = "") => {
  const key = label.toUpperCase();
  if (key.includes("CRITICAL")) return 4;
  if (key.includes("HIGH")) return 3;
  if (key.includes("MEDIUM")) return 2;
  if (key.includes("LOW")) return 1;
  return 0;
};

const getPriorityTone = (label = "") => {
  const rank = priorityRank(label);
  if (rank >= 4) return "critical";
  if (rank === 3) return "high";
  if (rank === 2) return "medium";
  return "low";
};

const TabMyQueue = ({ onRefreshMetrics }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setApiError(false);
        const response = await fetchMyQueue({ page, limit: 20 });
        setAlerts(extractItems(response).map(mapMyQueueAlert));
        setTotal(response?.total ?? 0);
      } catch (err) {
        console.error("[TabMyQueue]", err.message);
        setApiError(true);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey, page]);

  const handleReview = useCallback(
    async (alert, decision, confidence, notes) => {
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
        setAlerts((prev) => [...prev, alert]);

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

  const queueStats = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
    const high = alerts.filter((a) => a.severity === "HIGH").length;
    const priority = alerts.filter((a) => priorityRank(a.priorityLabel) >= 3)
      .length;
    const blocked = alerts.filter(
      (a) => getAlertCaseType(a).key === "BLOCKED",
    ).length;
    const flagged = alerts.length - blocked;
    return {
      total: alerts.length,
      critical,
      high,
      priority,
      blocked,
      flagged,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return alerts
      .filter((alert) =>
        severityFilter === "ALL" ? true : alert.severity === severityFilter,
      )
      .filter((alert) => {
        if (!keyword) return true;
        return [
          alert.alertId,
          alert.transactionId,
          alert.alertType,
          alert.service,
          alert.title,
          alert.message,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      })
      .sort((a, b) => {
        const severityOrder =
          FILTERS.findIndex((f) => f.value === a.severity) -
          FILTERS.findIndex((f) => f.value === b.severity);
        if (severityOrder !== 0) return severityOrder;
        return priorityRank(b.priorityLabel) - priorityRank(a.priorityLabel);
      });
  }, [alerts, query, severityFilter]);

  const resetFilters = () => {
    setQuery("");
    setSeverityFilter("ALL");
  };

  if (loading) return <PageLoader message="Memuat My Queue..." />;

  return (
    <div className="review-tab-content">
      <div className="review-panel-header">
        <div>
          <h2 className="review-panel-title">
            <span className="review-panel-icon blue">
              <i className="bi bi-person-check-fill" />
            </span>
            Review Alerts
          </h2>
          <p className="review-panel-subtitle">
            Alert yang sudah Anda claim. Flagged case direview
            post-transaction, sedangkan blocked case diinvestigasi untuk
            validasi block dan false positive.
          </p>
        </div>
        <div className="review-header-actions">
          <Link className="review-secondary-btn" to="/alerts">
            <i className="bi bi-bell" />
            My Alerts
          </Link>
          <button
            className="review-secondary-btn"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <i className="bi bi-arrow-clockwise" />
            Refresh
          </button>
        </div>
      </div>

      {apiError && (
        <div className="review-error-banner">
          <span>
            <i className="bi bi-wifi-off" />
            <strong>Gagal memuat queue.</strong> Pastikan backend berjalan lalu
            coba lagi.
          </span>
          <button onClick={() => setRefreshKey((k) => k + 1)}>Coba Lagi</button>
        </div>
      )}

      <div className="review-mini-metrics">
        <div className="review-mini-metric">
          <span>Total Claimed</span>
          <strong>{queueStats.total}</strong>
        </div>
        <div className="review-mini-metric danger">
          <span>Critical</span>
          <strong>{queueStats.critical}</strong>
        </div>
        <div className="review-mini-metric">
          <span>High Risk</span>
          <strong>{queueStats.high}</strong>
        </div>
        <div className="review-mini-metric success">
          <span>Flagged</span>
          <strong>{queueStats.flagged}</strong>
        </div>
        <div className="review-mini-metric danger">
          <span>Blocked</span>
          <strong>{queueStats.blocked}</strong>
        </div>
      </div>

      <div className="review-queue-toolbar">
        <div className="review-queue-search">
          <i className="bi bi-search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari Alert ID, Transaction ID, layanan, atau tipe..."
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        <div className="review-queue-filters">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={severityFilter === filter.value ? "active" : ""}
              onClick={() => setSeverityFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="review-queue-empty">
          <i className="bi bi-inbox" />
          <strong>Belum ada alert yang sedang Anda review</strong>
          <span>
            Klaim alert dari My Alerts untuk mulai investigasi post-transaction.
          </span>
          <Link to="/alerts">
            <i className="bi bi-bell" />
            Buka My Alerts
          </Link>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="review-queue-empty compact">
          <i className="bi bi-funnel" />
          <strong>Tidak ada alert sesuai filter</strong>
          <span>Ubah keyword atau severity untuk melihat queue lain.</span>
          <button onClick={resetFilters}>Reset filter</button>
        </div>
      ) : (
        <div className="review-alert-grid">
          {filteredAlerts.map((alert) => (
            (() => {
              const caseType = getAlertCaseType(alert);
              return (
                <button
                  type="button"
                  key={alert.alertId}
                  className={`review-alert-card ${getPriorityTone(alert.priorityLabel)} case-${caseType.tone}`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="review-alert-card-top">
                    <div>
                      <span className="review-alert-id">
                        Alert #{alert.alertId}
                      </span>
                      <strong>{alert.title}</strong>
                    </div>
                    <ServiceBadge service={alert.service} />
                  </div>

                  <div className="review-alert-meta-row">
                    <SeverityBadge severity={alert.severity} />
                    <span className={`review-case-pill ${caseType.tone}`}>
                      <i className={`bi ${caseType.icon}`} />
                      {caseType.label}
                    </span>
                    <span className="review-priority-pill">
                      <i className="bi bi-flag-fill" />
                      {alert.priorityLabel}
                    </span>
                  </div>

                  <div className="review-alert-message">
                    {alert.message || "Tidak ada deskripsi alert."}
                  </div>

                  <div className="review-alert-facts">
                    <span>
                      <i className="bi bi-arrow-left-right" />
                      TRX #{alert.transactionId ?? "-"}
                    </span>
                    <span>
                      <i className="bi bi-diagram-3" />
                      {alert.alertType}
                    </span>
                    <span>
                      <i className="bi bi-clock" />
                      {fmtDate(alert.createdAt)}
                    </span>
                  </div>

                  <div className="review-alert-card-footer">
                    <span>{caseType.shortAction}</span>
                    <i className="bi bi-arrow-right" />
                  </div>
                </button>
              );
            })()
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="review-pagination-row">
          <button
            className="page-btn nav"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <i className="bi bi-chevron-left" /> Sebelumnya
          </button>
          <span className="review-muted-cell">
            Halaman {page} dari {Math.ceil(total / 20)}
          </span>
          <button
            className="page-btn nav"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage((current) => current + 1)}
          >
            Berikutnya <i className="bi bi-chevron-right" />
          </button>
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
