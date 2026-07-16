import { api } from "./apiService";

export const fetchAlerts = ({
  status,
  severity,
  service,
  type,
  priority,
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

  return api.get(`/alerts/?${params}`, { signal });
};

export const fetchAlertMetrics = (signal) =>
  api.get("/alerts/metrics", { signal });

export const fetchAlertCount = (signal) => api.get("/alerts/count", { signal });

// Navbar notification dropdown — pakai dashboard endpoint (response lebih lengkap)
export const fetchRecentAlerts = (signal) =>
  api.get(`/dashboard/alerts/recent`, { signal });

export const fetchPriorityDistribution = (signal) =>
  api.get("/alerts/priority-distribution", { signal });

export const fetchOpenQueue = ({
  priority,
  severity,
  type,
  page = 1,
  limit = 10,
  signal,
} = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (priority) params.set("priority", priority);
  if (severity && severity !== "all") params.set("severity", severity);
  if (type && type !== "all") params.set("alert_type", type);

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

export const updateAlertStatus = (alertId, status) =>
  api.patch(`/alerts/${alertId}/status?status=${status.toUpperCase()}`);
