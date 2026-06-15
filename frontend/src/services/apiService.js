const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const storage = {
  getAccessToken: () => localStorage.getItem("access_token"),
  getRefreshToken: () => localStorage.getItem("refresh_token"),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  },

  setUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));
  },

  clear: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
  },
};

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  refreshQueue = [];
};

const refreshAccessToken = async () => {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${API_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }), // ✅ FIX: pakai body bukan query params
  });

  if (!res.ok) throw new Error("Refresh token expired");

  const data = await res.json();

  storage.setTokens(data.access_token, refreshToken);
  return data.access_token;
};

const request = async (method, endpoint, body = null, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const token = storage.getAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    method,
    headers,
    signal: options.signal,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(url, config);

  if (res.status === 401 && !options._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newToken) => {
        config.headers["Authorization"] = `Bearer ${newToken}`;
        return fetch(url, config).then(handleResponse);
      });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      config.headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, { ...config, _retry: true });
    } catch (err) {
      processQueue(err, null);
      storage.clear();

      window.location.href = "/login?reason=expired";
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return handleResponse(res);
};

const handleResponse = async (res) => {
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (isJson && data?.detail) ||
      (isJson && data?.message) ||
      `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  get: (endpoint, options = {}) => request("GET", endpoint, null, options),

  post: (endpoint, body, options = {}) =>
    request("POST", endpoint, body, options),

  put: (endpoint, body, options = {}) =>
    request("PUT", endpoint, body, options),

  patch: (endpoint, body, options = {}) =>
    request("PATCH", endpoint, body, options),

  del: (endpoint, options = {}) => request("DELETE", endpoint, null, options),
  delete: (endpoint, options = {}) =>
    request("DELETE", endpoint, null, options),

  postForm: async (endpoint, formData, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const token = storage.getAccessToken();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      signal: options.signal,
    });
    return handleResponse(res);
  },
};

export const authService = {
  login: async (email, password) => {
    // ✅ FIX: pakai body bukan query params
    const data = await api.post("/login", { email, password });

    storage.setTokens(data.access_token, data.refresh_token);

    try {
      const me = await api.get("/accounts/me");
      storage.setUser(me);
    } catch {
      if (data.user) storage.setUser(data.user);
    }

    return data;
  },

  logout: async () => {
    try {
      await api.post("/logout");
    } catch {
    } finally {
      storage.clear();
      window.location.href = "/login";
    }
  },

  isAuthenticated: () => {
    return !!storage.getAccessToken();
  },

  getCurrentUser: () => {
    return storage.getUser();
  },

  changePassword: (oldPassword, newPassword) => {
    return api.post("/accounts/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  hasRole: (role) => {
    const user = storage.getUser();
    return user?.role === role;
  },

  isSuperAdmin: () => authService.hasRole("SUPER_ADMIN"),
};

export default api;
