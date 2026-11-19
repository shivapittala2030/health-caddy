import { describe, expect, it } from 'vitest';
import { weeklyReport } from './report';
import { migrateLegacy, ownerOf } from '../store';
import type { FoodItem, LogEntry, Profile, ScanEvent } from './types';

const p: Profile = { diet: 'lacto', avoid: [], custom: [], allergies: [], sens: [], goals: [], body: {}, tol: 'standard' };
const food = (id: string, ingredients: string, n: FoodItem['n']): FoodItem => ({ id, name: id, ingredients, n, source: 'openfoodfacts' });
const entry = (date: string, item: FoodItem): LogEntry => ({ id: date + item.id, personId: 'a', date, time: 600, servings: 1, item });
const scan = (date: string, itemId: string, verdict: ScanEvent['verdict']): ScanEvent => ({ id: date + itemId, personId: 'a', at: 0, date, itemId, name: itemId, source: 'openfoodfacts', verdict });

describe('weekly report', () => {
  const gummy = food('gummy', 'Sugar, gelatin, carmine.', { kcal: 140, sugar: 30, sodium: 20, fiber: 0, protein: 2 });
  const dal = food('dal', 'Lentils, rice, ghee, salt.', { kcal: 450, sugar: 3, sodium: 2600, fiber: 9, protein: 16 });
  const log = [entry('2026-11-17', gummy), entry('2026-11-18', gummy), entry('2026-11-18', dal), entry('2026-11-01', dal)];
  const scans = [scan('2026-11-17', 'gummy', 'avoid'), scan('2026-11-16', 'yogurt', 'good')];
  const r = weeklyReport(log, scans, p, '2026-11-18');

  it('covers the last seven days only', () => {
    expect(r.from).toBe('2026-11-12');
    expect(r.days).toHaveLength(7);
    expect(r.itemsLogged).toBe(3);
    expect(r.daysLogged).toBe(2);
  });

  it('counts each scan once and adds logged foods that were not scanned', () => {
    expect(r.scans).toBe(2);
    expect(r.verdicts).toEqual({ avoid: 1, caution: 0, good: 2, unknown: 0 });
  });

  it('finds the most flagged ingredients and over-limit days', () => {
    expect(r.flagged[0]).toEqual({ label: 'carmine', n: 2 });
    expect(r.targets.find(t => t.key === 'sodium')!.daysOver).toBe(1);
    expect(r.highlights.join(' ')).toMatch(/Sodium was over 2,300 mg on 1 of 2/);
  });

  it('is empty but safe with no data', () => {
    const e = weeklyReport([], [], p, '2026-11-18');
    expect(e.daysLogged).toBe(0);
    expect(e.highlights).toEqual([]);
  });
});

describe('profiles on one device', () => {
  it('turns old single-person data into a person called Me', () => {
    const r = migrateLegacy([], p, () => 'me1');
    expect(r.people[0]).toMatchObject({ id: 'me1', name: 'Me', profile: p });
    expect(migrateLegacy(r.people, p, () => 'x').people).toHaveLength(1);
    expect(migrateLegacy([], null, () => 'x').people).toHaveLength(0);
  });

  it('gives unowned log entries to that person', () => {
    const rows = [{ id: '1' }, { id: '2', personId: 'b' }];
    expect(ownerOf(rows, 'me1').map(r => r.personId)).toEqual(['me1', 'b']);
  });
});
