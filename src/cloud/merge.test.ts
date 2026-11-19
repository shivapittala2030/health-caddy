import { describe, expect, it } from 'vitest';
import { asSnapshot, emptySnapshot, mergeSnapshots, type Snapshot } from './merge';
import type { LogEntry, Person, Profile } from '../engine/types';

const prof: Profile = { diet: 'lacto', avoid: [], custom: [], allergies: [], sens: [], goals: [], body: {}, tol: 'standard' };
const person = (id: string, name: string, updatedAt = 1): Person => ({ id, name, profile: prof, createdAt: 1, updatedAt });
const entry = (id: string, personId: string): LogEntry => ({ id, personId, date: '2026-11-19', time: 600, servings: 1, item: { id: 'x', name: 'x', ingredients: '', source: 'common' } });
const snap = (p: Partial<Snapshot>): Snapshot => ({ ...emptySnapshot(), ...p });

describe('cloud merge', () => {
  it('joins two phones without losing anything', () => {
    const a = snap({ people: [person('p1', 'Siva')], log: [entry('e1', 'p1')] });
    const b = snap({ people: [person('p1', 'Siva'), person('p2', 'Mom')], log: [entry('e2', 'p1'), entry('e3', 'p2')] });
    const m = mergeSnapshots(a, b);
    expect(m.people.map(p => p.name)).toEqual(['Siva', 'Mom']);
    expect(m.log.map(e => e.id).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('keeps the newest edit of a person', () => {
    const m = mergeSnapshots(snap({ people: [person('p1', 'Old', 5)] }), snap({ people: [person('p1', 'New', 9)] }));
    expect(m.people[0].name).toBe('New');
    const m2 = mergeSnapshots(snap({ people: [person('p1', 'New', 9)] }), snap({ people: [person('p1', 'Old', 5)] }));
    expect(m2.people[0].name).toBe('New');
  });

  it('does not bring deleted items back', () => {
    const phone = snap({ people: [person('p1', 'Siva')], log: [], deleted: ['e1'] });
    const cloud = snap({ people: [person('p1', 'Siva')], log: [entry('e1', 'p1'), entry('e2', 'p1')] });
    expect(mergeSnapshots(phone, cloud).log.map(e => e.id)).toEqual(['e2']);
  });

  it('drops a deleted person together with their log', () => {
    const phone = snap({ people: [person('p1', 'Siva')], deleted: ['p2'] });
    const cloud = snap({ people: [person('p1', 'Siva'), person('p2', 'Mom')], log: [entry('e3', 'p2')] });
    const m = mergeSnapshots(phone, cloud);
    expect(m.people).toHaveLength(1);
    expect(m.log).toHaveLength(0);
  });

  it('treats junk from the cloud as empty', () => {
    expect(asSnapshot(null)).toEqual(emptySnapshot());
    expect(asSnapshot({ people: 'x', deleted: [1, 'a'] }).deleted).toEqual(['a']);
  });
});
