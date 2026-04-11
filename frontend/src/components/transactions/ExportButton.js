import React, { useState } from "react";
import "./ExportButton.css";

const ExportButton = ({ data, filename = "transactions" }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const exportToCSV = () => {
    setIsExporting(true);

    try {
      const headers = [
        "Transaction ID",
        "User",
        "Amount",
        "Time",
        "Location",
        "Status",
      ];

      const rows = data.map((transaction) => [
        transaction.id,
        transaction.user,
        transaction.amount,
        formatDateTime(transaction.time),
        transaction.location,
        transaction.status,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${new Date().getTime()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowDropdown(false);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);

    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${new Date().getTime()}.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowDropdown(false);
    } catch (error) {
      console.error("Error exporting JSON:", error);
      alert("Failed to export JSON");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = () => {
    setIsExporting(true);

    try {
      let tableHTML = "<table><thead><tr>";
      tableHTML +=
        "<th>Transaction ID</th><th>User</th><th>Amount</th><th>Time</th><th>Location</th><th>Status</th>";
      tableHTML += "</tr></thead><tbody>";

      data.forEach((transaction) => {
        tableHTML += "<tr>";
        tableHTML += `<td>${transaction.id}</td>`;
        tableHTML += `<td>${transaction.user}</td>`;
        tableHTML += `<td>${formatCurrency(transaction.amount)}</td>`;
        tableHTML += `<td>${formatDateTime(transaction.time)}</td>`;
        tableHTML += `<td>${transaction.location}</td>`;
        tableHTML += `<td>${transaction.status}</td>`;
        tableHTML += "</tr>";
      });

      tableHTML += "</tbody></table>";

      const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${new Date().getTime()}.xls`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowDropdown(false);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      alert("Failed to export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".export-button-container")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <div className="export-button-container">
      <button
        className="btn btn-primary export-button"
        onClick={toggleDropdown}
        disabled={isExporting || data.length === 0}
      >
        {isExporting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            Exporting...
          </>
        ) : (
          <>
            <i className="bi bi-download me-2"></i>
            Export Data
          </>
        )}
      </button>

      {showDropdown && (
        <div className="export-dropdown">
          <div className="dropdown-header">
            <i className="bi bi-file-earmark-arrow-down me-2"></i>
            Export as
          </div>
          <button className="dropdown-item" onClick={exportToCSV}>
            <i className="bi bi-filetype-csv me-2"></i>
            CSV File
            <small className="text-muted d-block">Comma-separated values</small>
          </button>
          <button className="dropdown-item" onClick={exportToExcel}>
            <i className="bi bi-file-earmark-excel me-2"></i>
            Excel File
            <small className="text-muted d-block">Microsoft Excel format</small>
          </button>
          <button className="dropdown-item" onClick={exportToJSON}>
            <i className="bi bi-filetype-json me-2"></i>
            JSON File
            <small className="text-muted d-block">
              JavaScript Object Notation
            </small>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
