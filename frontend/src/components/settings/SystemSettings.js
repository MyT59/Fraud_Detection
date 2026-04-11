import React, { useState } from "react";

const SystemSettings = ({ data, onSave }) => {
  const [formData, setFormData] = useState(data);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
  };

  const handleReset = () => {
    setFormData(data);
    setHasChanges(false);
  };

  return (
    <div className="card settings-card">
      <div className="card-header">
        <h5 className="card-title mb-0">
          <i className="bi bi-sliders me-2"></i>
          System Preferences
        </h5>
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-12 mb-4">
            <div className="system-setting-item">
              <label className="form-label">
                <i className="bi bi-palette me-2 text-danger"></i>
                Theme
              </label>
              <div className="theme-selector">
                <div className="row">
                  <div className="col-md-4">
                    <div
                      className={`theme-option ${formData.theme === "light" ? "active" : ""}`}
                      onClick={() =>
                        handleSelectChange({
                          target: { name: "theme", value: "light" },
                        })
                      }
                    >
                      <i className="bi bi-sun-fill"></i>
                      <span>Light</span>
                      {formData.theme === "light" && (
                        <i className="bi bi-check-circle-fill"></i>
                      )}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div
                      className={`theme-option ${formData.theme === "dark" ? "active" : ""}`}
                      onClick={() =>
                        handleSelectChange({
                          target: { name: "theme", value: "dark" },
                        })
                      }
                    >
                      <i className="bi bi-moon-stars-fill"></i>
                      <span>Dark</span>
                      {formData.theme === "dark" && (
                        <i className="bi bi-check-circle-fill"></i>
                      )}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div
                      className={`theme-option ${formData.theme === "auto" ? "active" : ""}`}
                      onClick={() =>
                        handleSelectChange({
                          target: { name: "theme", value: "auto" },
                        })
                      }
                    >
                      <i className="bi bi-circle-half"></i>
                      <span>Auto</span>
                      {formData.theme === "auto" && (
                        <i className="bi bi-check-circle-fill"></i>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <small className="text-muted">Pilih tema tampilan aplikasi</small>
            </div>
          </div>
        </div>

        {hasChanges && (
          <div className="alert alert-warning d-flex justify-content-between align-items-center">
            <span>
              <i className="bi bi-exclamation-triangle me-2"></i>
              You have unsaved changes
            </span>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={handleReset}
              >
                Reset
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleSave}>
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;
