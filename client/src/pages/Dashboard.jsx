import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Chart, Doughnut } from 'react-chartjs-2';
import { AlertTriangle, CheckCircle2, Clock, Database, IndianRupee, Leaf, Package, Sparkles, TrendingDown } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { baseOptions, useChartColors } from '../charts';
import { greeting, money, qty, shortDate } from '../format';
import { Button, Card, CardHead, Empty, Page, Rise, Skeleton, Stagger, Stat, useFetch } from '../ui';
import { alertIcon, alertTone } from '../Layout';
import { useState } from 'react';

const REASON_LABEL = { expired: 'Expired', spoilage: 'Spoilage', 'over-preparation': 'Over-preparation', other: 'Other' };

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const c = useChartColors();
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard'));
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    try { await api.post('/demo/seed'); toast('Demo kitchen loaded with 90 days of synthetic history'); reload(); }
    catch (e) { toast(e.message, 'error'); } finally { setSeeding(false); }
  };

  const header = { title: `${greeting()}, ${user.name.split(' ')[0]}`, subtitle: 'Here is how your kitchen is doing today.' };
  if (loading && !data) return (
    <Page {...header}><div className="grid g-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card"><Skeleton h={44} w={44} r={14} /><div style={{ height: 14 }} /><Skeleton h={32} w="60%" /></div>)}</div><div className="grid g-main" style={{ marginTop: 18 }}><Skeleton h={360} r={18} /><Skeleton h={360} r={18} /></div></Page>
  );
  if (error) return <Page {...header}><Card><Empty icon={AlertTriangle} title="Could not load the dashboard" text={error} action={<Button onClick={reload}>Try again</Button>} /></Card></Page>;

  if (!data.hasData) return (
    <Page {...header}>
      <Card className="hero-empty">
        <div className="empty" style={{ padding: 0 }}><div className="ico" style={{ width: 76, height: 76, borderRadius: 24 }}><Package size={34} /></div></div>
        <h2>Your kitchen is a blank slate</h2>
        <p>Add your ingredients to start tracking stock, or explore the whole app instantly with 90 days of clearly labelled synthetic demo data.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => nav('/inventory')}>Add ingredients</Button>
          {user.role === 'manager' && <Button variant="ghost" loading={seeding} onClick={seed}><Database size={16} /> Load demo data</Button>}
        </div>
      </Card>
    </Page>
  );

  const s = data.stats;
  const labels = data.series.map((d) => shortDate(d.date));
  const reasons = data.wasteByReason;
  const palette = [c.danger, c.accent, c.violet, c.info];
  return (
    <Page {...header}>
      <Stagger className="grid g-4">
        <Stat icon={Package} label="Ingredients tracked" value={s.ingredientCount} tone="brand" hint="Active in your inventory" />
        <Stat icon={IndianRupee} label="Stock value" value={s.stockValue} prefix="₹" tone="info" hint="Based on purchase cost of batches in stock" />
        <Stat icon={TrendingDown} label="Low or out of stock" value={s.lowCount} tone="accent" hint={s.lowCount ? 'Needs restocking soon' : 'Everything is stocked'} />
        <Stat icon={Clock} label="Expiry alerts" value={s.expiringCount} tone="danger" hint={s.expiringCount ? 'Use these batches first' : 'Nothing about to expire'} />
      </Stagger>

      <div className="grid g-main" style={{ marginTop: 18 }}>
        <Rise className="card">
          <CardHead title="Food cost vs waste" sub="Last 14 days, in ₹" right={<div className="legend"><span><i style={{ background: c.brand }} />Used in cooking</span><span><i style={{ background: c.danger }} />Wasted</span></div>} />
          <div className="chart-box">
            <Chart type="bar" options={{ ...baseOptions(c), plugins: { ...baseOptions(c).plugins, tooltip: { ...baseOptions(c).plugins.tooltip, callbacks: { label: (x) => ` ${x.dataset.label}: ${money(x.parsed.y)}` } } } }}
              data={{ labels, datasets: [
                { type: 'bar', label: 'Used', data: data.series.map((d) => d.consumptionCost), backgroundColor: c.brand, borderRadius: 8, maxBarThickness: 28 },
                { type: 'line', label: 'Wasted', data: data.series.map((d) => d.wasteCost), borderColor: c.danger, backgroundColor: c.danger, tension: 0.4, pointRadius: 3, borderWidth: 2.5 },
              ] }} />
          </div>
        </Rise>
        <Rise className="card">
          <CardHead title="Alerts" sub={`${data.alertTotal} active`} />
          <div className="list">
            {data.alerts.length === 0 && <div className="empty" style={{ padding: 30 }}><CheckCircle2 size={34} color="var(--brand)" />All clear. Nothing needs attention.</div>}
            {data.alerts.map((a) => { const I = alertIcon[a.type]; return (
              <button key={a.id} className={`row-item tone-${alertTone(a)}`} onClick={() => nav(a.type === 'expired' ? '/waste' : '/inventory')}>
                <span className="ic"><I size={18} /></span><span><div className="tx">{a.message}</div></span>
              </button>); })}
          </div>
        </Rise>
      </div>

      <div className="grid g-3" style={{ marginTop: 18 }}>
        <Rise className="card">
          <CardHead title="Waste by reason" sub="Last 30 days" />
          {reasons.length === 0 ? <Empty icon={Leaf} title="No waste recorded" text="Nice. Nothing thrown away in 30 days." /> : (
            <>
              <div className="chart-box sm"><Doughnut options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.label}: ${money(x.parsed)}` } } } }}
                data={{ labels: reasons.map((r) => REASON_LABEL[r.reason]), datasets: [{ data: reasons.map((r) => r.cost), backgroundColor: palette, borderColor: c.surface, borderWidth: 3, hoverOffset: 8 }] }} /></div>
              <div className="legend" style={{ marginTop: 14, justifyContent: 'center' }}>{reasons.map((r, i) => <span key={r.reason}><i style={{ background: palette[i % 4] }} />{REASON_LABEL[r.reason]} · {money(r.cost)}</span>)}</div>
            </>
          )}
        </Rise>
        <Rise className="card">
          <CardHead title="Use these first" sub="Earliest-expiring batches" />
          <div className="list">
            {data.useFirst.length === 0 && <Empty icon={Clock} title="No batches with expiry" text="Add expiry dates when recording purchases." />}
            {data.useFirst.map((b) => (
              <div key={b.id} className={`row-item tone-${b.daysLeft <= 1 ? 'danger' : b.daysLeft <= 3 ? 'accent' : 'brand'}`} style={{ cursor: 'default' }}>
                <div><div className="ing-name">{b.name}</div><div className="ing-sub num">{qty(b.remaining)} {b.unit}</div></div>
                <div className="countdown"><b>{b.daysLeft}</b><span>{b.daysLeft === 1 ? 'day' : 'days'}</span></div>
              </div>
            ))}
          </div>
        </Rise>
        <Rise className="card" style={{ display: 'grid', alignContent: 'space-between', gap: 16 }}>
          <CardHead title="Waste rate" sub="Wasted share of food cost, last 30 days" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, lineHeight: 1, fontWeight: 600, color: s.wasteRate > 8 ? 'var(--danger)' : 'var(--brand)' }}>{s.wasteRate}<span style={{ fontSize: 28 }}>%</span></div>
            <div style={{ color: 'var(--muted)', marginTop: 8 }}>{money(s.wasteCost30)} wasted of {money(s.consumptionCost30 + s.wasteCost30)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--faint)', fontWeight: 600, marginBottom: 8 }}>Biggest sources of waste</div>
            {data.topWasted.length === 0 ? <div className="ing-sub">None yet</div> : data.topWasted.slice(0, 3).map((t, i) => (
              <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8, fontSize: 14 }}>
                <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t.name}</span></div>
                  <div className="bar" style={{ marginTop: 5 }}><motion.i initial={{ width: 0 }} animate={{ width: `${(t.cost / data.topWasted[0].cost) * 100}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }} style={{ background: c.danger }} /></div></div>
                <b className="num">{money(t.cost)}</b>
              </div>))}
          </div>
          <Button variant="ghost" onClick={() => nav('/forecast')}><Sparkles size={16} /> Plan tomorrow's purchases</Button>
        </Rise>
      </div>
    </Page>
  );
}
