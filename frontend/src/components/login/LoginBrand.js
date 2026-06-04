import React from "react";
import { BRAND } from "./loginData";

const LoginBrand = () => {
  return (
    <div className="login-brand-panel">
      <div className="login-brand-logo">
        <div className="brand-logo-icon">
          <i className="bi bi-shield-check"></i>
        </div>
        <div className="brand-logo-name">
          {BRAND.name}
          <span>{BRAND.company}</span>
        </div>
      </div>

      <div className="login-brand-headline">
        <h1>
          {BRAND.tagline.split("\n").map((line, i) =>
            line ? (
              <span key={i}>
                {line}
                <br />
              </span>
            ) : null,
          )}
          <em>{BRAND.taglineAccent}</em>
        </h1>
        <p>{BRAND.description}</p>
      </div>
    </div>
  );
};

export default LoginBrand;
