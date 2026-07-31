import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import PageLoader from "../components/common/PageLoader";
import HistoryStats from "../components/reviewhistory/HistoryStats";
import HistoryTable from "../components/reviewhistory/HistoryTable";
import HistoryDetailModal from "../components/reviewhistory/HistoryDetailModal";
import api from "../services/apiService";
import useRole from "../hooks/useRole";
import {
  fetchMyReviewHistory,
  fetchMyReviewMetrics,
  fetchReviewHistory,
  mapHistoryItem,
} from "../services/reviewApiService";
import "./ReviewHistory.css";

// ─── Komponen Utama ───────────────────────────────────────────────

const ReviewHistory = () => {
  const { isFraudAnalyst } = useRole();
  const [searchParams] = useSearchParams();
  const reviewedByParam = searchParams.get("reviewed_by");

  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("all");
  const [sortKey, setSortKey] = useState("createdAt-desc");
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 10;

  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const abortRef = useRef(null);

  // ─── Fetch History ─────────────────────────────────────────────
  // FRAUD_ANALYST → GET /reviews/my-history (hanya miliknya)
  // RISK_MANAGER & SUPER_ADMIN → GET /reviews/history (semua reviewer)

  const fetchHistory = useCallback(
    async (targetPage) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        let data;
        const sortBy = sortKey === "createdAt-asc" ? "oldest" : "newest";
        if (isFraudAnalyst) {
          data = await fetchMyReviewHistory({
            page: targetPage, limit: LIMIT, decision, search, sortBy,
            requestOptions: { signal: controller.signal },
          });
        } else {
          data = await fetchReviewHistory({
            page: targetPage, limit: LIMIT, reviewedBy: reviewedByParam,
            decision, search, sortBy,
            requestOptions: { signal: controller.signal },
          });
        }

        const mapped = (data.items ?? []).map(mapHistoryItem);
        setItems(mapped);
        setTotalItems(data.total ?? 0);
        setApiError(false);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("[ReviewHistory] Gagal memuat history:", err.message);
        setApiError(true);
        setItems([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    },
    [isFraudAnalyst, reviewedByParam, decision, search, sortKey],
  );

  // ─── Fetch Metrics ─────────────────────────────────────────────
  // FRAUD_ANALYST → GET /reviews/my-metrics (metrics miliknya)
  // RISK_MANAGER & SUPER_ADMIN → GET /reviews/metrics (global)

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      let data;
      if (isFraudAnalyst) {
        data = await fetchMyReviewMetrics();
      } else {
        data = await api.get("/reviews/metrics");
      }
      setMetrics(data?.data ?? data ?? null);
    } catch (err) {
      console.warn("[ReviewHistory] Gagal fetch metrics:", err.message);
    } finally {
      setMetricsLoading(false);
    }
  }, [isFraudAnalyst]);

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

  const handleFiltersChange = (next) => {
    setSearch(next.search);
    setDecision(next.decision);
    setSortKey(next.sortKey);
    setPage(1);
  };

  // ─── Render ────────────────────────────────────────────────────

  if (loading && page === 1 && items.length === 0) {
    return <PageLoader message="Memuat Review History..." />;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));

  return (
    <div className="rh-page-wrapper">
      {/* Info banner — tunjukkan context history ke user */}
      {!apiError && (
        <div
          style={{
            padding: ".625rem 1rem",
            marginBottom: "1rem",
            background: isFraudAnalyst ? "#eff6ff" : "#f0fdf4",
            border: `1px solid ${isFraudAnalyst ? "#bfdbfe" : "#bbf7d0"}`,
            borderRadius: "8px",
            fontSize: ".82rem",
            color: isFraudAnalyst ? "#1d4ed8" : "#15803d",
            display: "flex",
            alignItems: "center",
            gap: ".5rem",
          }}
        >
          <i
            className={`bi ${isFraudAnalyst ? "bi-person-fill" : "bi-people-fill"}`}
          />
          {isFraudAnalyst
            ? "Menampilkan riwayat review milik Anda sendiri."
            : reviewedByParam
              ? `Menampilkan riwayat review untuk Analyst ID ${reviewedByParam}.`
              : "Menampilkan riwayat review seluruh tim (semua analis)."}
        </div>
      )}

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
        search={search}
        decision={decision}
        sortKey={sortKey}
        onFiltersChange={handleFiltersChange}
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
