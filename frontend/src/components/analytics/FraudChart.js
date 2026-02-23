import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const FraudChart = ({ data }) => {
  const total = data.fraud + data.legit;
  const fraudPercentage = ((data.fraud / total) * 100).toFixed(1);
  const legitPercentage = ((data.legit / total) * 100).toFixed(1);

  const chartData = {
    labels: ['Fraud', 'Legit'],
    datasets: [
      {
        data: [data.fraud, data.legit],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(16, 185, 129, 0.8)'
        ],
        borderColor: [
          '#ef4444',
          '#10b981'
        ],
        borderWidth: 2,
        hoverOffset: 8
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 13,
            weight: '500'
          },
          generateLabels: function(chart) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label}: ${value.toLocaleString()} (${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor[i],
                  lineWidth: 2,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: '600'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toLocaleString()} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="fraud-chart-wrapper">
      <div style={{ height: '250px', position: 'relative' }}>
        <Doughnut data={chartData} options={options} />
        <div className="chart-center-text">
          <div className="center-value">{total.toLocaleString()}</div>
          <div className="center-label">Total</div>
        </div>
      </div>
      <div className="fraud-stats mt-3">
        <div className="row text-center">
          <div className="col-6">
            <div className="fraud-stat-item fraud">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div className="stat-number">{fraudPercentage}%</div>
              <div className="stat-text">Fraud Rate</div>
            </div>
          </div>
          <div className="col-6">
            <div className="fraud-stat-item legit">
              <i className="bi bi-check-circle-fill"></i>
              <div className="stat-number">{legitPercentage}%</div>
              <div className="stat-text">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FraudChart;