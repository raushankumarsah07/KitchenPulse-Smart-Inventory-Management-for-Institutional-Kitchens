import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { longDate, money, qty } from '../format';
import { Button, Card, Confirm, Drawer, Empty, Field, Page, Pill, Rise, Segmented, Skeleton, Stagger, useFetch } from '../ui';

const CATS = ['Grains', 'Pulses', 'Vegetables', 'Dairy', 'Oils', 'Protein', 'Spices', 'Pantry', 'Other'];
const blank = { name: '', category: 'Grains', unit: 'kg', minStock: '', unitCost: '', supplier: '', shelfLifeDays: '' };
const STATUS = { ok: ['ok', 'In stock'], low: ['low', 'Low'], out: ['out', 'Out'] };

function Batches({ id }) {
  const { data, loading } = useFetch(() => api.get(`/ingredients/${id}/batches`), [id]);
  if (loading) return <Skeleton h={48} />;
  if (!data?.length) return <div className="ing-sub">No stock batches yet. Record a purchase to add some.</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--faint)', fontWeight: 600 }}>Batches · used first to last</div>
      {data.map((b, i) => (
        <div key={b._id} style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 14 }}>
          <b style={{ color: 'var(--brand)' }}>#{i + 1}</b>
          <span className="num"><b>{qty(b.remaining)}</b> left of {qty(b.quantity)}</span>
          <span className="ing-sub">bought {longDate(b.purchasedAt)} at {money(b.unitCost, 2)}</span>
          <span style={{ marginLeft: 'auto' }}>{b.expiryDate ? (new Date(b.expiryDate) < new Date(new Date().toDateString()) ? <Pill tone="out">Expired {longDate(b.expiryDate)}</Pill> : <Pill tone="info">Expires {longDate(b.expiryDate)}</Pill>) : <Pill>No expiry</Pill>}</span>
        </div>
      ))}
    </div>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get('/ingredients'));
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [del, setDel] = useState(null);

  const items = data || [];
  const cats = useMemo(() => ['All', ...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter((i) => (cat === 'All' || i.category === cat) && (status === 'all' || (status === 'attention' ? i.status !== 'ok' : i.status === status)) && i.name.toLowerCase().includes(q.toLowerCase()));

  const openForm = (ing) => { setEdit(ing); setErrors({}); setForm(ing ? { name: ing.name, category: ing.category, unit: ing.unit, minStock: ing.minStock, unitCost: ing.unitCost, supplier: ing.supplier || '', shelfLifeDays: ing.shelfLifeDays ?? '' } : blank); setOpen(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.minStock !== '' && Number(form.minStock) < 0) e.minStock = 'Cannot be negative';
    if (form.unitCost !== '' && Number(form.unitCost) < 0) e.unitCost = 'Cannot be negative';
    setErrors(e); return !Object.keys(e).length;
  };
  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = { ...form, minStock: Number(form.minStock || 0), unitCost: Number(form.unitCost || 0), shelfLifeDays: form.shelfLifeDays === '' ? null : Number(form.shelfLifeDays) };
      edit ? await api.patch(`/ingredients/${edit._id}`, body) : await api.post('/ingredients', body);
      toast(edit ? `${form.name} updated` : `${form.name} added to inventory`);
      setOpen(false); reload();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <Page title="Inventory" subtitle="Every ingredient, its live stock, and how many days it will last at the current pace."
      actions={<Button onClick={() => openForm(null)}><Plus size={17} /> Add ingredient</Button>}>
      <Card>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <div className="input-wrap" style={{ flex: '1 1 240px', maxWidth: 360 }}><Search size={17} className="lead" /><input className="input" placeholder="Search ingredients…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Segmented id="inv-status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'attention', label: 'Needs attention' }, { value: 'ok', label: 'Healthy' }]} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {loading && !data ? <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={56} />)}</div>
          : error ? <Empty icon={Package} title="Could not load inventory" text={error} action={<Button onClick={reload}>Try again</Button>} />
          : items.length === 0 ? <Empty icon={Package} title="No ingredients yet" text="Add your first ingredient, then record a purchase to start tracking stock." action={<Button onClick={() => openForm(null)}><Plus size={16} /> Add ingredient</Button>} />
          : shown.length === 0 ? <Empty icon={Search} title="Nothing matches" text="Try a different search or filter." />
          : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ingredient</th><th style={{ width: '24%' }}>Usable stock</th><th>Lasts</th><th className="r">Min</th><th className="r">Value</th><th>Status</th><th /></tr></thead>
              <motion.tbody variants={{ show: { transition: { staggerChildren: 0.03 } } }} initial="hidden" animate="show">
                {shown.map((i) => {
                  const pct = Math.min(100, (i.usable / Math.max(i.minStock * 2, i.usable, 1)) * 100);
                  const [tone, label] = STATUS[i.status];
                  return (
                    <Fragment key={i._id}>
                      <motion.tr className="clickable" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} onClick={() => setExpanded(expanded === i._id ? null : i._id)}>
                        <td><div className="ing-name">{i.name}</div><div className="ing-sub">{i.category}{i.supplier ? ` · ${i.supplier}` : ''}</div></td>
                        <td>
                          <div className="num" style={{ fontWeight: 600, marginBottom: 6 }}>{qty(i.usable)} <span className="ing-sub">{i.unit}</span>{i.expiredQty > 0 && <span style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 6 }}>+{qty(i.expiredQty)} expired</span>}</div>
                          <div className={`bar ${i.status}`}><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} /></div>
                        </td>
                        <td className="num">{i.daysLeft == null ? <span className="ing-sub">n/a</span> : <b style={{ color: i.daysLeft < 2 ? 'var(--danger)' : 'inherit' }}>{i.daysLeft} days</b>}</td>
                        <td className="r num">{qty(i.minStock)}</td>
                        <td className="r num">{money(i.value)}</td>
                        <td><Pill tone={tone}>{label}</Pill></td>
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Edit" onClick={() => openForm(i)}><Pencil size={15} /></button>{' '}
                          {user.role === 'manager' && <button className="btn btn-danger btn-icon btn-sm" aria-label="Archive" onClick={() => setDel(i)}><Trash2 size={15} /></button>}{' '}
                          <motion.span animate={{ rotate: expanded === i._id ? 180 : 0 }} style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--faint)' }}><ChevronDown size={18} /></motion.span>
                        </td>
                      </motion.tr>
                      <AnimatePresence initial={false}>
                        {expanded === i._id && (
                          <tr><td colSpan={7} style={{ padding: 0, borderTop: 0 }}>
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
                              <div style={{ padding: '4px 12px 18px' }}><Batches id={i._id} /></div>
                            </motion.div>
                          </td></tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title={edit ? `Edit ${edit.name}` : 'Add ingredient'}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{edit ? 'Save changes' : 'Add ingredient'}</Button></>}>
        <div className="form-grid">
          <Field className="full" label="Name" error={errors.name}><input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Basmati Rice" autoFocus /></Field>
          <Field label="Category"><select className="select" value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Unit"><select className="select" value={form.unit} onChange={set('unit')}>{['kg', 'g', 'L', 'ml', 'pcs'].map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label={`Minimum stock (${form.unit})`} error={errors.minStock} hint="Alert fires below this level"><input className="input" type="number" min="0" step="any" value={form.minStock} onChange={set('minStock')} placeholder="0" /></Field>
          <Field label={`Cost per ${form.unit} (₹)`} error={errors.unitCost}><input className="input" type="number" min="0" step="any" value={form.unitCost} onChange={set('unitCost')} placeholder="0" /></Field>
          <Field label="Supplier"><input className="input" value={form.supplier} onChange={set('supplier')} placeholder="Optional" /></Field>
          <Field label="Shelf life (days)" hint="Auto-fills expiry on purchases"><input className="input" type="number" min="1" value={form.shelfLifeDays} onChange={set('shelfLifeDays')} placeholder="Optional" /></Field>
        </div>
      </Drawer>
      <Confirm open={!!del} title={`Archive ${del?.name}?`} text="It disappears from inventory and alerts, but its past usage stays in your reports." confirmLabel="Archive"
        onCancel={() => setDel(null)} onConfirm={async () => { try { await api.del(`/ingredients/${del._id}`); toast(`${del.name} archived`); setDel(null); reload(); } catch (e) { toast(e.message, 'error'); } }} />
    </Page>
  );
}
