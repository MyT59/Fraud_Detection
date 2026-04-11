export const MODELS = [
  "FraudNet v3.2",
  "AnomalyDetector v1.8",
  "RiskScorer v2.0",
  "PatternClassifier v4.1",
  "BehaviorAnalyzer v2.5",
  "TransactionGuard v1.3",
];

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) =>
  String(i + 1),
);

export const FREQUENCIES = [
  { value: "daily", label: "Harian", icon: "bi-arrow-clockwise" },
  { value: "weekly", label: "Mingguan", icon: "bi-calendar-week" },
  { value: "monthly", label: "Bulanan", icon: "bi-calendar-month" },
];

export const INITIAL_SCHEDULES = [
  {
    id: 1,
    name: "Weekly Full Retrain",
    model: "FraudNet v3.2",
    frequency: "weekly",
    dayOfWeek: "Monday",
    dayOfMonth: null,
    time: "02:00",
    status: "active",
    lastRun: "2025-06-16 02:00",
    nextRun: "2025-06-23 02:00",
    description: "Full weekly retrain menggunakan data transaksi terbaru.",
    createdAt: "2025-05-01",
  },
  {
    id: 2,
    name: "Monthly Deep Retrain",
    model: "AnomalyDetector v1.8",
    frequency: "monthly",
    dayOfWeek: null,
    dayOfMonth: "1",
    time: "00:00",
    status: "active",
    lastRun: "2025-06-01 00:00",
    nextRun: "2025-07-01 00:00",
    description: "Deep retrain bulanan untuk akurasi tinggi.",
    createdAt: "2025-04-15",
  },
  {
    id: 3,
    name: "Daily Incremental Update",
    model: "RiskScorer v2.0",
    frequency: "daily",
    dayOfWeek: null,
    dayOfMonth: null,
    time: "03:30",
    status: "paused",
    lastRun: "2025-06-18 03:30",
    nextRun: "—",
    description: "Update inkremental harian untuk model risk scoring realtime.",
    createdAt: "2025-06-01",
  },
  {
    id: 4,
    name: "Bi-weekly Pattern Refresh",
    model: "PatternClassifier v4.1",
    frequency: "weekly",
    dayOfWeek: "Friday",
    dayOfMonth: null,
    time: "01:00",
    status: "active",
    lastRun: "2025-06-14 01:00",
    nextRun: "2025-06-21 01:00",
    description:
      "Refresh pattern classifier setiap Jumat untuk deteksi pola baru.",
    createdAt: "2025-05-20",
  },
];

export const EMPTY_FORM = {
  name: "",
  model: MODELS[0],
  frequency: "weekly",
  dayOfWeek: "Monday",
  dayOfMonth: "1",
  time: "02:00",
  status: "active",
  description: "",
};

export const getFrequencyLabel = (f) =>
  FREQUENCIES.find((x) => x.value === f)?.label ?? f;

export const getFrequencyIcon = (f) =>
  FREQUENCIES.find((x) => x.value === f)?.icon ?? "bi-calendar";

export const getStatusClass = (s) =>
  s === "active" ? "badge--active" : "badge--paused";

export const getStatusLabel = (s) => (s === "active" ? "Aktif" : "Paused");

export const formatScheduleTime = (s) => {
  if (s.frequency === "daily") return `Setiap hari, ${s.time}`;
  if (s.frequency === "weekly") return `Setiap ${s.dayOfWeek}, ${s.time}`;
  if (s.frequency === "monthly")
    return `Tgl ${s.dayOfMonth} setiap bulan, ${s.time}`;
  return s.time;
};

export const getNowString = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

let _nextId = INITIAL_SCHEDULES.length + 1;
export const getNextId = () => _nextId++;
