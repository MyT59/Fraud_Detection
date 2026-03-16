import React, { useState, useMemo, useEffect } from "react";
import PageLoader        from "../components/common/PageLoader";
import HistoryStats      from "../components/reviewhistory/HistoryStats";
import HistoryFilter     from "../components/reviewhistory/HistoryFilter";
import HistoryTable      from "../components/reviewhistory/HistoryTable";
import HistoryDetailModal from "../components/reviewhistory/HistoryDetailModal";
import "./ReviewHistory.css";

const BASE_URL = process.env.REACT_APP_ML_API_URL || "http://localhost:8000";

/* ── Sample fallback (tampil kalau backend offline) ── */
const SAMPLE = [
  {
    id: "sample-1", transactionId: "AGN-000008", action: "rejected",
    service: "agenusa", accountId: "ACC-001", amount: 895000,
    riskScore: 96, reviewer: "Admin User", reviewerRole: "Senior Analyst",
    timestamp: new Date().toISOString(), duration: "—",
    notes: "Multiple patterns confirmed: bruteforce PIN + money mule destination.",
  },
  {
    id: "sample-2", transactionId: "NUS-000009", action: "rejected",
    service: "nusabill", accountId: "CUST-009", amount: 315845,
    riskScore: 95, reviewer: "Jane Smith", reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 3600000).toISOString(), duration: "—",
    notes: "Refund abuse + burst payment pattern via API channel.",
  },
  {
    id: "sample-3", transactionId: "AGN-000003", action: "approved",
    service: "agenusa", accountId: "ACC-003", amount: 234802,
    riskScore: 78, reviewer: "John Doe", reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 7200000).toISOString(), duration: "—",
    notes: "Midnight withdrawal pattern — verified, no conclusive fraud.",
  },
  {
    id: "sample-4", transactionId: "NUS-000001", action: "rejected",
    service: "nusabill", accountId: "CUST-001", amount: 412500,
    riskScore: 94, reviewer: "Admin User", reviewerRole: "Senior Analyst",
    timestamp: new Date(Date.now() - 18000000).toISOString(), duration: "—",
    notes: "Burst payment + sudden API channel switch + refund abuse.",
  },
  {
    id: "sample-5", transactionId: "AGN-000007", action: "approved",
    service: "agenusa", accountId: "ACC-007", amount: 130227,
    riskScore: 52, reviewer: "Sarah W.", reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 10800000).toISOString(), duration: "—",
    notes: "Score above threshold but no pattern matched. Verified with account holder.",
  },
];

/* ── Map data dari backend → format komponen ── */
const mapRecord = (r, idx) => {
  // amount: agenusa pakai AMOUNT, nusabill pakai BILL_AMOUNT
  const amount =
    parseFloat(r.BILL_AMOUNT || r.AMOUNT || 0);

  // riskScore: backend simpan 0–1, kita tampilkan 0–100
  const raw = parseFloat(r.ml_fraud_score || 0);
  const riskScore = Math.round((raw <= 1 ? raw * 100 : raw));

  // accountId: agenusa → ACCOUNT_NUMBER, nusabill → CUSTOMER_ID
  const accountId = r.ACCOUNT_NUMBER || r.CUSTOMER_ID || "—";

  // transactionId prefix sesuai domain
  const prefix = r.domain === "agenusa" ? "AGN" : "NUS";
  const txnId  = r.transaction_id || `${prefix}-${String(idx + 1).padStart(6, "0")}`;

  return {
    id:            r.transaction_id || `rec-${idx}`,
    transactionId: txnId,
    action:        r.decision,           // "approved" | "rejected"
    service:       r.domain,             // "agenusa" | "nusabill"
    accountId,
    amount,
    riskScore,
    reviewer:      "Admin User",         // belum ada auth — hardcoded
    reviewerRole:  "Fraud Analyst",
    timestamp:     r.reviewed_at,
    duration:      "—",
    notes:         r.reviewer_notes || "",
    matchedPatterns: r.matched_patterns
      ? r.matched_patterns.split("|").filter(Boolean)
      : [],
  };
};

/* ── Filter berdasarkan date range ── */
const applyDateRange = (arr, range) => {
  if (!range || range === "all") return arr;
  const now   = new Date();
  const start = new Date();
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    start.setDate(now.getDate() - 7);
  } else if (range === "month") {
    start.setMonth(now.getMonth() - 1);
  }
  return arr.filter((d) => new Date(d.timestamp) >= start);
};

/* ══════════════════════════════════════════════════════════ */
const ReviewHistory = () => {
  const [loading,      setLoading]      = useState(true);
  const [apiData,      setApiData]      = useState(null);   // null = belum fetch
  const [apiError,     setApiError]     = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  /* Filter state */
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange,    setDateRange]    = useState("all");
  const [searchTerm,   setSearchTerm]   = useState("");

  /* ── Fetch dari /review/feedback ── */
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${BASE_URL}/review/feedback`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const mapped = (json.records || []).map(mapRecord);
        // Urutkan terbaru dulu
        mapped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setApiData(mapped);
      } catch (err) {
        console.warn("ReviewHistory: backend offline, pakai sample data.", err.message);
        setApiError(true);
        setApiData(SAMPLE);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  /* ── Data yang dipakai (real atau fallback) ── */
  const allData = apiData || SAMPLE;

  /* ── Filter + search ── */
  const filtered = useMemo(() => {
    let arr = applyDateRange(allData, dateRange);

    if (actionFilter !== "all")
      arr = arr.filter((d) => d.action === actionFilter);

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      arr = arr.filter(
        (d) =>
          d.transactionId.toLowerCase().includes(q) ||
          (d.accountId  && d.accountId.toLowerCase().includes(q)) ||
          (d.reviewer   && d.reviewer.toLowerCase().includes(q))
      );
    }

    return arr;
  }, [allData, actionFilter, dateRange, searchTerm]);

  /* ── Loading ── */
  if (loading) return <PageLoader message="Memuat Review History..." />;

  return (
    <div className="rh-page-wrapper">

      {/* Banner offline */}
      {apiError && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: "8px", padding: ".75rem 1.25rem",
          marginBottom: "1.25rem", fontSize: ".85rem",
          color: "#92400e", display: "flex", alignItems: "center", gap: ".5rem",
        }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          Backend tidak tersedia — menampilkan data sampel. Jalankan uvicorn untuk melihat data review nyata.
        </div>
      )}

      {/* Stats */}
      <HistoryStats data={allData} />

      {/* Filter */}
      <HistoryFilter
        actionFilter={actionFilter}  setActionFilter={setActionFilter}
        dateRange={dateRange}        setDateRange={setDateRange}
        searchTerm={searchTerm}      setSearchTerm={setSearchTerm}
        totalResults={filtered.length}
      />

      {/* Table */}
      <HistoryTable
        data={filtered}
        onViewDetail={setSelectedItem}
      />

      {/* Detail Modal */}
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