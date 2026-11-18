import { useCallback, useEffect, useState } from 'react';
import type { LogEntry, Profile, UsualMeal } from './engine/types';

/** Everything stays in this browser on this device (R16). Nothing is sent to a server. */
const KEYS = { profile: 'hc_profile_v1', log: 'hc_log_v1', usuals: 'hc_usuals_v1' };

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode or full */ }
}

function usePersisted<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => load(key, fallback));
  useEffect(() => { save(key, v); }, [key, v]);
  return [v, setV];
}

export const DEFAULT_PROFILE: Profile = {
  diet: 'lacto', avoid: [], custom: [], allergies: [], sens: [], goals: [], body: {}, tol: 'standard',
};

export function useStore() {
  const [profile, setProfile] = usePersisted<Profile | null>(KEYS.profile, null);
  const [log, setLog] = usePersisted<LogEntry[]>(KEYS.log, []);
  const [usuals, setUsuals] = usePersisted<UsualMeal[]>(KEYS.usuals, []);
  const addEntries = useCallback((es: LogEntry[]) => setLog(l => [...l, ...es]), [setLog]);
  const removeEntry = useCallback((id: string) => setLog(l => l.filter(e => e.id !== id)), [setLog]);
  const resetAll = useCallback(() => {
    Object.values(KEYS).forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
    setProfile(null); setLog([]); setUsuals([]);
  }, [setProfile, setLog, setUsuals]);
  return { profile, setProfile, log, setLog, addEntries, removeEntry, usuals, setUsuals, resetAll };
}

export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
