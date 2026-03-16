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
import './ChartCard.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

// Fallback statis kalau prop `data` tidak dikirim
const STATIC_DATA = [
  { label: 'Mon', transactions: 120 },
  { label: 'Tue', transactions: 190 },
  { label: 'Wed', transactions: 150 },
  { label: 'Thu', transactions: 220 },
  { label: 'Fri', transactions: 180 },
  { label: 'Sat', transactions: 210 },
  { label: 'Sun', transactions: 165 },
];

const TransactionChart = ({ data }) => {
  const source = (data && data.length > 0) ? data : STATIC_DATA;

  const chartData = {
    labels: source.map(d => d.label),
    datasets: [
      {
        label: 'Transactions',
        data: source.map(d => d.transactions),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#262626',
        padding: 12,
        titleFont: { size: 13, weight: '600' },
        bodyFont:  { size: 14, weight: '700' },
        displayColors: false,
        cornerRadius: 6,
        callbacks: {
          afterLabel: (ctx) => {
            const row = source[ctx.dataIndex];
            if (row?.fraud !== undefined) {
              return `Fraud: ${row.fraud}`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: '#f5f5f5', drawBorder: false },
        ticks: { font: { size: 12, weight: '500' }, color: '#737373', padding: 8 }
      },
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { font: { size: 12, weight: '600' }, color: '#525252', padding: 8 }
      }
    }
  };

  return (
    <div className="chart-card-simple">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Transactions Per Day</h3>
          <p className="chart-subtitle">Last 7 days</p>
        </div>
      </div>
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default TransactionChart;