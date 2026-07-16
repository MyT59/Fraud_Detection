export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  RISK_MANAGER: "Risk Manager",
  FRAUD_ANALYST: "Fraud Analyst",
};

export const ROLE_HOME_COPY = {
  SUPER_ADMIN: {
    workspace: "System Oversight",
    reviewNav: "Fraud Analysts",
    reviewTitle: "Fraud Analysts",
    reviewSubtitle:
      "Pantau queue, performa reviewer, timeline review, dan quality control keputusan fraud.",
    quickReview: "Fraud Analysts",
    quickReviewHint: "Monitor reviewer, queue, dan keputusan post-transaction review.",
  },
  RISK_MANAGER: {
    workspace: "Risk Operations",
    reviewNav: "Fraud Analysts",
    reviewTitle: "Fraud Analysts",
    reviewSubtitle:
      "Kelola performa reviewer, review queue, dan eskalasi kasus risiko setelah transaksi berhasil.",
    quickReview: "Fraud Analysts",
    quickReviewHint: "Pantau performa analyst dan review management.",
  },
  FRAUD_ANALYST: {
    workspace: "Review Desk",
    reviewNav: "My Review Queue",
    reviewTitle: "My Review Queue",
    reviewSubtitle:
      "Kerjakan kasus transaksi yang sudah sukses tetapi ditandai anomali untuk review pasca-transaksi.",
    quickReview: "My Review Queue",
    quickReviewHint: "Lanjutkan kasus yang sudah Anda klaim.",
  },
};

export const getRoleLabel = (role) => ROLE_LABELS[role] || role || "Administrator";

export const getRoleCopy = (role) =>
  ROLE_HOME_COPY[role] || {
    workspace: "Workspace",
    reviewNav: "Review Queue",
    reviewTitle: "Review Queue",
    reviewSubtitle: "Pantau dan tindak lanjuti transaksi yang membutuhkan review.",
    quickReview: "Review Queue",
    quickReviewHint: "Buka daftar review transaksi.",
  };
