import { useMemo } from "react";
import { authService } from "../services/AuthService"; // ✅ FIX

/**
 * useRole
 * Hook untuk mengecek role user yang sedang login.
 */
const useRole = () => {
  const user = authService.getCurrentUser();
  const role = user?.role || null;

  return useMemo(
    () => ({
      role,
      user,
      isFraudAnalyst: role === "FRAUD_ANALYST",
      isRiskManager: role === "RISK_MANAGER",
      isSuperAdmin: role === "SUPER_ADMIN",
      canReview: role === "FRAUD_ANALYST" || role === "SUPER_ADMIN",
      canManage: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      canViewAnalytics: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      canOverride: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      canDelete: role === "RISK_MANAGER" || role === "SUPER_ADMIN",
      hasRole: (r) => role === r,
      hasAnyRole: (...roles) => roles.includes(role),
    }),
    [role, user],
  );
};

export default useRole;
