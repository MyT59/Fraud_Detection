import React, { useState } from 'react';
import './ScheduledReports.css';

const ScheduledReports = ({ schedules, onAddSchedule, onEditSchedule, onDeleteSchedule }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    reportType: 'Monthly Summary',
    frequency: 'weekly',
    dayOfWeek: 'monday',
    dayOfMonth: '1',
    time: '09:00',
    format: 'PDF',
    recipients: '',
    enabled: true
  });

  // Default schedules if none provided
  const defaultSchedules = [
    {
      id: 1,
      name: 'Weekly Fraud Report',
      reportType: 'Fraud Analysis',
      frequency: 'weekly',
      dayOfWeek: 'monday',
      time: '09:00',
      format: 'PDF',
      recipients: 'admin@company.com',
      enabled: true,
      lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    },
    {
      id: 2,
      name: 'Monthly Summary',
      reportType: 'Monthly Summary',
      frequency: 'monthly',
      dayOfMonth: '1',
      time: '08:00',
      format: 'Excel',
      recipients: 'management@company.com',
      enabled: true,
      lastRun: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    },
    {
      id: 3,
      name: 'Daily Transaction Report',
      reportType: 'Transaction Report',
      frequency: 'daily',
      time: '23:00',
      format: 'CSV',
      recipients: 'operations@company.com',
      enabled: false,
      lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      nextRun: null
    }
  ];

  const schedulesList = schedules || defaultSchedules;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingSchedule) {
      onEditSchedule?.({ ...formData, id: editingSchedule.id });
    } else {
      onAddSchedule?.(formData);
    }
    
    resetForm();
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      reportType: schedule.reportType,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek || 'monday',
      dayOfMonth: schedule.dayOfMonth || '1',
      time: schedule.time,
      format: schedule.format,
      recipients: schedule.recipients,
      enabled: schedule.enabled
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      reportType: 'Monthly Summary',
      frequency: 'weekly',
      dayOfWeek: 'monday',
      dayOfMonth: '1',
      time: '09:00',
      format: 'PDF',
      recipients: '',
      enabled: true
    });
    setEditingSchedule(null);
    setShowForm(false);
  };

  const formatDate = (date) => {
    if (!date) return 'Not scheduled';
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(date));
  };

  const getFrequencyBadge = (frequency) => {
    const badges = {
      daily: { class: 'bg-primary', icon: 'calendar-day' },
      weekly: { class: 'bg-info', icon: 'calendar-week' },
      monthly: { class: 'bg-warning', icon: 'calendar-month' }
    };
    const badge = badges[frequency] || badges.weekly;
    return (
      <span className={`badge ${badge.class}`}>
        <i className={`bi bi-${badge.icon} me-1`}></i>
        {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
      </span>
    );
  };

  return (
    <div className="scheduled-reports-wrapper">
      <div className="scheduled-header mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="mb-1">
              <i className="bi bi-calendar-event text-danger me-2"></i>
              Scheduled Reports
            </h6>
            <small className="text-muted">{schedulesList.length} active schedules</small>
          </div>
          <button 
            className="btn btn-sm btn-danger"
            onClick={() => setShowForm(!showForm)}
          >
            <i className="bi bi-plus-circle me-1"></i>
            New Schedule
          </button>
        </div>
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="schedule-form-card mb-3">
          <div className="card-header">
            <h6 className="mb-0">
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Schedule Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Weekly Fraud Report"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Report Type</label>
                  <select
                    className="form-select form-select-sm"
                    name="reportType"
                    value={formData.reportType}
                    onChange={handleInputChange}
                  >
                    <option>Monthly Summary</option>
                    <option>Fraud Analysis</option>
                    <option>Transaction Report</option>
                    <option>Location Analysis</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Frequency</label>
                  <select
                    className="form-select form-select-sm"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleInputChange}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {formData.frequency === 'weekly' && (
                  <div className="col-md-4">
                    <label className="form-label">Day of Week</label>
                    <select
                      className="form-select form-select-sm"
                      name="dayOfWeek"
                      value={formData.dayOfWeek}
                      onChange={handleInputChange}
                    >
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>
                )}

                {formData.frequency === 'monthly' && (
                  <div className="col-md-4">
                    <label className="form-label">Day of Month</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      name="dayOfMonth"
                      value={formData.dayOfMonth}
                      onChange={handleInputChange}
                      min="1"
                      max="31"
                    />
                  </div>
                )}

                <div className="col-md-4">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Format</label>
                  <select
                    className="form-select form-select-sm"
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                  >
                    <option>PDF</option>
                    <option>Excel</option>
                    <option>CSV</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Recipients (comma separated)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="recipients"
                    value={formData.recipients}
                    onChange={handleInputChange}
                    placeholder="email1@example.com, email2@example.com"
                    required
                  />
                </div>

                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="enabled"
                      id="scheduleEnabled"
                      checked={formData.enabled}
                      onChange={handleInputChange}
                    />
                    <label className="form-check-label" htmlFor="scheduleEnabled">
                      Enable this schedule
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <div className="d-flex gap-2 justify-content-end">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-danger">
                      {editingSchedule ? 'Update' : 'Create'} Schedule
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedules List */}
      <div className="schedules-list">
        {schedulesList.map(schedule => (
          <div key={schedule.id} className={`schedule-item ${!schedule.enabled ? 'disabled' : ''}`}>
            <div className="schedule-icon">
              <i className="bi bi-clock-history"></i>
            </div>

            <div className="schedule-content">
              <div className="schedule-header">
                <h6 className="schedule-name">{schedule.name}</h6>
                <div className="schedule-badges">
                  {getFrequencyBadge(schedule.frequency)}
                  <span className={`badge ${schedule.enabled ? 'bg-success' : 'bg-secondary'}`}>
                    {schedule.enabled ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>

              <div className="schedule-details">
                <div className="detail-item">
                  <i className="bi bi-file-earmark"></i>
                  <span>{schedule.reportType}</span>
                </div>
                <div className="detail-item">
                  <i className="bi bi-filetype-pdf"></i>
                  <span>{schedule.format}</span>
                </div>
                <div className="detail-item">
                  <i className="bi bi-clock"></i>
                  <span>{schedule.time}</span>
                </div>
                <div className="detail-item">
                  <i className="bi bi-envelope"></i>
                  <span>{schedule.recipients}</span>
                </div>
              </div>

              <div className="schedule-timeline">
                <div className="timeline-item">
                  <small className="text-muted">Last run:</small>
                  <span>{formatDate(schedule.lastRun)}</span>
                </div>
                {schedule.enabled && (
                  <div className="timeline-item">
                    <small className="text-muted">Next run:</small>
                    <span className="text-primary fw-medium">{formatDate(schedule.nextRun)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="schedule-actions">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => handleEdit(schedule)}
                title="Edit"
              >
                <i className="bi bi-pencil"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  if (window.confirm(`Delete schedule "${schedule.name}"?`)) {
                    onDeleteSchedule?.(schedule.id);
                  }
                }}
                title="Delete"
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {schedulesList.length === 0 && (
        <div className="empty-schedules">
          <i className="bi bi-calendar-x"></i>
          <p>No scheduled reports yet</p>
          <button className="btn btn-sm btn-outline-danger" onClick={() => setShowForm(true)}>
            Create Your First Schedule
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduledReports;