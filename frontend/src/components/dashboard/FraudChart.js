import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './ChartCard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const FraudChart = ({ total = 1290, fraudCount = 56 }) => {
  const legitimateCount  = total - fraudCount;
  const fraudPercentage  = total > 0 ? ((fraudCount / total) * 100).toFixed(1) : "0.0";

  const data = {
    labels: ['Legitimate', 'Fraudulent'],
    datasets: [
      {
        data: [legitimateCount, fraudCount],
        backgroundColor: ['#262626', '#dc2626'],
        borderColor: ['#ffffff', '#ffffff'],
        borderWidth: 3,
        hoverOffset: 8,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          font: { size: 13, weight: '600' },
          color: '#525252',
          usePointStyle: true,
          pointStyle: 'circle',
        }
      },
      tooltip: {
        backgroundColor: '#262626',
        padding: 12,
        titleFont: { size: 13, weight: '600' },
        bodyFont:  { size: 14, weight: '700' },
        displayColors: true,
        cornerRadius: 6,
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed || 0;
            const pct = ((val / total) * 100).toFixed(1);
            return `${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
          }
        }
      }
    },
    cutout: '65%',
  };

  return (
    <div className="chart-card-simple">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Fraud vs Non-Fraud</h3>
          <p className="chart-subtitle">Distribution overview</p>
        </div>
        <div className="fraud-rate-badge">
          {fraudPercentage}% Fraud Rate
        </div>
      </div>
      <div className="chart-container doughnut-chart">
        <div className="doughnut-center-text">
          <div className="center-value">{total.toLocaleString()}</div>
          <div className="center-label">Total</div>
        </div>
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

export default FraudChart;