import React, { useState, useEffect } from "react";
import useRole from "../hooks/useRole";
import ReviewStatsBar from "../components/review/ReviewStatsBar";
import TabMyQueue from "../components/review/TabMyQueue";
import TabAnalystPerformance from "../components/review/TabAnalystPerformance";
import TabTimeline from "../components/review/TabTimeline";
import TabReviewManagement from "../components/review/TabReviewManagement";
import {
  fetchReviewMetrics,
  fetchMyReviewMetrics,
} from "../services/reviewApiService";
import "./ManualReview.css";

/**
 * ManualReview.js — Orchestrator
 * Menentukan tab mana yang tampil berdasarkan role user.
 *
 * FRAUD_ANALYST  : My Assigned Cases
 * RISK_MANAGER   : Analyst Performance + Timeline + Review Management
 * SUPER_ADMIN    : Semua tab
 */

const TAB_CONFIG = [
  {
    id: "my-queue",
    label: "My Assigned Cases",
    icon: "bi-person-check-fill",
    color: "#2563eb",
    roles: ["canReview"],
  },
  {
    id: "performance",
    label: "Analyst Performance",
    icon: "bi-people-fill",
    color: "#7c3aed",
    roles: ["canViewAnalytics"],
  },
  {
    id: "timeline",
    label: "Timeline Analytics",
    icon: "bi-graph-up-arrow",
    color: "#2563eb",
    roles: ["canViewAnalytics"],
  },
  {
    id: "management",
    label: "Review Management",
    icon: "bi-shield-fill-exclamation",
    color: "#dc2626",
    roles: ["canManage"],
  },
];

const ManualReview = () => {
  const { canReview, canManage, canViewAnalytics } = useRole();

  const roleFlags = { canReview, canManage, canViewAnalytics };

  // Tab yang tersedia berdasarkan role
  const availableTabs = TAB_CONFIG.filter((tab) =>
    tab.roles.some((r) => roleFlags[r]),
  );

  // Default tab berdasarkan role
  const defaultTab = canReview ? "my-queue" : "performance";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsKey, setMetricsKey] = useState(0);

  // Load metrics — personal untuk FRAUD_ANALYST, global untuk lainnya
  useEffect(() => {
    const load = async () => {
      try {
        setMetricsLoading(true);
        const data =
          canReview && !canManage
            ? await fetchMyReviewMetrics()
            : await fetchReviewMetrics();
        setMetrics(data?.data ?? data ?? null);
      } catch {
        /* metrics gagal tidak kritis */
      } finally {
        setMetricsLoading(false);
      }
    };
    load();
  }, [metricsKey, canReview, canManage]);

  return (
    <div className="manual-review-page">
      {/* Header */}
      <div className="review-header">
        <div className="header-content">
          <h1>Manual Review</h1>
          <p className="subtitle">
            {canReview && canManage
              ? "Dashboard review lengkap"
              : canReview
                ? "Alert yang sudah Anda klaim — siap untuk direview"
                : "Analytics & manajemen proses review"}
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <ReviewStatsBar metrics={metrics} loading={metricsLoading} />

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "20px",
          borderBottom: "2px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 16px",
              whiteSpace: "nowrap",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: ".875rem",
              color: activeTab === tab.id ? tab.color : "#6b7280",
              borderBottom:
                activeTab === tab.id
                  ? `2px solid ${tab.color}`
                  : "2px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: ".4rem",
              transition: "all .15s",
            }}
          >
            <i className={`bi ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="review-section">
        {activeTab === "my-queue" && (
          <TabMyQueue onRefreshMetrics={() => setMetricsKey((k) => k + 1)} />
        )}
        {activeTab === "performance" && <TabAnalystPerformance />}
        {activeTab === "timeline" && <TabTimeline />}
        {activeTab === "management" && <TabReviewManagement />}
      </div>
    </div>
  );
};

export default ManualReview;
