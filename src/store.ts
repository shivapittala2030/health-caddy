import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FoodItem, LogEntry, Person, Profile, ScanEvent, UsualMeal } from './engine/types';
import type { Snapshot } from './cloud/merge';

/**
 * Everything stays in this browser on this device (R16). Nothing is sent to a server.
 * Several people can share one device; each has their own profile, log, usual meals and scan history.
 */
const KEYS = {
  people: 'hc_people_v1', active: 'hc_active_v1', log: 'hc_log_v1', usuals: 'hc_usuals_v1',
  scans: 'hc_scans_v1', recent: 'hc_recent_v2', deleted: 'hc_deleted_v1',
  legacyProfile: 'hc_profile_v1', legacyRecent: 'hc_recent_v1',
};
const MAX_SCANS = 3000;
const MAX_RECENT = 8;

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode or full */ }
}
function drop(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

function usePersisted<T>(key: string, init: () => T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(init);
  useEffect(() => { save(key, v); }, [key, v]);
  return [v, setV];
}

export const DEFAULT_PROFILE: Profile = {
  diet: 'lacto', avoid: [], custom: [], allergies: [], sens: [], goals: [], body: {}, tol: 'standard',
};

export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * Data saved before profiles existed belongs to one person. Turn it into "Me" once, so nothing is lost.
 * Exported for tests.
 */
export function migrateLegacy(people: Person[], legacyProfile: Profile | null, newId: () => string): { people: Person[]; migratedId?: string } {
  if (people.length || !legacyProfile) return { people };
  const me: Person = { id: newId(), name: 'Me', profile: legacyProfile, createdAt: Date.now() };
  return { people: [me], migratedId: me.id };
}

/** Give entries saved before profiles existed to the first person. */
export function ownerOf<T extends { personId?: string }>(rows: T[], fallbackId: string | undefined): T[] {
  return fallbackId ? rows.map(r => r.personId ? r : { ...r, personId: fallbackId }) : rows;
}

function initPeople(): { people: Person[]; active: string | null } {
  const stored = load<Person[]>(KEYS.people, []);
  const { people, migratedId } = migrateLegacy(stored, load<Profile | null>(KEYS.legacyProfile, null), uid);
  if (migratedId) {
    save(KEYS.people, people);
    save(KEYS.log, ownerOf(load<LogEntry[]>(KEYS.log, []), migratedId));
    save(KEYS.usuals, ownerOf(load<UsualMeal[]>(KEYS.usuals, []), migratedId));
    save(KEYS.recent, { [migratedId]: load<FoodItem[]>(KEYS.legacyRecent, []) });
    drop(KEYS.legacyProfile); drop(KEYS.legacyRecent);
  }
  const act = load<string | null>(KEYS.active, null);
  return { people, active: people.some(p => p.id === act) ? act : people[0]?.id ?? null };
}

export function useStore() {
  const [boot] = useState(initPeople);
  const [people, setPeople] = usePersisted<Person[]>(KEYS.people, () => boot.people);
  const [activeId, setActiveId] = usePersisted<string | null>(KEYS.active, () => boot.active);
  const [allLog, setAllLog] = usePersisted<LogEntry[]>(KEYS.log, () => ownerOf(load(KEYS.log, []), people[0]?.id));
  const [allUsuals, setAllUsuals] = usePersisted<UsualMeal[]>(KEYS.usuals, () => ownerOf(load(KEYS.usuals, []), people[0]?.id));
  const [allScans, setAllScans] = usePersisted<ScanEvent[]>(KEYS.scans, () => load(KEYS.scans, []));
  const [recentMap, setRecentMap] = usePersisted<Record<string, FoodItem[]>>(KEYS.recent, () => load(KEYS.recent, {}));
  const [deleted, setDeleted] = usePersisted<string[]>(KEYS.deleted, () => load(KEYS.deleted, []));
  const forget = useCallback((ids: string[]) => setDeleted(d => [...d, ...ids].slice(-5000)), [setDeleted]);

  const person = people.find(p => p.id === activeId) ?? null;
  const pid = person?.id ?? '';

  const log = useMemo(() => allLog.filter(e => e.personId === pid), [allLog, pid]);
  const usuals = useMemo(() => allUsuals.filter(u => u.personId === pid), [allUsuals, pid]);
  const scans = useMemo(() => allScans.filter(s => s.personId === pid), [allScans, pid]);
  const recent = recentMap[pid] ?? [];

  const setProfile = useCallback((profile: Profile) => setPeople(ps => ps.map(p => p.id === pid ? { ...p, profile, updatedAt: Date.now() } : p)), [pid, setPeople]);
  const addPerson = useCallback((name: string, profile: Profile) => {
    const p: Person = { id: uid(), name: name.trim() || 'Me', profile, createdAt: Date.now(), updatedAt: Date.now() };
    setPeople(ps => [...ps, p]);
    setActiveId(p.id);
    return p;
  }, [setPeople, setActiveId]);
  const renamePerson = useCallback((id: string, name: string) => setPeople(ps => ps.map(p => p.id === id ? { ...p, name: name.slice(0, 40), updatedAt: Date.now() } : p)), [setPeople]);
  const switchPerson = useCallback((id: string) => setActiveId(id), [setActiveId]);
  const deletePerson = useCallback((id: string) => {
    const rest = people.filter(p => p.id !== id);
    forget([id, ...allLog.filter(e => e.personId === id).map(e => e.id), ...allUsuals.filter(m => m.personId === id).map(m => m.id)]);
    setPeople(rest);
    setAllLog(l => l.filter(e => e.personId !== id));
    setAllUsuals(u => u.filter(m => m.personId !== id));
    setAllScans(s => s.filter(x => x.personId !== id));
    setRecentMap(r => { const c = { ...r }; delete c[id]; return c; });
    if (activeId === id) setActiveId(rest[0]?.id ?? null);
  }, [people, activeId, allLog, allUsuals, forget, setPeople, setAllLog, setAllUsuals, setAllScans, setRecentMap, setActiveId]);

  const addEntries = useCallback((es: Omit<LogEntry, 'personId'>[]) => setAllLog(l => [...l, ...es.map(e => ({ ...e, personId: pid }))]), [pid, setAllLog]);
  const removeEntry = useCallback((id: string) => { forget([id]); setAllLog(l => l.filter(e => e.id !== id)); }, [forget, setAllLog]);
  const addUsual = useCallback((name: string, items: FoodItem[]) => setAllUsuals(u => [...u, { id: uid(), personId: pid, name, items }]), [pid, setAllUsuals]);
  const removeUsual = useCallback((id: string) => { forget([id]); setAllUsuals(u => u.filter(m => m.id !== id)); }, [forget, setAllUsuals]);

  const recordScan = useCallback((item: FoodItem, verdict: ScanEvent['verdict']) => {
    if (!pid) return;
    const now = new Date();
    const ev: ScanEvent = { id: uid(), personId: pid, at: now.getTime(), date: todayStr(now), itemId: item.id, name: item.name, brand: item.brand, source: item.source, verdict };
    setAllScans(s => [...s, ev].slice(-MAX_SCANS));
    if (item.source !== 'common' && !item.notFound) setRecentMap(r => ({ ...r, [pid]: [item, ...(r[pid] ?? []).filter(x => x.id !== item.id)].slice(0, MAX_RECENT) }));
  }, [pid, setAllScans, setRecentMap]);

  /** Clears this phone only. A signed-in account keeps its cloud copy. */
  const resetAll = useCallback(() => {
    Object.values(KEYS).forEach(drop);
    setPeople([]); setActiveId(null); setAllLog([]); setAllUsuals([]); setAllScans([]); setRecentMap({}); setDeleted([]);
  }, [setPeople, setActiveId, setAllLog, setAllUsuals, setAllScans, setRecentMap, setDeleted]);

  const snapshot = useMemo<Snapshot>(() => ({ v: 1, people, log: allLog, usuals: allUsuals, scans: allScans, deleted }), [people, allLog, allUsuals, allScans, deleted]);
  /** Replace this phone's data with merged data from the account. */
  const applySnapshot = useCallback((s: Snapshot) => {
    setPeople(s.people); setAllLog(s.log); setAllUsuals(s.usuals); setAllScans(s.scans); setDeleted(s.deleted);
    setActiveId(a => (a && s.people.some(p => p.id === a) ? a : s.people[0]?.id ?? null));
  }, [setPeople, setAllLog, setAllUsuals, setAllScans, setDeleted, setActiveId]);

  return {
    people, person, profile: person?.profile ?? null,
    setProfile, addPerson, renamePerson, switchPerson, deletePerson,
    log, addEntries, removeEntry, usuals, addUsual, removeUsual,
    scans, recordScan, recent, resetAll, snapshot, applySnapshot,
  };
}
