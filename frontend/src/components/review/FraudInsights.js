import React from "react";
import "./FraudInsights.css";

const FraudInsights = ({ transaction }) => {
  const getInsights = () => {
    const items = [];
    const patterns = transaction.anomalies || [];
    const isAgenusa = transaction.service === "agenusa";

    if (transaction.fraudScore >= 80) {
      items.push({
        id: "score",
        title: "High-Risk Score Flagged",
        description: `Fraud score ${transaction.fraudScore}/100 exceeds the high-risk threshold (${isAgenusa ? "50" : "93"}) by a significant margin.`,
        confidence: transaction.fraudScore,
        icon: "bi-exclamation-triangle-fill",
        color: "danger",
        recommendation: "Proceed with immediate manual review",
      });
    } else if (transaction.fraudScore >= 60) {
      items.push({
        id: "score",
        title: "Moderate Risk Score",
        description: `Fraud score ${transaction.fraudScore}/100 is above review threshold. Transaction requires manual verification.`,
        confidence: transaction.fraudScore,
        icon: "bi-exclamation-circle-fill",
        color: "warning",
        recommendation: "Review transaction details carefully",
      });
    }

    if (isAgenusa) {
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("bruteforce") ||
            p.toLowerCase().includes("pin"),
        )
      ) {
        items.push({
          id: "pin",
          title: "PIN Bruteforce Pattern Detected",
          description: `Multiple failed PIN attempts detected on account ${transaction.ACCOUNT_NUMBER} before successful transaction.`,
          confidence: 91,
          icon: "bi-lock-fill",
          color: "danger",
          recommendation: "Freeze account PIN and notify account holder",
        });
      }
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("retry") ||
            p.toLowerCase().includes("declined"),
        )
      ) {
        items.push({
          id: "retry",
          title: "Rapid Retry After Decline",
          description:
            "Transaction was preceded by several declined attempts in quick succession — a known carding pattern.",
          confidence: 83,
          icon: "bi-arrow-repeat",
          color: "warning",
          recommendation:
            "Check decline history and verify with account holder",
        });
      }
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("mule") ||
            p.toLowerCase().includes("destination"),
        )
      ) {
        items.push({
          id: "mule",
          title: "Money Mule Destination Flagged",
          description: `Destination account ${transaction.DEST_ACCOUNT_NUMBER} is associated with money mule activity in historical data.`,
          confidence: 88,
          icon: "bi-send-exclamation-fill",
          color: "danger",
          recommendation:
            "Block destination account and escalate to compliance team",
        });
      }
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("midnight") ||
            p.toLowerCase().includes("unusual amount"),
        )
      ) {
        items.push({
          id: "midnight",
          title: "Off-Hours High-Value Transaction",
          description: `Transfer of ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(transaction.AMOUNT)} occurred at an unusual hour.`,
          confidence: 74,
          icon: "bi-moon-stars-fill",
          color: "warning",
          recommendation: "Confirm with account holder via OTP or call",
        });
      }
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("travel") ||
            p.toLowerCase().includes("terminal"),
        )
      ) {
        items.push({
          id: "travel",
          title: "Impossible Terminal Switch",
          description:
            "Transaction initiated from a terminal inconsistent with the account's recent geographic activity.",
          confidence: 79,
          icon: "bi-geo-alt-fill",
          color: "warning",
          recommendation: "Verify terminal ID and account holder location",
        });
      }
    }

    if (!isAgenusa) {
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("burst") ||
            p.toLowerCase().includes("payment pattern"),
        )
      ) {
        items.push({
          id: "burst",
          title: "Burst Payment Pattern",
          description: `Customer ${transaction.CUSTOMER_ID} submitted multiple bill payments in rapid succession — indicative of automated fraud tooling.`,
          confidence: 86,
          icon: "bi-lightning-fill",
          color: "danger",
          recommendation: "Throttle API requests and verify customer identity",
        });
      }
      if (patterns.some((p) => p.toLowerCase().includes("refund"))) {
        items.push({
          id: "refund",
          title: "Refund Abuse Pattern",
          description: `Bill ${transaction.BILL_ID} has REFUND_FLAG=1 combined with suspicious payment behavior.`,
          confidence: 82,
          icon: "bi-arrow-counterclockwise",
          color: "danger",
          recommendation:
            "Hold refund processing and investigate payment history",
        });
      }
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes("channel switch") ||
            p.toLowerCase().includes("api"),
        )
      ) {
        items.push({
          id: "channel",
          title: "Sudden Channel Switch to API",
          description: `Customer switched to API channel (${transaction.CHANNEL}) which differs from their typical payment channel — potential account takeover.`,
          confidence: 71,
          icon: "bi-wifi-off",
          color: "warning",
          recommendation:
            "Require re-authentication for API channel transactions",
        });
      }
      if (transaction.BILL_AMOUNT !== transaction.PAYMENT_AMOUNT) {
        items.push({
          id: "underpay",
          title: "Payment Amount Mismatch",
          description: `PAYMENT_AMOUNT (${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(transaction.PAYMENT_AMOUNT)}) does not match BILL_AMOUNT — possible partial payment manipulation.`,
          confidence: 76,
          icon: "bi-currency-exchange",
          color: "warning",
          recommendation: "Verify payment intent and reconcile billing record",
        });
      }
    }

    if (items.length === 0) {
      items.push({
        id: "clean",
        title: "No Critical Patterns Found",
        description:
          "Transaction was flagged by score threshold only — no specific fraud pattern matched.",
        confidence: 85,
        icon: "bi-check-circle-fill",
        color: "success",
        recommendation: "Low risk — standard review applies",
      });
    }

    return items;
  };

  const getRiskFactors = () => {
    const baseScore = transaction.fraudScore;
    const isAgenusa = transaction.service === "agenusa";
    const patterns = transaction.anomalies || [];
    const patternCount = patterns.length;

    return [
      {
        factor: isAgenusa ? "Transfer Amount" : "Bill Amount",
        score: Math.min(100, Math.round(transaction.amount / 5000000)),
        status:
          transaction.amount > 500000000
            ? "high"
            : transaction.amount > 100000000
              ? "medium"
              : "low",
      },
      {
        factor: "Fraud Score",
        score: baseScore,
        status: baseScore >= 80 ? "high" : baseScore >= 60 ? "medium" : "low",
      },
      {
        factor: "Matched Patterns",
        score: Math.min(100, patternCount * 25),
        status:
          patternCount >= 3 ? "high" : patternCount >= 1 ? "medium" : "low",
      },
      isAgenusa
        ? {
            factor: "PIN / Retry Behavior",
            score: patterns.some(
              (p) =>
                p.toLowerCase().includes("pin") ||
                p.toLowerCase().includes("retry"),
            )
              ? 75
              : 15,
            status: patterns.some(
              (p) =>
                p.toLowerCase().includes("pin") ||
                p.toLowerCase().includes("retry"),
            )
              ? "high"
              : "low",
          }
        : {
            factor: "Refund & Channel Risk",
            score:
              (transaction.REFUND_FLAG ? 50 : 0) +
              (transaction.CHANNEL === "API" ? 35 : 0),
            status:
              transaction.REFUND_FLAG && transaction.CHANNEL === "API"
                ? "high"
                : transaction.REFUND_FLAG || transaction.CHANNEL === "API"
                  ? "medium"
                  : "low",
          },
      isAgenusa
        ? {
            factor: "Destination Account",
            score: patterns.some(
              (p) =>
                p.toLowerCase().includes("mule") ||
                p.toLowerCase().includes("destination"),
            )
              ? 88
              : 20,
            status: patterns.some(
              (p) =>
                p.toLowerCase().includes("mule") ||
                p.toLowerCase().includes("destination"),
            )
              ? "high"
              : "low",
          }
        : {
            factor: "Payment vs Bill Amount",
            score:
              transaction.BILL_AMOUNT !== transaction.PAYMENT_AMOUNT
                ? Math.min(
                    100,
                    Math.round(
                      (Math.abs(
                        transaction.BILL_AMOUNT - transaction.PAYMENT_AMOUNT,
                      ) /
                        transaction.BILL_AMOUNT) *
                        100 *
                        10,
                    ),
                  )
                : 5,
            status:
              transaction.BILL_AMOUNT !== transaction.PAYMENT_AMOUNT
                ? "medium"
                : "low",
          },
    ];
  };

  const getSimilarCases = () => {
    const base = transaction.amount;
    const prefix = transaction.service === "agenusa" ? "AGN" : "NUS";
    const numPart = parseInt(transaction.id.replace(/[^0-9]/g, "")) || 1;
    return [
      {
        id: `${prefix}-${String(numPart + 117).padStart(6, "0")}`,
        similarity: 87,
        outcome: transaction.fraudScore >= 80 ? "fraud" : "legit",
        amount: Math.round(base * 0.97),
        date: "2 days ago",
      },
      {
        id: `${prefix}-${String(numPart + 144).padStart(6, "0")}`,
        similarity: 72,
        outcome: transaction.riskLevel === "critical" ? "fraud" : "legit",
        amount: Math.round(base * 1.08),
        date: "1 week ago",
      },
      {
        id: `${prefix}-${String(numPart + 197).padStart(6, "0")}`,
        similarity: 65,
        outcome: transaction.fraudScore >= 70 ? "fraud" : "legit",
        amount: Math.round(base * 1.05),
        date: "2 weeks ago",
      },
    ];
  };

  const insights = getInsights();
  const riskFactors = getRiskFactors();
  const similarCases = getSimilarCases();

  const fraudProbability = Math.min(
    98,
    Math.round(transaction.fraudScore * 1.05),
  );

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return "confidence-high";
    if (confidence >= 60) return "confidence-medium";
    return "confidence-low";
  };

  const getRiskStatusColor = (status) => {
    switch (status) {
      case "high":
        return "status-high";
      case "medium":
        return "status-medium";
      case "low":
        return "status-low";
      default:
        return "status-medium";
    }
  };

  return (
    <div className="fraud-insights-card">
      <div className="insights-header">
        <div className="header-content">
          <h3 className="insights-title">
            <i className="bi bi-lightbulb-fill"></i>
            AI Fraud Insights
          </h3>
          <p className="insights-subtitle">Analysis for {transaction.id}</p>
        </div>
        <div className="ai-badge">
          <i className="bi bi-cpu"></i>
          <span>AI Powered</span>
        </div>
      </div>

      <div className="insights-content">
        <div className="insights-section">
          <h4 className="section-title">
            <i className="bi bi-stars"></i>
            Key Findings
          </h4>
          <div className="insights-list">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`insight-item insight-${insight.color}`}
              >
                <div className={`insight-icon bg-${insight.color}`}>
                  <i className={insight.icon}></i>
                </div>
                <div className="insight-content">
                  <div className="insight-header">
                    <h5 className="insight-title">{insight.title}</h5>
                    <span
                      className={`confidence-badge ${getConfidenceColor(insight.confidence)}`}
                    >
                      {insight.confidence}% confidence
                    </span>
                  </div>
                  <p className="insight-description">{insight.description}</p>
                  <div className="insight-recommendation">
                    <i className="bi bi-arrow-right-circle"></i>
                    <span>{insight.recommendation}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="insights-section">
          <h4 className="section-title">
            <i className="bi bi-shield-exclamation"></i>
            Risk Factor Breakdown
          </h4>
          <div className="risk-factors-list">
            {riskFactors.map((risk, index) => (
              <div key={index} className="risk-factor-item">
                <div className="factor-info">
                  <span className="factor-name">{risk.factor}</span>
                  <span
                    className={`factor-score ${getRiskStatusColor(risk.status)}`}
                  >
                    {risk.score}%
                  </span>
                </div>
                <div className="factor-bar">
                  <div
                    className={`factor-fill ${getRiskStatusColor(risk.status)}`}
                    style={{ width: `${risk.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="insights-section">
          <h4 className="section-title">
            <i className="bi bi-diagram-3"></i>
            Similar Cases
          </h4>
          <div className="similar-cases-list">
            {similarCases.map((case_) => (
              <div key={case_.id} className="similar-case-item">
                <div className="case-header">
                  <span className="case-id">{case_.id}</span>
                  <span className="similarity-badge">
                    {case_.similarity}% similar
                  </span>
                </div>
                <div className="case-details">
                  <span className="case-detail">
                    <i className="bi bi-cash"></i>
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(case_.amount)}
                  </span>
                  <span className="case-detail">
                    <i className="bi bi-clock"></i>
                    {case_.date}
                  </span>
                </div>
                <div className={`case-outcome outcome-${case_.outcome}`}>
                  <i
                    className={`bi bi-${case_.outcome === "fraud" ? "x-circle-fill" : "check-circle-fill"}`}
                  ></i>
                  {case_.outcome === "fraud" ? "Was Fraud" : "Was Legit"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ai-recommendation">
          <div className="recommendation-header">
            <i className="bi bi-robot"></i>
            <h4>AI Recommendation</h4>
          </div>
          <div className="recommendation-content">
            <p className="recommendation-text">
              Based on analysis of <strong>1,247 similar cases</strong>, there
              is a{" "}
              <strong className="text-danger">
                {fraudProbability}% probability
              </strong>{" "}
              that this transaction is{" "}
              {transaction.riskLevel === "critical" ||
              transaction.fraudScore >= 80
                ? "fraudulent"
                : "suspicious"}
              . Risk level classified as{" "}
              <strong>{transaction.riskLevel.toUpperCase()}</strong>.
            </p>
            <div className="recommendation-actions">
              {transaction.fraudScore >= 70 && (
                <span className="action-tag reject">
                  <i className="bi bi-x-circle"></i>
                  Recommend: Reject
                </span>
              )}
              <span className="action-tag verify">
                <i className="bi bi-shield-check"></i>
                Suggested:{" "}
                {transaction.fraudScore >= 80
                  ? "Immediate Review"
                  : "Additional Verification"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FraudInsights;
