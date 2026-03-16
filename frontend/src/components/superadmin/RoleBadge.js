import React from 'react';
import './RoleBadge.css';

const ROLE_CONFIG = {
  superadmin: { label: 'Super Admin',  icon: 'bi-shield-fill',       className: 'role-superadmin' },
  admin:      { label: 'Admin',        icon: 'bi-person-badge-fill', className: 'role-admin'      },
  analyst:    { label: 'Fraud Analyst',icon: 'bi-search',            className: 'role-analyst'    },
};

const STATUS_CONFIG = {
  active:    { label: 'Active',    className: 'status-active'    },
  inactive:  { label: 'Inactive',  className: 'status-inactive'  },
  suspended: { label: 'Suspended', className: 'status-suspended' },
};

export const RoleBadge = ({ role }) => {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.analyst;
  return (
    <span className={`role-badge ${config.className}`}>
      <i className={`bi ${config.icon}`}></i>
      {config.label}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export { ROLE_CONFIG, STATUS_CONFIG };
export default RoleBadge;