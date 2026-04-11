import React, { useState } from "react";
import "./ReviewHistory.css";

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const fmtTs = (ds) => {
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
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ACTION_META = {
  approved: {
    icon: "bi-check-circle-fill",
    label: "Approved",
    cls: "approved",
  },
  rejected: { icon: "bi-x-circle-fill", label: "Rejected", cls: "rejected" },
  flagged: { icon: "bi-flag-fill", label: "Flagged", cls: "flagged" },
  escalated: {
    icon: "bi-arrow-up-circle-fill",
    label: "Escalated",
    cls: "escalated",
  },
};

const SAMPLE = [
  {
    id: 1,
    transactionId: "AGN-000008",
    action: "rejected",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date().toISOString(),
    amount: 895000,
    riskScore: 96,
    duration: "4 minutes",
    notes:
      "Multiple patterns confirmed: bruteforce PIN + money mule destination. Account blocked.",
  },
  {
    id: 2,
    transactionId: "NUS-000009",
    action: "rejected",
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    amount: 315845,
    riskScore: 95,
    duration: "5 minutes",
    notes:
      "Refund abuse + burst payment pattern via API channel. Transaction reversed.",
  },
  {
    id: 3,
    transactionId: "AGN-000003",
    action: "escalated",
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    amount: 234802,
    riskScore: 78,
    duration: "8 minutes",
    notes:
      "Midnight withdrawal pattern — requires senior approval before blocking.",
  },
  {
    id: 4,
    transactionId: "AGN-000007",
    action: "approved",
    reviewer: "Sarah W.",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    amount: 130227,
    riskScore: 52,
    duration: "2 minutes",
    notes:
      "Score above threshold but no pattern matched. Verified with account holder.",
  },
  {
    id: 5,
    transactionId: "NUS-000001",
    action: "rejected",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    amount: 412500,
    riskScore: 94,
    duration: "6 minutes",
    notes:
      "Burst payment + sudden API channel switch + refund abuse. Customer account suspended.",
  },
  {
    id: 6,
    transactionId: "NUS-000008",
    action: "approved",
    reviewer: "Rina Sari",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 21600000).toISOString(),
    amount: 280575,
    riskScore: 50,
    duration: "2 minutes",
    notes:
      "Customer confirmed API channel change was intentional — migrating from Web.",
  },
  {
    id: 7,
    transactionId: "AGN-000004",
    action: "flagged",
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 25200000).toISOString(),
    amount: 226048,
    riskScore: 61,
    duration: "4 minutes",
    notes: "Impossible terminal switch detected — flagged for senior review.",
  },
  {
    id: 8,
    transactionId: "NUS-000002",
    action: "rejected",
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    amount: 275000,
    riskScore: 87,
    duration: "5 minutes",
    notes:
      "REFUND_FLAG=1 combined with underpayment and burst pattern. Rejected.",
  },
  {
    id: 9,
    transactionId: "AGN-000006",
    action: "approved",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    amount: 184311,
    riskScore: 57,
    duration: "3 minutes",
    notes: "Midnight flag but single pattern only. Customer OTP verified.",
  },
  {
    id: 10,
    transactionId: "NUS-000003",
    action: "escalated",
    reviewer: "Budi S.",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 90000000).toISOString(),
    amount: 198000,
    riskScore: 76,
    duration: "6 minutes",
    notes:
      "Payment spike + burst pattern — escalated for further review by compliance.",
  },
  {
    id: 11,
    transactionId: "AGN-000005",
    action: "approved",
    reviewer: "Sarah W.",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    amount: 142014,
    riskScore: 60,
    duration: "3 minutes",
    notes:
      "Terminal switch detected but geo-verified. Approved after confirmation.",
  },
  {
    id: 12,
    transactionId: "NUS-000004",
    action: "flagged",
    reviewer: "Rina Sari",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 180000000).toISOString(),
    amount: 357477,
    riskScore: 65,
    duration: "4 minutes",
    notes:
      "Sudden API channel switch — flagged, pending customer verification.",
  },
];

const HIST_PER_PAGE = 5;

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
}) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);
  const effectivePages = Math.max(1, totalPages);
  const getPages = () => {
    if (effectivePages <= 7)
      return Array.from({ length: effectivePages }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(effectivePages - 1, currentPage + 1);
      i++
    )
      pages.push(i);
    if (currentPage < effectivePages - 2) pages.push("...");
    pages.push(effectivePages);
    return pages;
  };
  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing{" "}
        <strong>
          {start}–{end}
        </strong>{" "}
        of <strong>{totalItems}</strong> entries
      </span>
      <div className="pagination-controls">
        <button
          className="page-btn page-nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`dot${i}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`page-btn${p === currentPage ? " active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="page-btn page-nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === effectivePages || totalItems === 0}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

