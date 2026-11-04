import mongoose from 'mongoose';
import { Consumption } from '../models.js';
import { HttpError, addDays, r2, r3, today, ymd } from '../utils.js';

/** Daily usage for one ingredient, with zero-filled gaps, ending today (if recorded) or yesterday. */
export async function dailySeries(ingredientId, days = 120) {
  const end = today();
  const start = addDays(end, -(days - 1));
  const rows = await Consumption.aggregate([
    { $match: { ingredient: new mongoose.Types.ObjectId(ingredientId), date: { $gte: start, $lte: end } } },
    { $group: { _id: '$date', quantity: { $sum: '$quantity' }, meals: { $max: '$mealsServed' } } },
    { $sort: { _id: 1 } },
  ]);
  if (!rows.length) throw new HttpError(400, 'No usage history yet. Record daily usage first (or load demo data).');
  const byDay = new Map(rows.map((r) => [ymd(r._id), r]));
  const last = rows[rows.length - 1]._id >= end ? end : addDays(end, -1);
  const series = [];
  for (let d = rows[0]._id; d <= last; d = addDays(d, 1)) {
    const r = byDay.get(ymd(d));
    series.push({ date: ymd(d), quantity: r3(r?.quantity || 0), meals: r?.meals ?? null });
  }
  return series;
}

export async function callMl(series, horizon) {
  const url = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${url}/forecast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series, horizon }), signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`ML service responded ${res.status}`);
    return { ...(await res.json()), source: 'ml-service' };
  } finally {
    clearTimeout(timer);
  }
}

/** Used only when the Python service is unreachable, so the app never breaks. */
export function fallbackForecast(series, horizon) {
  const recent = series.slice(-7);
  const avg = recent.reduce((s, p) => s + p.quantity, 0) / Math.max(recent.length, 1);
  const lastDate = new Date(`${series[series.length - 1].date}T00:00:00Z`);
  return {
    source: 'fallback',
    best: 'Moving average (7 days)',
    models: [{ name: 'Moving average (7 days)', mae: null, rmse: null }],
    improvementOverBaselinePct: null,
    warnings: ['The Python ML service is not reachable, so a simple 7-day moving average was used.'],
    predictions: Array.from({ length: horizon }, (_, i) => ({ date: ymd(addDays(lastDate, i + 1)), quantity: r3(avg), lower: null, upper: null })),
  };
}

export function buildSuggestion({ predictions, usable, pending, safetyPct, unit }) {
  const need = r3(predictions.reduce((s, p) => s + p.quantity, 0));
  const safety = r3((need * safetyPct) / 100);
  const raw = need + safety - usable - pending;
  const toBuy = raw <= 0 ? 0 : unit === 'pcs' ? Math.ceil(raw) : Math.ceil(raw * 10) / 10;
  return { predictedNeed: need, safetyStock: safety, usableStock: r3(usable), pendingDelivery: r3(pending), toBuy, safetyPct,
    steps: [
      { label: 'Predicted need', value: need, op: '' },
      { label: `Safety stock (${safetyPct}%)`, value: safety, op: '+' },
      { label: 'Usable stock now', value: r3(usable), op: '−' },
      { label: 'Pending delivery', value: r3(pending), op: '−' },
    ] };
}
