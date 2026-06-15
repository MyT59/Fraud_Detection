import React, { useState } from "react";
import { authService } from "../../services/apiService";

import { BRAND } from "./loginData";

const LoginForm = ({ onLoginSuccess, sessionExpired }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!formData.password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);

    try {
      // authService.login() dari apiService.js sudah otomatis
      // redirect ke /change-password kalau is_password_temporary = true.
      // Kalau tidak, lanjut ke onLoginSuccess (redirect ke dashboard).
      await authService.login(formData.email, formData.password);
      onLoginSuccess();
    } catch (err) {
      if (err.status === 401) {
        setError("Invalid email or password. Please try again.");
      } else if (err.status === 403) {
        setError(
          err.message ||
            "Your account has been suspended or temporarily locked.",
        );
      } else if (err.status === 429) {
        setError(
          "Too many login attempts. Please wait a moment before trying again.",
        );
      } else if (err.status === 0 || !err.status) {
        setError("Cannot connect to server. Please check your connection.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-panel">
      <div className="login-form-container">
        <div className="login-form-header">
          <h2>Welcome back</h2>
          <p>Sign in to your account</p>
        </div>

        {sessionExpired && (
          <div className="login-warning">
            <i className="bi bi-clock-history"></i>
            Your session has expired due to 60 minutes of inactivity. Please
            sign in again.
          </div>
        )}

        {error && (
          <div className="login-error">
            <i className="bi bi-exclamation-circle-fill"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="login-email">Email Address</label>
            <div className="login-input-wrap">
              <input
                id="login-email"
                type="email"
                name="email"
                className="login-input"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
              />
              <i className="bi bi-envelope login-input-icon"></i>
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                className="login-input login-input-password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={loading}
              />
              <i className="bi bi-lock login-input-icon"></i>
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((p) => !p)}
                tabIndex={-1}
              >
                <i className={`bi bi-eye${showPassword ? "-slash" : ""}`}></i>
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="login-spinner"></span>
                Signing in...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i>
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="login-form-divider">
          <span>System Info</span>
        </div>

        <div className="login-demo-hint">
          <i className="bi bi-info-circle-fill"></i>
          <div className="login-demo-hint-text">
            <strong>
              {BRAND.name} — {BRAND.company}
            </strong>
            <br />
            <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
              Gunakan akun admin yang telah didaftarkan oleh Super Admin.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
