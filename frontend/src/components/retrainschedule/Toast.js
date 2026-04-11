import React from "react";

const ICON_MAP = {
  success: "bi-check-circle-fill",
  danger: "bi-trash-fill",
  info: "bi-info-circle-fill",
  run: "bi-play-circle-fill",
};

const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`rs-toast rs-toast--${toast.type}`}>
      <i className={`bi ${ICON_MAP[toast.type] ?? "bi-check-circle-fill"}`} />
      <span>{toast.msg}</span>
    </div>
  );
};

export default Toast;
