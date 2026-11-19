import { useMemo } from 'react';
import type { LogEntry, Profile, ScanEvent } from '../engine/types';
import { weeklyReport } from '../engine/report';
import { shiftDay } from './Log';

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', opts);
const nice = (x: number) => Math.round(x).toLocaleString('en-US');

export function ReportScreen({ name, p, log, scans, to, today, setTo }: {
  name: string; p: Profile; log: LogEntry[]; scans: ScanEvent[]; to: string; today: string; setTo: (d: string) => void;
}) {
  const r = useMemo(() => weeklyReport(log, scans, p, to), [log, scans, p, to]);
  const checked = r.verdicts.avoid + r.verdicts.caution + r.verdicts.good + r.verdicts.unknown;
  const range = `${fmtDay(r.from, { month: 'short', day: 'numeric' })} – ${fmtDay(r.to, { month: 'short', day: 'numeric' })}`;
  const maxK = Math.max(1, ...r.days.map(d => d.totals.kcal));

  return (
    <>
      <div className="daynav">
        <button aria-label="Previous week" onClick={() => setTo(shiftDay(to, -7))}>‹</button>
        <div style={{ textAlign: 'center' }}><h1 className="h">{name}’s week</h1><p className="sub">{range}</p></div>
        <button aria-label="Next week" disabled={to >= today} onClick={() => setTo(shiftDay(to, 7) > today ? today : shiftDay(to, 7))}>›</button>
      </div>

      <div className="totals" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div><b>{r.scans}</b><span>Scans</span></div>
        <div><b>{r.itemsLogged}</b><span>Foods logged</span></div>
        <div><b>{r.daysLogged}/7</b><span>Days logged</span></div>
      </div>

      {checked === 0 && r.itemsLogged === 0 ? (
        <div className="card"><p className="fine">Nothing scanned or logged this week yet. Your report fills in as you scan foods and log meals.</p></div>
      ) : (
        <>
          {r.highlights.length > 0 && (
            <section className="card stack">
              <h2 className="sec-title">This week at a glance</h2>
              <ul className="hl">{r.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </section>
          )}

          {checked > 0 && (
            <section className="stack">
              <h2 className="sec-title">Verdicts <small>{checked} foods checked</small></h2>
              <div className="vbar" role="img" aria-label={`Good ${r.verdicts.good}, Caution ${r.verdicts.caution}, Avoid ${r.verdicts.avoid}, Unknown ${r.verdicts.unknown}`}>
                {(['good', 'caution', 'avoid', 'unknown'] as const).map(v => r.verdicts[v] > 0 && <i key={v} className={`v-${v}`} style={{ flexGrow: r.verdicts[v] }} />)}
              </div>
              <div className="chips">
                {(['good', 'caution', 'avoid', 'unknown'] as const).map(v => <span key={v} className={`pill v-${v}`}>{v[0].toUpperCase() + v.slice(1)} {r.verdicts[v]}</span>)}
              </div>
            </section>
          )}

          {r.daysLogged > 0 && (
            <section className="stack">
              <h2 className="sec-title">Daily averages <small>On the {r.daysLogged} day{r.daysLogged > 1 ? 's' : ''} you logged</small></h2>
              <div className="stack" style={{ gap: 8 }}>
                {r.targets.map(t => {
                  const pct = Math.min(100, (t.avg / t.target) * 100);
                  const off = t.kind === 'max' ? t.avg > t.target : t.avg < t.target * 0.8;
                  return (
                    <div key={t.key} className={`meter ${off ? 'v-caution' : 'v-good'}`}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{t.label}</b>
                        <span className="fine">{nice(t.avg)} {t.unit} · {t.key === 'kcal' ? 'your need' : t.kind === 'max' ? 'limit' : 'goal'} {nice(t.target)} {t.unit}</span>
                      </div>
                      <div className="track"><i style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {r.daysLogged > 0 && (
            <section className="stack">
              <h2 className="sec-title">Calories by day</h2>
              <div className="days">
                {r.days.map(d => (
                  <div key={d.date} title={`${nice(d.totals.kcal)} kcal`}>
                    <span className="col"><i style={{ height: `${(d.totals.kcal / maxK) * 100}%` }} /></span>
                    <small>{fmtDay(d.date, { weekday: 'narrow' })}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {r.flagged.length > 0 && (
            <section className="stack">
              <h2 className="sec-title">Most flagged ingredients <small>In foods you logged</small></h2>
              <div className="results">{r.flagged.map(f => <div key={f.label} className="res"><span>{f.label}</span><b>{f.n}×</b></div>)}</div>
            </section>
          )}

          {r.topFoods.length > 0 && (
            <section className="stack">
              <h2 className="sec-title">Foods you logged most</h2>
              <div className="results">{r.topFoods.map(f => <div key={f.label} className="res"><span>{f.label}</span><b>{f.n}×</b></div>)}</div>
            </section>
          )}
        </>
      )}
      <div className="disclaimer">Limits shown: sugar 50 g (US Daily Value for added sugar), sodium 2,300 mg, fiber 14 g per 1,000 kcal. These are general guides, not medical advice.</div>
    </>
  );
}
