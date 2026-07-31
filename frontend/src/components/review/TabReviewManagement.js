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

const LIMIT = 10;

const TabReviewManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingOp, setPendingOp] = useState({});
  const [overrideModal, setOverrideModal] = useState(null);

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

  const handleDelete = async (reviewId) => {
    if (
      !window.confirm(
        `Soft delete Review #${reviewId}? Tindakan ini dicatat untuk audit.`,
      )
    ) {
      return;
    }

    setPendingOp((p) => ({ ...p, [reviewId]: "deleting" }));
    try {
      await api.del(`/reviews/${reviewId}`);
      setItems((prev) => prev.filter((i) => i.reviewId !== reviewId));
      setTotal((current) => Math.max(0, current - 1));
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
          i.reviewId === reviewId
            ? { ...i, decision: newDecision, finalStatus: newDecision, isOverridden: true }
            : i,
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
    <div className="review-tab-content">
      <div className="review-panel-header">
        <div>
          <h2 className="review-panel-title">
            <span className="review-panel-icon red">
              <i className="bi bi-shield-fill-exclamation" />
            </span>
            Reviewer Operations
          </h2>
          <p className="review-panel-subtitle">
            Kontrol override, audit keputusan, dan laporan false negative untuk
            kebutuhan compliance.
          </p>
        </div>
        <button className="review-secondary-btn" onClick={() => load(page)}>
          <i className="bi bi-arrow-clockwise" />
          Refresh
        </button>
      </div>

      <div className="review-warning-banner">
        <i className="bi bi-exclamation-triangle-fill" />
        <span>
          Override dan delete hanya digunakan untuk alasan compliance. Semua
          tindakan tetap dicatat di audit log.
        </span>
      </div>

      {error ? (
        <div className="review-error-state">
          <i className="bi bi-wifi-off" />
          <p>Gagal memuat data.</p>
        </div>
      ) : loading ? (
        <PageLoader message="Memuat review..." />
      ) : (
        <>
          <div className="review-table-card">
            <div className="review-table-toolbar">
              <div>
                <strong>Review Decisions</strong>
                <span>{total} catatan audit review</span>
              </div>
            </div>
            <table className="txn-table review-data-table">
              <thead>
                <tr>
                  <th>Review</th>
                  <th>Transaction</th>
                  <th>Alert</th>
                  <th>Decision</th>
                  <th>Status Change</th>
                  <th>Waktu</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ opacity: pendingOp[item.reviewId] ? 0.55 : 1 }}
                  >
                    <td>
                      <span className="cell-id">#{item.reviewId}</span>
                    </td>
                    <td>
                      <span className="cell-id">{item.transactionId}</span>
                    </td>
                    <td>
                      <span className="cell-id">
                        {item.alertId != null ? `#${item.alertId}` : "-"}
                      </span>
                    </td>
                    <td>
                      <DecisionBadge decision={item.decision} />
                    </td>
                    <td>
                      <span className="review-status-flow">
                        <span>{item.previousStatus || "-"}</span>
                        <i className="bi bi-arrow-right" />
                        <strong>{item.finalStatus || "-"}</strong>
                      </span>
                    </td>
                    <td>
                      <span className="cell-date">
                        {fmtDate(item.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="review-action-row">
                        <button
                          className="btn-aksi review-action-blue"
                          onClick={() => setOverrideModal(item)}
                          disabled={!!pendingOp[item.reviewId]}
                        >
                          <i className="bi bi-arrow-repeat" />
                          Override
                        </button>
                        <button
                          className="btn-aksi review-action-red"
                          onClick={() => handleDelete(item.reviewId)}
                          disabled={!!pendingOp[item.reviewId]}
                        >
                          {pendingOp[item.reviewId] === "deleting" ? (
                            "Deleting..."
                          ) : (
                            <>
                              <i className="bi bi-trash3" />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="review-inline-empty">
                        Belum ada hasil review untuk periode ini.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="review-pagination-row">
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

      <FalseNegativeSection />
    </div>
  );
};

export default TabReviewManagement;
