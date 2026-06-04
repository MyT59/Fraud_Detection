import React, { useState, useEffect } from "react";
import {
  fetchReviewHistory,
  mapHistoryItem,
} from "../services/reviewApiService";
import "./ReviewHistory.css";

const fmtTs = (ds) => {
  if (!ds) return "—";
  const d = new Date(ds);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const timeAgo = (ds) => {
  if (!ds) return "—";
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ACTION_META = {
  approved: {
    icon: "bi-check-circle-fill",
    label: "Approved (SAFE)",
    cls: "approved",
  },
  rejected: {
    icon: "bi-x-circle-fill",
    label: "Rejected (FRAUD)",
    cls: "rejected",
  },
  flagged: { icon: "bi-flag-fill", label: "Flagged", cls: "flagged" },
  escalated: {
    icon: "bi-arrow-up-circle-fill",
    label: "Escalated",
    cls: "escalated",
  },
};

const DECISION_META = {
  SAFE: { label: "SAFE", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  FRAUD: { label: "FRAUD", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

const SAMPLE = [
  {
    id: 1,
    transactionId: "AGN-000008",
    alertId: null,
    action: "rejected",
    decision: "FRAUD",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date().toISOString(),
    notes:
      "Multiple patterns confirmed: bruteforce PIN + money mule destination. Account blocked.",
  },
  {
    id: 2,
    transactionId: "NUS-000009",
    alertId: null,
    action: "rejected",
    decision: "FRAUD",
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    notes:
      "Refund abuse + burst payment pattern via API channel. Transaction reversed.",
  },
  {
    id: 3,
    transactionId: "AGN-000007",
    alertId: null,
    action: "approved",
    decision: "SAFE",
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    notes: "Verified with customer — legit transaction.",
  },
];

const HistoryItem = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[item.action] || ACTION_META.approved;
  const decisionMeta = DECISION_META[item.decision] || DECISION_META.SAFE;

  return (
    <div className={`history-item ${meta.cls}`}>
      <div
        className="history-item-header"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="history-item-left">
          <div className={`history-action-icon ${meta.cls}`}>
            <i className={`bi ${meta.icon}`}></i>
          </div>
          <div className="history-item-info">
            <div className="history-item-title">
              <span className="history-txn-id">{item.transactionId}</span>

              <span
                style={{
                  fontSize: ".68rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "4px",
                  background: decisionMeta.bg,
                  color: decisionMeta.color,
                  border: `1px solid ${decisionMeta.border}`,
                  letterSpacing: ".04em",
                }}
              >
                {decisionMeta.label}
              </span>
              {item.alertId && (
                <span
                  style={{
                    fontSize: ".65rem",
                    color: "#64748b",
                    fontWeight: 500,
                  }}
                >
                  Alert #{item.alertId}
                </span>
              )}
            </div>
            <div className="history-item-meta">
              <span className="history-reviewer">
                <i className="bi bi-person-circle"></i>
                {item.reviewer || "—"}{" "}
                {item.reviewerRole && (
                  <span style={{ color: "#94a3b8", fontSize: ".72rem" }}>
                    · {item.reviewerRole}
                  </span>
                )}
              </span>
              <span className="history-time">
                <i className="bi bi-clock"></i>
                {timeAgo(item.timestamp)}
              </span>
            </div>
          </div>
        </div>

        <div className="history-item-right">
          <span className={`history-action-badge ${meta.cls}`}>
            <i className={`bi ${meta.icon}`}></i>
            {meta.label}
          </span>
          <button className="history-expand-btn">
            <i className={`bi bi-chevron-${expanded ? "up" : "down"}`}></i>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="history-item-body">
          <div className="history-detail-grid">
            <div className="history-detail-item">
              <span className="history-detail-label">Transaction ID</span>
              <span className="history-detail-value mono">
                {item.transactionId}
              </span>
            </div>
            {item.alertId && (
              <div className="history-detail-item">
                <span className="history-detail-label">Alert ID</span>
                <span className="history-detail-value mono">
                  #{item.alertId}
                </span>
              </div>
            )}
            <div className="history-detail-item">
              <span className="history-detail-label">Decision</span>
              <span
                className="history-detail-value"
                style={{ color: decisionMeta.color, fontWeight: 700 }}
              >
                {decisionMeta.label}
              </span>
            </div>
            <div className="history-detail-item">
              <span className="history-detail-label">Reviewed At</span>
              <span className="history-detail-value">
                {fmtTs(item.timestamp)}
              </span>
            </div>
            {item.previousStatus && (
              <div className="history-detail-item">
                <span className="history-detail-label">Previous Status</span>
                <span className="history-detail-value">
                  {item.previousStatus}
                </span>
              </div>
            )}
            {item.finalStatus && (
              <div className="history-detail-item">
                <span className="history-detail-label">Final Status</span>
                <span className="history-detail-value">{item.finalStatus}</span>
              </div>
            )}
          </div>

          {item.notes && (
            <div className="history-notes">
              <i className="bi bi-chat-left-text"></i>
              <span>{item.notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ReviewHistory = ({ recentTransactions = [] }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [usingFallback, setFallback] = useState(false);
  const LIMIT = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReviewHistory({ page, limit: LIMIT });
        const mapped = (data.items || []).map(mapHistoryItem);
        setItems(mapped);
        setTotal(data.total || 0);
        setFallback(false);
      } catch (err) {
        const reviewed = recentTransactions
          .filter((t) => t.status === "approved" || t.status === "rejected")
          .map((t, i) => ({
            id: i + 100,
            transactionId: t.id,
            alertId: t._alertId || null,
            action: t.status,
            decision: t.status === "approved" ? "SAFE" : "FRAUD",
            reviewer: "You",
            reviewerRole: "Analyst",
            timestamp: t.reviewedAt || new Date().toISOString(),
            notes: t.reviewNotes || "",
          }));

        const combined = [...reviewed, ...SAMPLE].slice(0, LIMIT);
        setItems(combined);
        setTotal(combined.length);
        setFallback(true);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [page, recentTransactions]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="review-history">
      <div className="history-header">
        <div className="history-title-row">
          <h3 className="history-title">
            <i className="bi bi-clock-history"></i>
            Review History
          </h3>
          {usingFallback && (
            <span
              style={{
                fontSize: ".72rem",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "4px",
                background: "#fef3c7",
                color: "#92400e",
                border: "1px solid #fde68a",
              }}
            >
              Offline mode
            </span>
          )}
        </div>
        <p className="history-subtitle">
          {usingFallback
            ? "Menampilkan data lokal — API tidak tersedia"
            : `${total} review tercatat`}
        </p>
      </div>

      {loading ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: ".9rem",
          }}
        >
          <i
            className="bi bi-arrow-repeat"
            style={{ marginRight: ".4rem" }}
          ></i>
          Memuat riwayat review...
        </div>
      ) : items.length === 0 ? (
        <div className="history-empty">
          <i className="bi bi-inbox"></i>
          <p>Belum ada riwayat review.</p>
        </div>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}
        </div>
      )}

      {!usingFallback && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: ".75rem 1rem 0",
            borderTop: "1px solid #f1f5f9",
            marginTop: ".5rem",
          }}
        >
          <span style={{ fontSize: ".8rem", color: "#64748b" }}>
            Page {page} of {totalPages} · {total} total
          </span>
          <div style={{ display: "flex", gap: ".4rem" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: ".3rem .6rem",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                background: "#fff",
                cursor: page === 1 ? "not-allowed" : "pointer",
                opacity: page === 1 ? 0.4 : 1,
              }}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: ".3rem .6rem",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                background: "#fff",
                cursor: page === totalPages ? "not-allowed" : "pointer",
                opacity: page === totalPages ? 0.4 : 1,
              }}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewHistory;
