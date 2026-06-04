import React, { useState } from "react";

const ProfileSettings = ({ data, onSave }) => {
  const [formData, setFormData] = useState(data);
  const [isEditing, setIsEditing] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(data);
    setIsEditing(false);
  };

  return (
    <div className="card settings-card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            <i className="bi bi-person-circle me-2"></i>
            Profile Information
          </h5>
          {!isEditing && (
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => setIsEditing(true)}
            >
              <i className="bi bi-pencil me-1"></i>
              Edit Profile
            </button>
          )}
        </div>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="profile-avatar-section mb-4">
            <div className="avatar-wrapper">
              <div className="avatar-circle">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="Profile" />
                ) : (
                  <span>{formData.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {isEditing && (
                <button type="button" className="avatar-upload-btn">
                  <i className="bi bi-camera"></i>
                </button>
              )}
            </div>
            <div className="avatar-info">
              <h6>{formData.name}</h6>
              <p className="text-muted">{formData.role}</p>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-person me-1"></i>
                Full Name
              </label>
              <input
                type="text"
                className="form-control"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={!isEditing}
                required
              />
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-envelope me-1"></i>
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                required
              />
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-telephone me-1"></i>
                Phone Number
              </label>
              <input
                type="tel"
                className="form-control"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-building me-1"></i>
                Department
              </label>
              <select
                className="form-select"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                disabled={!isEditing}
              >
                <option value="Risk Management">Risk Management</option>
                <option value="Fraud Prevention">Fraud Prevention</option>
              </select>
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-shield-check me-1"></i>
                Role
              </label>
              <input
                type="text"
                className="form-control"
                name="role"
                value={formData.role}
                disabled
              />
              <small className="text-muted">
                Contact Super Admin to change role
              </small>
            </div>
          </div>

          {isEditing && (
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleCancel}
              >
                <i className="bi bi-x-circle me-1"></i>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger">
                <i className="bi bi-check-circle me-1"></i>
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
