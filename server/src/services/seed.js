import mongoose from 'mongoose';
import { Batch, Consumption, Ingredient, Waste } from '../models.js';
import { addDays, r3, today } from '../utils.js';

const CATALOG = [
  { name: 'Rice', category: 'Grains', unit: 'kg', unitCost: 58, perMeal: 0.12, shelf: 365, supplier: 'Annapurna Traders' },
  { name: 'Wheat Flour (Atta)', category: 'Grains', unit: 'kg', unitCost: 42, perMeal: 0.07, shelf: 120, supplier: 'Annapurna Traders' },
  { name: 'Toor Dal', category: 'Pulses', unit: 'kg', unitCost: 130, perMeal: 0.03, shelf: 365, supplier: 'Annapurna Traders' },
  { name: 'Tomatoes', category: 'Vegetables', unit: 'kg', unitCost: 35, perMeal: 0.04, shelf: 5, supplier: 'Fresh Farms Mandi' },
  { name: 'Onions', category: 'Vegetables', unit: 'kg', unitCost: 30, perMeal: 0.04, shelf: 20, supplier: 'Fresh Farms Mandi' },
  { name: 'Potatoes', category: 'Vegetables', unit: 'kg', unitCost: 28, perMeal: 0.05, shelf: 25, supplier: 'Fresh Farms Mandi' },
  { name: 'Milk', category: 'Dairy', unit: 'L', unitCost: 54, perMeal: 0.06, shelf: 2, supplier: 'Nandini Dairy' },
  { name: 'Curd', category: 'Dairy', unit: 'kg', unitCost: 70, perMeal: 0.03, shelf: 4, supplier: 'Nandini Dairy' },
  { name: 'Cooking Oil', category: 'Oils', unit: 'L', unitCost: 135, perMeal: 0.012, shelf: 180, supplier: 'Sri Lakshmi Stores' },
  { name: 'Eggs', category: 'Protein', unit: 'pcs', unitCost: 7, perMeal: 0.25, shelf: 14, supplier: 'Poultry Hub' },
  { name: 'Sugar', category: 'Pantry', unit: 'kg', unitCost: 46, perMeal: 0.012, shelf: 365, supplier: 'Sri Lakshmi Stores' },
  { name: 'Turmeric Powder', category: 'Spices', unit: 'kg', unitCost: 180, perMeal: 0.0012, shelf: 365, supplier: 'Sri Lakshmi Stores' },
];
const MEALS_BY_DOW = [220, 500, 520, 510, 500, 490, 380]; // Sun..Sat
const dowFactor = (name, dow) => (name === 'Eggs' ? ([3, 6].includes(dow) ? 1.7 : 0.6) : name === 'Milk' && dow === 0 ? 0.8 : 1);

