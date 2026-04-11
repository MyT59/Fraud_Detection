import React, { useState } from "react";

const ApiSettings = ({ data, onSave }) => {
  const [formData, setFormData] = useState(data);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggle = (field) => {
    const newData = {
      ...formData,
      [field]: !formData[field],
    };
    setFormData(newData);
    onSave(newData);
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(formData.apiKey);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleRegenerateApiKey = () => {
    if (
      window.confirm("Are you sure? This will invalidate your current API key.")
    ) {
      const newApiKey =
        "sk_live_" +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      const newData = {
        ...formData,
        apiKey: newApiKey,
      };
      setFormData(newData);
      onSave(newData);
      alert("New API key generated successfully!");
    }
  };

  return (
    <>
      <div className="card settings-card">
        <div className="card-header">
          <h5 className="card-title mb-0">
            <i className="bi bi-key me-2"></i>
            API Key Management
          </h5>
        </div>
        <div className="card-body">
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-icon bg-success">
                <i className="bi bi-toggle-on"></i>
              </div>
              <div className="setting-details">
                <h6>Enable API Access</h6>
                <p>Allow external applications to access the API</p>
              </div>
            </div>
            <div className="setting-control">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={formData.apiEnabled}
                  onChange={() => handleToggle("apiEnabled")}
                />
              </div>
            </div>
          </div>

          <div className="api-key-section mt-4">
            <label className="form-label">
              <i className="bi bi-shield-lock me-2"></i>
              Your API Key
            </label>
            <div className="api-key-display">
              <input
                type={showApiKey ? "text" : "password"}
                className="form-control"
                value={formData.apiKey}
                readOnly
              />
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? "Hide" : "Show"}
              >
                <i className={`bi bi-eye${showApiKey ? "-slash" : ""}`}></i>
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={handleCopyApiKey}
                title="Copy"
              >
                <i
                  className={`bi bi-${copySuccess ? "check" : "clipboard"}`}
                ></i>
              </button>
            </div>
            <small className="text-muted">
              Keep this key secret and secure
            </small>
          </div>

          <div className="mt-3">
            <button
              className="btn btn-outline-danger"
              onClick={handleRegenerateApiKey}
            >
              <i className="bi bi-arrow-repeat me-2"></i>
              Regenerate API Key
            </button>
          </div>
        </div>
      </div>

      <div className="card settings-card mt-4">
        <div className="card-header">
          <h5 className="card-title mb-0">
            <i className="bi bi-gear me-2"></i>
            API Configuration
          </h5>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label className="form-label">
              <i className="bi bi-link-45deg me-2"></i>
              Webhook URL
            </label>
            <input
              type="url"
              className="form-control"
              name="webhookUrl"
              value={formData.webhookUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/webhook"
            />
            <small className="text-muted">
              Receive real-time notifications at this URL
            </small>
          </div>

          <div className="mb-4">
            <label className="form-label">
              <i className="bi bi-speedometer2 me-2"></i>
              Rate Limit (requests per minute)
            </label>
            <input
              type="number"
              className="form-control"
              name="rateLimitPerMinute"
              value={formData.rateLimitPerMinute}
              onChange={handleInputChange}
              min="10"
              max="1000"
            />
            <small className="text-muted">
              Maximum API requests allowed per minute
            </small>
          </div>

          <button className="btn btn-danger" onClick={handleSave}>
            <i className="bi bi-check-circle me-2"></i>
            Save Configuration
          </button>
        </div>
      </div>
    </>
  );
};

export default ApiSettings;
