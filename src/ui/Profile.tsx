import { useState } from 'react';
import type { DietKey, GoalKey, Profile, ToleranceKey } from '../engine/types';
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

export function Onboarding({ initial, onDone }: { initial: Profile; onDone: (p: Profile) => void }) {
  const [p, setP] = useState(initial);
  const [i, setI] = useState(0);
  const S = STEPS[i];
  return (
    <div className="onb" role="dialog" aria-modal="true" aria-label="Set up your profile">
      <div className="top">
        <div className="bar" aria-hidden="true"><i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>
        <p className="sub">Step {i + 1} of {STEPS.length}</p>
        <h1 className="h">{S.title}</h1>
        <p className="sub">{S.sub}</p>
      </div>
      <div className="body"><S.C p={p} set={setP} /></div>
      <div className="foot">
        {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>}
        {i < STEPS.length - 1
          ? <button className="btn" onClick={() => setI(i + 1)}>Next</button>
          : <button className="btn" onClick={() => onDone(p)}>Start scanning</button>}
      </div>
    </div>
  );
}

export function ProfileScreen({ p, set, onReset }: { p: Profile; set: Set; onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div><h1 className="h">Your profile</h1><p className="sub">Every verdict is worked out from these settings. Changes apply right away.</p></div>
      <DietSection p={p} set={set} />
      <AvoidSection p={p} set={set} />
      <AllergySection p={p} set={set} />
      <GoalsSection p={p} set={set} />
      <section className="card stack">
        <h2 className="sec-title">Your data</h2>
        <p className="fine">Your profile and food log are saved only in this browser on this device. Nothing is sent to us. Product lookups go to Open Food Facts with only the barcode or search words.</p>
        {confirm
          ? <div className="row"><span className="grow fine">Delete your profile and the whole food log?</span><button className="btn small danger" onClick={onReset}>Delete</button><button className="btn small ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
          : <button className="btn ghost small" onClick={() => setConfirm(true)}>Delete my data</button>}
      </section>
      <section className="card stack">
        <h2 className="sec-title">About</h2>
        <p className="fine">Product data comes from <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>, a free database built by volunteers and shared under the Open Database License. Home-food nutrition is rounded from USDA FoodData Central.</p>
        <p className="fine">Health Caddy gives general guidance, not medical advice. Always read the package label, and talk to your doctor about allergies and health conditions.</p>
      </section>
    </>
  );
}
