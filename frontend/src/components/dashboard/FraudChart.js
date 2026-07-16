import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "./ChartCard.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const FraudChart = ({ total = 0, fraudCount = 0 }) => {
  const { computedTotal, computedFraud } = useMemo(() => {
    return { computedTotal: total, computedFraud: fraudCount };
  }, [total, fraudCount]);

  const legitimateCount = Math.max(0, computedTotal - computedFraud);
  const fraudPercentage =
    computedTotal > 0
      ? ((computedFraud / computedTotal) * 100).toFixed(1)
      : "0.0";

  const data = {
    labels: ["Legitimate", "Fraudulent"],
    datasets: [
      {
        data: [legitimateCount, computedFraud],
        backgroundColor: ["#262626", "#dc2626"],
        borderColor: ["#ffffff", "#ffffff"],
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 12,
          font: { size: 11, weight: "600" },
          color: "#525252",
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: "#262626",
        padding: 10,
        titleFont: { size: 12, weight: "600" },
        bodyFont: { size: 13, weight: "700" },
        displayColors: true,
        cornerRadius: 6,
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed || 0;
            const pct =
              computedTotal > 0 ? ((val / computedTotal) * 100).toFixed(1) : "0.0";
            return `${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
    cutout: "68%",
  };

  return (
    <div className="chart-card-simple">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Fraud vs Non-Fraud</h3>
          <p className="chart-subtitle">Distribution overview</p>
        </div>
        <div className="fraud-rate-badge">{fraudPercentage}% Fraud Rate</div>
      </div>
      <div className="chart-container doughnut-chart">
        <div className="doughnut-center-text">
          <div className="center-value">{computedTotal.toLocaleString()}</div>
          <div className="center-label">Total</div>
        </div>
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

export default FraudChart;
