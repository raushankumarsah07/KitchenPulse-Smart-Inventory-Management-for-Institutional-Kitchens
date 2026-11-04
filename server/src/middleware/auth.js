import jwt from 'jsonwebtoken';
import { HttpError } from '../utils.js';

export const signToken = (user) =>
  jwt.sign({ id: String(user._id), role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

export function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please sign in to continue.'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
}

export const requireManager = (req, _res, next) =>
  req.user?.role === 'manager' ? next() : next(new HttpError(403, 'Only the kitchen manager can do this.'));
