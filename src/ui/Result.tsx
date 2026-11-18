import { useMemo, useState, type ReactNode } from 'react';
import type { FoodItem, Level, Profile } from '../engine/types';
import { evaluate, VERDICT_WORD } from '../engine/evaluate';
import { ICONS } from './icons';

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wrap flagged words in the ingredient text with coloured marks. */
export function highlight(text: string, flags: Record<string, Level>): ReactNode[] {
  const words = Object.keys(flags).filter(w => (flags[w] === 'avoid' || flags[w] === 'caution') && w.length > 1).sort((a, b) => b.length - a.length);
  if (!words.length) return [text];
  const re = new RegExp(`(${words.map(w => reEsc(w).replace(/ /g, '\\s+')).join('|')})`, 'gi');
  return text.split(re).map((part, i) => {
    if (i % 2 === 0) return part;
    const lvl = flags[part.toLowerCase().replace(/\s+/g, ' ')] || 'caution';
    return <mark key={i} className={`m-${lvl}`}>{part}</mark>;
  });
}

export function VerdictPill({ item, p }: { item: FoodItem; p: Profile }) {
  const v = useMemo(() => evaluate(item, p).verdict, [item, p]);
  return <span className={`pill v-${v}`}>{VERDICT_WORD[v]}</span>;
}

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface Props {
  item: FoodItem; p: Profile;
  onBack: () => void;
  onLog: (servings: number, time: number) => void;
  onScanLabel: () => void;
  defaultTime: number;
}

export function ResultView({ item, p, onBack, onLog, onScanLabel, defaultTime }: Props) {
  const ev = useMemo(() => evaluate(item, p), [item, p]);
  const [servings, setServings] = useState(1);
  const [time, setTime] = useState(toHHMM(defaultTime));
  const n = item.n || {};
  const est = (k: keyof typeof n) => item.estimated?.includes(k) ? '*' : '';
  const val = (x: number | undefined, unit: string) => x === undefined ? '–' : `${x}${unit}`;
  const offUrl = item.source === 'openfoodfacts' ? `https://world.openfoodfacts.org/product/${item.id}` : null;

  return (
    <>
      <button className="back" onClick={onBack}>‹ Back</button>
      <div className={`banner v-${ev.verdict}`} role="status">
        <div className="top">
          <div className="stack" style={{ gap: 6 }}>
            <div className="word">{ICONS[ev.verdict]}{VERDICT_WORD[ev.verdict]}</div>
            <div className="pname">{item.name}</div>
            <div className="meta">{[item.brand, item.serving && `Serving: ${item.serving}`, item.source === 'openfoodfacts' && !item.notFound && `UPC ${item.id}`].filter(Boolean).join(' · ')}</div>
          </div>
          {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
        </div>
      </div>

      <section className="stack">
        <h2 className="sec-title">Why <small>Based on your profile</small></h2>
        <ul className="reasons">
          {ev.reasons.map((r, i) => (
            <li key={i} className={`v-${r.lvl}`}><span className="dot" aria-hidden="true" /><span>{r.text}<small>{r.src}</small></span></li>
          ))}
        </ul>
      </section>

      {item.notFound ? (
        <section className="card stack">
          <p className="fine">You can still check this food by taking a photo of its ingredient list.</p>
          <button className="btn" onClick={onScanLabel}>{ICONS.camera}Scan the ingredient label</button>
          <a className="fine" href={`https://world.openfoodfacts.org/cgi/product.pl?code=${item.id}`} target="_blank" rel="noreferrer">Add this product to Open Food Facts so it works for everyone</a>
        </section>
      ) : (
        <>
          {item.n && (
            <section className="stack">
              <h2 className="sec-title">Nutrition <small>Per serving</small></h2>
              <div className="nut">
                <div><span>Calories</span><b>{val(n.kcal, '')}</b></div>
                <div><span>Protein</span><b>{val(n.protein, ' g')}</b></div>
                <div><span>Fiber</span><b>{val(n.fiber, ' g')}</b></div>
                <div><span>Sugar</span><b>{val(n.sugar, ' g')}</b></div>
                <div><span>Sodium</span><b>{val(n.sodium, ' mg')}</b></div>
                <div><span>Caffeine{est('caffeine')}</span><b>{val(n.caffeine, ' mg')}</b></div>
              </div>
              {item.estimated?.length ? <p className="fine">* Estimated from the ingredients; the database doesn’t list it.</p> : null}
            </section>
          )}
          <section className="stack">
            <h2 className="sec-title">Ingredients</h2>
            <p className="ingr">{item.ingredients ? highlight(item.ingredients, ev.flags) : 'No ingredient list available.'}</p>
            {item.allergens?.length ? <p className="fine">Declared allergens: {item.allergens.join(', ')}</p> : null}
            {item.traces?.length ? <p className="fine">May contain: {item.traces.join(', ')}</p> : null}
          </section>

          <section className="card stack">
            <h2 className="sec-title">Add to today’s log</h2>
            <div className="grid2">
              <label className="field">Servings
                <select value={servings} onChange={e => setServings(Number(e.target.value))}>
                  {[0.5, 1, 1.5, 2, 3].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">Time<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
            </div>
            <button className="btn" onClick={() => { const [h, m] = time.split(':').map(Number); onLog(servings, (h || 0) * 60 + (m || 0)); }}>Add to log</button>
          </section>
        </>
      )}

      {offUrl && (
        <p className="fine">
          Product data from <a href={offUrl} target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL). Something wrong or missing? <a href={offUrl} target="_blank" rel="noreferrer">Fix it there</a> and it improves for everyone. Always check the package label too.
        </p>
      )}
    </>
  );
}
