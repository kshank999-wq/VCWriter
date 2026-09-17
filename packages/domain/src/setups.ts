import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { derivedSetupPayoffStatus } from './entities/setups.js';
import type { SetupPayoff, SetupPoint } from './entities/setups.js';
import type { StoryEntityRef } from './entities/links.js';
import type { ProjectFile } from './project-file.js';

/**
 * Whether a payoff has been prepared (the Setups & Payoffs spec, §7).
 *
 * The rule the module exists to make visible: **a payoff should have at least
 * three setup points before it.** Nothing here prevents a writer from breaking
 * it — red is a warning and never a block — but it must be impossible to miss,
 * which is why the count and the light are on the list rather than inside each
 * record.
 *
 * Two decisions shape the whole reading.
 *
 * **Before is the only thing that counts.** A setup that falls *after* its
 * payoff is not a setup; it is an explanation. It stays in the record, visible
 * and listed, and does not count — so dragging a scene from before the payoff
 * to after it turns the light red with nothing run, and dragging it back turns
 * it green. That is the whole reason this is a reading rather than a stored
 * number: a cached status would survive a reorder and be wrong.
 *
 * **Position is read to the beat, not to the scene.** A setup and its payoff in
 * one scene is a real thing a writer does, and *which came first* is answerable
 * — so the comparison goes as fine as the anchor does, and only falls back to
 * the scene when that is all the anchor names.
 */

/** The minimum a payoff wants, unless a record says otherwise. One constant. */
export const MINIMUM_VALID_SETUPS = 3;

/** Where something sits in the story: which scene, and which beat inside it. */
export interface StoryPosition {
  unitIndex: number;
  /** -1 when the anchor names the scene rather than a beat inside it. */
  beatIndex: number;
}

/** Story order, comparably. Negative when `one` comes first. */
export const comparePositions = (one: StoryPosition, two: StoryPosition): number =>
  one.unitIndex === two.unitIndex ? one.beatIndex - two.beatIndex : one.unitIndex - two.unitIndex;

/**
 * Where a reference falls in the story, or null for one that names nothing
 * that is still there.
 *
 * Null is the orphan state, and it is deliberately not an error: a setup
 * pinned to a scene that has since been cut is work the writer still has, and
 * it is shown struck through rather than dropped.
 */
export const storyPositionOf = (file: ProjectFile, ref: StoryEntityRef | null): StoryPosition | null => {
  if (!ref) return null;
  const order = unitsInStoryOrder(file);
  const indexOf = new Map(order.map((unit, index) => [unit.id as string, index]));

  if (ref.type === 'unit') {
    const at = indexOf.get(ref.id);
    return at === undefined ? null : { unitIndex: at, beatIndex: -1 };
  }
  if (ref.type === 'beat') {
    const beat = file.beats.find((candidate) => (candidate.id as string) === ref.id);
    if (!beat) return null;
    const at = indexOf.get(beat.unitId as string);
    if (at === undefined) return null;
    const beats = beatsForUnit(file, beat.unitId);
    return { unitIndex: at, beatIndex: Math.max(0, beats.findIndex((one) => one.id === beat.id)) };
  }
  return null;
};

/** "Scene 12 · Beat 3", or what is true instead. */
export const describePlace = (file: ProjectFile, ref: StoryEntityRef | null): string => {
  if (!ref) return 'Not placed yet';
  const at = storyPositionOf(file, ref);
  if (!at) return 'The writing it was on has gone';
  const scene = `Scene ${at.unitIndex + 1}`;
  return at.beatIndex < 0 ? scene : `${scene} · Beat ${at.beatIndex + 1}`;
};

/** One setup point, read against the payoff. */
export interface SetupPlace {
  point: SetupPoint;
  at: StoryPosition | null;
  /** Whether it counts: placed, still in the manuscript, and before the payoff. */
  counts: boolean;
  /** Why it does not, where it does not. Empty when it counts. */
  why: string;
  where: string;
}

export interface SetupReadiness {
  setups: SetupPlace[];
  payoffAt: StoryPosition | null;
  /** Whether a passage has been named as the payoff at all. */
  payoffPlaced: boolean;
  /** Setups that count. */
  valid: number;
  /** What this record wants — the constant, or its own. */
  needed: number;
  ready: boolean;
  light: 'red' | 'green';
  /** "2 / 3", "4 / 3" — beside the light, because a light alone says how but not how far. */
  count: string;
  /** One line, for the list and for a writer who wants to know why it is red. */
  says: string;
}

export const setupReadiness = (file: ProjectFile, record: SetupPayoff): SetupReadiness => {
  const needed = Math.max(1, record.minimumSetups || MINIMUM_VALID_SETUPS);
  const payoffAt = storyPositionOf(file, record.payoff?.location ?? null);
  const payoffPlaced = Boolean(record.payoff?.location);

  const setups: SetupPlace[] = record.setups.map((point) => {
    const at = storyPositionOf(file, point.location);
    const where = describePlace(file, point.location);
    if (!point.location) return { point, at, counts: false, why: 'Not placed in the writing yet', where };
    if (!at) return { point, at, counts: false, why: 'The writing it was on has gone', where };
    if (!payoffAt) return { point, at, counts: false, why: '', where };
    // The rule: before, or it is an explanation rather than a setup.
    if (comparePositions(at, payoffAt) >= 0) {
      return { point, at, counts: false, why: 'Falls after the payoff, so it does not count', where };
    }
    return { point, at, counts: true, why: '', where };
  });

  const valid = setups.filter((one) => one.counts).length;
  const ready = payoffAt !== null && valid >= needed;

  return {
    setups,
    payoffAt,
    payoffPlaced,
    valid,
    needed,
    ready,
    light: ready ? 'green' : 'red',
    count: `${valid} / ${needed}`,
    says: sentenceFor({ ready, valid, needed, payoffPlaced, payoffAt, setups }),
  };
};

