import React, { useState } from 'react';

const NotificationSettings = ({ data, onSave }) => {
  const [formData, setFormData] = useState(data);

  const handleToggle = (field) => {
    const newData = {
      ...formData,
      [field]: !formData[field]
    };
    setFormData(newData);
    onSave(newData);
  };

  const notifications = [
    {
      key: 'fraudAlerts',
      icon: 'exclamation-triangle',
      color: 'danger',
      title: 'Fraud Alerts',
      description: 'Notifikasi segera saat terdeteksi fraud',
      enabled: formData.fraudAlerts
    },
    {
      key: 'pushNotifications',
      icon: 'bell',
      color: 'warning',
      title: 'Push Notifications',
      description: 'Notifikasi push di browser atau mobile',
      enabled: formData.pushNotifications
    }
  ];

  return (
    <div className="card settings-card">
      <div className="card-header">
        <h5 className="card-title mb-0">
          <i className="bi bi-bell me-2"></i>
          Notification Preferences
        </h5>
      </div>
      <div className="card-body">
        <p className="text-muted mb-4">
          Pilih jenis notifikasi yang ingin Anda terima
        </p>

        {notifications.map((notification, index) => (
          <div 
            key={notification.key}
            className={`setting-item ${index === notifications.length - 1 ? 'border-0 pb-0' : ''}`}
          >
            <div className="setting-info">
              <div className={`setting-icon bg-${notification.color}`}>
                <i className={`bi bi-${notification.icon}`}></i>
              </div>
              <div className="setting-details">
                <h6>{notification.title}</h6>
                <p>{notification.description}</p>
              </div>
            </div>
            <div className="setting-control">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={notification.enabled}
                  onChange={() => handleToggle(notification.key)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSettings;