import type { ProjectFile } from './project-file.js';
import type { ImplementationBinding } from './entities/implementation.js';

/**
 * Implementation status (addendum 25 §1–§2): how far VC Game Studio has built
 * each authored thing, **read** from the bindings it wrote.
 *
 * VC Writer shows this and never changes it. Binding happens in Game Studio;
 * here the Implementation view says so.
 */

/** Game Studio §3's five words. */
export type ImplementationStatus = 'unbound' | 'partial' | 'implemented' | 'needs_update' | 'conflict';

export const IMPLEMENTATION_WORDS: Record<ImplementationStatus, string> = {
  unbound: 'Not built yet',
  partial: 'Partly built',
  implemented: 'Built',
  needs_update: 'Changed since it was built',
  conflict: 'Built, but the writing it was built from is gone',
};

/**
 * The kinds of authored record Game Studio can bind, and where each lives.
 *
 * A binding whose `sourceType` is not here was written by a newer Game Studio
 * about something this build does not know. It is kept (the file carries it)
 * and read as nothing.
 */
const SOURCES = {
  element: (file: ProjectFile) => file.narrativeElements,
  choice: (file: ProjectFile) => file.choices,
  resource: (file: ProjectFile) => file.resourceDefinitions,
  state: (file: ProjectFile) => file.stateDefinitions,
} as const satisfies Record<string, (file: ProjectFile) => ReadonlyArray<{ id: string }>>;

export type BindableType = keyof typeof SOURCES;

export const isBindableType = (type: string): type is BindableType => Object.hasOwn(SOURCES, type);

/** Fields that change without the authored thing changing. */
const BOOKKEEPING = new Set(['createdAt', 'updatedAt']);

/**
 * A short, stable fingerprint of an authored record's content, for telling
 * whether it changed after it was built.
 *
 * Key order does not matter and timestamps are left out, so saving the file
 * or touching a record without changing it does not mark it *needs update*.
 * This is change detection, not security: two different records colliding is
 * a false *built*, never a lost edit, and at 53 bits it does not happen in a
 * project's lifetime. It is synchronous and pure so the status can be a
 * reading, and Game Studio computes it with this same function.
 */
export const fingerprintOf = (record: unknown): string => {
  const text = canonical(record, true);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
};

const canonical = (value: unknown, top: boolean): string => {
  if (Array.isArray(value)) return `[${value.map((one) => canonical(one, false)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, one]) => one !== undefined && !(top && BOOKKEEPING.has(key)))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, one]) => `${JSON.stringify(key)}:${canonical(one, false)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

export const bindingsFor = (file: ProjectFile, sourceType: BindableType, sourceId: string): ImplementationBinding[] =>
  file.implementationBindings.filter((one) => one.sourceType === sourceType && one.sourceId === sourceId);

/** How far one authored record has been built. */
export const implementationStatus = (file: ProjectFile, sourceType: BindableType, sourceId: string): ImplementationStatus => {
  const bindings = bindingsFor(file, sourceType, sourceId);
  const record = SOURCES[sourceType](file).find((one) => one.id === sourceId);
  if (!record) return bindings.length ? 'conflict' : 'unbound';
  if (!bindings.length) return 'unbound';
  const now = fingerprintOf(record);
  if (bindings.some((one) => one.sourceHash !== now)) return 'needs_update';
  return bindings.every((one) => one.complete) ? 'implemented' : 'partial';
};

export interface ImplementationReading {
  sourceType: BindableType;
  sourceId: string;
  status: ImplementationStatus;
}

/**
 * Every bindable record's status, then every binding whose record is gone.
 * Bindings of a type this build does not know are left out: kept in the
 * file, read as nothing.
 */
export const implementationOverview = (file: ProjectFile): ImplementationReading[] => {
  const out: ImplementationReading[] = [];
  const seen = new Set<string>();
  for (const sourceType of Object.keys(SOURCES) as BindableType[]) {
    for (const record of SOURCES[sourceType](file)) {
      seen.add(`${sourceType}:${record.id}`);
      out.push({ sourceType, sourceId: record.id, status: implementationStatus(file, sourceType, record.id) });
    }
  }
  for (const binding of file.implementationBindings) {
    const key = `${binding.sourceType}:${binding.sourceId}`;
    if (!isBindableType(binding.sourceType) || seen.has(key)) continue;
    seen.add(key);
    out.push({ sourceType: binding.sourceType, sourceId: binding.sourceId, status: 'conflict' });
  }
  return out;
};

/** How many records stand at each status, for the Implementation view's header. */
export const implementationCounts = (file: ProjectFile): Record<ImplementationStatus, number> => {
  const counts: Record<ImplementationStatus, number> = { unbound: 0, partial: 0, implemented: 0, needs_update: 0, conflict: 0 };
  for (const one of implementationOverview(file)) counts[one.status] += 1;
  return counts;
};
