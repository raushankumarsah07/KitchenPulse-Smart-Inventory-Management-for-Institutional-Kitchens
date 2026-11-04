import { useEffect, useState } from 'react';
import { ArcElement, BarController, BarElement, CategoryScale, Chart, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.animation.duration = 900;
Chart.defaults.animation.easing = 'easeOutQuart';

const read = () => {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return { brand: v('--brand'), brand2: v('--brand-2'), accent: v('--accent'), danger: v('--danger'), info: v('--info'), violet: v('--violet'), ink: v('--ink'), muted: v('--muted'), border: v('--border'), surface: v('--surface') };
};
/** Chart colours that follow the light/dark theme. */
export function useChartColors() {
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return c;
}
export const baseOptions = (c) => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface, padding: 12, cornerRadius: 10, boxPadding: 5, usePointStyle: true } },
  scales: { x: { grid: { display: false }, ticks: { color: c.muted }, border: { display: false } }, y: { grid: { color: c.border }, ticks: { color: c.muted }, border: { display: false }, beginAtZero: true } },
});
