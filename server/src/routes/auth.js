import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models.js';
import { HttpError, wrap } from '../utils.js';
import { validate } from '../validate.js';
import { auth, signToken } from '../middleware/auth.js';

const router = Router();
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post('/register', wrap(async (req, res) => {
  const d = validate(z.object({ name: z.string().trim().min(2, 'Please enter your name').max(60), email: z.string().trim().email('Enter a valid email'), password: z.string().min(8, 'Password must be at least 8 characters').max(100) }), req.body);
  if (await User.exists({ email: d.email.toLowerCase() })) throw new HttpError(409, 'An account with this email already exists.');
  const first = (await User.countDocuments()) === 0; // the first account becomes the kitchen manager
  const user = await User.create({ name: d.name, email: d.email, passwordHash: await bcrypt.hash(d.password, 10), role: first ? 'manager' : 'staff' });
  res.status(201).json({ token: signToken(user), user: pub(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const d = validate(z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') }), req.body);
  const user = await User.findOne({ email: d.email.toLowerCase() });
  if (!user || !(await bcrypt.compare(d.password, user.passwordHash))) throw new HttpError(401, 'Incorrect email or password.');
  res.json({ token: signToken(user), user: pub(user) });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  res.json({ user: pub(user) });
}));

export default router;
