import { useMemo, useState } from 'react';
import type { FoodItem, LogEntry, Profile, UsualMeal } from '../engine/types';
import { totals, fmtTime } from '../engine/predict';
import { COMMON_FOODS } from '../data/commonFoods';
import { searchProducts, LookupError } from '../data/openFoodFacts';
import { ICONS } from './icons';
import { VerdictPill } from './Result';

const MEALS = [
  { name: 'Breakfast', to: 660 }, { name: 'Lunch', to: 900 }, { name: 'Afternoon', to: 1080 }, { name: 'Dinner', to: 1260 }, { name: 'Late', to: 1440 },
];

export function dayLabel(date: string, today: string) {
  if (date === today) return 'Today';
  const d = new Date(date + 'T12:00:00');
  const t = new Date(today + 'T12:00:00');
  if ((t.getTime() - d.getTime()) / 86_400_000 === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export function shiftDay(date: string, by: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  p: Profile; date: string; today: string; setDate: (d: string) => void;
  entries: LogEntry[]; usuals: UsualMeal[];
  onOpen: (item: FoodItem) => void; onRemove: (id: string) => void;
  onAdd: () => void; onScan: () => void; onPhoto: () => void; onUsual: () => void;
  onSaveUsual: (name: string, items: FoodItem[]) => void;
}

export function LogScreen({ p, date, today, setDate, entries, onOpen, onRemove, onAdd, onScan, onPhoto, onUsual, onSaveUsual }: Props) {
  const sorted = useMemo(() => [...entries].sort((a, b) => a.time - b.time), [entries]);
  const T = totals(sorted);
  const [saving, setSaving] = useState<string | null>(null);
  const [usualName, setUsualName] = useState('');
  let from = 0;
  const groups = MEALS.map(m => { const g = { ...m, from, es: sorted.filter(e => e.time >= from && e.time < m.to) }; from = m.to; return g; }).filter(g => g.es.length);

  return (
    <>
      <div className="daynav">
        <button aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))}>‹</button>
        <div style={{ textAlign: 'center' }}><h1 className="h">{dayLabel(date, today)}</h1><p className="sub">{sorted.length} item{sorted.length === 1 ? '' : 's'} logged</p></div>
        <button aria-label="Next day" disabled={date >= today} onClick={() => setDate(shiftDay(date, 1))}>›</button>
      </div>
      <div className="totals">
        <div><b>{T.kcal}</b><span>kcal</span></div>
        <div><b>{T.protein}</b><span>Protein g</span></div>
        <div><b>{T.fiber}</b><span>Fiber g</span></div>
        <div><b>{T.sugar}</b><span>Sugar g</span></div>
        <div><b>{T.sodium}</b><span>Sodium mg</span></div>
      </div>
      <div className="adds">
        <button className="add" onClick={onAdd}>{ICONS.search}Search</button>
        <button className="add" onClick={onScan}>{ICONS.scan}Barcode</button>
        <button className="add" onClick={onPhoto}>{ICONS.camera}Label</button>
        <button className="add" onClick={onUsual}>{ICONS.usual}Usual meal</button>
      </div>
      {!sorted.length && <div className="card"><p className="fine">Nothing logged for this day yet. Add what you eat and drink to see how it may affect your digestion, sleep, energy and weight.</p></div>}
      {groups.map(g => (
        <section key={g.name} className="meal">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>{g.name}</h3>
            {g.es.length > 0 && saving !== g.name && <button className="linkbtn fine" onClick={() => { setSaving(g.name); setUsualName(`Usual ${g.name.toLowerCase()}`); }}>Save as usual meal</button>}
          </div>
          {saving === g.name && (
            <form className="row" style={{ marginBottom: 8 }} onSubmit={e => { e.preventDefault(); onSaveUsual(usualName.trim() || `Usual ${g.name.toLowerCase()}`, g.es.map(x => x.item)); setSaving(null); }}>
              <input className="inp grow" value={usualName} onChange={e => setUsualName(e.target.value)} aria-label="Usual meal name" />
              <button className="btn small" type="submit">Save</button>
              <button className="btn small ghost" type="button" onClick={() => setSaving(null)}>Cancel</button>
            </form>
          )}
          {g.es.map(e => (
            <div className="entry" key={e.id}>
              <time>{fmtTime(e.time)}</time>
              <button className="nm" onClick={() => onOpen(e.item)}>{e.item.name}<small>{e.servings !== 1 ? `${e.servings} × ` : ''}{e.item.serving || ''}{e.item.n?.kcal !== undefined ? ` · ${Math.round(e.item.n.kcal * e.servings)} kcal` : ''}</small></button>
              <VerdictPill item={e.item} p={p} />
              <button className="x" aria-label={`Remove ${e.item.name}`} onClick={() => onRemove(e.id)}>×</button>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

/** Bottom sheet: search home foods and US products, or pick a usual meal. */
export function AddSheet({ p, mode, usuals, onPick, onPickMeal, onDeleteMeal, onClose }: {
  p: Profile; mode: 'search' | 'usual'; usuals: UsualMeal[];
  onPick: (item: FoodItem) => void; onPickMeal: (m: UsualMeal) => void; onDeleteMeal: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<FoodItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const local = q.trim() ? COMMON_FOODS.filter(f => f.name.toLowerCase().includes(q.trim().toLowerCase())) : COMMON_FOODS.slice(0, 8);

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true); setErr(''); setRemote(null);
    try { setRemote(await searchProducts(q.trim())); }
    catch (e) { setErr(e instanceof LookupError ? e.message : 'Search failed. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={mode === 'search' ? 'Add food' : 'Usual meals'}>
        <div className="grab" />
        {mode === 'search' ? (
          <>
            <h2 className="h">Add food</h2>
            <form className="row" onSubmit={e => { e.preventDefault(); search(); }}>
              <input className="inp grow" autoFocus value={q} onChange={e => { setQ(e.target.value); setRemote(null); }} placeholder="e.g. dal, apple, Greek yogurt" aria-label="Search foods" />
              <button className="btn" type="submit" disabled={!q.trim() || busy}>Search</button>
            </form>
            {local.length > 0 && (
              <section className="stack">
                <h3 className="sec-title">Home and fresh foods</h3>
                <div className="results">{local.map(f => <ResRow key={f.id} item={f} p={p} onPick={onPick} />)}</div>
              </section>
            )}
            {busy && <div className="busy"><div className="spinner" /><span>Searching US products…</span></div>}
            {err && <div className="err" role="alert">{err}</div>}
            {remote && (
              <section className="stack">
                <h3 className="sec-title">Packaged products <small>Open Food Facts</small></h3>
                {remote.length ? <div className="results">{remote.map(f => <ResRow key={f.id} item={f} p={p} onPick={onPick} />)}</div> : <p className="fine">No products found. Try fewer words, or scan the barcode.</p>}
              </section>
            )}
            {!remote && !busy && q.trim() && <p className="fine">Press Search to look up packaged products too.</p>}
          </>
        ) : (
          <>
            <h2 className="h">Usual meals</h2>
            {usuals.length ? (
              <div className="results">
                {usuals.map(m => (
                  <div key={m.id} className="res">
                    <span><b>{m.name}</b><small>{m.items.map(i => i.name).join(', ')}</small></span>
                    <span className="row" style={{ flexWrap: 'nowrap' }}>
                      <button className="btn small" onClick={() => onPickMeal(m)}>Add</button>
                      <button className="x" aria-label={`Delete ${m.name}`} onClick={() => onDeleteMeal(m.id)}>×</button>
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="fine">No usual meals yet. Log a meal once, then tap “Save as usual meal” above it in your log. Next time it’s one tap.</p>}
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </>
  );
}

function ResRow({ item, p, onPick }: { item: FoodItem; p: Profile; onPick: (i: FoodItem) => void }) {
  return (
    <button className="res" onClick={() => onPick(item)}>
      <span><b>{item.name}</b><small>{[item.brand, item.serving, item.n?.kcal !== undefined && `${item.n.kcal} kcal`].filter(Boolean).join(' · ')}</small></span>
      <VerdictPill item={item} p={p} />
    </button>
  );
}
