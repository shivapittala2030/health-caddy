import type { LogEntry, Profile } from '../engine/types';
import { predict } from '../engine/predict';

const WORD = { good: 'Looks good', mixed: 'Mixed', watch: 'Watch' };

export function InsightsScreen({ p, entries, label }: { p: Profile; entries: LogEntry[]; label: string }) {
  const r = predict(entries, p);
  return (
    <>
      <div><h1 className="h">What to expect</h1><p className="sub">Based on the {r.count} item{r.count === 1 ? '' : 's'} logged {label.toLowerCase() === 'today' ? 'today' : `on ${label}`}. Tap a card to see the rules behind it.</p></div>
      {r.count === 0 && <div className="card"><p className="fine">Log a few meals and drinks first. Your forecast for digestion, sleep, energy and weight appears here.</p></div>}
      {r.count > 0 && r.out.map(o => (
        <details key={o.area} className={`card eff e-${o.st}`}>
          <summary style={{ listStyle: 'none' }}>
            <div className="eff-head"><h3>{o.area}</h3><span className={`pill e-${o.st}`}>{WORD[o.st]}</span></div>
            <div className="headline">{o.head}</div>
            <div className="when">{o.when}</div>
          </summary>
          <ul style={{ marginTop: 8 }}>
            {o.reasons.map((x, i) => <li key={i}>{x.t}<div className="rule">{x.rule}</div></li>)}
          </ul>
          {o.tips && <p className="fine" style={{ marginTop: 8 }}><b>Tip:</b> {o.tips}</p>}
        </details>
      ))}
      <div className="disclaimer">These are general estimates from simple, published nutrition rules, not medical advice. Everyone’s body is different. Talk to your doctor about any health concern.</div>
    </>
  );
}
