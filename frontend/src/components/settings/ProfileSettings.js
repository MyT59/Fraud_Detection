import React, { useState, useEffect } from "react";

const DEPARTMENT_OPTIONS = [
  "Risk Management",
  "Fraud Prevention",
  "Security",
  "IT",
  "Operations",
];

const ProfileSettings = ({ data, onSave, canEditDepartment = false }) => {
  const [formData, setFormData] = useState(data);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setFormData(data);
    }
  }, [data, isEditing]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const saved = await onSave(formData);
    setIsSaving(false);
    if (saved) setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(data);
    setIsEditing(false);
  };

  const getInitials = (name = "") =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

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
                  <span>{getInitials(formData.name)}</span>
                )}
              </div>
            </div>
            <div className="avatar-info">
              <h6>{formData.name || "—"}</h6>
              <p className="text-muted">{formData.role || "—"}</p>
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                <i className="bi bi-envelope me-1"></i>
                {formData.email || "—"}
              </p>
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
                value={formData.name || ""}
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
                value={formData.email || ""}
                disabled
              />
              <small className="text-muted">Email tidak dapat diubah</small>
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
                value={formData.phone || ""}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="Belum diisi"
              />
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-building me-1"></i>
                Department
              </label>
              {isEditing && canEditDepartment ? (
                <select
                  className="form-select"
                  name="department"
                  value={formData.department || ""}
                  onChange={handleInputChange}
                >
                  <option value="">— Pilih Department —</option>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-control"
                  value={formData.department || "Belum diisi"}
                  disabled
                />
              )}
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                <i className="bi bi-shield-check me-1"></i>
                Role
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.role || ""}
                disabled
              />
              <small className="text-muted">
                Role menentukan akses menu dan workflow review. Hubungi Super
                Admin untuk mengubah role.
              </small>
            </div>
          </div>

          {isEditing && (
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <i className="bi bi-x-circle me-1"></i>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-1"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
