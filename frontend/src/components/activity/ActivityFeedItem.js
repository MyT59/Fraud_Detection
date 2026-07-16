import React, { useState } from "react";
import {
  ACTION_META,
  DEFAULT_META,
  getActivityGroup,
  GROUP_BADGE_CLASS,
  GROUP_LABEL,
} from "./activityData";

const fmtRelative = (isoString) => {
  if (!isoString) return "-";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
};

const fmtDateTime = (isoString) => {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const stringifyValue = (value) => {
  if (value == null) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const SnapshotDiff = ({ before = {}, after = {} }) => {
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed = allKeys.filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const unchanged = allKeys.filter(
    (key) => JSON.stringify(before[key]) === JSON.stringify(after[key]),
  );

  return (
    <div className="tf-snapshot">
      {changed.map((key) => (
        <div key={key} className="tf-snapshot-row tf-snapshot-changed">
          <span className="tf-snapshot-key">{key.replace(/_/g, " ")}:</span>
          <span className="tf-snapshot-before">
            {stringifyValue(before[key])}
          </span>
          <i className="bi bi-arrow-right tf-snapshot-arrow" />
          <span className="tf-snapshot-after">{stringifyValue(after[key])}</span>
        </div>
      ))}
      {unchanged.map((key) => (
        <div key={key} className="tf-snapshot-row tf-snapshot-same">
          <span className="tf-snapshot-key">{key.replace(/_/g, " ")}:</span>
          <span className="tf-snapshot-value">{stringifyValue(after[key])}</span>
        </div>
      ))}
    </div>
  );
};

const DetailTags = ({ details }) => {
  const skip = new Set(["before", "after", "reason"]);
  const entries = Object.entries(details).filter(([key]) => !skip.has(key));
  if (!entries.length) return null;

  return entries.slice(0, 5).map(([key, value]) => (
    <span key={key} className="tf-tag">
      <strong>{key.replace(/_/g, " ")}:</strong> {stringifyValue(value)}
    </span>
  ));
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
  const description = isString
    ? rawDetails
    : activity.target_type && activity.target_id
      ? `${activity.target_type}: ${activity.target_id}`
      : activity.module_source || "System event";

  return (
    <div className="timeline-item-full">
      <div className="tf-icon-col">
        <div className={`tf-marker activity-${meta.color}`}>
          <i className={`bi ${meta.icon}`} />
        </div>
        {!isLast && <div className="tf-connector" />}
      </div>

      <div className="tf-content">
        <div className="tf-top-row">
          <div>
            <h4 className="tf-title">{meta.title}</h4>
            <span className="tf-module">{activity.module_source || "SYSTEM"}</span>
          </div>
          <span className="tf-time-badge">
            <i className="bi bi-clock" />
            {fmtRelative(activity.created_at)}
          </span>
        </div>

        <p className="tf-description">
          {description}
          {isObject && details.reason ? ` - ${details.reason}` : ""}
        </p>

        <div className="tf-meta">
          <span className={`tf-type-badge ${badgeClass}`}>{groupLabel}</span>

          {activity.severity && activity.severity !== "INFO" && (
            <span
              className={`tf-type-badge tf-severity-${activity.severity.toLowerCase()}`}
            >
              {activity.severity}
            </span>
          )}

          {isObject && !hasSnapshot && <DetailTags details={details} />}

          {hasSnapshot && (
            <button
              className="tf-snapshot-toggle"
              onClick={() => setShowSnapshot((value) => !value)}
            >
              <i
                className={`bi bi-${showSnapshot ? "chevron-up" : "code-slash"}`}
              />
              {showSnapshot ? "Sembunyikan perubahan" : "Lihat perubahan"}
            </button>
          )}

          <span className="tf-user">
            <i className="bi bi-person-fill" />
            {activity.admin_name || "System"}
          </span>
        </div>

        <div className="tf-footer-row">
          <span>ID #{activity.id}</span>
          <span>{fmtDateTime(activity.created_at)}</span>
        </div>

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
