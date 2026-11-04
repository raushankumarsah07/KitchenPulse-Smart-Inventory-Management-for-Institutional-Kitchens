import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { AlertTriangle, BrainCircuit, Info, Sparkles, Trophy } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../toast';
import { baseOptions, useChartColors } from '../charts';
import { qty, shortDate } from '../format';
import { AnimatedNumber, Button, Card, CardHead, Empty, Field, Page, Pill, Segmented, useFetch } from '../ui';

export default function Forecast() {
  const toast = useToast();
  const c = useChartColors();
  const ings = useFetch(() => api.get('/ingredients'));
  const [id, setId] = useState('');
  const [horizon, setHorizon] = useState(7);
  const [pending, setPending] = useState('');
  const [safety, setSafety] = useState(10);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = ings.data || [];
  const sel = list.find((i) => i._id === id);
  useEffect(() => { if (!id && list.length) setId(list[0]._id); }, [list, id]);

  const run = async () => {
    if (!id) return;
    setBusy(true);
    try { setRes(await api.post('/forecast', { ingredientId: id, horizon, pendingQty: Number(pending) || 0, safetyPct: safety })); }
    catch (e) { toast(e.message, 'error'); setRes(null); } finally { setBusy(false); }
  };

  const chart = (() => {
    if (!res) return null;
    const h = res.history, p = res.predictions;
    const labels = [...h.map((x) => shortDate(x.date)), ...p.map((x) => shortDate(x.date))];
    const pad = (arr, before, after) => [...Array(before).fill(null), ...arr, ...Array(after).fill(null)];
    const actual = pad(h.map((x) => x.quantity), 0, p.length);
    const pred = pad([h[h.length - 1].quantity, ...p.map((x) => x.quantity)], h.length - 1, 0);
    const hasBand = p[0].lower != null;
    return { labels, datasets: [
      ...(hasBand ? [
        { label: 'low', data: pad(p.map((x) => x.lower), h.length, 0), borderWidth: 0, pointRadius: 0, backgroundColor: 'transparent' },
        { label: 'Likely range', data: pad(p.map((x) => x.upper), h.length, 0), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: `${c.violet}33` },
      ] : []),
      { label: 'Actual use', data: actual, borderColor: c.brand, backgroundColor: c.brand, tension: 0.35, pointRadius: 2, borderWidth: 2.5 },
      { label: 'Forecast', data: pred, borderColor: c.violet, backgroundColor: c.violet, borderDash: [6, 5], tension: 0.35, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 },
    ] };
  })();
  const opts = { ...baseOptions(c), plugins: { ...baseOptions(c).plugins, tooltip: { ...baseOptions(c).plugins.tooltip, filter: (t) => t.dataset.label !== 'low' && t.dataset.label !== 'Likely range' } } };
  const maxMae = res ? Math.max(...res.models.map((m) => m.mae || 0), 0.001) : 1;
  const sg = res?.suggestion;

  return (
    <Page title="Demand forecast" subtitle="A machine-learning model reads your usage history, predicts what you will need, and shows its working.">
      <div className="grid g-side">
        <Card className="stack" style={{ alignSelf: 'start' }}>
          <CardHead title="Plan a purchase" />
          {ings.loading && !ings.data ? null : !list.length ? <Empty icon={BrainCircuit} title="No ingredients" text="Add ingredients and usage history first." /> : (
            <>
              <Field label="Ingredient"><select className="select" value={id} onChange={(e) => setId(e.target.value)}>{list.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}</select></Field>
              <Field label="Forecast horizon"><Segmented id="horizon" value={horizon} onChange={setHorizon} options={[{ value: 1, label: '1 day' }, { value: 3, label: '3 days' }, { value: 7, label: '7 days' }, { value: 14, label: '14 days' }]} /></Field>
              <Field label={`Delivery already on the way${sel ? ` (${sel.unit})` : ''}`} hint="Subtracted from what you need to buy"><input className="input" type="number" min="0" step="any" value={pending} onChange={(e) => setPending(e.target.value)} placeholder="0" /></Field>
              <Field label={`Safety stock: ${safety}%`} hint="Extra buffer on top of the predicted need"><input className="slider" type="range" min="0" max="40" step="5" value={safety} onChange={(e) => setSafety(Number(e.target.value))} /></Field>
              <Button loading={busy} onClick={run} style={{ padding: 13 }}><Sparkles size={17} /> Run forecast</Button>
            </>
          )}
        </Card>

        <div className="stack">
          <AnimatePresence mode="wait">
            {!res ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card><Empty icon={BrainCircuit} title="Ready when you are" text="Choose an ingredient and run the forecast. The model compares three approaches on held-out data and uses the most accurate one." /></Card>
              </motion.div>
            ) : (
              <motion.div key={res.ingredient.id + horizon + res.suggestion.toBuy} className="stack" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                <div className="card suggest">
                  <div className="suggest-grid">
                    <div>
                      <div className="eyebrow">Suggested purchase</div>
                      <div className="big" style={{ margin: '10px 0 2px' }}><AnimatedNumber value={sg.toBuy} decimals={res.ingredient.unit === 'pcs' ? 0 : 1} /> <span style={{ fontSize: 24, opacity: 0.8 }}>{res.ingredient.unit}</span></div>
                      <div style={{ opacity: 0.85 }}>of {res.ingredient.name} to cover the next {horizon} day{horizon > 1 ? 's' : ''}</div>
                    </div>
                    <div className="calc">
                      {sg.steps.map((s) => <div key={s.label}><span><span className="op">{s.op}</span>{s.label}</span><b className="num">{qty(s.value)}</b></div>)}
                      <div className="total"><span><span className="op">=</span>To buy</span><b className="num">{qty(sg.toBuy)} {res.ingredient.unit}</b></div>
                    </div>
                  </div>
                </div>
                <Card>
                  <CardHead title="How the model decided" sub={`Trained on ${res.trainedOnDays} days of usage`} right={<Pill tone={res.source === 'ml-service' ? 'ok' : 'low'}>{res.source === 'ml-service' ? 'ML service' : 'Fallback'}</Pill>} />
                  {res.models.map((m) => (
                    <div key={m.name} className="model-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: m.name === res.best ? 700 : 500 }}>{m.name === res.best && <Trophy size={15} color="var(--accent)" />}{m.name}</div>
                      <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: m.mae == null ? '0%' : `${Math.max(6, (m.mae / maxMae) * 100)}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} style={m.name === res.best ? undefined : { background: 'var(--faint)' }} /></div>
                      <span className="num" style={{ color: 'var(--muted)', fontSize: 13 }}>{m.mae == null ? 'n/a' : `Error ${m.mae} (MAE)`}</span>
                    </div>))}
                  <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--muted)' }}>
                    {res.improvementOverBaselinePct != null ? <>Best model is <b style={{ color: 'var(--brand)' }}>{res.improvementOverBaselinePct}% more accurate</b> than the moving-average baseline, measured on days it never trained on. Shorter bar = smaller error = better.</> : 'Lower MAE (mean absolute error) means a more accurate forecast.'}
                  </div>
                </Card>
                {res.warnings.map((w) => <div key={w} className="warn"><AlertTriangle size={18} style={{ flex: 'none', marginTop: 2 }} />{w}</div>)}
                <Card>
                  <CardHead title={`${res.ingredient.name}: usage and forecast`} sub={`Daily quantity in ${res.ingredient.unit}`} right={<div className="legend"><span><i style={{ background: c.brand }} />Actual</span><span><i style={{ background: c.violet }} />Forecast</span></div>} />
                  <div className="chart-box"><Line data={chart} options={opts} /></div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, color: 'var(--muted)', fontSize: 13 }}><Info size={16} style={{ flex: 'none', marginTop: 2 }} />The shaded band is an approximate 80% range. Forecasts improve as you record more days of usage.</div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}
