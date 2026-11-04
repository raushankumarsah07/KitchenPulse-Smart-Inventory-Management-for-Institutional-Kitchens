import { Router } from 'express';
import { Batch, Consumption, Ingredient, Waste } from '../models.js';
import { HttpError, addDays, parseDay, r2, r3, today, wrap, ymd } from '../utils.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const to = req.query.to ? parseDay(req.query.to) : today();
  const from = req.query.from ? parseDay(req.query.from) : addDays(to, -29);
  if (from > to) throw new HttpError(400, 'The start date must be before the end date.');
  if ((to - from) / 86400000 > 366) throw new HttpError(400, 'Please choose a range of one year or less.');
  const range = { $gte: from, $lte: to };
  const [cons, waste, buys, consDay, wasteDay, buyDay, ings] = await Promise.all([
    Consumption.aggregate([{ $match: { date: range } }, { $group: { _id: '$ingredient', qty: { $sum: '$quantity' }, cost: { $sum: '$cost' } } }]),
    Waste.aggregate([{ $match: { date: range } }, { $group: { _id: '$ingredient', qty: { $sum: '$quantity' }, cost: { $sum: '$cost' } } }]),
    Batch.aggregate([{ $match: { purchasedAt: range } }, { $group: { _id: '$ingredient', qty: { $sum: '$quantity' }, cost: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } }]),
    Consumption.aggregate([{ $match: { date: range } }, { $group: { _id: '$date', cost: { $sum: '$cost' }, meals: { $max: '$mealsServed' } } }]),
    Waste.aggregate([{ $match: { date: range } }, { $group: { _id: '$date', cost: { $sum: '$cost' } } }]),
    Batch.aggregate([{ $match: { purchasedAt: range } }, { $group: { _id: '$purchasedAt', cost: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } }]),
    Ingredient.find().select('name unit category').lean(),
  ]);
  const info = new Map(ings.map((i) => [String(i._id), i]));
  const m = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const C = m(cons), W = m(waste), B = m(buys);
  const ids = new Set([...C.keys(), ...W.keys(), ...B.keys()]);
  const byIngredient = [...ids].map((id) => ({
    ingredientId: id, name: info.get(id)?.name || 'Unknown', unit: info.get(id)?.unit || '', category: info.get(id)?.category || '',
    purchasedQty: r3(B.get(id)?.qty || 0), purchasedCost: r2(B.get(id)?.cost || 0),
    usedQty: r3(C.get(id)?.qty || 0), usedCost: r2(C.get(id)?.cost || 0),
    wastedQty: r3(W.get(id)?.qty || 0), wastedCost: r2(W.get(id)?.cost || 0),
  })).sort((a, b) => b.usedCost - a.usedCost);

  const CD = new Map(consDay.map((r) => [ymd(r._id), r])), WD = new Map(wasteDay.map((r) => [ymd(r._id), r])), BD = new Map(buyDay.map((r) => [ymd(r._id), r]));
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = ymd(d), c = CD.get(k), w = WD.get(k), b = BD.get(k);
    const usedCost = r2(c?.cost || 0);
    days.push({ date: k, meals: c?.meals ?? null, purchaseCost: r2(b?.cost || 0), usedCost, wasteCost: r2(w?.cost || 0), costPerMeal: c?.meals ? r2(usedCost / c.meals) : null });
  }
  const sum = (k) => r2(byIngredient.reduce((s, r) => s + r[k], 0));
  const usedCost = sum('usedCost'), wastedCost = sum('wastedCost');
  res.json({
    from: ymd(from), to: ymd(to), days, byIngredient,
    totals: { purchaseCost: sum('purchasedCost'), usedCost, wastedCost, wasteRate: usedCost + wastedCost ? r2((wastedCost / (usedCost + wastedCost)) * 100) : 0 },
  });
}));

export default router;
