import React, { useState, useMemo, useEffect } from "react";
import PatternStats from "../components/fraudpatterns/PatternStats";
import PatternFilter from "../components/fraudpatterns/PatternFilter";
import PatternCard from "../components/fraudpatterns/PatternCard";
import PatternDetailModal from "../components/fraudpatterns/PatternDetailModal";
import PatternTrendChart from "../components/fraudpatterns/PatternTrendChart";
import PageLoader from "../components/common/PageLoader";
import "./FraudPatterns.css";

/* ── Seed Data ── */
const ALL_PATTERNS = [
  {
    id: 1,
    mlKey: "bruteforce_pin_pattern",
    name: "Multiple Failed Logins",
    description:
      "Repeated failed authentication attempts on a single account within a short time window, indicating brute-force or credential stuffing attacks.",
    category: "Credential",
    riskLevel: "high",
    status: "active",
    occurrences: 156,
    accuracy: 94.2,
    falsePositiveRate: 3.1,
    avgLossIDR: "18.5 Jt",
    trend: 12,
    lastUpdated: "15 Feb 2026",
    indicators: [
      "More than 5 failed login attempts in 10 minutes",
      "Attempts from different IP addresses",
      "Sequential password guessing patterns detected",
      "Unusual geographic distribution of attempts",
    ],
    recommendedActions: [
      "Temporarily lock account after threshold exceeded",
      "Send OTP verification to registered phone/email",
      "Flag IP address for enhanced monitoring",
      "Require CAPTCHA for subsequent login attempts",
    ],
  },
  {
    id: 2,
    mlKey: "high_amount_spike",
    name: "Unusual Transaction Amount",
    description:
      "Transaction amount significantly deviates (≥3× standard deviation) from the user's historical average, suggesting account takeover or unauthorized use.",
    category: "Transaction",
    riskLevel: "high",
    status: "active",
    occurrences: 98,
    accuracy: 91.5,
    falsePositiveRate: 5.2,
    avgLossIDR: "32.1 Jt",
    trend: 8,
    lastUpdated: "14 Feb 2026",
    indicators: [
      "Amount exceeds 3× user's 90-day average",
      "First large transaction from new device",
      "Transaction to a new or unverified recipient",
      "Multiple high-value transactions in one session",
    ],
    recommendedActions: [
      "Require additional authentication for large transfers",
      "Send real-time notification to account owner",
      "Temporarily hold transaction for manual review",
      "Verify recipient account ownership",
    ],
  },
  {
    id: 3,
    mlKey: "impossible_travel_terminal_switch",
    name: "Location Mismatch",
    description:
      "Transaction originates from a geographic location inconsistent with the user's registered address or recent login history, especially across international borders.",
    category: "Location",
    riskLevel: "medium",
    status: "active",
    occurrences: 87,
    accuracy: 88.7,
    falsePositiveRate: 7.4,
    avgLossIDR: "12.8 Jt",
    trend: 5,
    lastUpdated: "13 Feb 2026",
    indicators: [
      "IP geolocation differs from registered city by >200 km",
      "VPN or proxy server detected",
      "Transaction from a high-risk country",
      "Login from multiple countries within 24 hours",
    ],
    recommendedActions: [
      "Verify location with user via SMS/email",
      "Block transactions from blacklisted regions",
      "Enable geo-fencing for high-risk users",
      "Log and flag all VPN-originated transactions",
    ],
  },
  {
    id: 4,
    mlKey: "rapid_retry_declined",
    name: "Rapid Successive Transactions",
    description:
      "Multiple transactions executed in quick succession within a very short time window, characteristic of automated fraud scripts or compromised account exploitation.",
    category: "Transaction",
    riskLevel: "medium",
    status: "active",
    occurrences: 65,
    accuracy: 86.3,
    falsePositiveRate: 8.1,
    avgLossIDR: "9.4 Jt",
    trend: -3,
    lastUpdated: "12 Feb 2026",
    indicators: [
      "More than 3 transactions within 5 minutes",
      "Identical or incrementally increasing amounts",
      "Transactions to multiple different recipients",
      "No user interaction between transactions",
    ],
    recommendedActions: [
      "Implement transaction rate limiting per account",
      "Require re-authentication after rapid transactions",
      "Alert user and request confirmation for burst activity",
      "Temporarily freeze account pending review",
    ],
  },
  {
    id: 5,
    mlKey: null,
    name: "New Device Detected",
    description:
      "Account accessed from a device fingerprint that has never been associated with the user, particularly concerning when combined with high-value transactions.",
    category: "Device",
    riskLevel: "low",
    status: "active",
    occurrences: 54,
    accuracy: 82.9,
    falsePositiveRate: 12.5,
    avgLossIDR: "5.2 Jt",
    trend: 2,
    lastUpdated: "11 Feb 2026",
    indicators: [
      "Device fingerprint not in user's device history",
      "New device OS or browser version",
      "No biometric/saved credential link to device",
      "First transaction within minutes of account login",
    ],
    recommendedActions: [
      "Send device registration OTP to user",
      "Limit transaction value on unverified devices",
      "Enable 30-day device trust period with monitoring",
      "Alert user about new device access",
    ],
  },
  {
    id: 6,
    mlKey: "midnight_unusual_amount",
    name: "Abnormal Transaction Time",
    description:
      "Transactions occurring at unusual hours inconsistent with the user's established behavioral patterns (e.g., 2–5 AM local time for dormant accounts).",
    category: "Behavioral",
    riskLevel: "low",
    status: "active",
    occurrences: 43,
    accuracy: 79.4,
    falsePositiveRate: 14.8,
    avgLossIDR: "4.1 Jt",
    trend: -1,
    lastUpdated: "10 Feb 2026",
    indicators: [
      "Transaction between 01:00–05:00 local time",
      "Account historically inactive during these hours",
      "High-value transaction at abnormal hour",
      "Combined with new device or location mismatch",
    ],
    recommendedActions: [
      "Apply enhanced scrutiny to late-night transactions",
      "Send push notification to user for confirmation",
      "Allow users to set custom transaction time restrictions",
      "Monitor accounts with persistent off-hours activity",
    ],
  },
  {
    id: 7,
    mlKey: null,
    name: "Blacklisted IP Address",
    description:
      "Transaction or login originating from an IP address that appears on known fraud databases, Tor exit nodes, or previously flagged sources.",
    category: "Network",
    riskLevel: "high",
    status: "active",
    occurrences: 72,
    accuracy: 97.1,
    falsePositiveRate: 1.8,
    avgLossIDR: "27.6 Jt",
    trend: 15,
    lastUpdated: "15 Feb 2026",
    indicators: [
      "IP found in threat intelligence blacklist",
      "Tor exit node or known VPN server IP",
      "IP associated with previous fraud cases",
      "IP from sanctioned country or region",
    ],
    recommendedActions: [
      "Automatically block transactions from blacklisted IPs",
      "Add IP to internal permanent blocklist",
      "Report IP to shared fraud intelligence network",
      "Conduct full account audit for any related transactions",
    ],
  },
  {
    id: 8,
    mlKey: "money_mule_destination",
    name: "Account Age Anomaly",
    description:
      "High-value transactions initiated by accounts less than 7 days old — a classic indicator of synthetic identity fraud or money mule accounts.",
    category: "Behavioral",
    riskLevel: "high",
    status: "review",
    occurrences: 38,
    accuracy: 89.6,
    falsePositiveRate: 6.7,
    avgLossIDR: "41.3 Jt",
    trend: 22,
    lastUpdated: "13 Feb 2026",
    indicators: [
      "Account less than 7 days old",
      "Transaction amount exceeds 10× average new-account transaction",
      "No prior transaction history to benchmark against",
      "KYC documents not fully verified",
    ],
    recommendedActions: [
      "Enforce 7-day cooling period for new high-value transfers",
      "Require enhanced KYC for new accounts over threshold",
      "Manual review mandatory for all flagged new-account transactions",
      "Limit daily transaction value for unverified accounts",
    ],
  },
  {
    id: 9,
    mlKey: "refund_abuse_pattern",
    name: "Suspicious Recipient Pattern",
    description:
      "Funds being transferred to accounts with characteristics matching money mule profiles: newly created, infrequently used, or linked to previous fraud reports.",
    category: "Transaction",
    riskLevel: "medium",
    status: "active",
    occurrences: 29,
    accuracy: 84.2,
    falsePositiveRate: 9.3,
    avgLossIDR: "22.7 Jt",
    trend: 7,
    lastUpdated: "11 Feb 2026",
    indicators: [
      "Recipient account has no prior inbound transactions",
      "Recipient account created within last 30 days",
      "Same recipient across multiple flagged transactions",
      "Recipient account shows immediate withdrawal after receipt",
    ],
    recommendedActions: [
      "Screen recipient accounts against fraud database",
      "Add suspicious recipients to watch list",
      "Require confirmation for first-time high-value recipients",
      "Collaborate with recipient's bank for account verification",
    ],
  },
  {
    id: 10,
    name: "Session Hijacking Indicators",
    description:
      "Behavioral signals suggesting the session token or credentials have been stolen and are being used by a different party than the legitimate account owner.",
    category: "Credential",
    riskLevel: "high",
    status: "inactive",
    occurrences: 21,
    accuracy: 92.8,
    falsePositiveRate: 4.5,
    avgLossIDR: "35.0 Jt",
    trend: -5,
    lastUpdated: "8 Feb 2026",
    indicators: [
      "Session token reused from a different IP",
      "Sudden change in user-agent mid-session",
      "Geographic impossibility between login and transaction",
      "Transaction pattern differs from all historical behavior",
    ],
    recommendedActions: [
      "Invalidate and rotate session tokens immediately",
      "Force re-login with MFA for all active sessions",
      "Alert user and lock account pending confirmation",
      "Preserve full session logs for forensic investigation",
    ],
  },
];

