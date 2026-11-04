import { Router } from 'express';
import { z } from 'zod';
import { Ingredient, Waste, WASTE_REASONS } from '../models.js';
import { HttpError, parseDay, today, wrap } from '../utils.js';
import { validate } from '../validate.js';
import { deduct, restore } from '../services/stock.js';

const router = Router();
const schema = z.object({
  ingredientId: z.string().min(1, 'Choose an ingredient'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  reason: z.enum(WASTE_REASONS, { errorMap: () => ({ message: 'Choose a reason' }) }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(200).optional(),
});

router.get('/', wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  res.json(await Waste.find().sort({ date: -1, createdAt: -1 }).limit(limit).populate('ingredient', 'name unit').select('-allocations').lean());
}));

router.post('/', wrap(async (req, res) => {
  const d = validate(schema, req.body);
  const ing = await Ingredient.findOne({ _id: d.ingredientId, archived: false });
  if (!ing) throw new HttpError(404, 'Ingredient not found.');
  const date = d.date ? parseDay(d.date) : today();
  const { allocations, cost } = await deduct(ing._id, d.quantity, { includeExpired: true });
  const doc = await Waste.create({ ingredient: ing._id, quantity: d.quantity, reason: d.reason, date, cost, allocations, note: d.note || '', createdBy: req.user.id });
  res.status(201).json(doc);
}));

router.delete('/:id', wrap(async (req, res) => {
  const w = await Waste.findById(req.params.id);
  if (!w) throw new HttpError(404, 'Record not found.');
  await restore(w.allocations);
  await w.deleteOne();
  res.json({ ok: true });
}));

export default router;
