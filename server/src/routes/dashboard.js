import { Router } from 'express';
import { Batch, Consumption, Ingredient, Waste } from '../models.js';
import { DAY_MS, addDays, r2, today, wrap, ymd } from '../utils.js';
import { stockSummary } from '../services/stock.js';
import { buildAlerts } from '../services/alerts.js';

const router = Router();
const dayRows = (from, rows, key) => {
  const m = new Map(rows.map((r) => [ymd(r._id), r.cost]));
  return Array.from({ length: 14 }, (_, i) => { const d = ymd(addDays(from, i)); return [d, m.get(d) || 0]; }).map(([date, v]) => ({ date, [key]: r2(v) }));
};

router.get('/', wrap(async (_req, res) => {
  const now = today(), from14 = addDays(now, -13), from30 = addDays(now, -29);
  const sumByDay = (Model, from) => Model.aggregate([{ $match: { date: { $gte: from } } }, { $group: { _id: '$date', cost: { $sum: '$cost' } } }]);
  const [ingredients, stock, alerts, cons14, waste14, reasons, topWaste, useFirst, cons30, waste30] = await Promise.all([
    Ingredient.find({ archived: false }).select('_id').lean(),
    stockSummary(),
    buildAlerts(),
    sumByDay(Consumption, from14),
    sumByDay(Waste, from14),
    Waste.aggregate([{ $match: { date: { $gte: from30 } } }, { $group: { _id: '$reason', cost: { $sum: '$cost' }, count: { $sum: 1 } } }]),
    Waste.aggregate([{ $match: { date: { $gte: from30 } } }, { $group: { _id: '$ingredient', cost: { $sum: '$cost' } } }, { $sort: { cost: -1 } }, { $limit: 5 },
      { $lookup: { from: 'ingredients', localField: '_id', foreignField: '_id', as: 'ing' } }, { $unwind: '$ing' }, { $project: { name: '$ing.name', cost: 1 } }]),
    Batch.find({ remaining: { $gt: 0 }, expiryDate: { $gte: now } }).sort({ expiryDate: 1 }).limit(6).populate('ingredient', 'name unit archived').lean(),
    Consumption.aggregate([{ $match: { date: { $gte: from30 } } }, { $group: { _id: null, cost: { $sum: '$cost' } } }]),
    Waste.aggregate([{ $match: { date: { $gte: from30 } } }, { $group: { _id: null, cost: { $sum: '$cost' } } }]),
  ]);
  const ids = new Set(ingredients.map((i) => String(i._id)));
  let stockValue = 0;
  for (const [id, s] of stock) if (ids.has(id)) stockValue += s.value;
  const consCost = cons30[0]?.cost || 0, wasteCost = waste30[0]?.cost || 0;
  const c = dayRows(from14, cons14, 'consumptionCost'), w = dayRows(from14, waste14, 'wasteCost');
  res.json({
    hasData: ingredients.length > 0,
    stats: {
      ingredientCount: ingredients.length,
      stockValue: r2(stockValue),
      lowCount: new Set(alerts.filter((a) => a.type === 'low' || a.type === 'out').map((a) => String(a.ingredientId))).size,
      expiringCount: alerts.filter((a) => a.type === 'expiring' || a.type === 'expired').length,
      consumptionCost30: r2(consCost), wasteCost30: r2(wasteCost),
      wasteRate: consCost + wasteCost > 0 ? r2((wasteCost / (consCost + wasteCost)) * 100) : 0,
    },
    series: c.map((row, i) => ({ date: row.date, consumptionCost: row.consumptionCost, wasteCost: w[i].wasteCost })),
    wasteByReason: reasons.map((r) => ({ reason: r._id, cost: r2(r.cost), count: r.count })),
    topWasted: topWaste.map((t) => ({ name: t.name, cost: r2(t.cost) })),
    useFirst: useFirst.filter((b) => b.ingredient && !b.ingredient.archived).map((b) => ({
      id: b._id, name: b.ingredient.name, unit: b.ingredient.unit, remaining: b.remaining, expiryDate: b.expiryDate,
      daysLeft: Math.round((new Date(b.expiryDate) - now) / DAY_MS) })),
    alerts: alerts.slice(0, 8),
    alertTotal: alerts.length,
  });
}));

export default router;
