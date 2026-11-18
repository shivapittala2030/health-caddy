import { describe, expect, it } from 'vitest';
import { evaluate, scanText } from './evaluate';
import { predict, needKcal } from './predict';
import { fromOff, validBarcode, estimateCaffeine } from '../data/openFoodFacts';
import type { FoodItem, LogEntry, Profile } from './types';

const base: Profile = { diet: 'lacto', avoid: [], custom: [], allergies: [], sens: [], goals: [], body: {}, tol: 'standard' };
const item = (ingredients: string, extra: Partial<FoodItem> = {}): FoodItem =>
  ({ id: 'x', name: 'Test', ingredients, source: 'openfoodfacts', ...extra });

describe('verdicts', () => {
  it('flags gelatin and carmine as Avoid for lacto-vegetarians, with reasons', () => {
    const e = evaluate(item('Corn syrup, sugar, gelatin, citric acid, carmine (color).'), base);
    expect(e.verdict).toBe('avoid');
    expect(e.reasons.map(r => r.text).join(' ')).toMatch(/gelatin/);
    expect(e.reasons.map(r => r.text).join(' ')).toMatch(/insects/);
  });

  it('allows dairy for lacto-vegetarians but not vegans', () => {
    const y = item('Cultured pasteurized nonfat milk, live active cultures.');
    expect(evaluate(y, base).verdict).toBe('good');
    expect(evaluate(y, { ...base, diet: 'vegan' }).verdict).toBe('avoid');
  });

  it('does not treat plant milks and nut butters as dairy', () => {
    const e = evaluate(item('Almond milk (filtered water, almonds), peanut butter, cocoa butter, coconut cream.'), { ...base, diet: 'vegan' });
    expect(e.verdict).toBe('good');
  });

  it('still catches soy inside soy milk for a soy allergy', () => {
    const e = evaluate(item('Soy milk (water, soybeans), sugar.'), { ...base, allergies: ['soy'] });
    expect(e.verdict).toBe('avoid');
  });

  it('marks hidden animal sources as Caution (R4)', () => {
    const e = evaluate(item('Wheat flour, water, L-cysteine, natural flavors, mono- and diglycerides.'), base);
    expect(e.verdict).toBe('caution');
    expect(e.reasons.filter(r => r.lvl === 'caution').length).toBeGreaterThanOrEqual(3);
  });

  it('treats "may contain" as a trace caution for allergies only', () => {
    const e = evaluate(item('Oats, sugar, salt. May contain peanuts.'), { ...base, allergies: ['peanut'] });
    expect(e.verdict).toBe('caution');
    expect(evaluate(item('Oats, sugar, salt. May contain peanuts.'), base).verdict).toBe('good');
  });

  it('uses declared allergens from the database even when the text misses them', () => {
    const e = evaluate(item('Flour, sugar, salt.', { allergens: ['milk'] }), { ...base, allergies: ['milk'] });
    expect(e.verdict).toBe('avoid');
  });

  it('never shows Good for missing or not-found data (R3)', () => {
    expect(evaluate(item(''), base).verdict).toBe('unknown');
    expect(evaluate(item('', { notFound: true }), base).verdict).toBe('unknown');
    expect(evaluate(item('Water', { source: 'label' }), base).verdict).toBe('unknown');
  });

  it('applies the custom avoid list and Jain root vegetables', () => {
    expect(evaluate(item('Rice, mushrooms, salt.'), { ...base, custom: ['mushrooms'] }).verdict).toBe('avoid');
    expect(evaluate(item('Potatoes, sunflower oil, sea salt.'), { ...base, diet: 'jain' }).verdict).toBe('avoid');
  });

  it('respects caffeine-free and decaf wording', () => {
    expect(scanText('Decaf coffee, water').some(h => h.tag === 'caffeine')).toBe(false);
    expect(scanText('Caffeine-free herbal blend').some(h => h.tag === 'caffeine')).toBe(false);
    expect(scanText('Carbonated water, caffeine').some(h => h.tag === 'caffeine')).toBe(true);
  });

  it('additive tolerance changes caution vs info', () => {
    const t = item('Sugar, red 40, aspartame.');
    expect(evaluate(t, { ...base, tol: 'relaxed' }).verdict).toBe('good');
    expect(evaluate(t, base).verdict).toBe('caution');
  });
});

