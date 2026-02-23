import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TrendAnalysis = ({ data }) => {
  // Calculate average fraud rate
  const avgFraudRate = (data.reduce((sum, item) => sum + parseFloat(item.fraudRate), 0) / data.length).toFixed(2);
  
  // Determine trend direction
  const firstWeek = data.slice(0, 7).reduce((sum, item) => sum + parseFloat(item.fraudRate), 0) / 7;
  const lastWeek = data.slice(-7).reduce((sum, item) => sum + parseFloat(item.fraudRate), 0) / 7;
  const trendDirection = lastWeek > firstWeek ? 'increasing' : 'decreasing';
  const trendPercentage = Math.abs(((lastWeek - firstWeek) / firstWeek) * 100).toFixed(1);

  const chartData = {
    labels: data.map(item => `Day ${item.day}`),
    datasets: [
      {
        label: 'Fraud Rate (%)',
        data: data.map(item => parseFloat(item.fraudRate)),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10,
        titleFont: {
          size: 13,
          weight: '600'
        },
        bodyFont: {
          size: 12
        },
        callbacks: {
          label: function(context) {
            return `Fraud Rate: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      x: {
        display: false,
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#f5f5f5',
          drawBorder: false
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value) {
            return value + '%';
          }
        }
      }
    }
  };

  return (
    <div className="trend-analysis-wrapper">
      <div style={{ height: '180px', marginBottom: '20px' }}>
        <Line data={chartData} options={options} />
      </div>
      
      <div className="trend-summary">
        <div className="trend-item">
          <div className="trend-label">Rata-rata Fraud Rate</div>
          <div className="trend-value">{avgFraudRate}%</div>
        </div>
        <div className="trend-item">
          <div className="trend-label">Trend</div>
          <div className={`trend-value ${trendDirection}`}>
            <i className={`bi bi-arrow-${trendDirection === 'increasing' ? 'up' : 'down'}`}></i>
            {trendPercentage}%
          </div>
        </div>
      </div>

      <div className="trend-indicator mt-3">
        <div className={`alert alert-${trendDirection === 'increasing' ? 'danger' : 'success'} mb-0`}>
          <i className={`bi bi-${trendDirection === 'increasing' ? 'exclamation-triangle' : 'check-circle'} me-2`}></i>
          {trendDirection === 'increasing' ? (
            <span>Fraud rate meningkat {trendPercentage}% dalam 7 hari terakhir. Perlu perhatian khusus!</span>
          ) : (
            <span>Fraud rate menurun {trendPercentage}% dalam 7 hari terakhir. Sistem bekerja dengan baik!</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrendAnalysis;