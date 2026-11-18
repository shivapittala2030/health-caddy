import type { Evaluation, FoodItem, Level, Profile, Reason } from './types';
import {
  ADDITIVE_NAME, ALLERGENS, ALLERGEN_TAG_MAP, AVOIDABLES, DICT, DIETS, SENSITIVITIES, TAGTXT, TOLERANCES,
} from './rules';

export interface Hit { tag: string; word: string; trace: boolean }

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lower-case and rewrite plant-based look-alikes so they don't trip animal rules. */
export function normalize(t: string): string {
  return (' ' + String(t).toLowerCase().replace(/[‐-―]/g, '-').replace(/\s+/g, ' ') + ' ')
    .replace(/\b(peanut|almond|cashew|cocoa|shea|nut|apple|sunflower|seed|soy|coconut) butter\b/g, '$1 spread')
    .replace(/\b(coconut|almond|oat|soy|rice|cashew|pea|hemp) (milk|cream|yog(h)?urt|cheese)\b/g, '$1 $2_plant')
    .replace(/cream of tartar/g, 'tartar')
    .replace(/\b(egg ?plants?|butternut|butterhead|milkweed|milk thistle)\b/g, m => m.replace(/egg|butter|milk/g, 'x_'))
    .replace(/\b(microbial|vegetable|non-animal|plant-based|vegetarian) (enzymes|rennet)\b/g, '$1 culture')
    .replace(/\bvitamin d3 \((from )?lichen\)/g, 'vitamin_d3 (lichen)')
    .replace(/\bgluten[- ]free\b/g, 'gf')
    .replace(/\b(dairy|milk|egg|soy|nut|peanut)[- ]free\b/g, 'freeof_$1')
    .replace(/\bdecaf(feinated)? (coffee|tea)\b/g, 'decaf_$2')
    .replace(/\bcaffeine[- ]free\b/g, 'freeof_caffeine');
}

const TRACE_RE = /may contain|processed in a facility|made on shared equipment|manufactured in a facility|produced in a facility|made in a facility/;

/** Find every dictionary tag in an ingredient list. Words after "may contain" are traces. */
export function scanText(text: string): Hit[] {
  const s = normalize(text);
  const i = s.search(TRACE_RE);
  const parts: [string, boolean][] = i >= 0 ? [[s.slice(0, i), false], [s.slice(i), true]] : [[s, false]];
  const hits: Hit[] = [];
  for (const [tag, re] of DICT) {
    const g = new RegExp(re.source, 'g');
    const seen = new Set<string>();
    for (const [part, trace] of parts) {
      g.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = g.exec(part))) {
        const k = m[0] + trace;
        if (!seen.has(k)) { seen.add(k); hits.push({ tag, word: m[0], trace }); }
      }
    }
  }
  if (hits.some(h => h.tag === 'animal_rennet')) return hits.filter(h => h.tag !== 'rennet_possible');
  return hits;
}

function origCase(w: string, text: string): string {
  const m = String(text).match(new RegExp(reEsc(w).replace(/ /g, '\\s+'), 'i'));
  const o = m ? m[0] : w;
  return o.length > 2 && o === o.toUpperCase() ? o : o.toLowerCase();
}
export const joinWords = (ws: string[]) => ws.length < 2 ? ws[0] : ws.slice(0, -1).join(', ') + ' and ' + ws[ws.length - 1];
const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Fewer than two real ingredients, or none at all, means we can't vouch for the food. */
export function looksIncomplete(item: FoodItem): string | undefined {
  if (item.incompleteReason) return item.incompleteReason;
  if (item.notFound) return "This barcode isn't in the food database yet, so we can't check it. You can scan the ingredient label instead.";
  if (item.whole) return undefined;
  const parts = (item.ingredients || '').split(/[,.;]/).filter(x => x.trim().length > 1);
  if (!item.ingredients.trim()) return 'No ingredient list is available for this product, so we can’t check it.';
  if (item.source === 'label' && parts.length < 2) return "We couldn't read enough of the ingredient list to check it.";
  return undefined;
}

