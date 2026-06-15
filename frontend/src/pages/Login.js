import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LoginBackground from "../components/login/LoginBackground";
import LoginBrand from "../components/login/LoginBrand";
import LoginForm from "../components/login/LoginForm";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionExpired =
    new URLSearchParams(location.search).get("reason") === "expired";

  const handleLoginSuccess = () => {
    // Redirect ke /change-password (kalau is_password_temporary)
    // sudah ditangani penuh oleh authService.login() di apiService.js
    // via window.location.href, jadi di sini cukup ke dashboard
    // sebagai fallback untuk kasus normal.
    navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <LoginBackground />
      <LoginBrand />
      <div className="login-divider" />
      <LoginForm
        onLoginSuccess={handleLoginSuccess}
        sessionExpired={sessionExpired}
      />
    </div>
  );
};

export default Login;
