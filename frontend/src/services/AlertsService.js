import { api } from "./apiService";

export const fetchAlerts = ({
  status,
  severity,
  service,
  type,
  priority,
  search,
  sortBy,
  page = 1,
  limit = 10,
  signal,
} = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (status && status !== "all") params.set("status", status);
  if (severity && severity !== "all") params.set("severity", severity);
  if (type && type !== "all") params.set("alert_type", type);
  if (service && service !== "all") params.set("service", service);
  if (priority && priority !== "all") params.set("priority", priority);
  if (search) params.set("search", search);
  if (sortBy) params.set("sort_by", sortBy);

  return api.get(`/alerts/?${params}`, { signal });
};

export const fetchAlertMetrics = (signal) =>
  api.get("/alerts/metrics", { signal });

export const fetchAlertCount = (signal, respectPreferences = false) =>
  api.get(`/alerts/count${respectPreferences ? "?respect_preferences=true" : ""}`, { signal });

// Navbar notification dropdown — pakai dashboard endpoint (response lebih lengkap)
export const fetchRecentAlerts = (signal) =>
  api.get(`/dashboard/alerts/recent`, { signal });

export const fetchPriorityDistribution = (signal) =>
  api.get("/alerts/priority-distribution", { signal });

export const fetchOpenQueue = ({
  priority,
  severity,
  type,
  search,
  sortBy,
  page = 1,
  limit = 10,
  signal,
} = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (priority) params.set("priority", priority);
  if (severity && severity !== "all") params.set("severity", severity);
  if (type && type !== "all") params.set("alert_type", type);
  if (search) params.set("search", search);
  if (sortBy) params.set("sort_by", sortBy);

  return api.get(`/alerts/open-queue?${params}`, { signal });
};

export const fetchMyQueue = ({ page = 1, limit = 10, signal } = {}) => {
  const params = new URLSearchParams({ page, limit });

  return api.get(`/alerts/my-queue?${params}`, { signal });
};

export const fetchAlertDetail = (alertId, signal) =>
  api.get(`/alerts/${alertId}`, { signal });

export const claimAlert = (alertId) => api.post(`/alerts/${alertId}/claim`);

export const releaseAlert = (alertId) => api.post(`/alerts/${alertId}/release`);

export const resolveAlert = (alertId) =>
  api.patch(`/alerts/${alertId}/resolve`);

export const updateAlertStatus = (alertId, status, reason = null) =>
  api.patch(`/alerts/${alertId}/status`, {
    status: status.toUpperCase(),
    ...(reason ? { reason } : {}),
  });