const HistoryModal = ({ item, onClose }) => {
  const meta = ACTION_META[item.action] || ACTION_META.approved;
  const bgMap = {
    approved: "#dcfce7",
    rejected: "#fee2e2",
    escalated: "#dbeafe",
    flagged: "#fef3c7",
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="txn-modal audit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-txn-id">Audit Entry</span>
            <span
              className={`audit-action-label ${meta.cls}`}
              style={{
                padding: ".2rem .6rem",
                borderRadius: "99px",
                fontSize: ".7rem",
                background: bgMap[meta.cls] || "#fef3c7",
              }}
            >
              {meta.label}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="audit-modal-hero">
          <div className={`audit-hero-icon ${meta.cls}`}>
            <i className={`bi ${meta.icon}`}></i>
          </div>
          <div>
            <div className="audit-hero-txn">{item.transactionId}</div>
            <div className="audit-hero-meta">
              {fmtTs(item.timestamp)} · {item.duration}
            </div>
          </div>
        </div>
        <div className="modal-body">
          <div className="audit-modal-grid">
            <div className="audit-kv">
              <div className="audit-kv-label">Amount</div>
              <div className="audit-kv-value mono">{fmt(item.amount)}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">Risk Score</div>
              <div className="audit-kv-value mono">{item.riskScore}/100</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">Reviewed By</div>
              <div className="audit-kv-value">{item.reviewer}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">Role</div>
              <div className="audit-kv-value">{item.reviewerRole}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">Review Duration</div>
              <div className="audit-kv-value">{item.duration}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">Timestamp</div>
              <div
                className="audit-kv-value mono"
                style={{ fontSize: ".75rem" }}
              >
                {fmtTs(item.timestamp)}
              </div>
            </div>
          </div>
          {item.notes && (
            <div className="audit-notes-block">
              <i className="bi bi-chat-left-text"></i>
              <span className="audit-notes-text">{item.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReviewHistory = ({ history }) => {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [histPage, setHistPage] = useState(1);
  const data = history && history.length > 0 ? history : SAMPLE;

  const stats = {
    approved: data.filter((d) => d.action === "approved").length,
    rejected: data.filter((d) => d.action === "rejected").length,
    escalated: data.filter((d) => d.action === "escalated").length,
  };

  const totalHistPages = Math.ceil(data.length / HIST_PER_PAGE);
  const paginatedHist = data.slice(
    (histPage - 1) * HIST_PER_PAGE,
    histPage * HIST_PER_PAGE,
  );

  return (
    <>
      <div className="review-section">
        <div className="section-header">
          <span className="section-title">
            <i className="bi bi-clock-history"></i>Review History
          </span>
          <span className="section-meta">{data.length} entries</span>
        </div>

        <div className="txn-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Txn ID</th>
                <th>Amount</th>
                <th className="hide-sm">Risk</th>
                <th className="hide-sm">Reviewer</th>
                <th className="hide-sm">Duration</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedHist.map((item) => {
                const meta = ACTION_META[item.action] || ACTION_META.approved;
                const initials = item.reviewer
                  .split(" ")
                  .map((n) => n[0])
                  .join("");
                return (
                  <tr key={item.id} onClick={() => setSelectedEntry(item)}>
                    <td>
                      <div className="audit-ts">{fmtTs(item.timestamp)}</div>
                      <div
                        style={{
                          fontSize: ".68rem",
                          color: "#94a3b8",
                          marginTop: ".1rem",
                        }}
                      >
                        {timeAgo(item.timestamp)}
                      </div>
                    </td>
                    <td>
                      <div className="audit-action-cell">
                        <span className={`audit-dot ${meta.cls}`}></span>
                        <span className={`audit-action-label ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="audit-txn-id">{item.transactionId}</span>
                    </td>
                    <td>
                      <span className="audit-amount">{fmt(item.amount)}</span>
                    </td>
                    <td className="hide-sm">
                      <span
                        style={{
                          fontFamily: "IBM Plex Mono, monospace",
                          fontSize: ".775rem",
                          fontWeight: "600",
                          color:
                            item.riskScore >= 80
                              ? "#dc2626"
                              : item.riskScore >= 60
                                ? "#d97706"
                                : "#16a34a",
                        }}
                      >
                        {item.riskScore}
                        <span style={{ fontWeight: 400, color: "#94a3b8" }}>
                          /100
                        </span>
                      </span>
                    </td>
                    <td className="hide-sm">
                      <div className="audit-reviewer">
                        <div className="audit-avatar">{initials}</div>
                        <span className="audit-reviewer-name">
                          {item.reviewer}
                        </span>
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span
                        style={{
                          fontFamily: "IBM Plex Mono, monospace",
                          fontSize: ".75rem",
                          color: "#475569",
                        }}
                      >
                        {item.duration}
                      </span>
                    </td>
                    <td>
                      {item.notes ? (
                        <span className="audit-notes">{item.notes}</span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: ".8rem" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-audit-detail"
                        onClick={() => setSelectedEntry(item)}
                      >
                        <i className="bi bi-eye"></i>View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={histPage}
          totalPages={totalHistPages}
          totalItems={data.length}
          perPage={HIST_PER_PAGE}
          onPageChange={setHistPage}
        />

        <div className="audit-footer">
          <div className="audit-footer-stats">
            <span className="audit-stat green">
              <i className="bi bi-check-circle-fill"></i>
              {stats.approved} Approved
            </span>
            <span className="audit-stat red">
              <i className="bi bi-x-circle-fill"></i>
              {stats.rejected} Rejected
            </span>
            <span className="audit-stat blue">
              <i className="bi bi-arrow-up-circle-fill"></i>
              {stats.escalated} Escalated
            </span>
          </div>
          <button className="btn-audit-detail">
            View Full Log <i className="bi bi-arrow-right"></i>
          </button>
        </div>
      </div>

      {selectedEntry && (
        <HistoryModal
          item={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
};

export default ReviewHistory;
