import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import './ComparisonChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ComparisonChart = ({ currentPeriodData, previousPeriodData }) => {
  const [comparisonType, setComparisonType] = useState('transactions'); // transactions, fraud, fraudRate

  const getChartData = () => {
    const labels = currentPeriodData.map(item => item.month || item.label);
    
    let currentData, previousData, label;
    
    switch (comparisonType) {
      case 'fraud':
        currentData = currentPeriodData.map(item => item.fraud);
        previousData = previousPeriodData.map(item => item.fraud);
        label = 'Fraud Transactions';
        break;
      case 'fraudRate':
        currentData = currentPeriodData.map(item => 
          ((item.fraud / item.transactions) * 100).toFixed(2)
        );
        previousData = previousPeriodData.map(item => 
          ((item.fraud / item.transactions) * 100).toFixed(2)
        );
        label = 'Fraud Rate (%)';
        break;
      default: // transactions
        currentData = currentPeriodData.map(item => item.transactions);
        previousData = previousPeriodData.map(item => item.transactions);
        label = 'Total Transactions';
    }

    return {
      labels,
      datasets: [
        {
          label: 'Current Period',
          data: currentData,
          backgroundColor: 'rgba(220, 38, 38, 0.8)',
          borderColor: '#dc2626',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Previous Period',
          data: previousData,
          backgroundColor: 'rgba(161, 161, 170, 0.6)',
          borderColor: '#a1a1aa',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: '500'
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
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += comparisonType === 'fraudRate' 
              ? context.parsed.y + '%' 
              : context.parsed.y.toLocaleString();
            return label;
          },
          afterBody: function(context) {
            if (context.length === 2) {
              const current = parseFloat(context[0].parsed.y);
              const previous = parseFloat(context[1].parsed.y);
              const diff = current - previous;
              const percentChange = ((diff / previous) * 100).toFixed(1);
              
              return `\nChange: ${diff > 0 ? '+' : ''}${diff.toLocaleString()} (${percentChange}%)`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
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
            size: 12
          },
          callback: function(value) {
            return comparisonType === 'fraudRate' 
              ? value + '%' 
              : value.toLocaleString();
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Calculate summary statistics
  const calculateChange = () => {
    const currentTotal = currentPeriodData.reduce((sum, item) => {
      switch (comparisonType) {
        case 'fraud':
          return sum + item.fraud;
        case 'fraudRate':
          return sum + ((item.fraud / item.transactions) * 100);
        default:
          return sum + item.transactions;
      }
    }, 0);

    const previousTotal = previousPeriodData.reduce((sum, item) => {
      switch (comparisonType) {
        case 'fraud':
          return sum + item.fraud;
        case 'fraudRate':
          return sum + ((item.fraud / item.transactions) * 100);
        default:
          return sum + item.transactions;
      }
    }, 0);

    const diff = currentTotal - previousTotal;
    const percentChange = ((diff / previousTotal) * 100).toFixed(1);

    return {
      current: currentTotal,
      previous: previousTotal,
      diff: diff,
      percentChange: percentChange,
      isIncrease: diff > 0
    };
  };

  const stats = calculateChange();

  return (
    <div className="comparison-chart-wrapper">
      {/* Comparison Type Selector */}
      <div className="comparison-selector mb-3">
        <div className="btn-group w-100" role="group">
          <button
            type="button"
            className={`btn btn-sm ${comparisonType === 'transactions' ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => setComparisonType('transactions')}
          >
            <i className="bi bi-graph-up me-1"></i>
            Transactions
          </button>
          <button
            type="button"
            className={`btn btn-sm ${comparisonType === 'fraud' ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => setComparisonType('fraud')}
          >
            <i className="bi bi-exclamation-triangle me-1"></i>
            Fraud
          </button>
          <button
            type="button"
            className={`btn btn-sm ${comparisonType === 'fraudRate' ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => setComparisonType('fraudRate')}
          >
            <i className="bi bi-percent me-1"></i>
            Fraud Rate
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="comparison-summary mb-3">
        <div className="row">
          <div className="col-6">
            <div className="summary-card current">
              <div className="summary-label">Current Period</div>
              <div className="summary-value">
                {comparisonType === 'fraudRate' 
                  ? (stats.current / currentPeriodData.length).toFixed(2) + '%'
                  : stats.current.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="summary-card previous">
              <div className="summary-label">Previous Period</div>
              <div className="summary-value">
                {comparisonType === 'fraudRate' 
                  ? (stats.previous / previousPeriodData.length).toFixed(2) + '%'
                  : stats.previous.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        
        <div className="change-indicator mt-2">
          <div className={`change-badge ${stats.isIncrease ? 'increase' : 'decrease'}`}>
            <i className={`bi bi-arrow-${stats.isIncrease ? 'up' : 'down'} me-1`}></i>
            {Math.abs(parseFloat(stats.percentChange))}% 
            {stats.isIncrease ? ' increase' : ' decrease'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: '300px' }}>
        <Bar data={getChartData()} options={options} />
      </div>
    </div>
  );
};

export default ComparisonChart;