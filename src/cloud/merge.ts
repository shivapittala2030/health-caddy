import type { LogEntry, Person, ScanEvent, UsualMeal } from '../engine/types';

/** Everything an account keeps in the cloud. Which person is active stays per device. */
export interface Snapshot {
  v: 1;
  people: Person[];
  log: LogEntry[];
  usuals: UsualMeal[];
  scans: ScanEvent[];
  /** Ids of people, log entries and usual meals that were deleted, so they don't come back from another device. */
  deleted: string[];
}

export const emptySnapshot = (): Snapshot => ({ v: 1, people: [], log: [], usuals: [], scans: [], deleted: [] });

const MAX_DELETED = 5000;
const MAX_SCANS = 3000;

function unionById<T extends { id: string }>(a: T[], b: T[], gone: Set<string>, pick?: (x: T, y: T) => T): T[] {
  const m = new Map<string, T>();
  for (const x of a) if (!gone.has(x.id)) m.set(x.id, x);
  for (const y of b) {
    if (gone.has(y.id)) continue;
    const x = m.get(y.id);
    m.set(y.id, x && pick ? pick(x, y) : x ?? y);
  }
  return [...m.values()];
}

/**
 * Combine this device's data with the account's data. Nothing is lost: items are joined by id,
 * deletions win, and for a person edited on two devices the most recent edit wins.
 */
export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const deleted = [...new Set([...a.deleted, ...b.deleted])].slice(-MAX_DELETED);
  const gone = new Set(deleted);
  const newer = (x: Person, y: Person) => ((y.updatedAt ?? 0) > (x.updatedAt ?? 0) ? y : x);
  const ownedBy = new Set(unionById(a.people, b.people, gone).map(p => p.id));
  const alive = <T extends { personId?: string }>(r: T) => !r.personId || ownedBy.has(r.personId);
  return {
    v: 1,
    people: unionById(a.people, b.people, gone, newer).sort((x, y) => x.createdAt - y.createdAt),
    log: unionById(a.log, b.log, gone).filter(alive),
    usuals: unionById(a.usuals, b.usuals, gone).filter(alive),
    scans: unionById(a.scans, b.scans, gone).filter(alive).sort((x, y) => x.at - y.at).slice(-MAX_SCANS),
    deleted,
  };
}

/** Accept only data that looks like a snapshot; anything else counts as empty. */
export function asSnapshot(x: unknown): Snapshot {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Snapshot>;
  const arr = <T,>(v: unknown) => (Array.isArray(v) ? v as T[] : []);
  return { v: 1, people: arr(o.people), log: arr(o.log), usuals: arr(o.usuals), scans: arr(o.scans), deleted: arr<string>(o.deleted).filter(s => typeof s === 'string') };
}
