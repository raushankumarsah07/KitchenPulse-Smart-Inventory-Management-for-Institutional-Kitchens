const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const money = (n, d = 0) => `₹${(d ? inr2 : inr).format(Number(n) || 0)}`;
export const qty = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n) || 0);
export const shortDate = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const longDate = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
/** Today's date as YYYY-MM-DD in the browser's local timezone. */
export const todayStr = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const addDaysStr = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
