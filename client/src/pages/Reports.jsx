import { useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Download, FileBarChart, IndianRupee, Leaf, Printer, ShoppingBasket, Utensils } from 'lucide-react';
import { api } from '../api';
import { baseOptions, useChartColors } from '../charts';
import { addDaysStr, longDate, money, qty, shortDate, todayStr } from '../format';
import { Button, Card, CardHead, Empty, Page, Segmented, Skeleton, Stagger, Stat, useFetch } from '../ui';

const download = (name, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click(); URL.revokeObjectURL(a.href);
};

export default function Reports() {
  const c = useChartColors();
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(addDaysStr(todayStr(), -29));
  const [to, setTo] = useState(todayStr());
  const { data, loading, error } = useFetch(() => api.get(`/reports?from=${from}&to=${to}`), [from, to]);

  const pick = (p) => {
    setPreset(p);
    if (p === 'month') { const d = new Date(); setFrom(todayStr(-(d.getDate() - 1))); setTo(todayStr()); }
    else if (p !== 'custom') { setFrom(addDaysStr(todayStr(), -(Number(p) - 1))); setTo(todayStr()); }
  };
  const t = data?.totals;
  const exportCsv = () => {
    download(`kitchen-report-${from}_to_${to}.csv`, [
      ['Ingredient', 'Unit', 'Purchased qty', 'Purchased cost', 'Used qty', 'Used cost', 'Wasted qty', 'Wasted cost'],
      ...data.byIngredient.map((r) => [r.name, r.unit, r.purchasedQty, r.purchasedCost, r.usedQty, r.usedCost, r.wastedQty, r.wastedCost]),
      [], ['Date', 'Meals served', 'Purchase cost', 'Used cost', 'Waste cost', 'Cost per meal'],
      ...data.days.map((d) => [d.date, d.meals, d.purchaseCost, d.usedCost, d.wasteCost, d.costPerMeal]),
    ]);
  };

  return (
    <Page title="Reports" subtitle="Purchases, usage and waste for any period, ready to export or print."
      actions={<><Button variant="ghost" disabled={!data} onClick={exportCsv}><Download size={16} /> Export CSV</Button><Button variant="ghost" onClick={() => window.print()}><Printer size={16} /> Print</Button></>}>
      <Card className="no-print" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented id="range" value={preset} onChange={pick} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: 'month', label: 'This month' }, { value: 'custom', label: 'Custom' }]} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
            <input className="input" type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} style={{ width: 160 }} />
            <span style={{ color: 'var(--faint)' }}>to</span>
            <input className="input" type="date" value={to} min={from} max={todayStr()} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} style={{ width: 160 }} />
          </div>
        </div>
      </Card>

      {error ? <Card><Empty icon={FileBarChart} title="Could not build the report" text={error} /></Card> : loading && !data ? <Skeleton h={420} r={18} /> : (
        <>
          <div className="print-title" style={{ display: 'none' }}>{longDate(data.from)} to {longDate(data.to)}</div>
          <Stagger className="grid g-4">
            <Stat icon={ShoppingBasket} label="Purchases" value={t.purchaseCost} prefix="₹" tone="info" />
            <Stat icon={Utensils} label="Food used in cooking" value={t.usedCost} prefix="₹" tone="brand" />
            <Stat icon={Leaf} label="Food wasted" value={t.wastedCost} prefix="₹" tone="danger" />
            <Stat icon={IndianRupee} label="Waste rate" value={t.wasteRate} suffix="%" decimals={1} tone="accent" hint="Wasted share of food cost" />
          </Stagger>
          <Card style={{ marginTop: 18 }}>
            <CardHead title="Daily trend" sub="Purchases, usage and waste in ₹" right={<div className="legend"><span><i style={{ background: c.info }} />Purchased</span><span><i style={{ background: c.brand }} />Used</span><span><i style={{ background: c.danger }} />Wasted</span></div>} />
            <div className="chart-box">
              <Chart type="bar" options={baseOptions(c)} data={{ labels: data.days.map((d) => shortDate(d.date)), datasets: [
                { type: 'bar', label: 'Purchased', data: data.days.map((d) => d.purchaseCost), backgroundColor: `${c.info}99`, borderRadius: 6, maxBarThickness: 18 },
                { type: 'line', label: 'Used', data: data.days.map((d) => d.usedCost), borderColor: c.brand, backgroundColor: c.brand, tension: 0.35, pointRadius: 0, borderWidth: 2.5 },
                { type: 'line', label: 'Wasted', data: data.days.map((d) => d.wasteCost), borderColor: c.danger, backgroundColor: c.danger, tension: 0.35, pointRadius: 0, borderWidth: 2.5 },
              ] }} />
            </div>
          </Card>
          <Card style={{ marginTop: 18 }}>
            <CardHead title="By ingredient" sub={`${longDate(data.from)} to ${longDate(data.to)}`} />
            {!data.byIngredient.length ? <Empty icon={FileBarChart} title="No activity in this period" text="Try a wider date range." /> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Ingredient</th><th className="r">Purchased</th><th className="r">Used</th><th className="r">Wasted</th><th className="r">Waste cost</th><th className="r">Used cost</th></tr></thead>
                <tbody>{data.byIngredient.map((r) => (
                  <tr key={r.ingredientId}><td><div className="ing-name">{r.name}</div><div className="ing-sub">{r.category}</div></td>
                    <td className="r num">{qty(r.purchasedQty)} {r.unit}</td><td className="r num">{qty(r.usedQty)} {r.unit}</td><td className="r num" style={{ color: r.wastedQty ? 'var(--danger)' : undefined }}>{qty(r.wastedQty)} {r.unit}</td>
                    <td className="r num">{money(r.wastedCost)}</td><td className="r num"><b>{money(r.usedCost)}</b></td></tr>))}</tbody>
              </table></div>
            )}
          </Card>
          <Card style={{ marginTop: 18 }}>
            <CardHead title="Day by day" sub="Cost per meal appears when you log meals served" />
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}><table>
              <thead><tr><th>Date</th><th className="r">Meals</th><th className="r">Purchased</th><th className="r">Used</th><th className="r">Wasted</th><th className="r">Cost / meal</th></tr></thead>
              <tbody>{[...data.days].reverse().map((d) => (
                <tr key={d.date}><td className="num">{longDate(d.date)}</td><td className="r num">{d.meals ?? '–'}</td><td className="r num">{money(d.purchaseCost)}</td><td className="r num">{money(d.usedCost)}</td><td className="r num">{money(d.wasteCost)}</td><td className="r num">{d.costPerMeal != null ? money(d.costPerMeal, 2) : '–'}</td></tr>))}</tbody>
            </table></div>
          </Card>
        </>
      )}
    </Page>
  );
}
