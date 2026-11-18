import { useEffect, useRef, useState } from 'react';
import type { FoodItem, Profile, UsualMeal } from './engine/types';
import { DEFAULT_PROFILE, nowMin, todayStr, uid, useStore } from './store';
import { ICONS } from './ui/icons';
import { Onboarding, ProfileScreen, profileSummary } from './ui/Profile';
import { ScanScreen, type ScanMode } from './ui/Scan';
import { ResultView } from './ui/Result';
import { AddSheet, LogScreen, dayLabel } from './ui/Log';
import { InsightsScreen } from './ui/Insights';

type Tab = 'scan' | 'log' | 'insights' | 'profile';
const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: 'scan', label: 'Scan', icon: 'scan' }, { k: 'log', label: 'Log', icon: 'log' },
  { k: 'insights', label: 'Insights', icon: 'effects' }, { k: 'profile', label: 'Profile', icon: 'profile' },
];
const RECENT_KEY = 'hc_recent_v1';

export default function App() {
  const st = useStore();
  const [tab, setTab] = useState<Tab>('scan');
  const [scanMode, setScanMode] = useState<ScanMode>('barcode');
  const [view, setView] = useState<FoodItem | null>(null);
  const [sheet, setSheet] = useState<'search' | 'usual' | null>(null);
  const [today, setToday] = useState(todayStr());
  const [date, setDate] = useState(today);
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<FoodItem[]>(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } });
  const screen = useRef<HTMLElement>(null);

  useEffect(() => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch { /* ignore */ } }, [recent]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { screen.current?.scrollTo(0, 0); }, [tab, view]);
  // Roll "today" over at midnight if the app stays open.
  useEffect(() => { const t = setInterval(() => { const d = todayStr(); if (d !== today) { if (date === today) setDate(d); setToday(d); } }, 60_000); return () => clearInterval(t); }, [today, date]);

  if (!st.profile) return <div className="app"><Onboarding initial={DEFAULT_PROFILE} onDone={p => { st.setProfile(p); setToast('Profile saved. Scan your first food.'); }} /></div>;
  const p: Profile = st.profile;

  const showResult = (item: FoodItem) => {
    setView(item);
    setSheet(null);
    if (item.source !== 'common' && !item.notFound) setRecent(r => [item, ...r.filter(x => x.id !== item.id)].slice(0, 8));
  };
  const go = (t: Tab) => { setView(null); setTab(t); };
  const addToLog = (items: FoodItem[], servings = 1, time = nowMin()) => {
    const day = tab === 'log' ? date : today;
    st.addEntries(items.map(item => ({ id: uid(), date: day, time, servings, item })));
    setToast(items.length === 1 ? `Added ${items[0].name} to ${dayLabel(day, today).toLowerCase() === 'today' ? 'today' : dayLabel(day, today)}.` : `Added ${items.length} items.`);
  };
  const dayEntries = st.log.filter(e => e.date === date);

  let body;
  if (view) {
    body = <ResultView key={view.id} item={view} p={p} defaultTime={nowMin()}
      onBack={() => setView(null)}
      onScanLabel={() => { setView(null); setScanMode('label'); setTab('scan'); }}
      onLog={(servings, time) => { addToLog([view], servings, time); setView(null); setTab('log'); }} />;
  } else if (tab === 'scan') {
    body = <ScanScreen p={p} mode={scanMode} setMode={setScanMode} onResult={showResult} recent={recent} />;
  } else if (tab === 'log') {
    body = <LogScreen p={p} date={date} today={today} setDate={setDate} entries={dayEntries} usuals={st.usuals}
      onOpen={showResult} onRemove={st.removeEntry}
      onAdd={() => setSheet('search')} onUsual={() => setSheet('usual')}
      onScan={() => { setScanMode('barcode'); go('scan'); }} onPhoto={() => { setScanMode('label'); go('scan'); }}
      onSaveUsual={(name, items) => { st.setUsuals(u => [...u, { id: uid(), name, items }]); setToast(`Saved “${name}”.`); }} />;
  } else if (tab === 'insights') {
    body = <InsightsScreen p={p} entries={dayEntries} label={dayLabel(date, today)} />;
  } else {
    body = <ProfileScreen p={p} set={st.setProfile} onReset={() => { st.resetAll(); setRecent([]); setTab('scan'); }} />;
  }

  return (
    <div className="app">
      <header className="appbar">
        <div className="brand"><span className="mark" aria-hidden="true">{ICONS.leaf}</span>Health Caddy</div>
        <button className="pchip" onClick={() => go('profile')} aria-label="Edit profile">{profileSummary(p)}</button>
      </header>
      <main className="screen" ref={screen}>{body}</main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map(t => (
          <button key={t.k} className="tab" aria-current={!view && tab === t.k ? 'page' : undefined} onClick={() => go(t.k)}>{ICONS[t.icon]}{t.label}</button>
        ))}
      </nav>
      {sheet && (
        <AddSheet p={p} mode={sheet} usuals={st.usuals} onClose={() => setSheet(null)}
          onPick={item => showResult(item)}
          onPickMeal={(m: UsualMeal) => { addToLog(m.items); setSheet(null); }}
          onDeleteMeal={id => st.setUsuals(u => u.filter(m => m.id !== id))} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
