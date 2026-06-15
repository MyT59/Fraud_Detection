import React, { useState, useEffect, useCallback } from "react";
import PageLoader from "../common/PageLoader";
import OverrideModal from "./OverrideModal";
import FalseNegativeSection from "./FalseNegativeSection";
import { DecisionBadge } from "./ReviewBadges";
import { fmtDate } from "./reviewHelpers";
import {
  overrideReview,
  fetchReviewHistory,
  mapHistoryItems,
} from "../../services/reviewApiService";
import api from "../../services/apiService";

/**
 * TabReviewManagement.js
 * Tab "Review Management" — hanya untuk RISK_MANAGER & SUPER_ADMIN.
 * Fitur: Override keputusan, Soft Delete review, Report False Negative.
 * Data source: GET /reviews/history
 */
const TabReviewManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingOp, setPendingOp] = useState({});
  const [overrideModal, setOverrideModal] = useState(null);
  const LIMIT = 10;

  // ─── Load Data ──────────────────────────────────────────────────

  const load = useCallback(async (p) => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetchReviewHistory({ page: p, limit: LIMIT });
      setItems(mapHistoryItems(res?.items ?? []));
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error("[TabReviewManagement]", err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  // ─── Handlers ───────────────────────────────────────────────────

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

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div>
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

      {/* Warning banner */}
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

      {/* Content */}
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

          {/* Pagination */}
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

      {/* Override Modal */}
      {overrideModal && (
        <OverrideModal
          item={overrideModal}
          onClose={() => setOverrideModal(null)}
          onSubmit={handleOverrideSubmit}
          pending={!!pendingOp[overrideModal.reviewId]}
        />
      )}

      {/* False Negative Section */}
      <FalseNegativeSection />
    </div>
  );
};

export default TabReviewManagement;
