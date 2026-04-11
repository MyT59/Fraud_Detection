import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const LocationChart = ({ data }) => {
  const chartData = {
    labels: data.map((item) => item.location),
    datasets: [
      {
        label: "Fraud",
        data: data.map((item) => item.fraud),
        backgroundColor: "rgba(239, 68, 68, 0.8)",
        borderColor: "#ef4444",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: "flex",
        maxBarThickness: 40,
      },
      {
        label: "Legit",
        data: data.map((item) => item.legit),
        backgroundColor: "rgba(16, 185, 129, 0.8)",
        borderColor: "#10b981",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: "flex",
        maxBarThickness: 40,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: "500",
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: {
          size: 14,
          weight: "600",
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          afterBody: function (context) {
            if (context.length > 0) {
              const dataIndex = context[0].dataIndex;
              const location = data[dataIndex];
              const fraudRate = (
                (location.fraud / location.total) *
                100
              ).toFixed(1);
              return `Total: ${location.total.toLocaleString()}\nFraud Rate: ${fraudRate}%`;
            }
            return "";
          },
        },
      },
    },
    scales: {
      x: {
        stacked: false,
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        stacked: false,
        beginAtZero: true,
        grid: {
          color: "#f5f5f5",
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 12,
          },
          callback: function (value) {
            return value.toLocaleString();
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
  };

  return (
    <div style={{ height: "300px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default LocationChart;
