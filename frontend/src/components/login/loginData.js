// ─── Login Page Constants ─────────────────────────────────────────────────────

export const BRAND = {
  name: 'Fraud Detection System',
  company: 'PT. NusaCita',
  tagline: 'Protect Every\nTransaction with\n',
  taglineAccent: 'Intelligence.',
  description:
    'Real-time fraud detection powered by machine learning. Monitor, analyze, and protect your financial ecosystem 24/7.',
};

export const BRAND_STATS = [
  { value: '98', suffix: '.7%', label: 'Model Accuracy' },
  { value: '1.2', suffix: 'M+', label: 'Txn Monitored' },
  { value: '<50', suffix: 'ms', label: 'Response Time'  },
];

export const BRAND_FEATURES = [
  { icon: 'bi-cpu',              label: 'ML-Powered Detection'  },
  { icon: 'bi-shield-check',     label: 'Real-time Monitoring'  },
  { icon: 'bi-graph-up-arrow',   label: 'Advanced Analytics'    },
  { icon: 'bi-bell',             label: 'Instant Alerts'        },
  { icon: 'bi-lock',             label: 'Bank-Grade Security'   },
  { icon: 'bi-clock-history',    label: 'Audit Trail'           },
];

export const DEMO_CREDENTIALS = {
  email:    'admin@frauddetection.com',
  password: 'admin123',
};

export const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left:     `${Math.random() * 100}%`,
  delay:    `${Math.random() * 12}s`,
  duration: `${8 + Math.random() * 8}s`,
  size:     `${1.5 + Math.random() * 2}px`,
}));