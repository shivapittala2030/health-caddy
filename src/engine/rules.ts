import type { DietKey, GoalKey, ToleranceKey } from './types';

/** Ingredient dictionary: each tag is found by a word pattern. Order matters only for display. */
export const DICT: [string, RegExp][] = [
  ['meat', /\b(beef|pork|chicken|turkey|bacon|lard|tallow|ham|veal|lamb|mutton|pepperoni|salami)\b/],
  ['fish', /\b(fish oil|fish gelatin|fish sauce|fish|anchov(y|ies)|sardines?|tilapia|tuna|salmon|cod|pollock|mackerel|bonito)\b/],
  ['shellfish', /\b(shrimp|prawns?|crab|lobster|clams?|oysters?|mussels?|scallops?)\b/],
  ['egg', /\b(egg whites?|egg yolks?|eggs?|albumin|ovalbumin|lysozyme|mayonnaise|meringue)\b/],
  ['dairy', /\b(skim milk|milk fat|nonfat milk|whole milk|milk powder|milk solids|milk protein|milk|cheese|whey|caseinate|casein|buttermilk|butter|cream|yogh?urt|lactose|ghee|paneer|curds?)\b/],
  ['honey', /\bhoney\b/],
  ['gelatin', /\b(gelatine?|collagen)\b/],
  ['carmine', /\b(carmine|cochineal|carminic acid|natural red 4|e120)\b/],
  ['shellac', /\b(shellac|confectioner'?s glaze|resinous glaze)\b/],
  ['animal_rennet', /\banimal rennet\b/],
  ['rennet_possible', /\b(enzymes|rennet)\b/],
  ['l_cysteine', /\bl-?cysteine\b/],
  ['natural_flavors', /\bnatural (and artificial )?flavou?rs?\b/],
  ['mono_di', /\bmono-? ?and diglycerides\b/],
  ['vitamin_d3', /\bvitamin d3\b/],
  ['root_veg', /\b(potato(es)?|onions?|garlic|carrots?|radish(es)?|turnips?|beetroots?|beets?|yams?|ginger|leeks?|shallots?|scallions?)\b/],
  ['caffeine', /\b(caffeine|coffee|espresso|black tea|green tea|tea|matcha|guarana|yerba mate|kola nut)\b/],
  ['alcohol', /\b(alcohol|wine|beer|rum|ethanol|brandy|whiskey|vodka|liqueur|sake)\b/],
  ['alcohol_possible', /\bvanilla extract\b/],
  ['peanut', /\bpeanuts?\b/],
  ['tree_nut', /\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|pine nuts?)\b/],
  ['soy', /\b(soy|soya|soybeans?|tofu|edamame)\b/],
  ['wheat', /\b(wheat|barley|rye|spelt|gluten|semolina|durum|malt)\b/],
  ['sesame', /\b(sesame|tahini)\b/],
  ['art_sweetener', /\b(aspartame|sucralose|acesulfame potassium|acesulfame k|acesulfame|saccharin|neotame|advantame)\b/],
  ['art_color', /\b(red 40|red 3|yellow 5|yellow 6|blue 1|blue 2|green 3|fd&c [a-z]+ (no\. )?\d+|tartrazine|allura red)\b/],
  ['preservative', /\b(tbhq|bha|bht|sodium nitrite|sodium nitrate|potassium bromate|sodium benzoate|potassium benzoate)\b/],
  ['msg', /\b(msg|monosodium glutamate)\b/],
];

/** OFF allergen tags (without "en:") mapped to our dictionary tags. */
export const ALLERGEN_TAG_MAP: Record<string, string> = {
  milk: 'dairy', eggs: 'egg', peanuts: 'peanut', nuts: 'tree_nut', soybeans: 'soy', gluten: 'wheat',
  sesame: 'sesame', 'sesame-seeds': 'sesame', fish: 'fish', crustaceans: 'shellfish', molluscs: 'shellfish',
};

export interface Diet { label: string; desc: string; avoid: string[]; check: string[] }

const HIDDEN = ['rennet_possible', 'l_cysteine', 'natural_flavors', 'mono_di'];
export const DIETS: Record<DietKey, Diet> = {
  lacto: { label: 'Lacto-vegetarian', desc: 'No meat, fish or eggs. Dairy is fine.',
    avoid: ['meat', 'fish', 'shellfish', 'egg', 'gelatin', 'carmine', 'animal_rennet'], check: [...HIDDEN, 'shellac'] },
  vegan: { label: 'Vegan', desc: 'No animal foods at all, including dairy and honey.',
    avoid: ['meat', 'fish', 'shellfish', 'egg', 'gelatin', 'carmine', 'animal_rennet', 'dairy', 'honey', 'shellac'], check: [...HIDDEN, 'vitamin_d3'] },
  jain: { label: 'Jain', desc: 'Lacto-vegetarian, plus no honey and no root vegetables.',
    avoid: ['meat', 'fish', 'shellfish', 'egg', 'gelatin', 'carmine', 'animal_rennet', 'honey', 'root_veg'], check: [...HIDDEN, 'shellac'] },
  none: { label: 'No preset', desc: 'No diet rules. Allergies and your avoid list still apply.', avoid: [], check: [] },
};

export const TAGTXT: Record<string, (w: string) => string> = {
  meat: w => `Contains ${w} (meat).`,
  fish: w => `Contains ${w}, from fish.`,
  shellfish: w => `Contains ${w}, a shellfish.`,
  egg: w => `Contains ${w} (egg).`,
  dairy: w => `Contains ${w} (dairy).`,
  honey: () => 'Contains honey.',
  gelatin: w => `Contains ${w}, made from animal bones and skin.`,
  carmine: w => `Contains ${w}, a red color made from insects.`,
  shellac: w => `Contains ${w}, a coating made by insects.`,
  animal_rennet: () => 'Contains animal rennet, from calf stomach.',
  root_veg: w => `Contains ${w} (root vegetable).`,
  rennet_possible: w => `Lists “${w}”. In cheese these can be animal rennet, and the label doesn't say which.`,
  l_cysteine: () => 'Contains L-cysteine, a dough softener often made from feathers or hair.',
  natural_flavors: w => `Lists “${w}”. The source isn't stated and can be animal.`,
  mono_di: () => 'Contains mono- and diglycerides, which can come from animal fat.',
  vitamin_d3: () => 'Contains vitamin D3, which is usually made from sheep wool (lanolin).',
};

export const AVOIDABLES: Record<string, { label: string; tags: string[]; possible?: string[]; syn: string }> = {
  eggs: { label: 'Eggs', tags: ['egg'], syn: 'Also catches albumin, egg white, lysozyme, ovalbumin, mayonnaise.' },
  caffeine: { label: 'Caffeine', tags: ['caffeine'], syn: 'Also catches coffee, tea, matcha, guarana, yerba mate, kola nut.' },
  alcohol: { label: 'Alcohol', tags: ['alcohol'], possible: ['alcohol_possible'], syn: 'Also catches wine, beer, rum, ethanol. Vanilla extract is flagged as possible.' },
  gelatin: { label: 'Gelatin', tags: ['gelatin'], syn: 'Also catches gelatine and collagen.' },
};

export const ALLERGENS: Record<string, { label: string; tags: string[] }> = {
  peanut: { label: 'Peanuts', tags: ['peanut'] }, tree_nut: { label: 'Tree nuts', tags: ['tree_nut'] },
  milk: { label: 'Milk', tags: ['dairy'] }, egg: { label: 'Eggs', tags: ['egg'] }, soy: { label: 'Soy', tags: ['soy'] },
  wheat: { label: 'Wheat', tags: ['wheat'] }, sesame: { label: 'Sesame', tags: ['sesame'] },
  fish: { label: 'Fish', tags: ['fish'] }, shellfish: { label: 'Shellfish', tags: ['shellfish'] },
};

export const SENSITIVITIES: Record<string, { label: string; tags: string[]; txt: (w: string) => string }> = {
  lactose: { label: 'Lactose', tags: ['dairy'], txt: w => `Contains ${w}. You noted a lactose sensitivity.` },
  gluten: { label: 'Gluten', tags: ['wheat'], txt: w => `Contains ${w}, a gluten source. You noted a gluten sensitivity.` },
  sweeteners: { label: 'Artificial sweeteners', tags: ['art_sweetener'], txt: w => `Contains ${w}, an artificial sweetener you're sensitive to.` },
  msg: { label: 'MSG', tags: ['msg'], txt: w => `Contains ${w}. You noted an MSG sensitivity.` },
};

export const GOALS: Record<GoalKey, string> = {
  weight: 'Lose weight', sleep: 'Better sleep', energy: 'Steady energy', digestion: 'Better digestion', sodium: 'Less sodium', sugar: 'Less sugar',
};

export const TOLERANCES: Record<ToleranceKey, { label: string; desc: string; tags: string[] }> = {
  relaxed: { label: 'Relaxed', desc: 'Show additives, never warn', tags: [] },
  standard: { label: 'Standard', desc: 'Warn on artificial colors and preservatives', tags: ['art_color', 'preservative'] },
  strict: { label: 'Strict', desc: 'Warn on all common additives', tags: ['art_color', 'preservative', 'art_sweetener', 'msg'] },
};

export const ADDITIVE_NAME: Record<string, string> = {
  art_color: 'an artificial color', preservative: 'a synthetic preservative', art_sweetener: 'an artificial sweetener', msg: 'a flavor enhancer',
};
