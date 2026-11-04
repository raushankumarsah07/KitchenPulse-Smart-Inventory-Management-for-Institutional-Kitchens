import { Batch, Ingredient } from '../models.js';
import { DAY_MS, expiryWarnDays, r3, today, ymd } from '../utils.js';
import { stockSummary } from './stock.js';

const order = { critical: 0, warning: 1, info: 2 };

export async function buildAlerts() {
  const now = today();
  const warnUntil = new Date(now.getTime() + expiryWarnDays() * DAY_MS);
  const [ingredients, stock, expiring] = await Promise.all([
    Ingredient.find({ archived: false }).lean(),
    stockSummary(),
    Batch.find({ remaining: { $gt: 0 }, expiryDate: { $ne: null, $lte: warnUntil } }).populate('ingredient').lean(),
  ]);
  const alerts = [];
  for (const i of ingredients) {
    const s = stock.get(String(i._id));
    const usable = r3((s?.quantity || 0) - (s?.expiredQty || 0));
    if (usable <= 0) {
      alerts.push({ id: `out-${i._id}`, type: 'out', severity: 'critical', ingredientId: i._id, name: i.name,
        message: `${i.name} is out of usable stock.`, meta: { usable, unit: i.unit } });
    } else if (usable < i.minStock) {
      alerts.push({ id: `low-${i._id}`, type: 'low', severity: 'warning', ingredientId: i._id, name: i.name,
        message: `${i.name} is low: ${usable} ${i.unit} left (minimum ${i.minStock}).`, meta: { usable, unit: i.unit, minStock: i.minStock } });
    }
  }
  for (const b of expiring) {
    if (!b.ingredient || b.ingredient.archived) continue;
    const days = Math.round((new Date(b.expiryDate) - now) / DAY_MS);
    const u = b.ingredient.unit;
    if (days < 0) {
      alerts.push({ id: `exp-${b._id}`, type: 'expired', severity: 'critical', ingredientId: b.ingredient._id, name: b.ingredient.name,
        message: `${r3(b.remaining)} ${u} of ${b.ingredient.name} expired on ${ymd(b.expiryDate)}. Record it as waste.`, meta: { days, batchId: b._id } });
    } else {
      alerts.push({ id: `soon-${b._id}`, type: 'expiring', severity: days <= 1 ? 'critical' : 'warning', ingredientId: b.ingredient._id, name: b.ingredient.name,
        message: `${r3(b.remaining)} ${u} of ${b.ingredient.name} ${days === 0 ? 'expires today' : days === 1 ? 'expires tomorrow' : `expires in ${days} days`}. Use first.`, meta: { days, batchId: b._id } });
    }
  }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
