import { useMemo, useState } from 'react';
import { ChefHat, Minus, Plus, Trash2, Wand2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../toast';
import { longDate, money, qty, todayStr } from '../format';
import { Button, Card, CardHead, Empty, Field, Page, Skeleton, useFetch } from '../ui';

const step = (u) => (u === 'pcs' ? 1 : 0.5);

export default function Usage() {
  const toast = useToast();
  const ings = useFetch(() => api.get('/ingredients'));
  const log = useFetch(() => api.get('/consumption?limit=40'));
  const [date, setDate] = useState(todayStr());
  const [meals, setMeals] = useState('');
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const list = (ings.data || []).filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  const filled = useMemo(() => Object.entries(vals).filter(([, v]) => Number(v) > 0), [vals]);
  const over = (i) => Number(vals[i._id]) > i.usable;
  const setV = (id, v) => setVals((s) => ({ ...s, [id]: v }));
  const bump = (i, dir) => setV(i._id, Math.max(0, Math.round(((Number(vals[i._id]) || 0) + dir * step(i.unit)) * 100) / 100));

  const autofill = () => {
    const next = {};
    (ings.data || []).forEach((i) => { if (i.avgDailyUse > 0) next[i._id] = Math.min(i.usable, Math.round(i.avgDailyUse * 10) / 10); });
    setVals(next); toast('Filled with each ingredient\'s 14-day daily average. Adjust as needed.');
  };
  const submit = async () => {
    if (!filled.length) return toast('Enter usage for at least one ingredient', 'error');
    setSaving(true);
    try {
      await api.post('/consumption', { date, mealsServed: meals === '' ? null : Number(meals), items: filled.map(([ingredientId, quantity]) => ({ ingredientId, quantity: Number(quantity) })) });
      toast(`Saved usage for ${filled.length} ingredient${filled.length > 1 ? 's' : ''}`);
      setVals({}); ings.reload(); log.reload();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const remove = async (r) => { try { await api.del(`/consumption/${r._id}`); toast('Usage entry removed and stock restored'); log.reload(); ings.reload(); } catch (e) { toast(e.message, 'error'); } };

  return (
    <Page title="Daily usage" subtitle="Log what the kitchen cooked with. Stock is deducted earliest-expiry first, and this history trains the forecast."
      actions={<Button variant="ghost" onClick={autofill}><Wand2 size={16} /> Fill typical day</Button>}>
      <Card>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 18 }}>
          <Field label="Date"><input className="input" type="date" max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Meals served" hint="Optional, improves cost-per-meal reports"><input className="input" type="number" min="0" value={meals} onChange={(e) => setMeals(e.target.value)} placeholder="e.g. 480" /></Field>
          <Field label="Find ingredient"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" /></Field>
        </div>
        {ings.loading && !ings.data ? <div className="usage-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={68} />)}</div>
          : !(ings.data || []).length ? <Empty icon={ChefHat} title="No ingredients yet" text="Add ingredients and record purchases first." />
          : (
          <div className="usage-grid">
            {list.map((i) => (
              <div key={i._id} className={`usage-row ${Number(vals[i._id]) > 0 ? 'filled' : ''}`}>
                <div style={{ minWidth: 0 }}>
                  <div className="ing-name">{i.name}</div>
                  <div className="ing-sub num">Usable: {qty(i.usable)} {i.unit}{over(i) && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · not enough stock</span>}</div>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => bump(i, -1)} aria-label="Decrease"><Minus size={15} /></button>
                  <input type="number" min="0" step="any" value={vals[i._id] ?? ''} placeholder="0" onChange={(e) => setV(i._id, e.target.value)} aria-label={`${i.name} used`} />
                  <button type="button" onClick={() => bump(i, 1)} aria-label="Increase"><Plus size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)' }}>{filled.length} ingredient{filled.length === 1 ? '' : 's'} to record</span>
          <Button loading={saving} disabled={!filled.length || (ings.data || []).some(over)} onClick={submit}><ChefHat size={17} /> Save today's usage</Button>
        </div>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <CardHead title="Recent usage" sub="Deleting an entry puts the stock back" />
        {log.loading && !log.data ? <Skeleton h={120} /> : !log.data?.length ? <Empty icon={ChefHat} title="Nothing recorded" text="Saved entries show up here." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Ingredient</th><th className="r">Used</th><th className="r">Meals</th><th className="r">Cost</th><th /></tr></thead>
            <tbody>{log.data.map((r) => (
              <tr key={r._id}><td className="num">{longDate(r.date)}</td><td className="ing-name">{r.ingredient?.name}</td><td className="r num">{qty(r.quantity)} {r.ingredient?.unit}</td><td className="r num">{r.mealsServed ?? '–'}</td><td className="r num">{money(r.cost, 2)}</td>
                <td style={{ textAlign: 'right' }}><button className="btn btn-danger btn-icon btn-sm" aria-label="Delete entry" onClick={() => remove(r)}><Trash2 size={15} /></button></td></tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </Page>
  );
}
