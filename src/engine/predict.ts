import type { LogEntry, Nutrition, Profile } from './types';
import { scanText } from './evaluate';

export type Outlook = 'good' | 'mixed' | 'watch';
export interface PredictionReason { t: string; rule: string }
export interface Prediction { area: 'Digestion' | 'Sleep' | 'Energy' | 'Weight'; st: Outlook; head: string; when: string; reasons: PredictionReason[]; tips: string }
export type Totals = Required<Nutrition>;

export const fmtTime = (m: number) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Daily energy need (Mifflin–St Jeor × activity), rounded to 50 kcal; 2,000 kcal when body data is missing. */
export function needKcal(p: Profile): { kcal: number; basis: string } {
  const b = p.body || {};
  const lb = Number(b.lb), ft = Number(b.ft), inch = Number(b.inch) || 0, age = Number(b.age);
  if (!lb || !ft || !age) return { kcal: 2000, basis: 'Using 2,000 kcal because your body data is not set.' };
  const kg = lb * 0.4536, cm = (ft * 12 + inch) * 2.54;
  const sexAdj = b.sex === 'male' ? 5 : b.sex === 'female' ? -161 : -78;
  const act = ({ low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 } as Record<string, number>)[b.activity || ''] || 1.375;
  const k = Math.round(((10 * kg + 6.25 * cm - 5 * age + sexAdj) * act) / 50) * 50;
  return { kcal: k, basis: `About ${k.toLocaleString('en-US')} kcal a day, estimated from your age, height, weight and activity.` };
}

const nv = (e: LogEntry, k: keyof Nutrition) => (e.item.n?.[k] ?? 0) * (e.servings || 1);
const r1 = (x: number) => Math.round(x * 10) / 10;

export function totals(entries: LogEntry[]): Totals {
  const T: Totals = { kcal: 0, protein: 0, fiber: 0, sugar: 0, sodium: 0, caffeine: 0 };
  for (const e of entries) for (const k of Object.keys(T) as (keyof Totals)[]) T[k] += nv(e, k);
  for (const k of Object.keys(T) as (keyof Totals)[]) T[k] = k === 'sodium' || k === 'kcal' || k === 'caffeine' ? Math.round(T[k]) : r1(T[k]);
  return T;
}

