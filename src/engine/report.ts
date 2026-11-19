import type { LogEntry, Profile, ScanEvent, Verdict } from './types';
import { evaluate } from './evaluate';
import { needKcal, totals, type Totals } from './predict';

export interface DayRow { date: string; logged: number; totals: Totals }
export interface Count { label: string; n: number }
export interface Target { key: 'sugar' | 'sodium' | 'fiber' | 'kcal'; label: string; unit: string; avg: number; target: number; kind: 'max' | 'min'; daysOver: number }

export interface WeeklyReport {
  from: string; to: string;
  days: DayRow[]; // oldest first, one per day in range
  daysLogged: number;
  itemsLogged: number;
  scans: number;
  verdicts: Record<Verdict, number>; // over every food checked or logged this week
  flagged: Count[]; // ingredient words that caused Avoid or Caution, most frequent first
  topFoods: Count[];
  targets: Target[];
  highlights: string[]; // short plain sentences
}

const addDays = (date: string, by: number) => {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const top = (m: Map<string, number>, n: number): Count[] => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([label, c]) => ({ label, n: c }));
const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const nice = (x: number) => Math.round(x).toLocaleString('en-US');

/** A seven-day summary ending on `to`, built only from this person's own log and scans on this device. */
export function weeklyReport(log: LogEntry[], scans: ScanEvent[], p: Profile, to: string): WeeklyReport {
  const from = addDays(to, -6);
  const inRange = (d: string) => d >= from && d <= to;
  const entries = log.filter(e => inRange(e.date));
  const weekScans = scans.filter(s => inRange(s.date));

  const days: DayRow[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const es = entries.filter(e => e.date === d);
    days.push({ date: d, logged: es.length, totals: totals(es) });
  }
  const loggedDays = days.filter(d => d.logged > 0);

  // Verdicts: every scan, plus logged foods that were never scanned (e.g. picked from search).
  const verdicts: Record<Verdict, number> = { avoid: 0, caution: 0, good: 0, unknown: 0 };
  const flagged = new Map<string, number>();
  for (const s of weekScans) verdicts[s.verdict]++;
  const scannedIds = new Set(weekScans.map(s => s.itemId));
  const foods = new Map<string, number>();
  for (const e of entries) {
    bump(foods, e.item.name);
    const ev = evaluate(e.item, p);
    if (!scannedIds.has(e.item.id)) verdicts[ev.verdict]++;
    for (const [w, lvl] of Object.entries(ev.flags)) if (lvl === 'avoid' || lvl === 'caution') bump(flagged, w.replace(/ \(declared allergen\)$/, ''));
  }

  const need = needKcal(p).kcal;
  const avg = (k: keyof Totals) => loggedDays.length ? loggedDays.reduce((s, d) => s + d.totals[k], 0) / loggedDays.length : 0;
  const fiberTarget = Math.round((need / 1000) * 14);
  const targets: Target[] = [
    { key: 'kcal', label: 'Calories', unit: 'kcal', avg: avg('kcal'), target: need, kind: 'max', daysOver: loggedDays.filter(d => d.totals.kcal > need).length },
    { key: 'sugar', label: 'Sugar', unit: 'g', avg: avg('sugar'), target: 50, kind: 'max', daysOver: loggedDays.filter(d => d.totals.sugar > 50).length },
    { key: 'sodium', label: 'Sodium', unit: 'mg', avg: avg('sodium'), target: 2300, kind: 'max', daysOver: loggedDays.filter(d => d.totals.sodium > 2300).length },
    { key: 'fiber', label: 'Fiber', unit: 'g', avg: avg('fiber'), target: fiberTarget, kind: 'min', daysOver: loggedDays.filter(d => d.totals.fiber < fiberTarget).length },
  ];

  const highlights: string[] = [];
  const checked = verdicts.avoid + verdicts.caution + verdicts.good + verdicts.unknown;
  if (checked) highlights.push(`${verdicts.good} of ${checked} foods checked were Good for you${verdicts.avoid ? `, and ${verdicts.avoid} were Avoid` : ''}.`);
  const fl = top(flagged, 1)[0];
  if (fl && fl.n > 1) highlights.push(`“${fl.label}” came up most often in foods flagged for you (${fl.n} times).`);
  for (const t of targets) {
    if (!loggedDays.length || t.key === 'kcal') continue;
    if (t.kind === 'max' && t.daysOver) highlights.push(`${t.label} was over ${nice(t.target)} ${t.unit} on ${t.daysOver} of ${loggedDays.length} logged day${loggedDays.length > 1 ? 's' : ''}.`);
    if (t.kind === 'min' && t.daysOver) highlights.push(`Fiber was under your ${t.target} g goal on ${t.daysOver} of ${loggedDays.length} logged day${loggedDays.length > 1 ? 's' : ''}.`);
  }
  if (loggedDays.length && loggedDays.length < 4) highlights.push('Log on more days for a clearer picture.');

  return {
    from, to, days, daysLogged: loggedDays.length, itemsLogged: entries.length, scans: weekScans.length,
    verdicts, flagged: top(flagged, 6), topFoods: top(foods, 5), targets, highlights,
  };
}
