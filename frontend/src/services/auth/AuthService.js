/**
 * authService.js
 * Mengelola autentikasi: login, logout, refresh, dan state user.
 *
 * Endpoints yang digunakan (sesuai API docs):
 *  POST /login?email=&password=
 *  POST /logout                  (Bearer token)
 *  POST /refresh?refresh_token=
 */

import { api, tokenStorage, ApiError } from "../apiService";

const USER_KEY = "current_user";

// ─── User Storage ─────────────────────────────────────────────────────────────

export const userStorage = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  },
  set: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => localStorage.removeItem(USER_KEY),
};

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Login dengan email & password.
   * Menyimpan access_token, refresh_token, dan data user ke localStorage.
   *
   * @returns {{ user, requirePasswordChange }}
   */
  login: async (email, password) => {
    // Backend menggunakan query params untuk login
    const data = await api.post(
      `/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );

    tokenStorage.setTokens(data.access_token, data.refresh_token);
    userStorage.set(data.user);

    return {
      user: data.user,
      requirePasswordChange: data.require_password_change || false,
    };
  },

  /**
   * Logout — memanggil endpoint backend agar token di-blacklist,
   * kemudian membersihkan localStorage.
   */
  logout: async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      // Tetap clear local state meski request gagal
      console.warn("[authService] Logout request gagal:", err.message);
    } finally {
      tokenStorage.clearTokens();
      userStorage.clear();
    }
  },

  /**
   * Ganti password (user self-service).
   * Semua role bisa menggunakan ini.
   */
  changePassword: async (oldPassword, newPassword) => {
    return api.post("/accounts/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  /**
   * Cek apakah user saat ini sudah login (ada token di localStorage).
   */
  isAuthenticated: () => !!tokenStorage.getAccess(),

  /**
   * Ambil data user yang sedang login dari localStorage.
   */
  getCurrentUser: () => userStorage.get(),

  /**
   * Cek role user yang sedang login.
   */
  hasRole: (role) => {
    const user = userStorage.get();
    return user?.role === role;
  },

  isSuperAdmin: () => authService.hasRole("SUPER_ADMIN"),
};

export default authService;