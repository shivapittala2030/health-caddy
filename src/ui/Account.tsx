import { useState } from 'react';
import type { Cloud } from '../cloud/useCloud';
import { friendlyError, sendSignInEmail, verifyCode } from '../cloud/client';

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/** Email sign-in with a link or a 6-digit code. No passwords to remember. */
export function SignInForm({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setBusy(true); setErr('');
    try { await sendSignInEmail(email.trim()); setSent(true); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr('');
    try { await verifyCode(email.trim(), code.trim()); window.dispatchEvent(new Event('hc-signed-in')); onDone?.(); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  if (!sent) return (
    <form className="stack" onSubmit={e => { e.preventDefault(); send(); }}>
      <label className="field">Email<input type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <button className="btn" type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
      {err && <div className="err" role="alert">{err}</div>}
    </form>
  );
  return (
    <div className="stack">
      <p className="fine">We sent an email to <b>{email}</b>. Tap the link in it on this phone. Or type the code from the email here.</p>
      <form className="row" onSubmit={e => { e.preventDefault(); verify(); }}>
        <input className="inp grow" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="Code from the email" aria-label="Sign-in code" />
        <button className="btn" type="submit" disabled={busy || code.length < 6}>Sign in</button>
      </form>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="linkbtn fine" onClick={() => { setSent(false); setCode(''); setErr(''); }}>Use a different email or send again</button>
    </div>
  );
}

export function AccountCard({ cloud }: { cloud: Cloud }) {
  const [confirm, setConfirm] = useState(false);
  if (!cloud.available) return null;
  return (
    <section className="card stack">
      <h2 className="sec-title">Account and sync <small>{cloud.email ? 'Signed in' : 'Optional'}</small></h2>
      {cloud.email ? (
        <>
          <p className="fine">Signed in as <b>{cloud.email}</b>. Everyone’s profiles, food logs and reports on this phone are backed up to your account and stay in step on any phone where you sign in.</p>
          <p className="fine" role="status">
            {cloud.state === 'syncing' ? 'Syncing…' : cloud.state === 'error' ? cloud.error : cloud.lastSynced ? `Synced ${ago(cloud.lastSynced)}.` : 'Waiting to sync.'}
          </p>
          <div className="row">
            <button className="btn small ghost" onClick={cloud.syncNow} disabled={cloud.state === 'syncing'}>Sync now</button>
            <button className="btn small ghost" onClick={() => cloud.signOut()}>Sign out</button>
          </div>
          {confirm ? (
            <div className="row"><span className="grow fine">Delete your account’s cloud copy? This phone keeps its data.</span>
              <button className="btn small danger" onClick={() => { setConfirm(false); cloud.deleteCloud().catch(() => {}); }}>Delete</button>
              <button className="btn small ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
          ) : <button className="linkbtn fine" onClick={() => setConfirm(true)}>Delete my cloud copy</button>}
        </>
      ) : (
        <>
          <p className="fine">Sign in to back up your profiles and food logs and use them on other phones. Without signing in, everything stays only on this phone.</p>
          <SignInForm />
        </>
      )}
    </section>
  );
}
