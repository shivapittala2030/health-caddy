/** Nutrition for one serving. Any value can be missing when the source has no data. */
export interface Nutrition {
  kcal?: number;
  protein?: number; // g
  fiber?: number; // g
  sugar?: number; // g
  sodium?: number; // mg
  caffeine?: number; // mg
}

export type ItemSource = 'openfoodfacts' | 'label' | 'common' | 'manual';

/** Any food the app can judge or log: a scanned product, a label photo, or a common home food. */
export interface FoodItem {
  id: string; // barcode, or a generated id
  name: string;
  brand?: string;
  serving?: string;
  ingredients: string; // English ingredient text, may be empty
  n?: Nutrition;
  /** Estimated values, such as caffeine guessed from an ingredient, are listed here. */
  estimated?: (keyof Nutrition)[];
  source: ItemSource;
  /** Allergen tags declared by the data source, e.g. "milk", "peanuts". */
  allergens?: string[];
  /** "May contain" tags declared by the data source. */
  traces?: string[];
  imageUrl?: string;
  /** Why the ingredient list can't be fully trusted, if it can't. */
  incompleteReason?: string;
  notFound?: boolean;
  whole?: boolean; // a whole or home-made food rather than a packaged product
}

export type DietKey = 'lacto' | 'vegan' | 'jain' | 'none';
export type ToleranceKey = 'relaxed' | 'standard' | 'strict';
export type GoalKey = 'weight' | 'sleep' | 'energy' | 'digestion' | 'sodium' | 'sugar';

export interface Body {
  age?: number;
  sex?: 'male' | 'female' | '';
  ft?: number;
  inch?: number;
  lb?: number;
  activity?: 'low' | 'light' | 'moderate' | 'high';
}

export interface Profile {
  diet: DietKey;
  avoid: string[]; // keys of AVOIDABLES
  custom: string[]; // free-text words to avoid
  allergies: string[]; // keys of ALLERGENS
  sens: string[]; // keys of SENSITIVITIES
  goals: GoalKey[];
  body: Body;
  tol: ToleranceKey;
}

export type Level = 'avoid' | 'unknown' | 'caution' | 'info' | 'good';
export type Verdict = 'avoid' | 'caution' | 'good' | 'unknown';

export interface Reason {
  lvl: Level;
  text: string;
  src: string; // which rule or profile setting produced it
  key?: string;
}

export interface Evaluation {
  verdict: Verdict;
  reasons: Reason[];
  /** Ingredient words that triggered a flag, lower-cased, mapped to their level. */
  flags: Record<string, Level>;
}

export interface LogEntry {
  id: string;
  personId?: string; // missing only on entries saved before profiles existed
  date: string; // YYYY-MM-DD, local
  time: number; // minutes after midnight
  servings: number;
  item: FoodItem;
}

export interface UsualMeal {
  id: string;
  personId?: string;
  name: string;
  items: FoodItem[];
}

/** One person using the app on this device, with their own settings. */
export interface Person {
  id: string;
  name: string;
  profile: Profile;
  createdAt: number;
}

/** A record that a person checked a food, kept for their usage report. */
export interface ScanEvent {
  id: string;
  personId: string;
  at: number; // ms since epoch
  date: string; // YYYY-MM-DD, local
  itemId: string;
  name: string;
  brand?: string;
  source: ItemSource;
  verdict: Verdict;
}
