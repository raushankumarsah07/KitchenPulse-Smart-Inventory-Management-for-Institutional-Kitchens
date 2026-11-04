import { useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { CalendarX2, Leaf, Salad, Trash2, Utensils, Bug } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../toast';
import { useChartColors } from '../charts';
import { longDate, money, qty, todayStr } from '../format';
import { Button, Card, CardHead, Empty, Field, Page, Pill, Skeleton, useFetch } from '../ui';

const REASONS = [['expired', 'Expired', CalendarX2], ['spoilage', 'Spoilage', Bug], ['over-preparation', 'Over-prepared', Utensils], ['other', 'Other', Salad]];

export default function Waste() {
  const toast = useToast();
  const c = useChartColors();
  const ings = useFetch(() => api.get('/ingredients'));
  const waste = useFetch(() => api.get('/waste?limit=100'));
  const [f, setF] = useState({ ingredientId: '', quantity: '', reason: 'expired', date: todayStr(), note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const list = ings.data || [];
  const sel = list.find((i) => i._id === f.ingredientId);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const byReason = REASONS.map(([k, label]) => ({ k, label, cost: (waste.data || []).filter((w) => w.reason === k).reduce((s, w) => s + w.cost, 0) }));
  const totalCost = byReason.reduce((s, r) => s + r.cost, 0);
  const palette = [c.danger, c.accent, c.violet, c.info];

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.ingredientId) er.ingredientId = 'Choose an ingredient';
    if (!(Number(f.quantity) > 0)) er.quantity = 'Enter a quantity above 0';
    setErrors(er); if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await api.post('/waste', { ...f, quantity: Number(f.quantity) });
      toast(`Recorded ${qty(f.quantity)} ${sel.unit} of ${sel.name} as waste`);
      setF({ ingredientId: '', quantity: '', reason: 'expired', date: todayStr(), note: '' });
      ings.reload(); waste.reload();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  const remove = async (w) => { try { await api.del(`/waste/${w._id}`); toast('Waste entry removed and stock restored'); waste.reload(); ings.reload(); } catch (e) { toast(e.message, 'error'); } };

  return (
    <Page title="Food waste" subtitle="Record what is thrown away and why. The cost of waste is worked out from the batches it came from.">
      <div className="grid g-side">
        <div className="stack">
          <Card>
            <CardHead title="Record waste" />
            <form className="form-grid" onSubmit={submit} noValidate>
              <Field className="full" label="Ingredient" error={errors.ingredientId}>
                <select className="select" value={f.ingredientId} onChange={set('ingredientId')}><option value="">Select…</option>{list.map((i) => <option key={i._id} value={i._id}>{i.name} · {qty(i.quantity)} {i.unit} in stock</option>)}</select>
              </Field>
              <Field label={`Quantity${sel ? ` (${sel.unit})` : ''}`} error={errors.quantity}><input className="input" type="number" min="0" step="any" value={f.quantity} onChange={set('quantity')} placeholder="0" /></Field>
              <Field label="Date"><input className="input" type="date" max={todayStr()} value={f.date} onChange={set('date')} /></Field>
              <div className="full field"><label>Reason</label>
                <div className="reason-grid">{REASONS.map(([k, label, I]) => <button type="button" key={k} className={`reason ${f.reason === k ? 'on' : ''}`} onClick={() => setF((s) => ({ ...s, reason: k }))}><I size={18} />{label}</button>)}</div>
              </div>
              <Field className="full" label="Note"><input className="input" value={f.note} onChange={set('note')} placeholder="Optional" /></Field>
              <div className="full"><Button type="submit" loading={saving} style={{ width: '100%', padding: 13 }}><Trash2 size={17} /> Record waste</Button></div>
            </form>
          </Card>
          <Card>
            <CardHead title="Where the money goes" sub="From the last 100 entries" />
            {totalCost === 0 ? <Empty icon={Leaf} title="No waste recorded" text="That is a good problem to have." /> : (
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, alignItems: 'center' }}>
                <div style={{ height: 150, position: 'relative' }}><Doughnut options={{ responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.label}: ${money(x.parsed)}` } } } }}
                  data={{ labels: byReason.map((r) => r.label), datasets: [{ data: byReason.map((r) => r.cost), backgroundColor: palette, borderColor: c.surface, borderWidth: 3 }] }} /></div>
                <div style={{ display: 'grid', gap: 8 }}>{byReason.map((r, i) => <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span className="legend"><span><i style={{ background: palette[i] }} />{r.label}</span></span><b className="num">{money(r.cost)}</b></div>)}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Total</span><b className="num">{money(totalCost)}</b></div></div>
              </div>)}
          </Card>
        </div>
        <Card>
          <CardHead title="Waste log" sub="Deleting an entry puts the stock back" />
          {waste.loading && !waste.data ? <Skeleton h={200} /> : !waste.data?.length ? <Empty icon={Leaf} title="Nothing wasted" text="Entries you record will appear here." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Date</th><th>Ingredient</th><th className="r">Quantity</th><th>Reason</th><th className="r">Cost</th><th /></tr></thead>
              <tbody>{waste.data.map((w) => (
                <tr key={w._id}><td className="num">{longDate(w.date)}</td><td><div className="ing-name">{w.ingredient?.name}</div>{w.note && <div className="ing-sub">{w.note}</div>}</td><td className="r num">{qty(w.quantity)} {w.ingredient?.unit}</td>
                  <td><Pill tone={w.reason === 'expired' ? 'out' : w.reason === 'spoilage' ? 'low' : 'info'}>{REASONS.find((r) => r[0] === w.reason)?.[1]}</Pill></td><td className="r num">{money(w.cost, 2)}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-danger btn-icon btn-sm" aria-label="Delete entry" onClick={() => remove(w)}><Trash2 size={15} /></button></td></tr>))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
    </Page>
  );
}
