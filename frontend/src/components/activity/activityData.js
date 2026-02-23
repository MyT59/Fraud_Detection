// ─── Activity Timeline Data & Constants ──────────────────────────────────────

export const ALL_ACTIVITIES = [
  {
    id: 1,
    type: 'fraud_detected',
    title: 'High-Risk Transaction Blocked',
    description: 'TRX001234 automatically blocked by system due to anomaly score exceeding threshold.',
    user: 'System',
    time: '2 min ago',
    timestamp: '2026-02-23 09:58',
    icon: 'bi-shield-exclamation',
    color: 'red',
    details: { amount: 'Rp 25.000.000', user: 'USR12345' }
  },
  {
    id: 2,
    type: 'manual_review',
    title: 'Transaction Approved',
    description: 'TRX001230 approved after manual review by admin.',
    user: 'Admin User',
    time: '15 min ago',
    timestamp: '2026-02-23 09:45',
    icon: 'bi-check-circle',
    color: 'green',
    details: { reviewTime: '3 minutes', transactionId: 'TRX001230' }
  },
  {
    id: 3,
    type: 'rule_update',
    title: 'Fraud Rule Updated',
    description: 'Velocity check threshold increased to 10 transactions per hour.',
    user: 'Security Team',
    time: '1 hr ago',
    timestamp: '2026-02-23 09:00',
    icon: 'bi-gear',
    color: 'blue',
    details: { rule: 'Velocity Check', oldValue: '8', newValue: '10' }
  },
  {
    id: 4,
    type: 'alert',
    title: 'Multiple Failed Login Attempts',
    description: 'USR67890 had 5 consecutive failed login attempts from Jakarta.',
    user: 'System',
    time: '2 hr ago',
    timestamp: '2026-02-23 07:58',
    icon: 'bi-exclamation-triangle',
    color: 'orange',
    details: { attempts: '5', userId: 'USR67890', location: 'Jakarta' }
  },
  {
    id: 5,
    type: 'report',
    title: 'Monthly Report Generated',
    description: 'January 2026 fraud analysis report completed and dispatched.',
    user: 'System',
    time: '3 hr ago',
    timestamp: '2026-02-23 06:58',
    icon: 'bi-file-earmark-text',
    color: 'purple',
    details: { reportId: 'RPT0015', period: 'January 2026' }
  },
  {
    id: 6,
    type: 'user_action',
    title: 'User Settings Updated',
    description: 'Email notifications enabled for high-risk transaction alerts.',
    user: 'Admin User',
    time: '5 hr ago',
    timestamp: '2026-02-23 04:58',
    icon: 'bi-person-gear',
    color: 'gray',
    details: { setting: 'Notifications', status: 'Enabled' }
  },
  {
    id: 7,
    type: 'fraud_detected',
    title: 'Suspicious Pattern Detected',
    description: 'Geographic anomaly detected in TRX001225 — transaction origin inconsistent.',
    user: 'System',
    time: '6 hr ago',
    timestamp: '2026-02-23 03:58',
    icon: 'bi-geo-alt',
    color: 'red',
    details: { location: 'Unknown', transactionId: 'TRX001225' }
  },
  {
    id: 8,
    type: 'system',
    title: 'ML Model Retrained',
    description: 'Fraud detection model updated with 5,000 new labeled samples.',
    user: 'System',
    time: '8 hr ago',
    timestamp: '2026-02-23 01:58',
    icon: 'bi-cpu',
    color: 'blue',
    details: { accuracy: '98.9%', samples: '5,000' }
  },
  {
    id: 9,
    type: 'alert',
    title: 'Unusual Transaction Volume',
    description: 'Spike detected: 3x normal transaction volume from merchant MRC00123.',
    user: 'System',
    time: '9 hr ago',
    timestamp: '2026-02-23 00:58',
    icon: 'bi-graph-up-arrow',
    color: 'orange',
    details: { merchant: 'MRC00123', spike: '3x normal' }
  },
  {
    id: 10,
    type: 'manual_review',
    title: 'Transaction Rejected',
    description: 'TRX001220 rejected after manual review — insufficient evidence.',
    user: 'Analyst Team',
    time: '10 hr ago',
    timestamp: '2026-02-22 23:58',
    icon: 'bi-x-circle',
    color: 'red',
    details: { transactionId: 'TRX001220', reason: 'Insufficient evidence' }
  },
  {
    id: 11,
    type: 'rule_update',
    title: 'New Blacklist Rule Added',
    description: 'IP range 192.168.x.x added to fraud blacklist by security team.',
    user: 'Security Team',
    time: '12 hr ago',
    timestamp: '2026-02-22 21:58',
    icon: 'bi-ban',
    color: 'blue',
    details: { rule: 'IP Blacklist', ipRange: '192.168.x.x' }
  },
  {
    id: 12,
    type: 'report',
    title: 'Daily Summary Dispatched',
    description: 'Daily fraud detection summary sent to all stakeholders.',
    user: 'System',
    time: '14 hr ago',
    timestamp: '2026-02-22 19:58',
    icon: 'bi-send',
    color: 'purple',
    details: { recipients: '12', reportId: 'DAILY-0223' }
  },
  {
    id: 13,
    type: 'system',
    title: 'Database Backup Completed',
    description: 'Scheduled database backup completed successfully — 14.2 GB archived.',
    user: 'System',
    time: '18 hr ago',
    timestamp: '2026-02-22 15:58',
    icon: 'bi-hdd',
    color: 'blue',
    details: { size: '14.2 GB', status: 'Success' }
  },
  {
    id: 14,
    type: 'user_action',
    title: 'New Admin Account Created',
    description: 'Administrator account created for new security analyst.',
    user: 'Super Admin',
    time: '1 day ago',
    timestamp: '2026-02-22 09:00',
    icon: 'bi-person-plus',
    color: 'gray',
    details: { role: 'Analyst', createdBy: 'Super Admin' }
  },
  {
    id: 15,
    type: 'fraud_detected',
    title: 'Card Cloning Attempt',
    description: 'TRX001210 flagged for potential card cloning — dual-location transaction.',
    user: 'System',
    time: '1 day ago',
    timestamp: '2026-02-22 07:30',
    icon: 'bi-credit-card-2-front',
    color: 'red',
    details: { transactionId: 'TRX001210', type: 'Card Cloning' }
  },
];

