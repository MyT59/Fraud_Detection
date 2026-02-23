import React, { useState } from 'react';

const ReportGenerator = ({ onGenerate, onCancel }) => {
  const [formData, setFormData] = useState({
    type: 'Monthly Summary',
    format: 'PDF',
    dateFrom: '',
    dateTo: '',
    includeCharts: true,
    includeDetails: true,
    filterStatus: 'all'
  });

  const reportTypes = [
    { value: 'Monthly Summary', icon: 'calendar-month' },
    { value: 'Fraud Analysis', icon: 'shield-exclamation' },
    { value: 'Transaction Report', icon: 'receipt' },
    { value: 'Location Analysis', icon: 'geo-alt' },
    { value: 'Custom Report', icon: 'sliders' }
  ];

  const formats = [
    { value: 'PDF', icon: 'file-pdf' },
    { value: 'Excel', icon: 'file-excel' },
    { value: 'CSV', icon: 'file-text' }
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(formData);
  };

  return (
    <div className="card report-generator-card">
      <div className="card-header">
        <h5 className="card-title mb-0">
          <i className="bi bi-magic me-2"></i>
          Generate New Report
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="row">
            {/* Report Type */}
            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-file-earmark me-1"></i>
                Report Type
              </label>
              <select
                className="form-select"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                required
              >
                {reportTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.value}
                  </option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-filetype-pdf me-1"></i>
                Export Format
              </label>
              <select
                className="form-select"
                name="format"
                value={formData.format}
                onChange={handleInputChange}
                required
              >
                {formats.map(format => (
                  <option key={format.value} value={format.value}>
                    {format.value}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-calendar-range me-1"></i>
                Date From
              </label>
              <input
                type="date"
                className="form-control"
                name="dateFrom"
                value={formData.dateFrom}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-calendar-check me-1"></i>
                Date To
              </label>
              <input
                type="date"
                className="form-control"
                name="dateTo"
                value={formData.dateTo}
                onChange={handleInputChange}
                required
              />
            </div>

            {/* Filter Status */}
            <div className="col-md-12 mb-3">
              <label className="form-label">
                <i className="bi bi-filter me-1"></i>
                Transaction Status Filter
              </label>
              <select
                className="form-select"
                name="filterStatus"
                value={formData.filterStatus}
                onChange={handleInputChange}
              >
                <option value="all">All Transactions</option>
                <option value="fraud">Fraud Only</option>
                <option value="legit">Legit Only</option>
              </select>
            </div>

            {/* Options */}
            <div className="col-md-12 mb-3">
              <label className="form-label">Report Options</label>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="includeCharts"
                  id="includeCharts"
                  checked={formData.includeCharts}
                  onChange={handleInputChange}
                />
                <label className="form-check-label" htmlFor="includeCharts">
                  Include Charts & Visualizations
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="includeDetails"
                  id="includeDetails"
                  checked={formData.includeDetails}
                  onChange={handleInputChange}
                />
                <label className="form-check-label" htmlFor="includeDetails">
                  Include Detailed Transaction List
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="col-md-12">
              <div className="d-flex gap-2 justify-content-end">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={onCancel}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-danger"
                >
                  <i className="bi bi-file-earmark-arrow-down me-1"></i>
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportGenerator;