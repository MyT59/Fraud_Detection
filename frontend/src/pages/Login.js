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

  // ✅ FIX: terima parameter requirePasswordChange dari LoginForm
  const handleLoginSuccess = ({ requirePasswordChange } = {}) => {
    console.log("handleLoginSuccess called:", requirePasswordChange);
    if (requirePasswordChange) {
      console.log("navigating to /change-password");
      navigate("/change-password", { replace: true });
      return;
    }
    console.log("navigating to /dashboard");
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
