import React from "react";
import "./ActivityStats.css";

const ActivityStats = ({ logs }) => {
  const total = logs.length;
  const creates = logs.filter((l) => l.type === "create").length;
  const edits = logs.filter((l) => l.type === "edit").length;
  const suspends = logs.filter((l) => l.type === "suspend").length;
  const deletes = logs.filter((l) => l.type === "delete").length;

  const stats = [
    {
      icon: "bi-journal-text",
      label: "Total Log",
      value: total,
      cls: "as-total",
    },
    {
      icon: "bi-person-plus",
      label: "Dibuat",
      value: creates,
      cls: "as-create",
    },
    { icon: "bi-pencil-square", label: "Diedit", value: edits, cls: "as-edit" },
    {
      icon: "bi-pause-circle",
      label: "Disuspend",
      value: suspends,
      cls: "as-suspend",
    },
    { icon: "bi-trash", label: "Dihapus", value: deletes, cls: "as-delete" },
  ];

  return (
    <div className="as-grid">
      {stats.map((s, i) => (
        <div className={`as-card ${s.cls}`} key={i}>
          <div className="as-icon-wrap">
            <i className={`bi ${s.icon}`}></i>
          </div>
          <div className="as-info">
            <span className="as-value">{s.value}</span>
            <span className="as-label">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityStats;