function rngFactory(seed) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Builds ~90 days of clearly labelled SYNTHETIC history (all records flagged isDemo). */
export async function seedDemo(userId, days = 90) {
  const rng = rngFactory(42);
  const end = today();
  const start = addDays(end, -days);
  const ingDocs = await Ingredient.insertMany(CATALOG.map((c) => ({
    name: c.name, category: c.category, unit: c.unit, unitCost: c.unitCost, supplier: c.supplier, shelfLifeDays: c.shelf,
    minStock: r3(c.perMeal * 430 * 1.5), isDemo: true,
  })));
  const batchesOut = [], consOut = [], wasteOut = [];

  CATALOG.forEach((c, idx) => {
    const ing = ingDocs[idx];
    const batches = [];
    const sorted = () => batches.filter((b) => b.remaining > 1e-6).sort((a, b) => (a.expiry?.getTime() ?? Infinity) - (b.expiry?.getTime() ?? Infinity));
    const take = (qty, date, includeExpired) => {
      const allocations = []; let need = qty, cost = 0;
      for (const b of sorted()) {
        if (!includeExpired && b.expiry && b.expiry < date) continue;
        if (need <= 1e-9) break;
        const t = Math.min(b.remaining, need);
        b.remaining -= t; need -= t; cost += t * b.unitCost;
        allocations.push({ batch: b._id, quantity: r3(t), cost: r3(t * b.unitCost) });
      }
      return { allocations, got: qty - need, cost: r3(cost) };
    };
    for (let d = 0; d < days; d++) {
      const date = addDays(start, d);
      const dow = date.getUTCDay();
      const meals = Math.round(MEALS_BY_DOW[dow] * (1 + (rng() - 0.5) * 0.1));
      // expired stock is written off
      for (const b of batches) {
        if (b.remaining > 1e-6 && b.expiry && b.expiry < date) {
          wasteOut.push({ ingredient: ing._id, quantity: r3(b.remaining), reason: 'expired', date, cost: r3(b.remaining * b.unitCost), allocations: [{ batch: b._id, quantity: r3(b.remaining), cost: r3(b.remaining * b.unitCost) }], isDemo: true, createdBy: userId });
          b.remaining = 0;
        }
      }
      // restock when usable stock is under ~1.5 days
      const usable = batches.filter((b) => !b.expiry || b.expiry >= date).reduce((s, b) => s + b.remaining, 0);
      const avg = c.perMeal * 430;
      const skipBuy = ['Tomatoes', 'Milk', 'Onions'].includes(c.name) && d >= days - 2; // keeps a few live alerts in the demo
      if (usable < avg * 1.5 && !skipBuy) {
        const cover = Math.min(7, Math.max(2, Math.floor(c.shelf * 0.7)));
        const qty = r3(avg * cover * (rng() < 0.12 ? 1.5 : 1.05));
        const price = r3(c.unitCost * (1 + (rng() - 0.5) * 0.1));
        const b = { _id: new mongoose.Types.ObjectId(), quantity: qty, remaining: qty, unitCost: price, purchasedAt: date, expiry: addDays(date, c.shelf) };
        batches.push(b);
      }
      // cooking
      const want = c.perMeal * meals * dowFactor(c.name, dow) * (1 + (rng() - 0.5) * 0.12);
      const used = take(r3(want), date, false);
      if (used.got > 0) consOut.push({ ingredient: ing._id, quantity: r3(used.got), date, mealsServed: meals, cost: used.cost, allocations: used.allocations, isDemo: true, createdBy: userId });
      // occasional spoilage / over-preparation
      const roll = rng();
      if (roll < 0.05 && c.shelf <= 25) {
        const w = take(r3(want * (0.05 + rng() * 0.08)), date, false);
        if (w.got > 0) wasteOut.push({ ingredient: ing._id, quantity: r3(w.got), reason: 'spoilage', date, cost: w.cost, allocations: w.allocations, isDemo: true, createdBy: userId });
      } else if (roll > 0.93) {
        const w = take(r3(want * (0.04 + rng() * 0.06)), date, false);
        if (w.got > 0) wasteOut.push({ ingredient: ing._id, quantity: r3(w.got), reason: 'over-preparation', date, cost: w.cost, allocations: w.allocations, isDemo: true, createdBy: userId });
      }
    }
    for (const b of batches) batchesOut.push({ _id: b._id, ingredient: ing._id, quantity: b.quantity, remaining: r3(Math.max(0, b.remaining)), unitCost: b.unitCost, supplier: c.supplier, purchasedAt: b.purchasedAt, expiryDate: b.expiry, isDemo: true, createdBy: userId });
  });
  await Batch.insertMany(batchesOut); await Consumption.insertMany(consOut); await Waste.insertMany(wasteOut);
  return { ingredients: ingDocs.length, purchases: batchesOut.length, usageRecords: consOut.length, wasteRecords: wasteOut.length };
}

export async function clearDemo() {
  const ids = (await Ingredient.find({ isDemo: true }).select('_id').lean()).map((i) => i._id);
  const match = { $or: [{ isDemo: true }, { ingredient: { $in: ids } }] };
  await Promise.all([Batch.deleteMany(match), Consumption.deleteMany(match), Waste.deleteMany(match)]);
  await Ingredient.deleteMany({ isDemo: true });
}