/** The verdict for one food, computed only from this user's profile (R1), always with reasons (R2). */
export function evaluate(item: FoodItem, p: Profile): Evaluation {
  const txt = item.ingredients || '';
  const hits = scanText(txt).map(h => ({ ...h, word: origCase(h.word, txt) }));

  // Declared allergens from the data source fill gaps the ingredient text misses.
  for (const a of item.allergens || []) {
    const tag = ALLERGEN_TAG_MAP[a];
    if (tag && !hits.some(h => h.tag === tag && !h.trace)) hits.push({ tag, word: `${a.replace(/-/g, ' ')} (declared allergen)`, trace: false });
  }
  for (const a of item.traces || []) {
    const tag = ALLERGEN_TAG_MAP[a];
    if (tag && !hits.some(h => h.tag === tag)) hits.push({ tag, word: a.replace(/-/g, ' '), trace: true });
  }

  const main = hits.filter(h => !h.trace);
  const R: Reason[] = [];
  const flags: Record<string, Level> = {};
  const add = (lvl: Level, text: string, src: string, words?: string | string[], key?: string) => {
    const ex = key ? R.find(r => r.key === key && r.lvl === lvl) : undefined;
    if (ex) { if (!ex.src.includes(src)) ex.src += ' · ' + src; }
    else if (!R.some(r => r.text === text)) R.push({ lvl, text, src, key });
    for (const w of ([] as string[]).concat(words || [])) {
      const k = w.toLowerCase();
      if (flags[k] !== 'avoid') flags[k] = lvl;
    }
  };

  const byTag: Record<string, string[]> = {};
  for (const h of main) (byTag[h.tag] ||= []).push(h.word);
  for (const k in byTag) byTag[k] = uniq(byTag[k]);

  const diet = DIETS[p.diet] || DIETS.none;
  for (const [tag, ws] of Object.entries(byTag)) {
    const say = TAGTXT[tag];
    if (!say) continue;
    if (diet.avoid.includes(tag)) add('avoid', say(joinWords(ws)), `${diet.label} diet`, ws, tag);
    else if (diet.check.includes(tag)) add('caution', say(joinWords(ws)), `${diet.label} diet · possible hidden source`, ws, tag);
  }

  for (const k of p.avoid) {
    const a = AVOIDABLES[k];
    if (!a) continue;
    for (const tag of a.tags) if (byTag[tag]) add('avoid', `Contains ${joinWords(byTag[tag])}.`, `Your avoid list: ${a.label}`, byTag[tag], tag);
    for (const tag of a.possible || []) if (byTag[tag]) add('caution', `Contains ${joinWords(byTag[tag])}, which may contain ${a.label.toLowerCase()}.`, `Your avoid list: ${a.label}`, byTag[tag], tag);
  }

  const mainText = normalize(txt).split(TRACE_RE)[0];
  for (const w of p.custom) {
    if (!w.trim()) continue;
    const m = mainText.match(new RegExp('\\b' + reEsc(w.toLowerCase().trim()) + '\\b'));
    if (m) { const o = origCase(m[0], txt); add('avoid', `Contains ${o}.`, `Your avoid list: ${w}`, o, 'custom:' + w); }
  }

  for (const k of p.allergies) {
    const A = ALLERGENS[k];
    if (!A) continue;
    for (const tag of A.tags) {
      if (byTag[tag]) add('avoid', `Contains ${joinWords(byTag[tag])}.`, `Allergy: ${A.label}`, byTag[tag], tag);
      const tr = hits.filter(h => h.trace && h.tag === tag);
      if (tr.length && !byTag[tag]) add('caution', `May contain ${A.label.toLowerCase()}, made on shared equipment.`, `Allergy: ${A.label}`, tr.map(h => h.word), 'trace:' + tag);
    }
  }

  for (const k of p.sens) {
    const S = SENSITIVITIES[k];
    if (!S) continue;
    for (const tag of S.tags) if (byTag[tag]) add('caution', S.txt(joinWords(byTag[tag])), `Sensitivity: ${S.label}`, byTag[tag], 'sens:' + tag);
  }

  const tol = TOLERANCES[p.tol] || TOLERANCES.standard;
  for (const h of main) {
    const name = ADDITIVE_NAME[h.tag];
    if (!name) continue;
    if (tol.tags.includes(h.tag)) add('caution', `Contains ${h.word}, ${name}.`, `Additive tolerance: ${tol.label}`, h.word);
    else add('info', `Contains ${h.word}, ${name}.`, `Shown for information (${tol.label.toLowerCase()} tolerance)`);
  }

  const n = item.n;
  if (n) {
    const est = (k: string) => item.estimated?.includes(k as never) ? ' (estimated)' : '';
    if (p.goals.includes('sugar') && (n.sugar ?? 0) >= 10) add('caution', `${n.sugar} g sugar per serving.`, 'Goal: less sugar');
    if (p.goals.includes('sodium') && (n.sodium ?? 0) >= 460) add('caution', `${n.sodium} mg sodium per serving, 20% or more of the daily value.`, 'Goal: less sodium');
    if (p.goals.includes('sleep') && (n.caffeine ?? 0) > 0) add('caution', `${n.caffeine} mg caffeine${est('caffeine')}. Have it before 2 PM to protect your sleep.`, 'Goal: better sleep');
    if (p.goals.includes('weight') && (n.kcal ?? 0) >= 250) add('caution', `${n.kcal} kcal per serving, a large share of a meal.`, 'Goal: lose weight');
    if (p.goals.includes('energy') && (n.sugar ?? 0) >= 20 && (n.fiber ?? 0) < 3 && (n.protein ?? 0) < 5)
      add('caution', `${n.sugar} g sugar with little fiber or protein can bring an energy dip an hour or two later.`, 'Goal: steady energy');
    if ((n.fiber ?? 0) >= 5) add('good', `High in fiber: ${n.fiber} g per serving.`, 'Nutrition');
    if ((n.protein ?? 0) >= 10) add('good', `Good protein: ${n.protein} g per serving.`, 'Nutrition');
  }

  const incomplete = looksIncomplete(item);
  // R3: incomplete data is Unknown, never Good. A known conflict still wins as Avoid.
  const verdict = R.some(r => r.lvl === 'avoid') ? 'avoid' : incomplete ? 'unknown' : R.some(r => r.lvl === 'caution') ? 'caution' : 'good';
  if (incomplete) R.unshift({ lvl: 'unknown', text: incomplete, src: 'Data check · Unknown is never shown as Good' });
  if (verdict === 'good') {
    const who = p.diet === 'none' ? 'your avoid list or allergies' : `your ${diet.label === 'Jain' ? 'Jain' : diet.label.toLowerCase()} diet, avoid list or allergies`;
    R.unshift({ lvl: 'good', text: `Nothing in the ingredients conflicts with ${who}.`, src: 'Checked against your profile' });
  }
  const order: Record<Level, number> = { avoid: 0, unknown: 1, caution: 2, info: 3, good: 4 };
  R.sort((a, b) => order[a.lvl] - order[b.lvl]);
  return { verdict, reasons: R, flags };
}

export const VERDICT_WORD = { avoid: 'Avoid', caution: 'Caution', good: 'Good', unknown: 'Unknown' } as const;
