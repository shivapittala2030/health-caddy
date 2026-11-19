import { useState, type ReactNode } from 'react';
import type { DietKey, GoalKey, Person, Profile, ToleranceKey } from '../engine/types';
import { ALLERGENS, AVOIDABLES, DIETS, GOALS, SENSITIVITIES, TOLERANCES } from '../engine/rules';

type Set = (p: Profile) => void;
const toggle = <T,>(a: T[], v: T) => a.includes(v) ? a.filter(x => x !== v) : [...a, v];

export function profileSummary(p: Profile): string {
  const bits = [DIETS[p.diet].label];
  if (p.allergies.length) bits.push(`${p.allergies.length} allerg${p.allergies.length > 1 ? 'ies' : 'y'}`);
  const av = p.avoid.length + p.custom.length;
  if (av) bits.push(`${av} avoided`);
  return bits.join(' · ');
}

export function DietSection({ p, set }: { p: Profile; set: Set }) {
  return (
    <section className="stack">
      <h2 className="sec-title">Diet</h2>
      <div className="opts">
        {(Object.keys(DIETS) as DietKey[]).map(k => (
          <button key={k} className="opt" aria-pressed={p.diet === k} onClick={() => set({ ...p, diet: k })}>
            <b>{DIETS[k].label}</b><small>{DIETS[k].desc}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AvoidSection({ p, set }: { p: Profile; set: Set }) {
  const [word, setWord] = useState('');
  const addWord = () => {
    const w = word.trim();
    if (w && !p.custom.some(c => c.toLowerCase() === w.toLowerCase())) set({ ...p, custom: [...p.custom, w] });
    setWord('');
  };
  return (
    <section className="stack">
      <h2 className="sec-title">Things I avoid</h2>
      <div className="chips">
        {Object.entries(AVOIDABLES).map(([k, a]) => (
          <button key={k} className="chip" aria-pressed={p.avoid.includes(k)} onClick={() => set({ ...p, avoid: toggle(p.avoid, k) })}>{a.label}</button>
        ))}
      </div>
      {p.avoid.map(k => AVOIDABLES[k] && <p key={k} className="syn"><b>{AVOIDABLES[k].label}:</b> {AVOIDABLES[k].syn}</p>)}
      <form className="row" onSubmit={e => { e.preventDefault(); addWord(); }}>
        <input className="inp grow" value={word} onChange={e => setWord(e.target.value)} placeholder="Add your own, e.g. mushrooms" aria-label="Add an ingredient to avoid" />
        <button className="btn small" type="submit" disabled={!word.trim()}>Add</button>
      </form>
      {p.custom.length > 0 && (
        <div className="chips">
          {p.custom.map(w => (
            <button key={w} className="chip" aria-pressed="true" onClick={() => set({ ...p, custom: p.custom.filter(x => x !== w) })} aria-label={`Remove ${w}`}>
              {w}<span className="rm" aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function AllergySection({ p, set }: { p: Profile; set: Set }) {
  return (
    <>
      <section className="stack">
        <h2 className="sec-title">Allergies <small>Always Avoid</small></h2>
        <div className="chips">
          {Object.entries(ALLERGENS).map(([k, a]) => (
            <button key={k} className="chip" aria-pressed={p.allergies.includes(k)} onClick={() => set({ ...p, allergies: toggle(p.allergies, k) })}>{a.label}</button>
          ))}
        </div>
      </section>
      <section className="stack">
        <h2 className="sec-title">Sensitivities <small>Shown as Caution</small></h2>
        <div className="chips">
          {Object.entries(SENSITIVITIES).map(([k, s]) => (
            <button key={k} className="chip" aria-pressed={p.sens.includes(k)} onClick={() => set({ ...p, sens: toggle(p.sens, k) })}>{s.label}</button>
          ))}
        </div>
      </section>
    </>
  );
}

export function GoalsSection({ p, set }: { p: Profile; set: Set }) {
  const b = p.body;
  const setB = (patch: Partial<Profile['body']>) => set({ ...p, body: { ...b, ...patch } });
  const numOrU = (v: string) => v === '' ? undefined : Number(v);
  return (
    <>
      <section className="stack">
        <h2 className="sec-title">Health goals</h2>
        <div className="chips">
          {(Object.keys(GOALS) as GoalKey[]).map(k => (
            <button key={k} className="chip" aria-pressed={p.goals.includes(k)} onClick={() => set({ ...p, goals: toggle(p.goals, k) })}>{GOALS[k]}</button>
          ))}
        </div>
      </section>
      <section className="stack">
        <h2 className="sec-title">About you <small>Optional, for calorie estimates</small></h2>
        <div className="grid3">
          <label className="field">Age<input inputMode="numeric" value={b.age ?? ''} onChange={e => setB({ age: numOrU(e.target.value.replace(/\D/g, '')) })} /></label>
          <label className="field">Height ft<input inputMode="numeric" value={b.ft ?? ''} onChange={e => setB({ ft: numOrU(e.target.value.replace(/\D/g, '')) })} /></label>
          <label className="field">in<input inputMode="numeric" value={b.inch ?? ''} onChange={e => setB({ inch: numOrU(e.target.value.replace(/\D/g, '')) })} /></label>
        </div>
        <div className="grid3">
          <label className="field">Weight lb<input inputMode="numeric" value={b.lb ?? ''} onChange={e => setB({ lb: numOrU(e.target.value.replace(/\D/g, '')) })} /></label>
          <label className="field">Sex
            <select value={b.sex ?? ''} onChange={e => setB({ sex: e.target.value as Profile['body']['sex'] })}>
              <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option>
            </select>
          </label>
          <label className="field">Activity
            <select value={b.activity ?? 'light'} onChange={e => setB({ activity: e.target.value as Profile['body']['activity'] })}>
              <option value="low">Low</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="high">High</option>
            </select>
          </label>
        </div>
      </section>
      <section className="stack">
        <h2 className="sec-title">Additives</h2>
        <div className="opts">
          {(Object.keys(TOLERANCES) as ToleranceKey[]).map(k => (
            <button key={k} className="opt" aria-pressed={p.tol === k} onClick={() => set({ ...p, tol: k })}>
              <b>{TOLERANCES[k].label}</b><small>{TOLERANCES[k].desc}</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

const STEPS = [
  { title: 'How do you eat?', sub: 'Pick the diet you follow. You can change it any time.', C: DietSection },
  { title: 'Anything else you avoid?', sub: 'We also catch hidden names, like albumin for egg.', C: AvoidSection },
  { title: 'Allergies and sensitivities', sub: 'Allergens are always shown as Avoid.', C: AllergySection },
  { title: 'Goals and additives', sub: 'These shape your daily insights. All optional.', C: GoalsSection },
];

export function Onboarding({ initial, first, onDone, onCancel, signIn }: {
  initial: Profile; first: boolean; onDone: (name: string, p: Profile) => void; onCancel?: () => void; signIn?: ReactNode;
}) {
  const [showSignIn, setShowSignIn] = useState(false);
  const [p, setP] = useState(initial);
  const [name, setName] = useState('');
  const [i, setI] = useState(-1); // -1 is the name step
  const total = STEPS.length + 1;
  const S = i >= 0 ? STEPS[i] : null;
  return (
    <div className="onb" role="dialog" aria-modal="true" aria-label="Set up a profile">
      <div className="top">
        <div className="bar" aria-hidden="true"><i style={{ width: `${((i + 2) / total) * 100}%` }} /></div>
        <p className="sub">Step {i + 2} of {total}</p>
        <h1 className="h">{S ? S.title : first ? 'Welcome to Health Caddy' : 'Add a person'}</h1>
        <p className="sub">{S ? S.sub : first
          ? 'Each person gets their own diet, allergies, food log and weekly report. You can add family members later.'
          : 'They get their own diet, allergies, food log and weekly report on this phone.'}</p>
      </div>
      <div className="body">
        {S ? <S.C p={p} set={setP} /> : (
          <>
            <label className="field">{first ? 'What should we call you?' : 'Name'}
              <input autoFocus value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder={first ? 'e.g. Siva' : 'e.g. Mom'} />
            </label>
            {first && signIn && (showSignIn
              ? <section className="card stack"><h2 className="sec-title">Sign in to your account</h2><p className="fine">Your profiles and food logs come back once you’re signed in.</p>{signIn}</section>
              : <button className="linkbtn" onClick={() => setShowSignIn(true)}>Already use Health Caddy on another phone? Sign in</button>)}
          </>
        )}
      </div>
      <div className="foot">
        {i >= 0 ? <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>
          : onCancel && <button className="btn ghost" onClick={onCancel}>Cancel</button>}
        {i < STEPS.length - 1
          ? <button className="btn" disabled={i === -1 && !name.trim()} onClick={() => setI(i + 1)}>Next</button>
          : <button className="btn" onClick={() => onDone(name, p)}>Start scanning</button>}
      </div>
    </div>
  );
}

/** Bottom sheet listing everyone on this phone. */
export function PeopleSheet({ people, activeId, onSwitch, onAdd, onClose }: {
  people: Person[]; activeId: string; onSwitch: (id: string) => void; onAdd: () => void; onClose: () => void;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Who is using Health Caddy">
        <div className="grab" />
        <h2 className="h">Who’s using Health Caddy?</h2>
        <div className="results">
          {people.map(x => (
            <button key={x.id} className="res" aria-current={x.id === activeId ? 'true' : undefined} onClick={() => onSwitch(x.id)}>
              <span className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="avatar" aria-hidden="true">{initials(x.name)}</span>
                <span><b>{x.name}</b><small>{profileSummary(x.profile)}</small></span>
              </span>
              {x.id === activeId && <span className="pill v-good">Active</span>}
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={onAdd}>+ Add a person</button>
        <p className="fine">Each person’s profile, food log and report are kept separately on this phone.</p>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </>
  );
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

export function ProfileScreen({ person, set, onRename, onDelete, onReset, others, account, signedIn }: {
  person: Person; set: Set; onRename: (name: string) => void; onDelete: () => void; onReset: () => void; others: number;
  account?: ReactNode; signedIn?: boolean;
}) {
  const p = person.profile;
  const [confirm, setConfirm] = useState<'' | 'person' | 'all'>('');
  return (
    <>
      <div><h1 className="h">{person.name}’s profile</h1><p className="sub">Every verdict is worked out from these settings. Changes apply right away.</p></div>
      <label className="field">Name<input value={person.name} maxLength={40} onChange={e => onRename(e.target.value)} /></label>
      <DietSection p={p} set={set} />
      <AvoidSection p={p} set={set} />
      <AllergySection p={p} set={set} />
      <GoalsSection p={p} set={set} />
      {account}
      <section className="card stack">
        <h2 className="sec-title">Your data</h2>
        <p className="fine">{signedIn
          ? 'Profiles, food logs and reports are saved on this phone and in your private account. Only you can see your account’s data.'
          : 'Profiles, food logs and reports are saved only in this browser on this phone. Nothing is sent to us.'} Product lookups go to Open Food Facts with only the barcode or search words.</p>
        {confirm === 'person' ? (
          <div className="row"><span className="grow fine">Delete {person.name}’s profile, food log and report?</span><button className="btn small danger" onClick={() => { setConfirm(''); onDelete(); }}>Delete</button><button className="btn small ghost" onClick={() => setConfirm('')}>Cancel</button></div>
        ) : confirm === 'all' ? (
          <div className="row"><span className="grow fine">Delete everyone’s profiles and logs on this phone?{signedIn ? ' You’ll be signed out; your cloud copy stays.' : ''}</span><button className="btn small danger" onClick={onReset}>Delete all</button><button className="btn small ghost" onClick={() => setConfirm('')}>Cancel</button></div>
        ) : (
          <div className="row">
            <button className="btn ghost small" onClick={() => setConfirm('person')}>Delete {person.name}</button>
            {others > 0 && <button className="btn ghost small" onClick={() => setConfirm('all')}>Delete everyone’s data</button>}
          </div>
        )}
      </section>
      <section className="card stack">
        <h2 className="sec-title">About</h2>
        <p className="fine">Product data comes from <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>, a free database built by volunteers and shared under the Open Database License. Home-food nutrition is rounded from USDA FoodData Central.</p>
        <p className="fine">Health Caddy gives general guidance, not medical advice. Always read the package label, and talk to your doctor about allergies and health conditions.</p>
      </section>
    </>
  );
}