/** Transparent, research-based rules (R13) for the next 24 to 48 hours (F8). Pass one day's entries. */
export function predict(entries: LogEntry[], p: Profile) {
  const es = [...entries].sort((a, b) => a.time - b.time);
  const T = totals(es);
  const need = needKcal(p);
  const out: Prediction[] = [];
  const has = (e: LogEntry, tag: string) => scanText(e.item.ingredients || '').some(h => h.tag === tag && !h.trace);

  // Digestion
  {
    const target = Math.round((need.kcal / 1000) * 14);
    const ratio = T.fiber / target;
    const reasons: PredictionReason[] = [];
    let st: Outlook = ratio >= 0.8 ? 'good' : ratio >= 0.5 ? 'mixed' : 'watch';
    reasons.push({ t: `Fiber so far: ${T.fiber} g of about ${target} g for the day.`, rule: 'US Dietary Guidelines suggest 14 g of fiber per 1,000 kcal. Less than half of that is linked to slower digestion.' });
    const sw = es.filter(e => has(e, 'art_sweetener'));
    if (sw.length) {
      reasons.push({ t: `Artificial sweeteners in ${sw.length} item${sw.length > 1 ? 's' : ''} (${sw.map(e => e.item.name).join(', ')}).`, rule: 'Some people get gas or bloating from sweeteners, mostly at larger amounts.' });
      if (sw.length >= 2 && st === 'good') st = 'mixed';
    }
    if (p.sens.includes('lactose')) {
      const d = es.filter(e => has(e, 'dairy'));
      if (d.length) {
        reasons.push({ t: `${d.length} dairy item${d.length > 1 ? 's' : ''} today with your lactose sensitivity.`, rule: 'Lactose discomfort usually shows within 30 minutes to 2 hours.' });
        if (st === 'good') st = 'mixed';
      }
    }
    const head = { good: 'Comfortable, regular digestion likely tomorrow.', mixed: 'Mostly comfortable. A bit more fiber would help.', watch: 'Digestion may feel slow tomorrow.' }[st];
    out.push({ area: 'Digestion', st, head, when: 'Next 12 to 36 hours', reasons, tips: st !== 'good' ? 'Add a bowl of dal, a pear or a side of vegetables to close the gap.' : '' });
  }

  // Sleep: caffeine still active at 10 PM, with a 5-hour half-life.
  {
    let caf10 = 0;
    for (const e of es) { const c = nv(e, 'caffeine'); if (c && e.time <= 1320) caf10 += c * Math.pow(0.5, (1320 - e.time) / 300); }
    caf10 = Math.round(caf10);
    const late = es.filter(e => e.time >= 840 && nv(e, 'caffeine') > 0);
    let st: Outlook = caf10 >= 50 ? 'watch' : caf10 >= 15 ? 'mixed' : 'good';
    const reasons: PredictionReason[] = [{
      t: late.length ? `About ${caf10} mg caffeine still active at 10 PM, mostly from ${late.map(e => `${e.item.name} at ${fmtTime(e.time)}`).join(', ')}.` : `About ${caf10} mg caffeine still active at 10 PM.`,
      rule: 'Caffeine has a half-life of about 5 hours. Caffeine within 6 hours of bedtime can shorten sleep.',
    }];
    const lateK = Math.round(es.filter(e => e.time >= 1230).reduce((s, e) => s + nv(e, 'kcal'), 0));
    if (lateK >= 400) {
      reasons.push({ t: `${lateK} kcal eaten after 8:30 PM.`, rule: 'A large meal within 2 to 3 hours of bed can cause reflux and lighter sleep.' });
      if (st === 'good') st = 'mixed';
    }
    const head = { good: 'Falling asleep should be easy tonight.', mixed: 'Sleep may come a little later tonight.', watch: 'Falling asleep may take longer tonight.' }[st];
    out.push({ area: 'Sleep', st, head, when: 'Tonight', reasons, tips: st !== 'good' ? 'Keep caffeine before 2 PM tomorrow.' : '' });
  }

  // Energy
  {
    const spikes = es.filter(e => nv(e, 'sugar') >= 20 && nv(e, 'fiber') < 3 && nv(e, 'protein') < 5);
    const reasons: PredictionReason[] = [];
    if (spikes.length) reasons.push({ t: `Sugar with little fiber or protein: ${spikes.map(e => `${e.item.name} (${r1(nv(e, 'sugar'))} g)`).join(', ')}.`, rule: 'Fast sugar without fiber or protein often brings a dip in energy 1 to 2 hours later.' });
    else reasons.push({ t: 'No high-sugar, low-fiber items logged today.', rule: 'Meals that pair carbs with fiber and protein release energy more evenly.' });
    const breakfastP = r1(es.filter(e => e.time < 660).reduce((s, e) => s + nv(e, 'protein'), 0));
    reasons.push({ t: `Protein so far: ${T.protein} g, with ${breakfastP} g before 11 AM.`, rule: 'Around 15 to 25 g of protein at breakfast helps steady mid-morning energy.' });
    const sleep = out[1].st;
    if (sleep !== 'good') reasons.push({ t: 'Tonight’s sleep forecast is not ideal.', rule: 'Shorter sleep often means lower energy the next morning.' });
    const st: Outlook = spikes.length >= 2 || sleep === 'watch' ? 'watch' : spikes.length === 1 || sleep === 'mixed' || breakfastP < 10 ? 'mixed' : 'good';
    const head = { good: 'Steady energy likely through tomorrow.', mixed: 'Mostly steady, with a possible slow start tomorrow.', watch: 'Expect an energy dip tomorrow.' }[st];
    out.push({ area: 'Energy', st, head, when: 'Rest of today and tomorrow', reasons, tips: st !== 'good' ? 'A protein-rich breakfast such as Greek yogurt, dal or a paneer wrap helps.' : '' });
  }

  // Weight
  {
    const reasons: PredictionReason[] = [];
    const diff = T.kcal - need.kcal;
    reasons.push({ t: `${T.kcal.toLocaleString('en-US')} kcal logged so far today. ${need.basis}`, rule: 'About 3,500 extra kcal adds roughly 1 lb of body fat over time; one day moves it very little.' });
    let st: Outlook = diff > 300 ? 'watch' : diff > 0 ? 'mixed' : 'good';
    if (T.sodium > 2300) {
      reasons.push({ t: `Sodium so far: ${T.sodium.toLocaleString('en-US')} mg, over the 2,300 mg daily value.`, rule: 'Extra sodium holds water for 1 to 2 days, so the scale can read 0.5 to 2 lb higher. That is water, not fat.' });
      if (st === 'good') st = 'mixed';
    } else reasons.push({ t: `Sodium so far: ${T.sodium.toLocaleString('en-US')} mg of the 2,300 mg daily value.`, rule: 'Staying under the daily value avoids most water-weight swings.' });
    const head = { good: 'Weight should stay steady.', mixed: T.sodium > 2300 ? 'The scale may read a little higher from water, not fat.' : 'Slightly over your estimated need today.', watch: 'Over your estimated need today.' }[st];
    out.push({ area: 'Weight', st, head, when: 'Next 24 to 48 hours', reasons, tips: '' });
  }

  return { T, out, count: es.length, need };
}