export const FILTER_CONFIG = [
  { label: 'All',         value: 'all',           icon: 'bi-grid',                 color: 'all',    dot: null       },
  { label: 'Fraud',       value: 'fraud_detected', icon: 'bi-shield-exclamation',   color: 'fraud',  dot: 'red'      },
  { label: 'Reviews',     value: 'manual_review',  icon: 'bi-eye',                  color: 'review', dot: 'green'    },
  { label: 'System',      value: 'system',         icon: 'bi-cpu',                  color: 'system', dot: 'blue'     },
  { label: 'Rules',       value: 'rule_update',    icon: 'bi-gear',                 color: 'rule',   dot: 'blue'     },
  { label: 'Alerts',      value: 'alert',          icon: 'bi-exclamation-triangle', color: 'alert',  dot: 'orange'   },
  { label: 'Reports',     value: 'report',         icon: 'bi-file-earmark-text',    color: 'report', dot: 'purple'   },
  { label: 'User Actions',value: 'user_action',    icon: 'bi-person-gear',          color: 'user',   dot: 'gray'     },
];

export const TYPE_BADGE_CLASS = {
  fraud_detected: 'tf-type-fraud',
  manual_review:  'tf-type-review',
  system:         'tf-type-system',
  rule_update:    'tf-type-rule',
  alert:          'tf-type-alert',
  report:         'tf-type-report',
  user_action:    'tf-type-user',
};

export const TYPE_LABEL = {
  fraud_detected: 'Fraud',
  manual_review:  'Review',
  system:         'System',
  rule_update:    'Rule',
  alert:          'Alert',
  report:         'Report',
  user_action:    'User',
};

export const STATS_BAR = [
  { label: 'Fraud Events',  key: 'fraud_detected', icon: 'bi-shield-exclamation', color: 'red'    },
  { label: 'Reviews',       key: 'manual_review',  icon: 'bi-eye',                color: 'green'  },
  { label: 'System Events', key: 'system',         icon: 'bi-cpu',                color: 'blue'   },
  { label: 'Alerts',        key: 'alert',          icon: 'bi-bell',               color: 'orange' },
  { label: 'Reports',       key: 'report',         icon: 'bi-file-text',          color: 'purple' },
  { label: 'User Actions',  key: 'user_action',    icon: 'bi-person',             color: 'gray'   },
];