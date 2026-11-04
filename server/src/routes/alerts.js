import { Router } from 'express';
import { wrap } from '../utils.js';
import { buildAlerts } from '../services/alerts.js';
const router = Router();
router.get('/', wrap(async (_req, res) => res.json(await buildAlerts())));
export default router;
