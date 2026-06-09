import React, { useState } from "react";
import {
  ACTION_META,
  DEFAULT_META,
  getActivityGroup,
  GROUP_BADGE_CLASS,
  GROUP_LABEL,
} from "./activityData";

const fmtRelative = (isoString) => {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
};

// Render before/after snapshot diff
const SnapshotDiff = ({ before = {}, after = {} }) => {
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed = allKeys.filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  const unchanged = allKeys.filter(
    (k) => JSON.stringify(before[k]) === JSON.stringify(after[k]),
  );

  return (
    <div className="tf-snapshot">
      {changed.map((k) => (
        <div key={k} className="tf-snapshot-row tf-snapshot-changed">
          <span className="tf-snapshot-key">{k.replace(/_/g, " ")}:</span>
          <span className="tf-snapshot-before">{String(before[k] ?? "—")}</span>
          <i className="bi bi-arrow-right tf-snapshot-arrow"></i>
          <span className="tf-snapshot-after">{String(after[k] ?? "—")}</span>
        </div>
      ))}
      {unchanged.map((k) => (
        <div key={k} className="tf-snapshot-row tf-snapshot-same">
          <span className="tf-snapshot-key">{k.replace(/_/g, " ")}:</span>
          <span className="tf-snapshot-value">{String(after[k] ?? "—")}</span>
        </div>
      ))}
    </div>
  );
};

// Render detail fields biasa (key-value)
const DetailTags = ({ details }) => {
  const skip = new Set(["before", "after", "reason"]);
  const entries = Object.entries(details).filter(([k]) => !skip.has(k));
  if (!entries.length) return null;
  return (
    <>
      {entries.map(([key, value]) => (
        <span key={key} className="tf-tag">
          <strong>{key.replace(/_/g, " ")}:</strong>{" "}
          {typeof value === "object" ? JSON.stringify(value) : String(value)}
        </span>
      ))}
    </>
  );
};

const ActivityFeedItem = ({ activity, isLast }) => {
  const [showSnapshot, setShowSnapshot] = useState(false);

  const meta = ACTION_META[activity.action_type] || DEFAULT_META;
  const group = getActivityGroup(activity.action_type);
  const badgeClass = GROUP_BADGE_CLASS[group] || "tf-type-system";
  const groupLabel = GROUP_LABEL[group] || group;

  const rawDetails = activity.details;
  const isString = typeof rawDetails === "string";
  const isObject = rawDetails && typeof rawDetails === "object";
  const hasSnapshot =
    isObject && ("before" in rawDetails || "after" in rawDetails);
  const details = isObject ? rawDetails : {};

  return (
    <div className="timeline-item-full">
      <div className="tf-icon-col">
        <div className={`tf-marker activity-${meta.color}`}>
          <i className={`bi ${meta.icon}`}></i>
        </div>
        {!isLast && <div className="tf-connector" />}
      </div>

      <div className="tf-content">
        <div className="tf-top-row">
          <h4 className="tf-title">{meta.title}</h4>
          <span className="tf-time-badge">
            <i className="bi bi-clock"></i>
            {fmtRelative(activity.created_at)}
          </span>
        </div>

        {/* Description */}
        <p className="tf-description">
          {isString
            ? rawDetails
            : activity.target_type && activity.target_id
              ? `${activity.target_type}: ${activity.target_id}`
              : activity.module_source}
          {isObject && details.reason ? ` — ${details.reason}` : ""}
        </p>

        <div className="tf-meta">
          <span className={`tf-type-badge ${badgeClass}`}>{groupLabel}</span>

          {/* Severity badge jika bukan INFO */}
          {activity.severity && activity.severity !== "INFO" && (
            <span
              className={`tf-type-badge tf-severity-${activity.severity.toLowerCase()}`}
            >
              {activity.severity}
            </span>
          )}

          {/* Object details biasa */}
          {isObject && !hasSnapshot && <DetailTags details={details} />}

          {/* Before/After snapshot toggle */}
          {hasSnapshot && (
            <button
              className="tf-snapshot-toggle"
              onClick={() => setShowSnapshot((v) => !v)}
            >
              <i
                className={`bi bi-${showSnapshot ? "chevron-up" : "code-slash"}`}
              ></i>
              {showSnapshot ? "Sembunyikan" : "Lihat perubahan"}
            </button>
          )}

          <span className="tf-user">
            <i className="bi bi-person-fill"></i>
            {activity.admin_name || "System"}
          </span>
        </div>

        {/* Snapshot diff expandable */}
        {hasSnapshot && showSnapshot && (
          <SnapshotDiff
            before={details.before || {}}
            after={details.after || {}}
          />
        )}
      </div>
    </div>
  );
};

export default ActivityFeedItem;
