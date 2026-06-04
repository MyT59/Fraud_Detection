export const BRAND = {
  name: "Fraud Detection System",
  company: "PT. NusaCita",
  tagline: "Protect Every\nTransaction with\n",
  taglineAccent: "Intelligence.",
  description:
    "Real-time fraud detection powered by machine learning. Monitor, analyze, and protect your financial ecosystem 24/7.",
};

export const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  delay: `${Math.random() * 12}s`,
  duration: `${8 + Math.random() * 8}s`,
  size: `${1.5 + Math.random() * 2}px`,
}));
