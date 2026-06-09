export const DOMAINS = [
  { value: "agenusa", label: "Agenusa" },
  { value: "nusabill", label: "Nusabill" },
];

export const FREQUENCIES = [
  { value: "daily", label: "Harian", icon: "bi-arrow-clockwise" },
  { value: "weekly", label: "Mingguan", icon: "bi-calendar-week" },
  { value: "monthly", label: "Bulanan", icon: "bi-calendar-month" },
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

export const EMPTY_FORM = {
  name: "",
  domain: "agenusa",
  frequency: "weekly",
  dayOfWeek: "Monday",
  dayOfMonth: "1",
  time: "02:00",
  is_active: true,
  description: "",
};

export const buildCronExpr = ({ frequency, dayOfWeek, dayOfMonth, time }) => {
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const minute = mm ?? 0;
  const hour = hh ?? 0;

  if (frequency === "daily") return `${minute} ${hour} * * *`;

  if (frequency === "weekly") {
    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const dow = dayMap[dayOfWeek] ?? 1;
    return `${minute} ${hour} * * ${dow}`;
  }

  if (frequency === "monthly") {
    const dom = parseInt(dayOfMonth, 10) || 1;
    return `${minute} ${hour} ${dom} * *`;
  }

  return `${minute} ${hour} * * *`;
};

export const parseCronExpr = (cron) => {
  if (!cron)
    return {
      frequency: "daily",
      dayOfWeek: "Monday",
      dayOfMonth: "1",
      time: "00:00",
    };

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5)
    return {
      frequency: "daily",
      dayOfWeek: "Monday",
      dayOfMonth: "1",
      time: "00:00",
    };

  const [minute, hour, dom, , dow] = parts;

  const pad = (n) => String(n).padStart(2, "0");
  const time = `${pad(hour === "*" ? 0 : Number(hour))}:${pad(minute === "*" ? 0 : Number(minute))}`;

  const dowNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  if (dom !== "*") {
    return {
      frequency: "monthly",
      dayOfWeek: "Monday",
      dayOfMonth: String(dom),
      time,
    };
  }

  if (dow !== "*") {
    const dayIndex = parseInt(dow, 10);
    return {
      frequency: "weekly",
      dayOfWeek: dowNames[dayIndex] || "Monday",
      dayOfMonth: "1",
      time,
    };
  }

  return { frequency: "daily", dayOfWeek: "Monday", dayOfMonth: "1", time };
};

export const adaptSchedule = (s) => {
  const parsed = parseCronExpr(s.cron_expr);
  return {
    id: s.id,
    name: s.name,
    model: "Isolation Forest",
    domain: s.domain,
    cron_expr: s.cron_expr,
    frequency: parsed.frequency,
    dayOfWeek: parsed.dayOfWeek,
    dayOfMonth: parsed.dayOfMonth,
    time: parsed.time,
    status: s.is_active ? "active" : "paused",
    is_active: s.is_active,
    lastRun: s.last_run_at
      ? new Date(s.last_run_at)
          .toLocaleString("id-ID", { hour12: false })
          .replace(",", "")
      : "—",
    nextRun: s.next_run_at
      ? new Date(s.next_run_at)
          .toLocaleString("id-ID", { hour12: false })
          .replace(",", "")
      : "—",
    lastRunStatus: s.last_run_status || null,
    description: "",
    createdAt: s.created_at
      ? new Date(s.created_at).toLocaleDateString("id-ID")
      : "—",
  };
};

export const getFrequencyLabel = (f) =>
  FREQUENCIES.find((x) => x.value === f)?.label ?? f;

export const getFrequencyIcon = (f) =>
  FREQUENCIES.find((x) => x.value === f)?.icon ?? "bi-calendar";

export const getStatusClass = (s) =>
  s === "active" ? "badge--active" : "badge--paused";

export const getStatusLabel = (s) => (s === "active" ? "Aktif" : "Paused");

export const getDomainLabel = (d) =>
  DOMAINS.find((x) => x.value === d)?.label ?? d;

export const formatScheduleTime = (s) => {
  if (s.frequency === "daily") return `Setiap hari, ${s.time}`;
  if (s.frequency === "weekly") return `Setiap ${s.dayOfWeek}, ${s.time}`;
  if (s.frequency === "monthly")
    return `Tgl ${s.dayOfMonth} setiap bulan, ${s.time}`;
  return s.time;
};
