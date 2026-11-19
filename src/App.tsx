import { useEffect, useRef, useState } from 'react';
import type { FoodItem, UsualMeal } from './engine/types';
import { evaluate } from './engine/evaluate';
import { DEFAULT_PROFILE, nowMin, todayStr, uid, useStore } from './store';
import { ICONS } from './ui/icons';
import { Onboarding, PeopleSheet, ProfileScreen, initials, profileSummary } from './ui/Profile';
import { ScanScreen, type ScanMode } from './ui/Scan';
import { ResultView } from './ui/Result';
import { AddSheet, LogScreen, dayLabel } from './ui/Log';
import { InsightsScreen } from './ui/Insights';
import { ReportScreen } from './ui/Report';

type Tab = 'scan' | 'log' | 'insights' | 'report' | 'profile';
const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: 'scan', label: 'Scan', icon: 'scan' }, { k: 'log', label: 'Log', icon: 'log' },
  { k: 'insights', label: 'Insights', icon: 'effects' }, { k: 'report', label: 'Report', icon: 'report' },
  { k: 'profile', label: 'Profile', icon: 'profile' },
];

export default function App() {
  const st = useStore();
  const [tab, setTab] = useState<Tab>('scan');
  const [scanMode, setScanMode] = useState<ScanMode>('barcode');
  const [view, setView] = useState<FoodItem | null>(null);
  const [sheet, setSheet] = useState<'search' | 'usual' | 'people' | null>(null);
  const [adding, setAdding] = useState(false);
  const [today, setToday] = useState(todayStr());
  const [date, setDate] = useState(today);
  const [weekEnd, setWeekEnd] = useState(today);
  const [toast, setToast] = useState<string | null>(null);
  const screen = useRef<HTMLElement>(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { screen.current?.scrollTo(0, 0); }, [tab, view, st.person?.id]);
  // Roll "today" over at midnight if the app stays open.
  useEffect(() => {
    const t = setInterval(() => {
      const d = todayStr();
      if (d !== today) { if (date === today) setDate(d); if (weekEnd === today) setWeekEnd(d); setToday(d); }
    }, 60_000);
    return () => clearInterval(t);
  }, [today, date, weekEnd]);

  if (!st.person || adding) {
    const first = !st.person;
    return (
      <div className="app">
        <Onboarding key={first ? 'first' : 'add'} first={first} initial={DEFAULT_PROFILE}
          onCancel={first ? undefined : () => setAdding(false)}
          onDone={(name, p) => {
            st.addPerson(name, p);
            setAdding(false); setView(null); setTab('scan'); setDate(today); setWeekEnd(today);
            setToast(first ? 'Profile saved. Scan your first food.' : `${name.trim()} is set up. You’re now using their profile.`);
          }} />
      </div>
    );
  }
  const person = st.person;
  const p = person.profile;
  const displayName = person.name.trim() || 'Me';

  const showResult = (item: FoodItem, record = true) => {
    setView(item);
    setSheet(null);
    if (record) st.recordScan(item, evaluate(item, p).verdict);
  };
  const go = (t: Tab) => { setView(null); setTab(t); };
  const addToLog = (items: FoodItem[], servings = 1, time = nowMin()) => {
    const day = tab === 'log' ? date : today;
    st.addEntries(items.map(item => ({ id: uid(), date: day, time, servings, item })));
    const when = dayLabel(day, today) === 'Today' ? 'today' : dayLabel(day, today);
    setToast(items.length === 1 ? `Added ${items[0].name} to ${when}.` : `Added ${items.length} items.`);
  };
  const dayEntries = st.log.filter(e => e.date === date);

  let body;
  if (view) {
    body = <ResultView key={view.id} item={view} p={p} defaultTime={nowMin()}
      onBack={() => setView(null)}
      onScanLabel={() => { setView(null); setScanMode('label'); setTab('scan'); }}
      onLog={(servings, time) => { addToLog([view], servings, time); setView(null); setTab('log'); }} />;
  } else if (tab === 'scan') {
    body = <ScanScreen p={p} mode={scanMode} setMode={setScanMode} onResult={showResult} recent={st.recent} />;
  } else if (tab === 'log') {
    body = <LogScreen p={p} date={date} today={today} setDate={setDate} entries={dayEntries} usuals={st.usuals}
      onOpen={item => showResult(item, false)} onRemove={st.removeEntry}
      onAdd={() => setSheet('search')} onUsual={() => setSheet('usual')}
      onScan={() => { setScanMode('barcode'); go('scan'); }} onPhoto={() => { setScanMode('label'); go('scan'); }}
      onSaveUsual={(name, items) => { st.addUsual(name, items); setToast(`Saved “${name}”.`); }} />;
  } else if (tab === 'insights') {
    body = <InsightsScreen p={p} entries={dayEntries} label={dayLabel(date, today)} />;
  } else if (tab === 'report') {
    body = <ReportScreen name={displayName} p={p} log={st.log} scans={st.scans} to={weekEnd} today={today} setTo={setWeekEnd} />;
  } else {
    body = <ProfileScreen person={person} set={st.setProfile} others={st.people.length - 1}
      onRename={name => st.renamePerson(person.id, name)}
      onDelete={() => { st.deletePerson(person.id); setTab('scan'); setToast(`Deleted ${displayName}’s data.`); }}
      onReset={() => { st.resetAll(); setTab('scan'); }} />;
  }

  return (
    <div className="app">
      <header className="appbar">
        <div className="brand"><span className="mark" aria-hidden="true">{ICONS.leaf}</span>Health Caddy</div>
        <button className="pchip" onClick={() => setSheet('people')} aria-label={`${displayName}: switch person`}>
          <span className="avatar" aria-hidden="true">{initials(displayName)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName} · {profileSummary(p)}</span>
        </button>
      </header>
      <main className="screen" ref={screen}>{body}</main>
      <nav className="tabbar five" aria-label="Sections">
        {TABS.map(t => (
          <button key={t.k} className="tab" aria-current={!view && tab === t.k ? 'page' : undefined} onClick={() => go(t.k)}>{ICONS[t.icon]}{t.label}</button>
        ))}
      </nav>
      {(sheet === 'search' || sheet === 'usual') && (
        <AddSheet p={p} mode={sheet} usuals={st.usuals} onClose={() => setSheet(null)}
          onPick={item => showResult(item, item.source !== 'common')}
          onPickMeal={(m: UsualMeal) => { addToLog(m.items); setSheet(null); }}
          onDeleteMeal={st.removeUsual} />
      )}
      {sheet === 'people' && (
        <PeopleSheet people={st.people} activeId={person.id} onClose={() => setSheet(null)}
          onAdd={() => { setSheet(null); setAdding(true); }}
          onSwitch={id => { st.switchPerson(id); setSheet(null); setView(null); setDate(today); setWeekEnd(today); const n = st.people.find(x => x.id === id)?.name; if (id !== person.id && n) setToast(`Now using ${n}’s profile.`); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
