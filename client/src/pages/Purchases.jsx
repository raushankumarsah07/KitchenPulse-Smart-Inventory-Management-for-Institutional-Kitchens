import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBasket, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../toast';
import { addDaysStr, longDate, money, qty, todayStr } from '../format';
import { Button, Card, CardHead, Empty, Field, Page, Pill, Skeleton, useFetch } from '../ui';

export default function Purchases() {
  const toast = useToast();
  const ings = useFetch(() => api.get('/ingredients'));
  const buys = useFetch(() => api.get('/purchases?limit=60'));
  const [f, setF] = useState({ ingredientId: '', quantity: '', unitCost: '', date: todayStr(), expiryDate: '', supplier: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const list = ings.data || [];
  const sel = list.find((i) => i._id === f.ingredientId);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  // pick ingredient → prefill cost, supplier and expiry from its shelf life
  useEffect(() => {
    if (!sel) return;
    setF((s) => ({ ...s, unitCost: s.unitCost === '' ? sel.unitCost : s.unitCost, supplier: sel.supplier || '', expiryDate: sel.shelfLifeDays ? addDaysStr(s.date, sel.shelfLifeDays) : '' }));
  }, [f.ingredientId]); // eslint-disable-line
  useEffect(() => { if (sel?.shelfLifeDays) setF((s) => ({ ...s, expiryDate: addDaysStr(s.date, sel.shelfLifeDays) })); }, [f.date]); // eslint-disable-line

  const total = (Number(f.quantity) || 0) * (Number(f.unitCost) || 0);
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.ingredientId) er.ingredientId = 'Choose an ingredient';
    if (!(Number(f.quantity) > 0)) er.quantity = 'Enter a quantity above 0';
    if (f.expiryDate && f.expiryDate < f.date) er.expiryDate = 'Expiry is before the purchase date';
    setErrors(er); if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await api.post('/purchases', { ingredientId: f.ingredientId, quantity: Number(f.quantity), unitCost: f.unitCost === '' ? undefined : Number(f.unitCost), date: f.date, expiryDate: f.expiryDate, supplier: f.supplier });
      toast(`${qty(f.quantity)} ${sel.unit} of ${sel.name} added to stock`);
      setF({ ingredientId: '', quantity: '', unitCost: '', date: todayStr(), expiryDate: '', supplier: '' });
      ings.reload(); buys.reload();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  const remove = async (b) => {
    try { await api.del(`/purchases/${b._id}`); toast('Purchase removed'); buys.reload(); ings.reload(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <Page title="Purchases" subtitle="Record what arrives in the kitchen. Each purchase becomes a batch with its own expiry date.">
      <div className="grid g-side">
        <Card className="stack" style={{ alignSelf: 'start' }}>
          <CardHead title="Record a purchase" sub="Stock updates instantly" />
          <form className="form-grid" onSubmit={submit} noValidate>
            <Field className="full" label="Ingredient" error={errors.ingredientId}>
              <select className="select" value={f.ingredientId} onChange={set('ingredientId')}><option value="">Select…</option>{list.map((i) => <option key={i._id} value={i._id}>{i.name} ({i.unit})</option>)}</select>
            </Field>
            <Field label={`Quantity${sel ? ` (${sel.unit})` : ''}`} error={errors.quantity}><input className="input" type="number" min="0" step="any" value={f.quantity} onChange={set('quantity')} placeholder="0" /></Field>
            <Field label="Cost per unit (₹)"><input className="input" type="number" min="0" step="any" value={f.unitCost} onChange={set('unitCost')} placeholder="0" /></Field>
            <Field label="Purchase date"><input className="input" type="date" max={todayStr()} value={f.date} onChange={set('date')} /></Field>
            <Field label="Expiry date" error={errors.expiryDate} hint={sel?.shelfLifeDays ? `Auto-set from ${sel.shelfLifeDays}-day shelf life` : 'Optional'}><input className="input" type="date" value={f.expiryDate} onChange={set('expiryDate')} /></Field>
            <Field className="full" label="Supplier"><input className="input" value={f.supplier} onChange={set('supplier')} placeholder="Optional" /></Field>
            <motion.div className="full" animate={{ opacity: total > 0 ? 1 : 0.5 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 14, background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 600 }}>
              <span>Total cost</span><span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{money(total, 2)}</span>
            </motion.div>
            <div className="full"><Button type="submit" loading={saving} style={{ width: '100%', padding: 13 }}><ShoppingBasket size={17} /> Add to stock</Button></div>
          </form>
        </Card>
        <Card>
          <CardHead title="Recent purchases" sub="Newest first" />
          {buys.loading && !buys.data ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={50} />)}</div>
            : !buys.data?.length ? <Empty icon={ShoppingBasket} title="No purchases yet" text="Record your first delivery to see it here." />
            : (
            <div className="table-wrap"><table>
              <thead><tr><th>Date</th><th>Ingredient</th><th className="r">Quantity</th><th className="r">Cost</th><th>Expiry</th><th /></tr></thead>
              <tbody>{buys.data.map((b) => (
                <tr key={b._id}>
                  <td className="num">{longDate(b.purchasedAt)}</td>
                  <td><div className="ing-name">{b.ingredient?.name}</div><div className="ing-sub">{b.supplier}</div></td>
                  <td className="r num">{qty(b.quantity)} {b.ingredient?.unit}</td>
                  <td className="r num">{money(b.quantity * b.unitCost)}</td>
                  <td>{b.expiryDate ? <Pill tone={new Date(b.expiryDate) < new Date(new Date().toDateString()) ? 'out' : 'info'}>{longDate(b.expiryDate)}</Pill> : <span className="ing-sub">none</span>}</td>
                  <td style={{ textAlign: 'right' }}>{b.remaining === b.quantity && <button className="btn btn-danger btn-icon btn-sm" aria-label="Delete purchase" onClick={() => remove(b)}><Trash2 size={15} /></button>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
    </Page>
  );
}
