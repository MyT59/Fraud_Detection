import { useMemo } from "react";
import { authService } from "../services/apiService";

/**
 * useRole
 * Hook untuk mengecek role user yang sedang login.
 * Membaca dari localStorage via authService.getCurrentUser().
 *
 * Role yang ada di sistem:
 *   FRAUD_ANALYST  → Claim & Review alert
 *   RISK_MANAGER   → Override, Delete, Performance Analytics
 *   SUPER_ADMIN    → Semua akses
 *
 * @returns {object} role utilities
 */
const useRole = () => {
  const user = authService.getCurrentUser();
  const role = user?.role || null;

  return useMemo(
    () => ({
      role,
      user,

      // Cek role spesifik
      isFraudAnalyst: role === "FRAUD_ANALYST",
      isRiskManager: role === "RISK_MANAGER",
      isSuperAdmin: role === "SUPER_ADMIN",

      // Cek akses level
      // SUPER_ADMIN bisa akses semua
      canReview: role === "FRAUD_ANALYST" || role === "SUPER_ADMIN",
      canManage: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      canViewAnalytics: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      canOverride: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      canDelete: role === "RISK_MANAGER" || role === "SUPER_ADMIN",

      // Helper: cek role arbitrary
      hasRole: (r) => role === r,
      hasAnyRole: (...roles) => roles.includes(role),
    }),
    [role, user],
  );
};

export default useRole;
