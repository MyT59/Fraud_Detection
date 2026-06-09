import React, { useState, useEffect, useCallback, useRef } from "react";
import PageLoader from "../components/common/PageLoader";
import HistoryStats from "../components/reviewhistory/HistoryStats";
import HistoryTable from "../components/reviewhistory/HistoryTable";
import HistoryDetailModal from "../components/reviewhistory/HistoryDetailModal";
import api from "../services/apiService";
import "./ReviewHistory.css";

/**
 * mapReviewItem
 * Memetakan item dari GET /reviews/history ke format internal FE.
 *
 * Hanya menggunakan field yang BENAR-BENAR ada di ReviewHistoryItem schema BE:
 *   id, transaction_id, alert_id, decision, review_note,
 *   previous_status, final_status, reviewed_by, created_at
 *
 * Field yang TIDAK ada di BE dan TIDAK boleh digunakan:
 *   service, amount, risk_score, account_id, matched_patterns,
 *   reviewer_name, reviewer_role, duration
 */
const mapReviewItem = (r) => ({
  // Identifikasi
  id: `review-${r.id}`,
  reviewId: r.id,
  transactionId: r.transaction_id
    ? `TRX-${String(r.transaction_id).padStart(6, "0")}`
    : `RVW-${String(r.id).padStart(6, "0")}`,
  transactionIdRaw: r.transaction_id ?? null,
  alertId: r.alert_id ?? null,

  // Keputusan
  decision: (r.decision || "").toUpperCase(), // "SAFE" | "FRAUD"

  // Status
  previousStatus: r.previous_status ?? null,
  finalStatus: r.final_status ?? null,

  // Reviewer — hanya ID, nama tidak ada di BE schema
  reviewedBy: r.reviewed_by ?? null,

  // Catatan
  reviewNote: r.review_note ?? null,

  // Waktu
  createdAt: r.created_at ?? null,
});

// ─── Komponen Utama ───────────────────────────────────────────────

const ReviewHistory = () => {
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 10;

  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const abortRef = useRef(null);

  // ─── Fetch History ─────────────────────────────────────────────

  const fetchHistory = useCallback(async (targetPage) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const data = await api.get(
        `/reviews/history?page=${targetPage}&limit=${LIMIT}`,
        { signal: controller.signal },
      );

      const mapped = (data.items ?? []).map(mapReviewItem);
      setItems(mapped);
      setTotalItems(data.total ?? 0);
      setApiError(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[ReviewHistory] Gagal memuat history:", err.message);
      // ❌ TIDAK fallback ke dummy — tampilkan error state
      setApiError(true);
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch Metrics ─────────────────────────────────────────────

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await api.get("/reviews/metrics");
      setMetrics(data?.data ?? data ?? null);
    } catch (err) {
      console.warn("[ReviewHistory] Gagal fetch metrics:", err.message);
      // Metrics gagal tidak kritis — halaman tetap bisa digunakan
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(page);
  }, [page, fetchHistory]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handlePageChange = (newPage) => {
    const maxPage = Math.ceil(totalItems / LIMIT);
    if (newPage < 1 || newPage > maxPage) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRefresh = () => {
    setApiError(false);
    setPage(1);
    fetchHistory(1);
    fetchMetrics();
  };

  // ─── Render ────────────────────────────────────────────────────

  if (loading && page === 1 && items.length === 0) {
    return <PageLoader message="Memuat Review History..." />;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));

  return (
    <div className="rh-page-wrapper">
      {/* Banner Error — tampil jika API gagal, tanpa dummy data */}
      {apiError && (
        <div className="rh-offline-banner">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>
            <strong>Gagal memuat data.</strong> Tidak dapat terhubung ke server.
            Periksa koneksi atau pastikan backend berjalan.
          </span>
          <button className="rh-refresh-btn" onClick={handleRefresh}>
            <i className="bi bi-arrow-clockwise" /> Coba Lagi
          </button>
        </div>
      )}

      {/* Stats — dari metrics API, bukan dari dummy */}
      <HistoryStats metrics={metrics} metricsLoading={metricsLoading} />

      {/* Tabel History */}
      <HistoryTable
        data={items}
        loading={loading}
        totalItems={totalItems}
        page={page}
        totalPages={totalPages}
        perPage={LIMIT}
        onPageChange={handlePageChange}
        onViewDetail={setSelectedItem}
        onRefresh={handleRefresh}
        apiError={apiError}
      />

      {/* Modal Detail */}
      {selectedItem && (
        <HistoryDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default ReviewHistory;