const sentenceFor = (input: {
  ready: boolean;
  valid: number;
  needed: number;
  payoffPlaced: boolean;
  payoffAt: StoryPosition | null;
  setups: SetupPlace[];
}): string => {
  if (input.ready) return `Prepared — ${input.valid} setups land before the payoff.`;
  // A payoff nobody has written yet is a different state from one that is
  // under-prepared, and saying so is the difference between a warning a writer
  // acts on and one they learn to ignore.
  if (!input.payoffPlaced) {
    return `${input.valid} ${input.valid === 1 ? 'setup is' : 'setups are'} placed. The payoff has not been named in the writing yet.`;
  }
  if (!input.payoffAt) return 'The writing the payoff was on has gone.';
  const after = input.setups.filter((one) => one.why.startsWith('Falls after')).length;
  const short = input.needed - input.valid;
  const tail =
    after > 0
      ? ` ${after} ${after === 1 ? 'falls after it and does not count' : 'fall after it and do not count'}.`
      : '';
  return `${short} more ${short === 1 ? 'setup' : 'setups'} before the payoff.${tail}`;
};

/**
 * Every record's readiness, worst first.
 *
 * What the list is for: a writer opening this wants the under-prepared ones,
 * and a list in creation order buries them.
 */
export interface ReadyRow {
  record: SetupPayoff;
  readiness: SetupReadiness;
}

export const setupsBoard = (file: ProjectFile, archived = false): ReadyRow[] =>
  file.setupsPayoffs
    .filter((record) => record.archived === archived)
    .map((record) => ({ record, readiness: setupReadiness(file, record) }))
    .sort((a, b) => {
      // Red before green, then the furthest short of the minimum.
      if (a.readiness.ready !== b.readiness.ready) return a.readiness.ready ? 1 : -1;
      const shortfall = (row: ReadyRow) => row.readiness.needed - row.readiness.valid;
      return shortfall(b) - shortfall(a);
    });

/** What the module owes, in one line. */
export const describeSetups = (file: ProjectFile): string => {
  const rows = setupsBoard(file);
  if (rows.length === 0) return 'Nothing set up yet.';
  const short = rows.filter((row) => !row.readiness.ready).length;
  if (short === 0) return `${rows.length} ${rows.length === 1 ? 'payoff' : 'payoffs'}, all prepared.`;
  return `${short} of ${rows.length} ${short === 1 ? 'is' : 'are'} under-prepared.`;
};

export { derivedSetupPayoffStatus };

// ------------------------------------------------- the track on the timeline

/** One point of one record, at the scene it falls in. */
export interface SetupMark {
  id: string;
  kind: 'setup' | 'payoff';
  /** Story index of the scene it lands in. */
  unitIndex: number;
  /** Whether it counts towards the payoff. Always true of the payoff itself. */
  counts: boolean;
  label: string;
}

/** One record's row on the track. */
export interface SetupTrackRow {
  recordId: string;
  title: string;
  light: 'red' | 'green';
  count: string;
  marks: SetupMark[];
}

/**
 * Setups and payoffs as a track of the story timeline (the spec's §6).
 *
 * **A row per record, not one row of everything.** The question the track exists
 * to answer is *how far apart are this payoff's setups, and where does it
 * land* — and points from three different promises on one line answer nothing.
 *
 * Only records with something placed appear: a payoff that has been written
 * down but never tagged in the script has no position, and a row of nothing is
 * a row that teaches a writer to ignore the track.
 */
export const setupTrack = (file: ProjectFile): SetupTrackRow[] => {
  const rows: SetupTrackRow[] = [];
  for (const { record, readiness } of setupsBoard(file)) {
    const marks: SetupMark[] = [];
    for (const place of readiness.setups) {
      if (!place.at) continue;
      marks.push({
        id: place.point.id as string,
        kind: 'setup',
        unitIndex: place.at.unitIndex,
        counts: place.counts,
        label: `${record.title} — ${place.point.description || 'setup'} · ${place.where}`,
      });
    }
    if (readiness.payoffAt) {
      marks.push({
        id: `${record.id as string}-payoff`,
        kind: 'payoff',
        unitIndex: readiness.payoffAt.unitIndex,
        counts: true,
        label: `${record.title} — pays off · ${describePlace(file, record.payoff?.location ?? null)}`,
      });
    }
    if (marks.length === 0) continue;
    marks.sort((a, b) => a.unitIndex - b.unitIndex);
    rows.push({
      recordId: record.id as string,
      title: record.title,
      light: readiness.light,
      count: readiness.count,
      marks,
    });
  }
  return rows;
};
