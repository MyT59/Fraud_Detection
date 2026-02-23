import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import './ChartCard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const FraudChart = () => {
  const total = 1290;
  const fraudCount = 56;
  const legitimateCount = total - fraudCount;
  const fraudPercentage = ((fraudCount / total) * 100).toFixed(1);

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
          font: {
            size: 13,
            weight: '600'
          },
          color: '#525252',
          usePointStyle: true,
          pointStyle: 'circle',
        }
      },
      tooltip: {
        backgroundColor: '#262626',
        padding: 12,
        titleFont: {
          size: 13,
          weight: '600'
        },
        bodyFont: {
          size: 14,
          weight: '700'
        },
        displayColors: true,
        cornerRadius: 6,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
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
          <div className="center-value">{total}</div>
          <div className="center-label">Total</div>
        </div>
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

export default FraudChart;