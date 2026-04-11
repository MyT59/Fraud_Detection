import React from "react";
import { useNavigate } from "react-router-dom";
import LoginBackground from "../components/login/LoginBackground";
import LoginBrand from "../components/login/LoginBrand";
import LoginForm from "../components/login/LoginForm";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <LoginBackground />

      <LoginBrand />

      <div className="login-divider" />

      <LoginForm onLoginSuccess={handleLoginSuccess} />
    </div>
  );
};

export default Login;
