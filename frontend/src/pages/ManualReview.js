import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { getRoleCopy, getRoleLabel } from "../utils/roleUi";
import "./ManualReview.css";

/**
 * ManualReview.js — Orchestrator
 * Menentukan tab mana yang tampil berdasarkan role user.
 *
 * FRAUD_ANALYST  : My Review Queue
 * RISK_MANAGER   : Analyst Performance + Timeline + Review Management
 * SUPER_ADMIN    : Analyst Performance + Timeline + Review Management
 */

const TAB_CONFIG = [
  {
    id: "my-queue",
    label: "My Review Queue",
    desc: "Kasus yang sudah Anda klaim",
    icon: "bi-person-check-fill",
    color: "#2563eb",
    roles: ["canReview"],
  },
  {
    id: "performance",
    label: "Analyst Performance",
    desc: "Kinerja dan beban kerja fraud analyst",
    icon: "bi-people-fill",
    color: "#7c3aed",
    roles: ["canViewAnalytics"],
  },
  {
    id: "timeline",
    label: "Review Timeline",
    desc: "Tren review, fraud, dan pertumbuhan queue",
    icon: "bi-graph-up-arrow",
    color: "#2563eb",
    roles: ["canViewAnalytics"],
  },
  {
    id: "management",
    label: "Reviewer Operations",
    desc: "Override, audit control, dan false negative",
    icon: "bi-shield-fill-exclamation",
    color: "#dc2626",
    roles: ["canManage"],
  },
];

const ManualReview = () => {
  const { role, canReview, canManage, canViewAnalytics, isFraudAnalyst } =
    useRole();
  const roleCopy = getRoleCopy(role);
  const roleLabel = getRoleLabel(role);

  const roleFlags = { canReview, canManage, canViewAnalytics };

  // Tab yang tersedia berdasarkan role
  const availableTabs = TAB_CONFIG.filter((tab) =>
    tab.roles.some((r) => roleFlags[r]),
  );

  // Default tab berdasarkan role
  const defaultTab = canManage ? "performance" : "my-queue";
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

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, availableTabs, defaultTab]);

  const activeTabMeta =
    availableTabs.find((tab) => tab.id === activeTab) || availableTabs[0];

  return (
    <div className="manual-review-page">
      {/* Header */}
      <div className="review-header review-header--workspace">
        <div className="header-content">
          <div className="review-role-pill">
            <i className="bi bi-person-badge" />
            {roleLabel}
          </div>
          <h1>{roleCopy.reviewTitle}</h1>
          <p className="subtitle">{roleCopy.reviewSubtitle}</p>
        </div>
        <div className="review-workspace-card">
          <span className="review-workspace-eyebrow">
            {isFraudAnalyst ? "Today Focus" : "Operations Focus"}
          </span>
          <strong>
            {isFraudAnalyst
              ? "Selesaikan kasus yang sudah diklaim"
              : "Pantau performa dan kualitas keputusan review"}
          </strong>
          <p>
            {isFraudAnalyst
              ? "Flagged transaction tetap berhasil, lalu Anda validasi sebagai safe atau fraud."
              : "Super Admin dan Risk Manager tidak memiliki queue personal, tetapi mengelola performa, timeline, dan kontrol review."}
          </p>
          <div className="review-workspace-actions">
            <Link to="/alerts">
              <i className="bi bi-bell" />
              {isFraudAnalyst ? "My Alerts" : "Alert Center"}
            </Link>
            <Link to="/review-history">
              <i className="bi bi-clock-history" />
              Review History
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <ReviewStatsBar
        metrics={metrics}
        loading={metricsLoading}
        isPersonal={isFraudAnalyst}
      />

      {/* Tab Navigation */}
      <div className="review-tabs-shell">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`review-tab-card ${activeTab === tab.id ? "active" : ""}`}
            style={{ "--tab-color": tab.color }}
          >
            <span className="review-tab-icon">
              <i className={`bi ${tab.icon}`} />
            </span>
            <span className="review-tab-copy">
              <strong>{tab.label}</strong>
              <small>{tab.desc}</small>
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTabMeta && (
        <div className="review-active-context">
          <i className={`bi ${activeTabMeta.icon}`} />
          <span>{activeTabMeta.desc}</span>
        </div>
      )}
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
