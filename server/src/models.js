import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const opts = { timestamps: true };
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true, index: true });

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['manager', 'staff'], default: 'staff' },
}, opts));

export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs'];
export const WASTE_REASONS = ['expired', 'spoilage', 'over-preparation', 'other'];

export const Ingredient = model('Ingredient', new Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'Other', trim: true },
  unit: { type: String, enum: UNITS, required: true },
  minStock: { type: Number, default: 0, min: 0 },
  unitCost: { type: Number, default: 0, min: 0 },
  supplier: { type: String, default: '', trim: true },
  shelfLifeDays: { type: Number, default: null, min: 1 },
  archived: { type: Boolean, default: false },
  isDemo: { type: Boolean, default: false },
}, opts));

const Allocation = new Schema({ batch: Schema.Types.ObjectId, quantity: Number, cost: Number }, { _id: false });

/** A purchase = a stock batch. `remaining` shrinks as stock is used or wasted (first-expiring-first-out). */
export const Batch = model('Batch', new Schema({
  ingredient: ref('Ingredient'),
  quantity: { type: Number, required: true, min: 0 },
  remaining: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, default: 0, min: 0 },
  supplier: { type: String, default: '' },
  purchasedAt: { type: Date, required: true },
  expiryDate: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDemo: { type: Boolean, default: false },
}, opts));

export const Consumption = model('Consumption', new Schema({
  ingredient: ref('Ingredient'),
  quantity: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, index: true },
  mealsServed: { type: Number, default: null },
  cost: { type: Number, default: 0 },
  allocations: [Allocation],
  note: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDemo: { type: Boolean, default: false },
}, opts));

export const Waste = model('Waste', new Schema({
  ingredient: ref('Ingredient'),
  quantity: { type: Number, required: true, min: 0 },
  reason: { type: String, enum: WASTE_REASONS, required: true },
  date: { type: Date, required: true, index: true },
  cost: { type: Number, default: 0 },
  allocations: [Allocation],
  note: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDemo: { type: Boolean, default: false },
}, opts));
