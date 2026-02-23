import React, { useState } from 'react';

const SecuritySettings = ({ data, onSave }) => {
  const [formData, setFormData] = useState(data);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleToggle = (field) => {
    const newData = {
      ...formData,
      [field]: !formData[field]
    };
    setFormData(newData);
    onSave(newData);
  };

  const handleSessionTimeoutChange = (e) => {
    const newData = {
      ...formData,
      sessionTimeout: parseInt(e.target.value)
    };
    setFormData(newData);
  };

  const handleSaveTimeout = () => {
    onSave(formData);
  };

  const handlePasswordChange = (e) => {
    setPasswordData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Password baru tidak cocok!');
      return;
    }
    // Simulate password change
    alert('Password berhasil diubah!');
    setShowPasswordModal(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="card settings-card">
        <div className="card-header">
          <h5 className="card-title mb-0">
            <i className="bi bi-shield-lock me-2"></i>
            Security Settings
          </h5>
        </div>
        <div className="card-body">
          {/* Session Timeout */}
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-icon bg-warning">
                <i className="bi bi-clock-history"></i>
              </div>
              <div className="setting-details">
                <h6>Session Timeout</h6>
                <p>Otomatis logout setelah periode inaktif</p>
              </div>
            </div>
            <div className="setting-control">
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: '120px' }}
                  value={formData.sessionTimeout}
                  onChange={handleSessionTimeoutChange}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
                <button 
                  className="btn btn-sm btn-danger"
                  onClick={handleSaveTimeout}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Password Management */}
          <div className="setting-item border-0 pb-0">
            <div className="setting-info">
              <div className="setting-icon bg-danger">
                <i className="bi bi-key"></i>
              </div>
              <div className="setting-details">
                <h6>Password</h6>
                <p>Last changed: {formatDate(formData.passwordLastChanged)}</p>
              </div>
            </div>
            <div className="setting-control">
              <button 
                className="btn btn-sm btn-outline-danger"
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="card settings-card mt-4">
        <div className="card-header">
          <h5 className="card-title mb-0">
            <i className="bi bi-laptop me-2"></i>
            Active Sessions
          </h5>
        </div>
        <div className="card-body">
          <div className="session-item">
            <div className="session-info">
              <i className="bi bi-laptop session-device-icon"></i>
              <div>
                <h6>Windows 10 - Chrome</h6>
                <p className="text-muted mb-0">
                  <i className="bi bi-geo-alt"></i> Jakarta, Indonesia
                  <span className="mx-2">•</span>
                  <i className="bi bi-clock"></i> Active now
                </p>
              </div>
            </div>
            <span className="badge bg-success">Current Session</span>
          </div>
          <div className="session-item">
            <div className="session-info">
              <i className="bi bi-phone session-device-icon"></i>
              <div>
                <h6>iPhone 13 - Safari</h6>
                <p className="text-muted mb-0">
                  <i className="bi bi-geo-alt"></i> Surabaya, Indonesia
                  <span className="mx-2">•</span>
                  <i className="bi bi-clock"></i> 2 hours ago
                </p>
              </div>
            </div>
            <button className="btn btn-sm btn-outline-danger">Revoke</button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>Change Password</h5>
              <button className="btn-close" onClick={() => setShowPasswordModal(false)}></button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength={8}
                  />
                  <small className="text-muted">Minimal 8 karakter</small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SecuritySettings;