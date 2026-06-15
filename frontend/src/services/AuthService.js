/**
 * authService.js
 * Mengelola autentikasi: login, logout, refresh, dan state user.
 *
 * Endpoints yang digunakan (sesuai API docs):
 *  POST /login      { email, password }
 *  POST /logout     (Bearer token)
 *  POST /refresh    { refresh_token }
 */

import { api, storage } from "./apiService";

// ✅ FIX: pakai storage dari apiService (key "user")
// konsisten dengan App.js yang baca pakai storage.getUser()
export const userStorage = {
  get: () => storage.getUser(),
  set: (user) => storage.setUser(user),
  clear: () => storage.clear(),
};

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {
  login: async (email, password) => {
    const data = await api.post("/login", { email, password });

    storage.setTokens(data.access_token, data.refresh_token);
    storage.setUser(data.user); // ✅ FIX: simpan ke key "user" bukan "current_user"

    return {
      user: data.user,
      requirePasswordChange: data.require_password_change || false,
    };
  },

  logout: async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.warn("[authService] Logout request gagal:", err.message);
    } finally {
      storage.clear();
    }
  },

  refreshToken: async (refreshToken) => {
    return api.post("/refresh", { refresh_token: refreshToken });
  },

  changePassword: async (oldPassword, newPassword) => {
    return api.post("/accounts/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  isAuthenticated: () => !!storage.getAccessToken(),

  getCurrentUser: () => storage.getUser(),

  hasRole: (role) => {
    const user = storage.getUser();
    return user?.role === role;
  },

  isSuperAdmin: () => authService.hasRole("SUPER_ADMIN"),
};

export default authService;
