import { Router } from 'express';
import { z } from 'zod';
import { Ingredient } from '../models.js';
import { HttpError, wrap } from '../utils.js';
import { validate } from '../validate.js';
import { stockSummary } from '../services/stock.js';
import { buildSuggestion, callMl, dailySeries, fallbackForecast } from '../services/forecast.js';

const router = Router();
const schema = z.object({
  ingredientId: z.string().min(1, 'Choose an ingredient'),
  horizon: z.coerce.number().int().min(1).max(14).default(7),
  pendingQty: z.coerce.number().min(0).default(0),
  safetyPct: z.coerce.number().min(0).max(100).default(10),
});

router.post('/', wrap(async (req, res) => {
  const d = validate(schema, req.body);
  const ing = await Ingredient.findOne({ _id: d.ingredientId, archived: false }).lean();
  if (!ing) throw new HttpError(404, 'Ingredient not found.');
  const series = await dailySeries(ing._id);
  let result;
  try {
    result = await callMl(series, d.horizon);
  } catch (err) {
    console.warn('[forecast] ML service unavailable, using fallback:', err.message);
    result = fallbackForecast(series, d.horizon);
  }
  const s = (await stockSummary()).get(String(ing._id));
  const usable = (s?.quantity || 0) - (s?.expiredQty || 0);
  res.json({
    ingredient: { id: ing._id, name: ing.name, unit: ing.unit },
    history: series.slice(-30), ...result,
    suggestion: buildSuggestion({ predictions: result.predictions, usable, pending: d.pendingQty, safetyPct: d.safetyPct, unit: ing.unit }),
    trainedOnDays: series.length,
  });
}));

export default router;
