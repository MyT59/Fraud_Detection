import React, { useState } from "react";
import { DEMO_CREDENTIALS } from "./loginData";

const LoginForm = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = (e) => {
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

    setTimeout(() => {
      if (
        formData.email === DEMO_CREDENTIALS.email &&
        formData.password === DEMO_CREDENTIALS.password
      ) {
        localStorage.setItem("isLoggedIn", "true");
        onLoginSuccess();
      } else {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
      }
    }, 1200);
  };

  const fillDemo = () => {
    setFormData({
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password,
    });
    setError("");
  };

  return (
    <div className="login-form-panel">
      <div className="login-form-container">
        <div className="login-form-header">
          <h2>Welcome back</h2>
          <p>Sign in to your administrator account</p>
        </div>

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

          <div className="login-options">
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me</span>
            </label>
            <button type="button" className="login-forgot">
              Forgot password?
            </button>
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
          <span>Demo Access</span>
        </div>

        <div className="login-demo-hint">
          <i className="bi bi-info-circle-fill"></i>
          <div className="login-demo-hint-text">
            <strong>Demo credentials: </strong>
            {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}{" "}
            <button
              type="button"
              className="login-forgot"
              onClick={fillDemo}
              style={{ fontSize: "0.78rem" }}
            >
              Fill automatically
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