const FraudPatterns = () => {
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState(ALL_PATTERNS); // ← real data dari ML
  const [apiError, setApiError] = useState(false);
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("occurrences_desc");
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'chart'

  /* ── Fetch pattern stats dari ML backend ── */
  useEffect(() => {
    const fetchPatternStats = async () => {
      try {
        setLoading(true);
        const BASE_URL =
          process.env.REACT_APP_ML_API_URL || "http://localhost:8000";
        const res = await fetch(`${BASE_URL}/patterns/stats`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Merge occurrences real dari ML ke metadata ALL_PATTERNS
        const merged = ALL_PATTERNS.map((p) => {
          const mlPattern = data.patterns.find((mp) => mp.key === p.mlKey);
          if (!mlPattern) return p;
          return {
            ...p,
            occurrences: mlPattern.occurrences,
            avgLossIDR: mlPattern.avg_loss_idr,
            lastUpdated: mlPattern.last_updated,
          };
        });

        // Pattern ML yang belum ada di ALL_PATTERNS (pattern baru dari model)
        const extraPatterns = data.patterns
          .filter((mp) => !ALL_PATTERNS.some((p) => p.mlKey === mp.key))
          .map((mp, i) => ({
            id: 100 + i,
            mlKey: mp.key,
            name: mp.name,
            description: mp.description,
            category: mp.category,
            riskLevel: mp.riskLevel,
            status: "active",
            occurrences: mp.occurrences,
            accuracy: mp.accuracy,
            falsePositiveRate: mp.falsePositiveRate,
            avgLossIDR: mp.avg_loss_idr,
            trend: mp.trend,
            lastUpdated: mp.last_updated,
            indicators: mp.indicators || [],
            recommendedActions: mp.recommendedActions || [],
          }));

        setPatterns([...merged, ...extraPatterns]);
        setApiError(false);
      } catch (err) {
        console.warn("Pattern stats API offline, pakai data statis:", err.message);
        setApiError(true);
        setPatterns(ALL_PATTERNS);
      } finally {
        setLoading(false);
      }
    };

    fetchPatternStats();
  }, []);

  const filtered = useMemo(() => {
    let result = patterns.filter((p) => {
      if (riskFilter !== "all" && p.riskLevel !== riskFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      const q = searchTerm.toLowerCase();
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q)
      )
        return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "occurrences_asc":
          return a.occurrences - b.occurrences;
        case "occurrences_desc":
          return b.occurrences - a.occurrences;
        case "accuracy_desc":
          return b.accuracy - a.accuracy;
        case "name_asc":
          return a.name.localeCompare(b.name);
        default:
          return b.occurrences - a.occurrences;
      }
    });

    return result;
  }, [riskFilter, statusFilter, searchTerm, sortBy, patterns]);

  if (loading) return <PageLoader message="Memuat Fraud Patterns..." />;

  return (
    <div className="fraud-patterns-page">
      {/* Page header */}
      <div className="fp-page-header">
        <div className="fp-header-left">
          <div className="fp-header-icon">
            <i className="bi bi-bug-fill"></i>
          </div>
          <div>
            <h1>Fraud Patterns</h1>
            <p className="fp-subtitle">
              Detection rules, pattern analysis, and threat intelligence
            </p>
          </div>
        </div>
        <div className="fp-header-actions">
          {/* View mode toggle */}
          <div className="fp-view-toggle">
            <button
              className={`fp-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Card View"
            >
              <i className="bi bi-grid-3x3-gap"></i>
            </button>
            <button
              className={`fp-view-btn ${viewMode === "chart" ? "active" : ""}`}
              onClick={() => setViewMode("chart")}
              title="Chart View"
            >
              <i className="bi bi-bar-chart-line"></i>
            </button>
          </div>
          <button className="fp-export-btn">
            <i className="bi bi-download"></i>
            Export Report
          </button>
        </div>
      </div>

      {/* API offline banner */}
      {apiError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".5rem",
            padding: ".5rem 1rem",
            marginBottom: "1rem",
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            fontSize: ".8rem",
            color: "#92400e",
            fontWeight: 600,
          }}
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          ML API offline — menampilkan data statis
        </div>
      )}

      {/* Stats */}
      <PatternStats patterns={patterns} />

      {/* Filter */}
      <PatternFilter
        riskFilter={riskFilter}
        setRiskFilter={setRiskFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        totalResults={filtered.length}
      />

      {/* Content */}
      {viewMode === "chart" ? (
        <PatternTrendChart
          patterns={filtered.length > 0 ? filtered : patterns}
        />
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="fp-empty-state">
              <i className="bi bi-inbox"></i>
              <p>No patterns match the current filters</p>
              <span>Try adjusting the risk level, status, or search term</span>
            </div>
          ) : (
            <div className="fp-cards-grid">
              {filtered.map((pattern) => (
                <PatternCard
                  key={pattern.id}
                  pattern={pattern}
                  onViewDetail={setSelectedPattern}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selectedPattern && (
        <PatternDetailModal
          pattern={selectedPattern}
          onClose={() => setSelectedPattern(null)}
        />
      )}
    </div>
  );
};

export default FraudPatterns;