import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudConfigured } from './config';
import { deleteCloudData, friendlyError, getClient, pullSnapshot, pushSnapshot, signOut } from './client';
import { mergeSnapshots, type Snapshot } from './merge';

export type SyncState = 'off' | 'syncing' | 'synced' | 'error';
export interface Cloud {
  available: boolean;
  email: string | null;
  state: SyncState;
  error: string;
  lastSynced: number | null;
  syncNow: () => void;
  signOut: () => Promise<void>;
  deleteCloud: () => Promise<void>;
}

const SIGNED_IN_HINT = 'hc_signed_in_v1';

/**
 * Keeps this phone and the signed-in account in step. Signing in is the opt-in (R16): nothing is sent
 * until someone signs in. On sign-in, and whenever the app comes back to the screen, it pulls the account's
 * copy and merges; after local changes it pushes, a few seconds later.
 */
export function useCloud(snapshot: Snapshot, apply: (s: Snapshot) => void): Cloud {
  const available = cloudConfigured();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<SyncState>('off');
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const lastPushed = useRef<string>('');
  const busy = useRef(false);
  const listening = useRef(false);

  const listen = useCallback(async () => {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    setUserId(data.session?.user.id ?? null); setEmail(data.session?.user.email ?? null);
    if (listening.current) return;
    listening.current = true;
    sb.auth.onAuthStateChange((_e, session) => { setUserId(session?.user.id ?? null); setEmail(session?.user.email ?? null); });
  }, []);

  // Load the library only if this phone has signed in before, or a sign-in link just brought us back.
  useEffect(() => {
    if (!available) return;
    let hinted = false;
    try { hinted = !!localStorage.getItem(SIGNED_IN_HINT); } catch { /* ignore */ }
    const fromLink = /access_token=|error_description=|[?&]code=/.test(window.location.hash + window.location.search);
    if (!hinted && !fromLink) return;
    listen().then(() => { if (fromLink) history.replaceState(null, '', window.location.pathname); }).catch(() => {});
  }, [available, listen]);

  // Called by the sign-in form after it succeeds, so the hook starts listening.
  useEffect(() => {
    const onSignedIn = () => { listen().catch(() => {}); };
    window.addEventListener('hc-signed-in', onSignedIn);
    return () => window.removeEventListener('hc-signed-in', onSignedIn);
  }, [listen]);

  useEffect(() => {
    try { if (userId) localStorage.setItem(SIGNED_IN_HINT, '1'); } catch { /* ignore */ }
    if (!userId) { setState('off'); lastPushed.current = ''; }
  }, [userId]);

  const sync = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    setState('syncing');
    try {
      const remote = await pullSnapshot(userId);
      const merged = remote ? mergeSnapshots(latest.current, remote) : latest.current;
      const json = JSON.stringify(merged);
      if (json !== JSON.stringify(latest.current)) apply(merged);
      if (!remote || json !== JSON.stringify(remote)) await pushSnapshot(userId, merged);
      lastPushed.current = json;
      setError(''); setState('synced'); setLastSynced(Date.now());
    } catch (e) {
      setError(friendlyError(e)); setState('error');
    } finally {
      busy.current = false;
    }
  }, [userId, apply]);

  // First sync after sign-in, and again whenever the app comes back to the screen.
  useEffect(() => {
    if (!userId) return;
    sync();
    const onShow = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', sync);
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('online', sync); };
  }, [userId, sync]);

  // Push local changes a few seconds after they happen.
  useEffect(() => {
    if (!userId || state === 'off') return;
    if (JSON.stringify(snapshot) === lastPushed.current) return;
    const t = setTimeout(sync, 3000);
    return () => clearTimeout(t);
  }, [snapshot, userId, state, sync]);

  return {
    available, email, state, error, lastSynced,
    syncNow: sync,
    signOut: async () => {
      await signOut();
      try { localStorage.removeItem(SIGNED_IN_HINT); } catch { /* ignore */ }
      setUserId(null); setEmail(null);
    },
    deleteCloud: async () => {
      if (userId) await deleteCloudData(userId);
      await signOut();
      try { localStorage.removeItem(SIGNED_IN_HINT); } catch { /* ignore */ }
      setUserId(null); setEmail(null);
    },
  };
}