describe('Open Food Facts mapping', () => {
  it('converts per-100 g values to the serving and sodium to mg', () => {
    const it = fromOff('0123', {
      product_name: 'Crackers', brands: 'Acme, Other', serving_size: '30 g', serving_quantity: 30,
      ingredients_text_en: 'Wheat flour, sunflower oil, salt.', allergens_tags: ['en:gluten'],
      nutriments: { 'energy-kcal_100g': 500, proteins_100g: 10, sugars_100g: 0, fiber_100g: 3.3, sodium_100g: 0.8 },
    });
    expect(it.brand).toBe('Acme');
    expect(it.n).toMatchObject({ kcal: 150, protein: 3, fiber: 1, sodium: 240 });
    expect(it.allergens).toEqual(['gluten']);
  });

  it('handles a real Open Food Facts response (Thai Kitchen peanut noodle kit, 18 Nov 2026)', () => {
    const it = fromOff('0737628064502', {
      allergens_tags: ['en:peanuts', 'en:sesame-seeds', 'en:soybeans'], brands: 'Simply Asia, Thai Kitchen', lang: 'en',
      ingredients_text_en: 'Rice Noodles (rice, water), seasoning packet (peanut, sugar, salt, corn starch, spices [chili, cinnamon, pepper, cumin, clove], hydrolyzed soy protein, green onions, citric acid, peanut oil, sesame oil, natural flavor).',
      nutriments: { 'energy-kcal_100g': 385, 'energy-kcal_serving': 200, proteins_serving: 5, fiber_serving: 0.988, sugars_serving: 7, sodium_serving: 0.15, sodium_100g: 0.288 },
      product_name: 'Thai peanut noodle kit', serving_quantity: 52, serving_size: '0.333 PACKAGE (52 g)', traces_tags: ['en:peanuts'],
    });
    expect(it.n).toMatchObject({ kcal: 200, protein: 5, fiber: 1, sugar: 7, sodium: 150 });
    expect(evaluate(it, { ...base, allergies: ['peanut'] }).verdict).toBe('avoid');
    expect(evaluate(it, { ...base, diet: 'jain' }).verdict).toBe('avoid'); // green onions
    expect(evaluate(it, base).verdict).toBe('caution'); // natural flavor
  });

  it('strips Open Food Facts allergen underscores', () => {
    const it = fromOff('0894700010137', { product_name: 'Greek Yogurt', ingredients_text_en: '_cultured nonfat milk_, S. Thermophilus' });
    expect(evaluate(it, { ...base, diet: 'vegan' }).verdict).toBe('avoid');
  });

  it('marks non-English ingredient lists as incomplete', () => {
    const it = fromOff('1', { product_name: 'Biscuits', lang: 'fr', ingredients_text: 'Farine de blé, sucre' });
    expect(evaluate(it, base).verdict).toBe('unknown');
  });

  it('estimates caffeine when the database has none', () => {
    expect(estimateCaffeine('Carbonated water, caffeine')).toBe(35);
    expect(estimateCaffeine('Decaf coffee')).toBeUndefined();
    const it = fromOff('2', { product_name: 'Cola', ingredients_text_en: 'Carbonated water, caffeine', nutriments: {} });
    expect(it.estimated).toContain('caffeine');
  });

  it('validates barcode check digits', () => {
    expect(validBarcode('737628064502')).toBe(true);
    expect(validBarcode('737628064503')).toBe(false);
    expect(validBarcode('5449000000996')).toBe(true);
  });
});

describe('predictions', () => {
  const entry = (time: number, n: FoodItem['n'], name = 'x', ingredients = ''): LogEntry =>
    ({ id: String(time), date: '2026-11-18', time, servings: 1, item: { id: name, name, ingredients, n, source: 'common' } });

  it('warns about late caffeine for sleep', () => {
    const r = predict([entry(990, { caffeine: 140 }, 'Coffee')], base);
    const s = r.out.find(o => o.area === 'Sleep')!;
    expect(s.st).toBe('watch');
    expect(s.reasons[0].t).toMatch(/Coffee at 4:30 PM/);
  });

  it('flags low fiber for digestion', () => {
    const r = predict([entry(600, { kcal: 500, fiber: 2 })], base);
    expect(r.out[0].st).toBe('watch');
  });

  it('estimates calorie need from body data', () => {
    expect(needKcal({ ...base, body: { age: 34, ft: 5, inch: 8, lb: 160, sex: 'male', activity: 'moderate' } }).kcal).toBeGreaterThan(2400);
    expect(needKcal(base).kcal).toBe(2000);
  });

  it('multiplies by servings', () => {
    const e = entry(600, { kcal: 100, sodium: 1500 });
    e.servings = 2;
    const r = predict([e], base);
    expect(r.T.kcal).toBe(200);
    expect(r.out[3].st).not.toBe('good');
  });
});
