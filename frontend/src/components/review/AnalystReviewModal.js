import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAnalystReviewHistory,
  mapHistoryItems,
} from "../../services/reviewApiService";
import { DecisionBadge } from "./ReviewBadges";
import { fmtDate } from "./reviewHelpers";

const LIMIT = 8;

const formatDuration = (start, end) => {
  if (!start || !end) return "-";
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "-";
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${(minutes / 60).toFixed(1)} jam`;
};

const getInitials = (name = "Analyst") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const AnalystReviewModal = ({ analyst, onClose }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetchAnalystReviewHistory(analyst.analyst_id, {
          page: 1,
          limit: LIMIT,
        });
        setItems(mapHistoryItems(res?.items ?? []));
        setTotal(res?.total ?? 0);
      } catch (err) {
        console.error("[AnalystReviewModal]", err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (analyst?.analyst_id) load();
  }, [analyst]);

  const fraudRate =
    analyst.reviews_completed > 0
      ? ((analyst.fraud_detected / analyst.reviews_completed) * 100).toFixed(1)
      : "0.0";
  const avgMinutes =
    analyst.avg_review_seconds > 0
      ? `${(analyst.avg_review_seconds / 60).toFixed(1)} min`
      : "-";

  const filteredItems = useMemo(() => {
    if (decisionFilter === "ALL") return items;
    return items.filter((item) => item.decision === decisionFilter);
  }, [items, decisionFilter]);

  const safeCount = items.filter((item) => item.decision === "SAFE").length;
  const fraudCount = items.filter((item) => item.decision === "FRAUD").length;

  return (
    <div className="analyst-modal-backdrop" onClick={onClose}>
      <div
        className="analyst-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail ${analyst.analyst_name || "Fraud Analyst"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="analyst-modal-header">
          <div className="analyst-modal-person">
            <span className="review-avatar analyst-modal-avatar">
              {getInitials(analyst.analyst_name)}
            </span>
            <div>
              <span className="analyst-modal-eyebrow">Fraud Analyst</span>
              <h3>{analyst.analyst_name || `Analyst #${analyst.analyst_id}`}</h3>
              <p>{analyst.analyst_email || "-"}</p>
            </div>
          </div>
          <button className="analyst-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="analyst-modal-metrics">
          <div>
            <span>Total Review</span>
            <strong>{analyst.reviews_completed}</strong>
          </div>
          <div>
            <span>Avg. Waktu</span>
            <strong>{avgMinutes}</strong>
          </div>
          <div>
            <span>Fraud Detected</span>
            <strong className="danger">{analyst.fraud_detected}</strong>
          </div>
          <div>
            <span>Fraud Rate</span>
            <strong>{fraudRate}%</strong>
          </div>
        </div>

        <div className="analyst-modal-section-head">
          <div>
            <strong>Review terbaru</strong>
            <span>
              Menampilkan {items.length} dari {total} review milik analyst ini.
            </span>
          </div>
          <div className="analyst-filter-group">
            {["ALL", "SAFE", "FRAUD"].map((value) => (
              <button
                key={value}
                className={decisionFilter === value ? "active" : ""}
                onClick={() => setDecisionFilter(value)}
              >
                {value === "ALL" ? "Semua" : value}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="analyst-modal-state">
            <span className="review-spinner" />
            <strong>Memuat review analyst...</strong>
          </div>
        ) : error ? (
          <div className="analyst-modal-state error">
            <i className="bi bi-wifi-off" />
            <strong>Gagal memuat review analyst.</strong>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="analyst-modal-state">
            <i className="bi bi-inbox" />
            <strong>Belum ada review sesuai filter.</strong>
          </div>
        ) : (
          <div className="analyst-review-list">
            {filteredItems.map((item) => (
              <div className="analyst-review-row" key={item.id}>
                <div>
                  <span className="cell-id">{item.transactionId}</span>
                  <small>Alert {item.alertId ? `#${item.alertId}` : "-"}</small>
                </div>
                <DecisionBadge decision={item.decision} />
                <div className="analyst-review-meta">
                  <span>{formatDuration(item.reviewStartedAt, item.reviewCompletedAt)}</span>
                  <small>{fmtDate(item.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="analyst-modal-insight">
          <div>
            <span>Decision sample</span>
            <strong>
              {safeCount} safe / {fraudCount} fraud
            </strong>
          </div>
          <p>
            Modal ini hanya preview cepat dari performa analyst. Audit lengkap
            tetap dilakukan melalui Review History.
          </p>
        </div>

        <div className="analyst-modal-footer">
          <button className="review-secondary-btn" onClick={onClose}>
            Tutup
          </button>
          <Link
            className="analyst-history-link"
            to={`/review-history?reviewed_by=${analyst.analyst_id}`}
          >
            <i className="bi bi-clock-history" />
            Lihat di Review History
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AnalystReviewModal;
