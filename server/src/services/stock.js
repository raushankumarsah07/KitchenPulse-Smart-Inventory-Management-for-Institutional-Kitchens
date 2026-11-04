import { Batch } from '../models.js';
import { HttpError, r3, today } from '../utils.js';

/** Per-ingredient stock totals computed from live batches. */
export async function stockSummary() {
  const now = today();
  const rows = await Batch.aggregate([
    { $match: { remaining: { $gt: 0 } } },
    { $group: {
      _id: '$ingredient',
      quantity: { $sum: '$remaining' },
      value: { $sum: { $multiply: ['$remaining', '$unitCost'] } },
      expiredQty: { $sum: { $cond: [{ $and: [{ $ne: ['$expiryDate', null] }, { $lt: ['$expiryDate', now] }] }, '$remaining', 0] } },
      nextExpiry: { $min: { $cond: [{ $and: [{ $ne: ['$expiryDate', null] }, { $gte: ['$expiryDate', now] }] }, '$expiryDate', null] } },
    } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

const expiryKey = (b) => (b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity);

/**
 * First-expiring-first-out deduction. `includeExpired=false` is used for cooking
 * (expired stock must not be used); waste entries may consume expired stock.
 * Returns the allocations so the action can be reversed exactly.
 */
export async function deduct(ingredientId, quantity, { includeExpired = false } = {}) {
  const now = today();
  let batches = await Batch.find({ ingredient: ingredientId, remaining: { $gt: 0 } }).lean();
  if (!includeExpired) batches = batches.filter((b) => !b.expiryDate || new Date(b.expiryDate) >= now);
  batches.sort((a, b) => expiryKey(a) - expiryKey(b) || new Date(a.purchasedAt) - new Date(b.purchasedAt));

  const available = r3(batches.reduce((s, b) => s + b.remaining, 0));
  if (quantity > available + 1e-9) {
    throw new HttpError(400, `Only ${available} available in usable stock.`, { available });
  }
  const plan = [];
  let need = quantity;
  for (const b of batches) {
    if (need <= 1e-9) break;
    const take = Math.min(b.remaining, need);
    plan.push({ batch: b._id, quantity: r3(take), cost: r3(take * b.unitCost) });
    need -= take;
  }
  const done = [];
  for (const a of plan) {
    const res = await Batch.updateOne({ _id: a.batch, remaining: { $gte: a.quantity } }, { $inc: { remaining: -a.quantity } });
    if (res.modifiedCount !== 1) {
      await restore(done); // someone else changed the batch meanwhile
      throw new HttpError(409, 'Stock changed while saving. Please try again.');
    }
    done.push(a);
  }
  return { allocations: plan, cost: r3(plan.reduce((s, a) => s + a.cost, 0)) };
}

export async function restore(allocations = []) {
  for (const a of allocations) await Batch.updateOne({ _id: a.batch }, { $inc: { remaining: a.quantity } });
}
