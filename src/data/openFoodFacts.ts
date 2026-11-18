import type { FoodItem, Nutrition } from '../engine/types';

/**
 * Open Food Facts: a free, open product database (data under the Open Database License).
 * https://world.openfoodfacts.org — the app shows this attribution on every product.
 */
const BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code', 'product_name', 'product_name_en', 'brands', 'serving_size', 'serving_quantity', 'lang',
  'ingredients_text_en', 'ingredients_text', 'allergens_tags', 'traces_tags', 'nutriments', 'image_front_small_url', 'image_small_url',
].join(',');

export interface OffProduct {
  code?: string;
  product_name?: string; product_name_en?: string; brands?: string; serving_size?: string; serving_quantity?: number | string; lang?: string;
  ingredients_text_en?: string; ingredients_text?: string; allergens_tags?: string[]; traces_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
  image_front_small_url?: string; image_small_url?: string;
}

const num = (v: unknown): number | undefined => {
  const x = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(x) ? x : undefined;
};
const round = (x: number | undefined, d = 0) => x === undefined ? undefined : Math.round(x * 10 ** d) / 10 ** d;
const stripLang = (tags?: string[]) => (tags || []).map(t => t.replace(/^[a-z]{2}:/, '')).filter(Boolean);

/** Typical caffeine per serving when the source doesn't list it. Shown as an estimate. */
export function estimateCaffeine(ingredients: string): number | undefined {
  const s = ingredients.toLowerCase();
  if (/\bdecaf/.test(s)) return undefined;
  if (/\b(coffee|espresso)\b/.test(s)) return 95;
  if (/\bguarana\b/.test(s)) return 50;
  if (/\b(green tea|black tea|matcha|tea|yerba mate)\b/.test(s)) return 40;
  if (/\bcaffeine\b/.test(s)) return 35;
  return undefined;
}

/** Convert an Open Food Facts product into the app's FoodItem, per serving where possible. */
export function fromOff(code: string, p: OffProduct): FoodItem {
  const nm = p.nutriments || {};
  const servingG = num(p.serving_quantity);
  const get = (key: string, factor = 1): number | undefined => {
    const perServing = num(nm[`${key}_serving`]);
    if (perServing !== undefined && servingG) return perServing * factor;
    const per100 = num(nm[`${key}_100g`]);
    if (per100 === undefined) return perServing !== undefined ? perServing * factor : undefined;
    return per100 * (servingG ? servingG / 100 : 1) * factor;
  };
  let ingredients = (p.ingredients_text_en || '').trim();
  let incompleteReason: string | undefined;
  if (!ingredients && p.ingredients_text && (!p.lang || p.lang === 'en')) ingredients = p.ingredients_text.trim();
  // OFF marks allergens with underscores, e.g. "_cultured nonfat milk_".
  ingredients = ingredients.replace(/_/g, '');
  if (!ingredients && p.ingredients_text) incompleteReason = 'The ingredient list for this product is only available in another language, so we can’t check it yet.';

  const n: Nutrition = {
    kcal: round(get('energy-kcal')),
    protein: round(get('proteins'), 1),
    fiber: round(get('fiber'), 1),
    sugar: round(get('sugars'), 1),
    sodium: round(get('sodium', 1000)), // OFF stores grams
    caffeine: round(get('caffeine', 1000)),
  };
  const estimated: (keyof Nutrition)[] = [];
  if (n.caffeine === undefined) {
    const c = estimateCaffeine(ingredients);
    if (c !== undefined) { n.caffeine = c; estimated.push('caffeine'); }
  }
  return {
    id: code,
    name: (p.product_name_en || p.product_name || '').trim() || `Product ${code}`,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    serving: p.serving_size || (servingG ? `${servingG} g` : '100 g'),
    ingredients,
    n,
    estimated,
    source: 'openfoodfacts',
    allergens: stripLang(p.allergens_tags),
    traces: stripLang(p.traces_tags),
    imageUrl: p.image_front_small_url || p.image_small_url,
    incompleteReason,
  };
}

/** Check digit test for EAN-13, UPC-A (12), EAN-8. */
export function validBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const CACHE_KEY = 'hc_off_cache_v1';
const CACHE_MAX = 300;
const DAY = 86_400_000;
type CacheRow = { at: number; item: FoodItem };

function readCache(): Record<string, CacheRow> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(c: Record<string, CacheRow>) {
  const keys = Object.keys(c);
  if (keys.length > CACHE_MAX) keys.sort((a, b) => c[a].at - c[b].at).slice(0, keys.length - CACHE_MAX).forEach(k => delete c[k]);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* storage full or blocked */ }
}

export class LookupError extends Error {}

/**
 * Look up a barcode. Recently seen products come from this device's cache (R20), so a repeat scan
 * in the aisle works without waiting on the network, and still works offline.
 */
export async function lookupBarcode(raw: string, fetchFn: typeof fetch = fetch): Promise<FoodItem> {
  const code = raw.replace(/\D/g, '');
  const cache = readCache();
  const hit = cache[code];
  if (hit && Date.now() - hit.at < 7 * DAY) return hit.item;
  let res: Response;
  try {
    res = await fetchFn(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, { headers: { Accept: 'application/json' } });
  } catch {
    if (hit) return hit.item;
    throw new LookupError('Can’t reach the food database. Check your internet connection and try again.');
  }
  if (res.status === 404) return notFound(code);
  if (!res.ok) {
    if (hit) return hit.item;
    throw new LookupError(`The food database answered with an error (${res.status}). Please try again in a moment.`);
  }
  const body = await res.json() as { status?: number; product?: OffProduct };
  if (!body.product || body.status === 0) return notFound(code);
  const item = fromOff(code, body.product);
  cache[code] = { at: Date.now(), item };
  writeCache(cache);
  return item;
}

function notFound(code: string): FoodItem {
  return { id: code, name: 'Product not found', serving: '', ingredients: '', source: 'openfoodfacts', notFound: true };
}

/** Text search for the food log, limited to products sold in the United States (R30). */
export async function searchProducts(q: string, fetchFn: typeof fetch = fetch): Promise<FoodItem[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15`
    + `&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states&fields=${FIELDS}`;
  let res: Response;
  try { res = await fetchFn(url); } catch { throw new LookupError('Can’t reach the food database. Check your internet connection.'); }
  if (res.status === 503 || res.status === 429) throw new LookupError('The food database is busy right now. Try again in a minute, or scan the barcode instead.');
  if (!res.ok) throw new LookupError(`Search failed (${res.status}). Please try again.`);
  const body = await res.json() as { products?: OffProduct[] };
  return (body.products || []).filter(p => p.code && (p.product_name || p.product_name_en)).map(p => fromOff(p.code!, p));
}
