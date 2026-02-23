import React, { useState } from 'react';
import './AnalyticsExportButton.css';

const AnalyticsExportButton = ({ analyticsData, timeRange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const exportToPDF = () => {
    setIsExporting(true);
    alert('PDF Export functionality - Coming soon! Will include charts and insights.');
    setTimeout(() => {
      setIsExporting(false);
      setShowDropdown(false);
    }, 1000);
  };

  const exportToExcel = () => {
    setIsExporting(true);
    
    try {
      // Create comprehensive Excel export
      let tableHTML = '<table border="1"><thead>';
      
      // Monthly Data Sheet
      tableHTML += '<tr><th colspan="5" style="background-color: #dc2626; color: white;">MONTHLY TRANSACTION DATA</th></tr>';
      tableHTML += '<tr><th>Month</th><th>Total Transactions</th><th>Fraud</th><th>Legit</th><th>Fraud Rate</th></tr></thead><tbody>';
      
      analyticsData.monthlyData.forEach(item => {
        const fraudRate = ((item.fraud / item.transactions) * 100).toFixed(2);
        tableHTML += `<tr>
          <td>${item.month}</td>
          <td>${item.transactions}</td>
          <td style="color: #ef4444;">${item.fraud}</td>
          <td style="color: #10b981;">${item.legit}</td>
          <td>${fraudRate}%</td>
        </tr>`;
      });
      
      tableHTML += '</tbody></table><br/><br/>';
      
      // Location Data Sheet
      tableHTML += '<table border="1"><thead>';
      tableHTML += '<tr><th colspan="5" style="background-color: #dc2626; color: white;">LOCATION ANALYSIS</th></tr>';
      tableHTML += '<tr><th>Location</th><th>Total</th><th>Fraud</th><th>Legit</th><th>Fraud Rate</th></tr></thead><tbody>';
      
      analyticsData.locationData.forEach(item => {
        const fraudRate = ((item.fraud / item.total) * 100).toFixed(2);
        tableHTML += `<tr>
          <td>${item.location}</td>
          <td>${item.total}</td>
          <td style="color: #ef4444;">${item.fraud}</td>
          <td style="color: #10b981;">${item.legit}</td>
          <td>${fraudRate}%</td>
        </tr>`;
      });
      
      tableHTML += '</tbody></table>';
      
      // Create blob and download
      const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics_report_${timeRange}_${new Date().getTime()}.xls`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowDropdown(false);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Failed to export Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = () => {
    setIsExporting(true);
    
    try {
      let csvContent = 'Analytics Report\n';
      csvContent += `Time Range: ${timeRange}\n`;
      csvContent += `Export Date: ${new Date().toLocaleString()}\n\n`;
      
      // Monthly Data
      csvContent += 'MONTHLY TRANSACTION DATA\n';
      csvContent += 'Month,Total Transactions,Fraud,Legit,Fraud Rate\n';
      
      analyticsData.monthlyData.forEach(item => {
        const fraudRate = ((item.fraud / item.transactions) * 100).toFixed(2);
        csvContent += `${item.month},${item.transactions},${item.fraud},${item.legit},${fraudRate}%\n`;
      });
      
      csvContent += '\n\nLOCATION ANALYSIS\n';
      csvContent += 'Location,Total,Fraud,Legit,Fraud Rate\n';
      
      analyticsData.locationData.forEach(item => {
        const fraudRate = ((item.fraud / item.total) * 100).toFixed(2);
        csvContent += `${item.location},${item.total},${item.fraud},${item.legit},${fraudRate}%\n`;
      });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics_report_${timeRange}_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowDropdown(false);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);
    
    try {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          timeRange: timeRange,
          reportType: 'Analytics Report'
        },
        monthlyData: analyticsData.monthlyData,
        locationData: analyticsData.locationData,
        fraudStats: analyticsData.fraudStats,
        dailyTrend: analyticsData.dailyTrend
      };
      
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics_data_${timeRange}_${new Date().getTime()}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowDropdown(false);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON');
    } finally {
      setIsExporting(false);
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.analytics-export-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <div className="analytics-export-container">
      <button 
        className="btn btn-danger analytics-export-btn"
        onClick={toggleDropdown}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            Exporting...
          </>
        ) : (
          <>
            <i className="bi bi-file-earmark-arrow-down me-2"></i>
            Export Report
          </>
        )}
      </button>

      {showDropdown && (
        <div className="analytics-export-dropdown">
          <div className="dropdown-header">
            <i className="bi bi-download me-2"></i>
            Export Format
          </div>
          
          <button className="dropdown-item" onClick={exportToCSV}>
            <div className="export-option">
              <div className="export-icon">
                <i className="bi bi-filetype-csv"></i>
              </div>
              <div className="export-info">
                <div className="export-title">CSV Report</div>
                <div className="export-desc">Comma-separated values for Excel</div>
              </div>
            </div>
          </button>
          
          <button className="dropdown-item" onClick={exportToExcel}>
            <div className="export-option">
              <div className="export-icon">
                <i className="bi bi-file-earmark-excel"></i>
              </div>
              <div className="export-info">
                <div className="export-title">Excel Report</div>
                <div className="export-desc">Formatted Excel spreadsheet</div>
              </div>
            </div>
          </button>
          
          <button className="dropdown-item" onClick={exportToJSON}>
            <div className="export-option">
              <div className="export-icon">
                <i className="bi bi-filetype-json"></i>
              </div>
              <div className="export-info">
                <div className="export-title">JSON Data</div>
                <div className="export-desc">Raw data for API integration</div>
              </div>
            </div>
          </button>
          
          <div className="dropdown-divider"></div>
          
          <button className="dropdown-item" onClick={exportToPDF}>
            <div className="export-option">
              <div className="export-icon">
                <i className="bi bi-file-earmark-pdf"></i>
              </div>
              <div className="export-info">
                <div className="export-title">PDF Report</div>
                <div className="export-desc">Full report with charts (Coming soon)</div>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default AnalyticsExportButton;