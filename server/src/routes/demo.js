import { Router } from 'express';
import { Ingredient } from '../models.js';
import { HttpError, wrap } from '../utils.js';
import { requireManager } from '../middleware/auth.js';
import { clearDemo, seedDemo } from '../services/seed.js';

const router = Router();
router.post('/seed', requireManager, wrap(async (req, res) => {
  if (await Ingredient.exists({})) throw new HttpError(409, 'Your kitchen already has ingredients. Remove them or clear demo data first.');
  res.status(201).json(await seedDemo(req.user.id));
}));
router.delete('/', requireManager, wrap(async (_req, res) => { await clearDemo(); res.json({ ok: true }); }));
export default router;
