import { nowIso } from './entities/common.js';
import type { ProjectFile } from './project-file.js';

/**
 * The graveyard (addendum 24, from Ken: *anything that gets removed or
 * deleted, instead of deleting it permanently, it goes to the graveyard, just
 * in case you accidentally delete something, you can restore it*).
 *
 * ## The graveyard is not the archive
 *
 * Six of the seven records here **already carry `archived`**, and reusing it
 * would have been the shortest change in the file. It would also have been
 * wrong, and this is the decision the module rests on: *archived* is **a
 * writer saying they are done with something**, and the graveyard is **a
 * writer saying they did not mean that**. Two intentions, so two fields. If
 * they were one, deliberately archiving a resolved setup would drop it in the
 * graveyard beside the note somebody deleted by accident, and **restore**
 * would mean two different things on two rows of the same list.
 *
 * It is the companion app's trap read from the other end (addendum 09 §2): a
 * category is not a destination, and a state is not a mistake.
 *
 * ## Nothing leaves its collection
 *
 * Deleting stamps `deletedAt` and **the record stays exactly where it is**.
 * That is what makes restoring a promise this module can keep: every usage
 * link, story link, occurrence and tag still points at an id that still
 * exists, so putting something back is clearing a field rather than
 * reassembling a record and everything that referred to it. A graveyard that
 * *moved* rows into a table of its own would have to rebuild all of that, and
 * would leave every reference dangling in the meantime.
 *
 * The cost is the obvious one: **every list must not show the buried**, and a
 * reader that forgets is a deleted note still on the shelf. So the filtering
 * is not left to the screens — `living` is the one predicate, and each
 * module's own reading applies it, which is where a missed filter would be
 * caught by that module's tests rather than by a writer.
 *
 * ## The graveyard itself is a reading
 *
 * There is no graveyard collection and nothing is stored about it: `graveyard`
 * walks the seven collections for stamps and sorts by when, newest first. So
 * restoring something takes it off the list with nothing run, and a record
 * that was never deleted cannot appear on it by any other route.
 */

// ------------------------------------------------------------------ records

/**
 * What the graveyard holds. These are the records a writer meets **as a row
 * in a list with a delete on it** — Research's own things, which are the ones
 * with no other safety net. The manuscript is deliberately not here: a scene
 * and a beat have snapshots, and burying one would have to bury its writing
 * and its place in the story order with it.
 */
export const BURIED_KINDS = [
  'researchItem',
  'character',
  'location',
  'theme',
  'motif',
  'setupPayoff',
  'thread',
] as const;
export type BuriedKind = (typeof BURIED_KINDS)[number];

/** Which collection each kind lives in — the one place that mapping is written. */
const COLLECTION: Record<BuriedKind, keyof ProjectFile> = {
  researchItem: 'researchItems',
  character: 'characters',
  location: 'locations',
  theme: 'themes',
  motif: 'motifs',
  setupPayoff: 'setupsPayoffs',
  thread: 'threads',
};

/** What each kind is called on the screen, singular. */
export const BURIED_WORDS: Record<BuriedKind, string> = {
  researchItem: 'Note',
  character: 'Character',
  location: 'Location',
  theme: 'Theme',
  motif: 'Motif',
  setupPayoff: 'Setup & payoff',
  thread: 'Thread',
};

/** A record that may be buried: anything with an id and a stamp. */
interface Burialble {
  id: string;
  deletedAt?: string | null;
  name?: string;
  title?: string;
}

/** Where a thing is, said in the two words that find it again. */
export interface BuriedRef {
  kind: BuriedKind;
  id: string;
}

/** One row of the graveyard. */
export interface BuriedRow extends BuriedRef {
  /** What it was called, or a sentence saying it never had a name. */
  name: string;
  /** The kind's word, for the row's label. */
  word: string;
  /** When it was deleted. */
  at: string;
}

// ----------------------------------------------------------------- readings

/**
 * Whether a record is still in the project rather than in the graveyard.
 * **The one predicate**, so a module that lists its records filters with the
 * same rule the graveyard collects by and the two cannot drift apart.
 */
export const living = <T extends { deletedAt?: string | null }>(record: T): boolean =>
  record.deletedAt === null || record.deletedAt === undefined;

/** The same, read the other way, for a screen that wants to say so. */
export const buried = <T extends { deletedAt?: string | null }>(record: T): boolean => !living(record);

/** Only the records still in the project. What every list wants. */
export const onlyLiving = <T extends { deletedAt?: string | null }>(records: readonly T[]): T[] =>
  records.filter((record) => living(record));

const rowsFor = (file: ProjectFile, kind: BuriedKind): BuriedRow[] =>
  ((file[COLLECTION[kind]] ?? []) as unknown as Burialble[])
    .filter((record) => !living(record))
    .map((record) => ({
      kind,
      id: record.id,
      // A record with no name is listed by its kind rather than as an empty
      // row: what a writer needs to decide is whether to put it back, and a
      // blank line says less than *Note (no name)*.
      name: (record.name ?? record.title ?? '').trim() || `${BURIED_WORDS[kind]} (no name)`,
      word: BURIED_WORDS[kind],
      at: record.deletedAt as string,
    }));

