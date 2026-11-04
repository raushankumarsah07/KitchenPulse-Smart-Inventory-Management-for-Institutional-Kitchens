import { Router } from 'express';
import { z } from 'zod';
import { Batch, Consumption, Ingredient, UNITS } from '../models.js';
import { HttpError, addDays, r2, r3, today, wrap } from '../utils.js';
import { validate } from '../validate.js';
import { requireManager } from '../middleware/auth.js';
import { stockSummary } from '../services/stock.js';

const router = Router();
const optNum = z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().min(1).nullable());
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  category: z.string().trim().max(40).default('Other'),
  unit: z.enum(UNITS, { errorMap: () => ({ message: 'Choose a unit' }) }),
  minStock: z.coerce.number().min(0, 'Minimum stock cannot be negative').default(0),
  unitCost: z.coerce.number().min(0, 'Cost cannot be negative').default(0),
  supplier: z.string().trim().max(80).default(''),
  shelfLifeDays: optNum.optional(),
});

router.get('/', wrap(async (_req, res) => {
  const from = addDays(today(), -13);
  const [items, stock, usage] = await Promise.all([
    Ingredient.find({ archived: false }).sort('name').lean(),
    stockSummary(),
    Consumption.aggregate([{ $match: { date: { $gte: from } } }, { $group: { _id: '$ingredient', total: { $sum: '$quantity' } } }]),
  ]);
  const use = new Map(usage.map((u) => [String(u._id), u.total / 14]));
  res.json(items.map((i) => {
    const s = stock.get(String(i._id));
    const usable = r3((s?.quantity || 0) - (s?.expiredQty || 0));
    const avg = use.get(String(i._id)) || 0;
    return { ...i, quantity: r3(s?.quantity || 0), usable, expiredQty: r3(s?.expiredQty || 0), value: r2(s?.value || 0),
      nextExpiry: s?.nextExpiry || null, avgDailyUse: r3(avg), daysLeft: avg > 0 ? r2(usable / avg) : null,
      status: usable <= 0 ? 'out' : usable < i.minStock ? 'low' : 'ok' };
  }));
}));

router.post('/', wrap(async (req, res) => {
  const d = validate(schema, req.body);
  if (await Ingredient.exists({ archived: false, name: new RegExp(`^${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }))
    throw new HttpError(409, `"${d.name}" already exists in your inventory.`);
  res.status(201).json(await Ingredient.create(d));
}));

router.patch('/:id', wrap(async (req, res) => {
  const d = validate(schema.partial(), req.body);
  const doc = await Ingredient.findOneAndUpdate({ _id: req.params.id, archived: false }, d, { new: true, runValidators: true });
  if (!doc) throw new HttpError(404, 'Ingredient not found.');
  res.json(doc);
}));

/** Archive instead of delete so past usage and reports stay correct. */
router.delete('/:id', requireManager, wrap(async (req, res) => {
  const doc = await Ingredient.findByIdAndUpdate(req.params.id, { archived: true });
  if (!doc) throw new HttpError(404, 'Ingredient not found.');
  res.json({ ok: true });
}));

router.get('/:id/batches', wrap(async (req, res) => {
  const batches = await Batch.find({ ingredient: req.params.id, remaining: { $gt: 0 } }).lean();
  batches.sort((a, b) => (a.expiryDate ? +new Date(a.expiryDate) : Infinity) - (b.expiryDate ? +new Date(b.expiryDate) : Infinity));
  res.json(batches);
}));

export default router;
