import React from "react";

const StatsOverview = ({ domainStats, modelAccuracy }) => {
  const ag = domainStats?.agenusa || {};
  const nu = domainStats?.nusabill || {};

  const agTotal = ag.transactions || 0;
  const agFraud = ag.fraud || 0;
  const agLegit = ag.legit || 0;
  const agFraudRate =
    agTotal > 0 ? ((agFraud / agTotal) * 100).toFixed(2) : "0.00";
  const agLegitTotal = agLegit;

  const nuTotal = nu.transactions || 0;
  const nuFraud = nu.fraud || 0;
  const nuLegit = nu.legit || 0;
  const nuFraudRate =
    nuTotal > 0 ? ((nuFraud / nuTotal) * 100).toFixed(2) : "0.00";
  const nuLegitTotal = nuLegit;

  const cards = [
    {
      label: "Total Agenusa",
      value: agTotal.toLocaleString(),
      icon: "bi-bank",
      iconBg: "#3b82f6",
      sub: `${agFraudRate}% fraud rate`,
      subColor: "#8a8a8a",
    },
    {
      label: "Total Nusabill",
      value: nuTotal.toLocaleString(),
      icon: "bi-receipt",
      iconBg: "#8b5cf6",
      sub: `${nuFraudRate}% fraud rate`,
      subColor: "#8a8a8a",
    },

    {
      label: "Agenusa Fraud",
      value: agFraud.toLocaleString(),
      icon: "bi-exclamation-triangle",
      iconBg: "#ef4444",
      sub: `${agFraudRate}% dari total`,
      subColor: "#ef4444",
    },
    {
      label: "Nusabill Fraud",
      value: nuFraud.toLocaleString(),
      icon: "bi-exclamation-triangle",
      iconBg: "#f97316",
      sub: `${nuFraudRate}% dari total`,
      subColor: "#f97316",
    },

    {
      label: "Agenusa Legit",
      value: agLegit.toLocaleString(),
      icon: "bi-check-circle",
      iconBg: "#10b981",
      sub: `${(100 - parseFloat(agFraudRate)).toFixed(2)}% success`,
      subColor: "#10b981",
    },
    {
      label: "Nusabill Legit",
      value: nuLegit.toLocaleString(),
      icon: "bi-check-circle",
      iconBg: "#059669",
      sub: `${(100 - parseFloat(nuFraudRate)).toFixed(2)}% success`,
      subColor: "#059669",
    },

    {
      label: "Agenusa Fraud Rate",
      value: `${agFraudRate}%`,
      icon: "bi-percent",
      iconBg: "#dc2626",
      sub: `${agFraud} transaksi fraud`,
      subColor: "#dc2626",
    },
    {
      label: "Nusabill Fraud Rate",
      value: `${nuFraudRate}%`,
      icon: "bi-percent",
      iconBg: "#b45309",
      sub: `${nuFraud} transaksi fraud`,
      subColor: "#b45309",
    },

    {
      label: "Total Agenusa Legit",
      value: agLegitTotal.toLocaleString(),
      icon: "bi-shield-check",
      iconBg: "#06b6d4",
      sub: "transaksi normal",
      subColor: "#8a8a8a",
    },
    {
      label: "Total Nusabill Legit",
      value: nuLegitTotal.toLocaleString(),
      icon: "bi-shield-check",
      iconBg: "#0891b2",
      sub: "transaksi normal",
      subColor: "#8a8a8a",
    },

    {
      label: "ML Model Accuracy",
      value: modelAccuracy ? `${modelAccuracy}%` : "—",
      icon: "bi-cpu",
      iconBg: "#7c3aed",
      sub: "Isolation Forest avg",
      subColor: "#7c3aed",
      wide: true,
    },
  ];

  const Card = ({ card }) => (
    <div
      style={{
        background: "white",
        borderRadius: 10,
        padding: "0.75rem 0.875rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        border: "1px solid #f0f0f0",
        height: "100%",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: card.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <i
          className={`bi ${card.icon}`}
          style={{ color: "white", fontSize: "0.9rem" }}
        ></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.7rem",
            color: "#9a9a9a",
            fontWeight: 500,
            marginBottom: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.label}
        </div>
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#1a1a1a",
            lineHeight: 1.2,
            marginBottom: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.value}
        </div>
        <div
          style={{ fontSize: "0.68rem", color: card.subColor, fontWeight: 500 }}
        >
          {card.sub}
        </div>
      </div>
    </div>
  );

  return (
    <div className="stats-overview mb-4">
      <div className="row g-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className={
              card.wide ? "col-12 col-md-6 col-xl-4" : "col-6 col-md-3 col-xl-2"
            }
            style={{ marginBottom: "0.5rem" }}
          >
            <Card card={card} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsOverview;