/**
 * Everything in the graveyard, **newest first** — the order somebody who has
 * just made a mistake wants, since what they are looking for is the thing
 * they deleted a moment ago. Assembled every time and stored nowhere.
 */
export const graveyard = (file: ProjectFile): BuriedRow[] =>
  BURIED_KINDS.flatMap((kind) => rowsFor(file, kind)).sort((a, b) => b.at.localeCompare(a.at));

/** How many are in it, for the menu's count. */
export const graveyardCount = (file: ProjectFile): number =>
  BURIED_KINDS.reduce((total, kind) => total + rowsFor(file, kind).length, 0);

// -------------------------------------------------------------------- acts

const stamp = (file: ProjectFile, ref: BuriedRef, at: string | null): ProjectFile => {
  const key = COLLECTION[ref.kind];
  const list = (file[key] ?? []) as unknown as Burialble[];
  if (!list.some((record) => record.id === ref.id)) return file;
  return {
    ...file,
    [key]: list.map((record) => (record.id === ref.id ? { ...record, deletedAt: at } : record)),
  } as ProjectFile;
};

/**
 * Delete a record: it keeps its place and gains a stamp. Everything pointing
 * at it goes on pointing at it, which is why restoring can promise to put
 * back what was there rather than something like it.
 */
export const sendToGraveyard = (file: ProjectFile, ref: BuriedRef, at: string = nowIso()): ProjectFile =>
  stamp(file, ref, at);

/** Put it back, exactly where it was. */
export const restoreFromGraveyard = (file: ProjectFile, ref: BuriedRef): ProjectFile => stamp(file, ref, null);

/**
 * What goes with a record that is destroyed for good.
 *
 * Burying keeps all of this, which is the whole of §2 — the links are what
 * make restoring able to give back what was there. **Destroying has to take
 * it**, or emptying the graveyard leaves a story link pointing at a character
 * who no longer exists, which is the fault this function was written to fix.
 *
 * Written **once, generically**, rather than as a destroyer per kind: what
 * hangs off a record is a story link that refers to it, a usage link it owns
 * and a theme–motif link that names it, and none of that varies by kind. It
 * is also why this lives here and imports nothing — a per-module destroyer
 * would have to be reached from here, and those modules already import this
 * one.
 */
const withoutWhatPointedAt = (file: ProjectFile, ids: ReadonlySet<string>): ProjectFile => {
  if (ids.size === 0) return file;
  return {
    ...file,
    links: (file.links ?? []).filter(
      (link) => !ids.has(link.from.id as string) && !ids.has(link.to.id as string),
    ),
    usageLinks: (file.usageLinks ?? []).filter((link) => !ids.has(link.ownerId as string)),
    themeMotifLinks: (file.themeMotifLinks ?? []).filter(
      (link) => !ids.has(link.themeId as string) && !ids.has(link.motifId as string),
    ),
  } as ProjectFile;
};

/**
 * Empty the graveyard: **the one act in the module that destroys anything**,
 * and the only reason it exists is that a graveyard nobody can empty is a
 * project that grows forever. It is deliberate, it is asked for, and it is
 * the only door out — nothing ages out on a timer, because a writer who comes
 * back to a project after a month should find what they deleted still there.
 */
export const emptyGraveyard = (file: ProjectFile): ProjectFile => {
  const going = new Set<string>();
  let next = file;
  for (const kind of BURIED_KINDS) {
    const key = COLLECTION[kind];
    const list = (next[key] ?? []) as unknown as Burialble[];
    for (const record of list) if (!living(record)) going.add(record.id);
    next = { ...next, [key]: list.filter((record) => living(record)) } as ProjectFile;
  }
  return withoutWhatPointedAt(next, going);
};

/** Take one row out for good, without emptying the rest. */
export const forgetOne = (file: ProjectFile, ref: BuriedRef): ProjectFile => {
  const key = COLLECTION[ref.kind];
  const list = (file[key] ?? []) as unknown as Burialble[];
  if (!list.some((record) => record.id === ref.id)) return file;
  const next = { ...file, [key]: list.filter((record) => record.id !== ref.id) } as ProjectFile;
  return withoutWhatPointedAt(next, new Set([ref.id]));
};

/**
 * What emptying would take, said before it is pressed. A count rather than a
 * list, because the list is on the screen behind the question.
 */
export const describeEmptying = (file: ProjectFile): string => {
  const count = graveyardCount(file);
  if (count === 0) return 'The graveyard is empty.';
  return count === 1
    ? 'One thing goes for good. This is the only act here that cannot be undone.'
    : `All ${count} go for good. This is the only act here that cannot be undone.`;
};
