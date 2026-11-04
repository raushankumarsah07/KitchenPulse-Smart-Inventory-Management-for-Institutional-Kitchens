import { Router } from 'express';
import { z } from 'zod';
import { Batch, Ingredient } from '../models.js';
import { HttpError, parseDay, today, wrap } from '../utils.js';
import { validate } from '../validate.js';

const router = Router();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date');
const schema = z.object({
  ingredientId: z.string().min(1, 'Choose an ingredient'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitCost: z.coerce.number().min(0).optional(),
  expiryDate: z.preprocess((v) => (v === '' ? null : v), day.nullable().optional()),
  supplier: z.string().trim().max(80).optional(),
  date: day.optional(),
});

router.get('/', wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await Batch.find().sort({ purchasedAt: -1, createdAt: -1 }).limit(limit).populate('ingredient', 'name unit').lean());
}));

router.post('/', wrap(async (req, res) => {
  const d = validate(schema, req.body);
  const ing = await Ingredient.findOne({ _id: d.ingredientId, archived: false });
  if (!ing) throw new HttpError(404, 'Ingredient not found.');
  const purchasedAt = d.date ? parseDay(d.date) : today();
  const expiryDate = d.expiryDate ? parseDay(d.expiryDate) : null;
  if (expiryDate && expiryDate < purchasedAt) throw new HttpError(400, 'Expiry date cannot be before the purchase date.');
  const unitCost = d.unitCost ?? ing.unitCost;
  const batch = await Batch.create({ ingredient: ing._id, quantity: d.quantity, remaining: d.quantity, unitCost, supplier: d.supplier ?? ing.supplier, purchasedAt, expiryDate, createdBy: req.user.id });
  if (d.unitCost != null) await Ingredient.updateOne({ _id: ing._id }, { unitCost });
  res.status(201).json(batch);
}));

router.delete('/:id', wrap(async (req, res) => {
  const b = await Batch.findById(req.params.id);
  if (!b) throw new HttpError(404, 'Purchase not found.');
  if (b.remaining < b.quantity) throw new HttpError(409, 'This stock has already been used, so the purchase cannot be deleted.');
  await b.deleteOne();
  res.json({ ok: true });
}));

export default router;
