import React, { useState, useEffect, useCallback, useRef } from "react";
import PageLoader from "../components/common/PageLoader";
import HistoryStats from "../components/reviewhistory/HistoryStats";
import HistoryTable from "../components/reviewhistory/HistoryTable";
import HistoryDetailModal from "../components/reviewhistory/HistoryDetailModal";
import api from "../services/apiService";
import "./ReviewHistory.css";

const mapReviewItem = (r, idx) => {
  const actionMap = {
    FRAUD: "rejected",
    SAFE: "approved",
  };
  const action = actionMap[r.decision?.toUpperCase()] ?? "approved";

  const txnDisplay = r.transaction_id
    ? `TRX-${String(r.transaction_id).padStart(6, "0")}`
    : `RVW-${String(r.id).padStart(6, "0")}`;

  return {
    id: `review-${r.id}`,
    reviewId: r.id,
    transactionId: txnDisplay,
    transactionIdRaw: r.transaction_id,
    alertId: r.alert_id,

    action,
    decision: r.decision,
    previousStatus: r.previous_status,
    finalStatus: r.final_status,

    reviewer: r.reviewer_name ?? `Analyst #${r.reviewed_by ?? "?"}`,
    reviewerRole: r.reviewer_role ?? "Fraud Analyst",
    reviewedBy: r.reviewed_by,

    timestamp: r.created_at,
    duration: "—",

    notes: r.review_note ?? "",

    service: r.service ?? r.domain ?? null,
    accountId: r.account_id ?? r.customer_id ?? "—",
    amount: parseFloat(r.amount ?? r.bill_amount ?? 0),
    riskScore:
      r.risk_score != null
        ? Math.round(r.risk_score <= 1 ? r.risk_score * 100 : r.risk_score)
        : 0,

    matchedPatterns: r.matched_patterns
      ? r.matched_patterns.split("|").filter(Boolean)
      : [],
  };
};

const SAMPLE = [
  {
    id: "review-1",
    reviewId: 1,
    transactionId: "TRX-000042",
    transactionIdRaw: 42,
    alertId: 1024,
    action: "rejected",
    decision: "FRAUD",
    previousStatus: "UNDER_REVIEW",
    finalStatus: "FRAUD",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    reviewedBy: 1,
    timestamp: new Date().toISOString(),
    duration: "—",
    notes:
      "Multiple patterns confirmed: bruteforce PIN + money mule destination.",
    service: "agenusa",
    accountId: "ACC-001",
    amount: 895000,
    riskScore: 96,
    matchedPatterns: ["brute_force_pin", "money_mule_destination"],
  },
  {
    id: "review-2",
    reviewId: 2,
    transactionId: "TRX-000009",
    transactionIdRaw: 9,
    alertId: 1025,
    action: "rejected",
    decision: "FRAUD",
    previousStatus: "UNDER_REVIEW",
    finalStatus: "FRAUD",
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    reviewedBy: 2,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    duration: "—",
    notes: "Refund abuse + burst payment pattern via API channel.",
    service: "nusabill",
    accountId: "CUST-009",
    amount: 315845,
    riskScore: 95,
    matchedPatterns: ["refund_abuse", "burst_payment"],
  },
  {
    id: "review-3",
    reviewId: 3,
    transactionId: "TRX-000003",
    transactionIdRaw: 3,
    alertId: 1026,
    action: "approved",
    decision: "SAFE",
    previousStatus: "UNDER_REVIEW",
    finalStatus: "SAFE",
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    reviewedBy: 3,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    duration: "—",
    notes: "Midnight withdrawal pattern — verified, no conclusive fraud.",
    service: "agenusa",
    accountId: "ACC-003",
    amount: 234802,
    riskScore: 78,
    matchedPatterns: [],
  },
];

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
      console.warn(
        "ReviewHistory: API error, menggunakan sample data.",
        err.message,
      );
      setApiError(true);
      setItems(SAMPLE);
      setTotalItems(SAMPLE.length);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await api.get("/reviews/metrics");

      setMetrics(data);
    } catch (err) {
      console.warn("ReviewHistory: Gagal fetch metrics.", err.message);
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

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / LIMIT)) return;
    setPage(newPage);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRefresh = () => {
    setPage(1);
    fetchHistory(1);
    fetchMetrics();
  };

  if (loading && page === 1 && items.length === 0) {
    return <PageLoader message="Memuat Review History..." />;
  }

  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <div className="rh-page-wrapper">
      {apiError && (
        <div className="rh-offline-banner">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>
            Backend tidak tersedia — menampilkan <strong>data sampel</strong>.
            Jalankan uvicorn agar data review nyata ditampilkan.
          </span>
          <button className="rh-refresh-btn" onClick={handleRefresh}>
            <i className="bi bi-arrow-clockwise"></i>
            Coba lagi
          </button>
        </div>
      )}

      <HistoryStats
        data={items}
        metrics={metrics}
        metricsLoading={metricsLoading}
      />

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
      />

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
