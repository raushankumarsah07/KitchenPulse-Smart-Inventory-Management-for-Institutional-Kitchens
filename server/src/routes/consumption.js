import { Router } from 'express';
import { z } from 'zod';
import { Consumption, Ingredient } from '../models.js';
import { HttpError, parseDay, today, wrap } from '../utils.js';
import { validate } from '../validate.js';
import { deduct, restore } from '../services/stock.js';

const router = Router();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date');
const schema = z.object({
  date: day.optional(),
  mealsServed: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().min(0).nullable()).optional(),
  note: z.string().max(200).optional(),
  items: z.array(z.object({ ingredientId: z.string().min(1), quantity: z.coerce.number().positive('Quantity must be greater than 0') })).min(1, 'Add at least one ingredient'),
});

router.get('/', wrap(async (req, res) => {
  const q = {};
  if (req.query.from || req.query.to) q.date = { ...(req.query.from && { $gte: parseDay(req.query.from) }), ...(req.query.to && { $lte: parseDay(req.query.to) }) };
  if (req.query.ingredient) q.ingredient = req.query.ingredient;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  res.json(await Consumption.find(q).sort({ date: -1, createdAt: -1 }).limit(limit).populate('ingredient', 'name unit').select('-allocations').lean());
}));

router.post('/', wrap(async (req, res) => {
  const d = validate(schema, req.body);
  const date = d.date ? parseDay(d.date) : today();
  if (date > today()) throw new HttpError(400, 'Usage cannot be recorded for a future date.');
  const merged = new Map();
  for (const it of d.items) merged.set(it.ingredientId, (merged.get(it.ingredientId) || 0) + it.quantity);
  const done = [];
  try {
    for (const [ingredientId, quantity] of merged) {
      const ing = await Ingredient.findOne({ _id: ingredientId, archived: false });
      if (!ing) throw new HttpError(404, 'Ingredient not found.');
      try {
        const { allocations, cost } = await deduct(ing._id, quantity);
        done.push(await Consumption.create({ ingredient: ing._id, quantity, date, mealsServed: d.mealsServed ?? null, cost, allocations, note: d.note || '', createdBy: req.user.id }));
      } catch (e) {
        if (e instanceof HttpError) e.message = `${ing.name}: ${e.message}`;
        throw e;
      }
    }
  } catch (e) {
    for (const c of done) { await restore(c.allocations); await c.deleteOne(); }
    throw e;
  }
  res.status(201).json({ saved: done.length });
}));

router.delete('/:id', wrap(async (req, res) => {
  const c = await Consumption.findById(req.params.id);
  if (!c) throw new HttpError(404, 'Record not found.');
  await restore(c.allocations);
  await c.deleteOne();
  res.json({ ok: true });
}));

export default router;
