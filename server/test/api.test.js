// End-to-end API test. Needs MongoDB running; the forecast step also uses the Python ML service
// (it falls back gracefully if that service is down).   Run:  npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const { createApp } = await import('../src/index.js');

let server, base, token, staffToken;
const call = async (method, path, body, tk = token) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(tk && { Authorization: `Bearer ${tk}` }) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const iso = (offset) => new Date(Date.now() + offset * 86400000 + 330 * 60000).toISOString().slice(0, 10);

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/smart_kitchen_test');
  await mongoose.connection.dropDatabase();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); });

test('auth: first user is manager, validation and login work', async () => {
  let r = await call('POST', '/api/auth/register', { name: 'Asha', email: 'asha@mess.in', password: 'short' }, null);
  assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/register', { name: 'Asha', email: 'asha@mess.in', password: 'password123' }, null);
  assert.equal(r.status, 201); assert.equal(r.body.user.role, 'manager'); token = r.body.token;
  r = await call('POST', '/api/auth/register', { name: 'Ravi', email: 'ravi@mess.in', password: 'password123' }, null);
  assert.equal(r.body.user.role, 'staff'); staffToken = r.body.token;
  assert.equal((await call('POST', '/api/auth/login', { email: 'asha@mess.in', password: 'wrongpass' }, null)).status, 401);
  assert.equal((await call('GET', '/api/ingredients', null, null)).status, 401);
});

let rice;
test('inventory + FIFO stock handling', async () => {
  let r = await call('POST', '/api/ingredients', { name: 'Rice', category: 'Grains', unit: 'kg', minStock: 20, unitCost: 60 });
  assert.equal(r.status, 201); rice = r.body._id;
  assert.equal((await call('POST', '/api/ingredients', { name: 'rice', unit: 'kg' })).status, 409);
  // later-expiring batch bought first, earlier-expiring second: FIFO must use the earlier expiry first
  await call('POST', '/api/purchases', { ingredientId: rice, quantity: 20, unitCost: 60, expiryDate: iso(60), date: iso(-5) });
  await call('POST', '/api/purchases', { ingredientId: rice, quantity: 10, unitCost: 50, expiryDate: iso(20), date: iso(-2) });
  let list = (await call('GET', '/api/ingredients')).body;
  assert.equal(list[0].quantity, 30); assert.equal(list[0].status, 'ok');
  r = await call('POST', '/api/consumption', { date: iso(0), mealsServed: 400, items: [{ ingredientId: rice, quantity: 12 }] });
  assert.equal(r.status, 201);
  const batches = (await call('GET', `/api/ingredients/${rice}/batches`)).body;
  // FIFO: the early-expiring 10 kg batch is used up first, then 2 kg comes from the later batch
  assert.equal(batches.length, 1); assert.equal(batches[0].remaining, 18);
  r = await call('POST', '/api/consumption', { items: [{ ingredientId: rice, quantity: 500 }] });
  assert.equal(r.status, 400); assert.match(r.body.error, /Only 18/);
  list = (await call('GET', '/api/ingredients')).body;
  assert.equal(list[0].quantity, 18); assert.equal(list[0].status, 'low');
});

test('waste, undo and alerts', async () => {
  let r = await call('POST', '/api/waste', { ingredientId: rice, quantity: 3, reason: 'spoilage' });
  assert.equal(r.status, 201); assert.ok(r.body.cost > 0);
  assert.equal((await call('GET', '/api/ingredients')).body[0].quantity, 15);
  await call('DELETE', `/api/waste/${r.body._id}`);
  assert.equal((await call('GET', '/api/ingredients')).body[0].quantity, 18);
  const alerts = (await call('GET', '/api/alerts')).body;
  assert.ok(alerts.some((a) => a.type === 'low' && a.name === 'Rice'));
  assert.equal((await call('DELETE', `/api/ingredients/${rice}`, null, staffToken)).status, 403);
  const rep = (await call('GET', `/api/reports?from=${iso(-7)}&to=${iso(0)}`)).body;
  assert.ok(rep.totals.usedCost > 0); assert.equal(rep.byIngredient[0].usedQty, 12);
});

test('demo data, dashboard and forecast', async () => {
  await call('DELETE', `/api/ingredients/${rice}`);
  await mongoose.connection.db.dropDatabase();
  let r = await call('POST', '/api/auth/register', { name: 'Mgr', email: 'm@x.in', password: 'password123' }, null);
  token = r.body.token;
  r = await call('POST', '/api/demo/seed');
  assert.equal(r.status, 201); assert.equal(r.body.ingredients, 12);
  assert.equal((await call('POST', '/api/demo/seed')).status, 409);
  const dash = (await call('GET', '/api/dashboard')).body;
  assert.equal(dash.hasData, true); assert.equal(dash.series.length, 14); assert.ok(dash.stats.stockValue > 0);
  const ings = (await call('GET', '/api/ingredients')).body;
  assert.ok(ings.every((i) => i.quantity >= 0));
  const f = await call('POST', '/api/forecast', { ingredientId: ings.find((i) => i.name === 'Rice')._id, horizon: 7, pendingQty: 0, safetyPct: 10 });
  assert.equal(f.status, 200); assert.equal(f.body.predictions.length, 7);
  assert.ok(f.body.suggestion.toBuy >= 0); assert.ok(['ml-service', 'fallback'].includes(f.body.source));
  console.log('   forecast source:', f.body.source, '| best model:', f.body.best, '| buy:', f.body.suggestion.toBuy);
  await call('DELETE', '/api/demo');
  assert.equal((await call('GET', '/api/ingredients')).body.length, 0);
});
