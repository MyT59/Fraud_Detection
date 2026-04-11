import React, { useState, useEffect } from "react";
import PageLoader from "../components/common/PageLoader";
import HistoryStats from "../components/reviewhistory/HistoryStats";
import HistoryTable from "../components/reviewhistory/HistoryTable";
import HistoryDetailModal from "../components/reviewhistory/HistoryDetailModal";
import "./ReviewHistory.css";

const BASE_URL = process.env.REACT_APP_ML_API_URL || "http://localhost:8000";

const SAMPLE = [
  {
    id: "sample-1",
    transactionId: "AGN-000008",
    action: "rejected",
    service: "agenusa",
    accountId: "ACC-001",
    amount: 895000,
    riskScore: 96,
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date().toISOString(),
    duration: "—",
    notes:
      "Multiple patterns confirmed: bruteforce PIN + money mule destination.",
  },
  {
    id: "sample-2",
    transactionId: "NUS-000009",
    action: "rejected",
    service: "nusabill",
    accountId: "CUST-009",
    amount: 315845,
    riskScore: 95,
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    duration: "—",
    notes: "Refund abuse + burst payment pattern via API channel.",
  },
  {
    id: "sample-3",
    transactionId: "AGN-000003",
    action: "approved",
    service: "agenusa",
    accountId: "ACC-003",
    amount: 234802,
    riskScore: 78,
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    duration: "—",
    notes: "Midnight withdrawal pattern — verified, no conclusive fraud.",
  },
  {
    id: "sample-4",
    transactionId: "NUS-000001",
    action: "rejected",
    service: "nusabill",
    accountId: "CUST-001",
    amount: 412500,
    riskScore: 94,
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    duration: "—",
    notes: "Burst payment + sudden API channel switch + refund abuse.",
  },
  {
    id: "sample-5",
    transactionId: "AGN-000007",
    action: "approved",
    service: "agenusa",
    accountId: "ACC-007",
    amount: 130227,
    riskScore: 52,
    reviewer: "Sarah W.",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    duration: "—",
    notes:
      "Score above threshold but no pattern matched. Verified with account holder.",
  },
];

const mapRecord = (r, idx) => {
  const amount = parseFloat(r.BILL_AMOUNT || r.AMOUNT || 0);

  const raw = parseFloat(r.ml_fraud_score || 0);
  const riskScore = Math.round(raw <= 1 ? raw * 100 : raw);

  const accountId = r.ACCOUNT_NUMBER || r.CUSTOMER_ID || "—";

  const prefix = r.domain === "agenusa" ? "AGN" : "NUS";
  const txnId =
    r.transaction_id || `${prefix}-${String(idx + 1).padStart(6, "0")}`;

  return {
    id: r.transaction_id ? `${r.transaction_id}-${idx}` : `rec-${idx}`,
    transactionId: txnId,
    action: r.decision,
    service: r.domain,
    accountId,
    amount,
    riskScore,
    reviewer: "Admin User",
    reviewerRole: "Fraud Analyst",
    timestamp: r.reviewed_at,
    duration: "—",
    notes: r.reviewer_notes || "",
    matchedPatterns: r.matched_patterns
      ? r.matched_patterns.split("|").filter(Boolean)
      : [],
  };
};

const ReviewHistory = () => {
  const [loading, setLoading] = useState(true);
  const [apiData, setApiData] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${BASE_URL}/review/feedback`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const mapped = (json.records || []).map(mapRecord);
        mapped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setApiData(mapped);
      } catch (err) {
        console.warn(
          "ReviewHistory: backend offline, pakai sample data.",
          err.message,
        );
        setApiError(true);
        setApiData(SAMPLE);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const allData = apiData || SAMPLE;

  if (loading) return <PageLoader message="Memuat Review History..." />;

  return (
    <div className="rh-page-wrapper">
      {apiError && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: ".75rem 1.25rem",
            marginBottom: "1.25rem",
            fontSize: ".85rem",
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: ".5rem",
          }}
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          Backend tidak tersedia — menampilkan data sampel. Jalankan uvicorn
          untuk melihat data review nyata.
        </div>
      )}

      <HistoryStats data={allData} />

      <HistoryTable data={allData} onViewDetail={setSelectedItem} />

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
