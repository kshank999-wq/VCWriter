import { addBeat, addUnit, moveBeat, moveUnit } from './mutations.js';
import { beatsForUnit, lanesInOrder, unitsInStoryOrder } from './selectors.js';
import { findOutline, findOutlineItem, outlineChildren, outlineParent, outlinesOf } from './outline.js';
import { claimedInScript, retitleScript } from './planning.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, OutlineId, OutlineItemId, StructuralUnitId } from './ids.js';

/**
 * Promotion: the outline into the script (addendum 06 §6), stage 5.
 *
 * **The point of the whole thing.** Everything before this is arranging, and
 * this is where the arrangement becomes the script — §12 says as much.
 *
 * Promotion *is* binding, the mechanism the board already uses: the same
 * one-claim rule, the same two-way rename, the same refusal to reorder the
 * script behind the writer's back. So this file is the Outliner's half of what
 * `sculptor-binding.ts` is for the board, and the rules that are about the
 * *pair* — who has claimed what, who gets renamed — live in `planning.ts`,
 * where there is one of each of them rather than two that would drift.
 */

/** What a row of this kind becomes in the script, if anything. */
export type PromoteKind = 'unit' | 'beat' | null;

/**
 * What a row can become.
 *
 * **Only scenes and beats.** Notes, Ideas, Characters, Settings and Props are
 * the writer's planning: they stay in the outline, where they can be read
 * while the scene is written, and there is nothing in the script for them to
 * turn into (§6).
 */
export const promoteKindOf = (item: OutlineItem): PromoteKind =>
  item.kind === 'scene' ? 'unit' : item.kind === 'beat' ? 'beat' : null;

export const isPromoted = (item: OutlineItem): boolean =>
  item.boundUnitId !== null || item.boundBeatId !== null;

/** The scene or beat a row **is**, resolved; null for a plan. */
export const promotedOf = (
  file: ProjectFile,
  item: OutlineItem,
): { kind: 'unit'; unit: StructuralUnit } | { kind: 'beat'; beat: Beat } | null => {
  if (item.boundUnitId !== null) {
    const unit = file.units.find((candidate) => candidate.id === item.boundUnitId);
    return unit ? { kind: 'unit', unit } : null;
  }
  if (item.boundBeatId !== null) {
    const beat = file.beats.find((candidate) => candidate.id === item.boundBeatId);
    return beat ? { kind: 'beat', beat } : null;
  }
  return null;
};

/** Why a row cannot go into the script, in the words the panel will use. */
export type Refusal =
  | 'nothing to promote'
  | 'already in the script'
  | 'its scene is still a plan'
  | 'there is no lane to put a scene in';

/**
 * Whether this row can be sent to the script, and what to say when it cannot.
 *
 * Every refusal here is a sentence a writer can act on, which is the point of
 * answering rather than simply failing: *its scene is still a plan* tells them
 * what to do next, and a button that does nothing does not.
 */
export const canPromote = (file: ProjectFile, outline: Outline, item: OutlineItem): Refusal | null => {
  const kind = promoteKindOf(item);
  if (kind === null) return 'nothing to promote';
  if (isPromoted(item)) return 'already in the script';
  if (kind === 'unit') return lanesInOrder(file).length === 0 ? 'there is no lane to put a scene in' : null;
  // A beat lives inside a scene and never floats in a lane (spec §19), so
  // there is nowhere to put one whose scene has not been written yet.
  const parent = outlineParent(outline, item);
  return parent?.boundUnitId ? null : 'its scene is still a plan';
};

const writeRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  patch: Partial<OutlineItem>,
): ProjectFile => {
  const at = new Date().toISOString();
  return {
    ...file,
    outlines: outlinesOf(file).map((candidate) =>
      candidate.id === outlineId
        ? {
            ...candidate,
            items: candidate.items.map((item) => (item.id === itemId ? { ...item, ...patch, updatedAt: at } : item)),
            updatedAt: at,
          }
        : candidate,
    ),
    project: { ...file.project, updatedAt: at },
  };
};

/**
 * Where a scene goes in the story, read off the outline: **after the scene of
 * the nearest promoted row above it, or before the nearest promoted row below
 * it, and at the end when it has neither.**
 *
 * Both directions matter. A row at the top of its group has nothing above it,
 * and landing at the end of the script because of that would put the first
 * scene last, which is the opposite of what the outline says.
 *
 * **Nothing already in the script moves** (§6, §10): this only says where one
 * new scene belongs.
 */
const indexAmong = (
  item: OutlineItem,
  siblings: readonly OutlineItem[],
  positionOf: (id: string) => number,
  end: number,
): number => {
  const at = siblings.findIndex((candidate) => candidate.id === item.id);
  const positionAt = (index: number): number => {
    const other = siblings[index];
    const id = other ? ((other.boundUnitId ?? other.boundBeatId) as string | null) : null;
    return id === null ? -1 : positionOf(id);
  };

  for (let index = at - 1; index >= 0; index -= 1) {
    const position = positionAt(index);
    if (position >= 0) return position + 1;
  }
  for (let index = at + 1; index < siblings.length; index += 1) {
    const position = positionAt(index);
    if (position >= 0) return position;
  }
  return end;
};

/** One row into the script, without its children. */
const promoteOne = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
): { file: ProjectFile; unitId: StructuralUnitId | null; beatId: BeatId | null } => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item || canPromote(file, outline, item) !== null) {
    return { file, unitId: null, beatId: null };
  }

  const title = item.title.trim();
  const siblings = outlineChildren(outline, item.parentId);

  if (promoteKindOf(item) === 'unit') {
    const lane = lanesInOrder(file)[0] as { id: Parameters<typeof addUnit>[1]['laneId'] };
    const order = unitsInStoryOrder(file);
    const positionOf = (id: string) => order.findIndex((unit) => (unit.id as string) === id);
    const made = addUnit(file, {
      laneId: lane.id,
      title,
      index: indexAmong(item, siblings, positionOf, order.length),
    });
    return {
      file: writeRow(made.file, outlineId, itemId, { boundUnitId: made.unit.id }),
      unitId: made.unit.id,
      beatId: null,
    };
  }

  const unitId = outlineParent(outline, item)?.boundUnitId as StructuralUnitId;
  const order = beatsForUnit(file, unitId);
  const positionOf = (id: string) => order.findIndex((beat) => (beat.id as string) === id);
  const made = addBeat(file, { unitId, title, index: indexAmong(item, siblings, positionOf, order.length) });
  return {
    file: writeRow(made.file, outlineId, itemId, { boundBeatId: made.beat.id }),
    unitId,
    beatId: made.beat.id,
  };
};

/**
 * **Send to Script**: a scene and its beats, in one move, in their order (§6).
 *
 * A scene row becomes a `StructuralUnit` and its child **Beat** rows become the
 * beats inside it. The supporting rows under those beats — the Notes, the
 * Ideas, the Characters — are not promoted and not lost: they are the writer's
 * planning, and they stay in the outline where they can be read while the
 * scene is written.
 *
 * Links to research survive without being carried, because they were
 * references and the ids do not change.
 *
 * A row already in the script is left exactly as it is rather than made twice,
 * which is the source specification's duplicate warning seen from the inside —
 * so sending a scene whose first beat is already real promotes the rest and
 * leaves that one alone.
 */
export const promoteRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
): { file: ProjectFile; unitId: StructuralUnitId | null; beats: BeatId[] } => {
  const first = promoteOne(file, outlineId, itemId);
  if (first.unitId === null && first.beatId === null) return { file, unitId: null, beats: [] };
  if (first.beatId !== null) return { file: first.file, unitId: first.unitId, beats: [first.beatId] };

  // The scene is real; now its beats, in the order the outline has them, so
  // each lands after the one before it.
  let current = first.file;
  const beats: BeatId[] = [];
  const outline = findOutline(current, outlineId) as Outline;
  for (const child of outlineChildren(outline, itemId)) {
    if (child.kind !== 'beat' || isPromoted(child)) continue;
    const made = promoteOne(current, outlineId, child.id);
    current = made.file;
    if (made.beatId) beats.push(made.beatId);
  }

  return { file: current, unitId: first.unitId, beats };
};

/**
 * Both stay, no longer joined.
 *
 * The scene keeps its place in the script and everything written in it; the row
 * keeps its place in the outline and goes back to being a plan. Taking a
 * promoted row out of the outline is the same: §10 says deleting one offers to
 * unbind rather than to delete the scene, and the writing is never what the ×
 * on a row is allowed to cost.
 */
export const unpromoteRow = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile =>
  writeRow(file, outlineId, itemId, { boundUnitId: null, boundBeatId: null });

/** The scenes a row could be, in story order: every one not already spoken for. */
export const promotableUnits = (file: ProjectFile, itemId: OutlineItemId | null = null): StructuralUnit[] => {
  const taken = claimedInScript(file, itemId as string | null).units;
  return unitsInStoryOrder(file).filter((unit) => !taken.has(unit.id as string));
};

/**
 * This row **is** that scene, where the writer picks one that already exists
 * rather than making a new one.
 *
 * The row's name wins where it has one, because that is what the writer typed
 * in front of them; where the row is blank it takes the script's, so binding to
 * a scene that already has a name reads as recognising it rather than wiping
 * it.
 */
export const bindRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  unitId: StructuralUnitId,
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  const unit = file.units.find((candidate) => candidate.id === unitId);
  if (!outline || !item || !unit) return file;
  if (promoteKindOf(item) !== 'unit') return file;
  if (claimedInScript(file, itemId as string).units.has(unitId as string)) return file;

  const title = item.title.trim() || unit.title;
  return retitleScript(
    writeRow(file, outlineId, itemId, { boundUnitId: unitId, boundBeatId: null, title }),
    { unitId },
    title,
  );
};

// ----------------------------- when the outline and the script disagree

/**
 * A promoted row whose neighbours in the outline are in a different order in
 * the script (§6).
 *
 * Moving a row moves the row, always — the outline never reorders the script
 * behind the writer's back. So the disagreement is said out loud instead, and
 * the offer to fix it is one click and is the writer's.
 */
export interface OutOfStepRow {
  itemId: OutlineItemId;
  /** The sibling it disagrees with, by name, for the sentence. */
  otherTitle: string;
  /** True where the outline puts this one first, which is what the script would become. */
  outlineFirst: boolean;
}

export const rowOutOfStep = (file: ProjectFile, outline: Outline, itemId: OutlineItemId): OutOfStepRow | null => {
  const item = findOutlineItem(outline, itemId);
  if (!item || !isPromoted(item)) return null;

  const siblings = outlineChildren(outline, item.parentId);
  const at = siblings.findIndex((candidate) => candidate.id === itemId);
  if (at === -1) return null;

  const parent = outlineParent(outline, item);
  const order =
    item.boundUnitId !== null
      ? unitsInStoryOrder(file).map((unit) => unit.id as string)
      : parent?.boundUnitId
        ? beatsForUnit(file, parent.boundUnitId).map((beat) => beat.id as string)
        : file.beats.map((beat) => beat.id as string);

  const positionOf = (candidate: OutlineItem): number => {
    const id = (candidate.boundUnitId ?? candidate.boundBeatId) as string | null;
    return id === null ? -1 : order.indexOf(id);
  };

  const mine = positionOf(item);
  if (mine === -1) return null;

  // The nearest promoted sibling either side is the one the sentence is
  // about: a disagreement with something three rows away is not what a writer
  // is looking at.
  for (const step of [-1, 1] as const) {
    for (let index = at + step; index >= 0 && index < siblings.length; index += step) {
      const other = siblings[index] as OutlineItem;
      const theirs = positionOf(other);
      if (theirs === -1) continue;
      const outlineFirst = step === 1;
      const scriptFirst = mine < theirs;
      if (outlineFirst !== scriptFirst) {
        return { itemId, otherTitle: other.title.trim() || 'the one beside it', outlineFirst };
      }
      break;
    }
  }
  return null;
};

/**
 * Move the script to match the outline, for one row, because the writer asked.
 *
 * The scene goes to the position its row has among its promoted siblings, and
 * nothing else is touched. **This is the only way the outline ever changes the
 * story order, and it is always a click.**
 */
export const followOutline = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item || !isPromoted(item)) return file;

  const siblings = outlineChildren(outline, item.parentId);
  if (siblings.findIndex((candidate) => candidate.id === itemId) === -1) return file;

  if (item.boundUnitId !== null) {
    const order = unitsInStoryOrder(file);
    const positionOf = (id: string) => order.findIndex((unit) => (unit.id as string) === id);
    // The index `moveUnit` wants counts every scene but this one, so a scene
    // moving down loses the place it is vacating.
    const target = indexAmong(item, siblings, positionOf, order.length);
    const here = positionOf(item.boundUnitId as string);
    const index = here !== -1 && target > here ? target - 1 : target;
    const unit = file.units.find((candidate) => candidate.id === item.boundUnitId);
    if (!unit) return file;
    // Its own lane: the outline says where a scene is in the story, never
    // which thread it belongs to (addendum 02 §8).
    return moveUnit(file, { unitId: item.boundUnitId, toLaneId: unit.laneId, index });
  }

  const unitId = outlineParent(outline, item)?.boundUnitId ?? null;
  if (unitId === null || item.boundBeatId === null) return file;
  const order = beatsForUnit(file, unitId);
  const positionOf = (id: string) => order.findIndex((beat) => (beat.id as string) === id);
  const target = indexAmong(item, siblings, positionOf, order.length);
  const here = positionOf(item.boundBeatId as string);
  const index = here !== -1 && target > here ? target - 1 : target;
  return moveBeat(file, { beatId: item.boundBeatId, toUnitId: unitId, index });
};

// --------------------------------------------- the scene card (§7)

/**
 * What a Scene row says about itself, resolved from wherever it lives.
 *
 * **The card shows what exists**, which is the same rule the rest of the
 * module follows: read through rather than copy across. A row that is still a
 * plan has a name, a note and a status of its own, because that is all a plan
 * is. A row in the script has a number, a synopsis, a purpose, a point of view
 * and a lane as well — and those are **the scene's own fields**, shown here
 * rather than copied here (§7), so there is no second set of them to keep in
 * step and promotion adds to the card rather than moving it.
 *
 * Empty throughout is the honest starting state. An unanswered field is not a
 * gap to be nagged about.
 */
export interface SceneCard {
  /** Whether these are the scene's fields or the row's own. */
  inScript: boolean;
  title: string;
  /** The scene's label in the script — "Sc. 14" — or null for a plan. */
  number: string | null;
  /** The summary, or the row's own note while it is still a plan. */
  synopsis: string;
  /** Why the scene is in the script (spec §8.2). Null for a plan. */
  purpose: string | null;
  /** Whose eyes it is seen through. Null for a plan. */
  pov: string | null;
  /** The thread it is drawn in (addendum 02 §8). Null for a plan. */
  lane: { id: string; name: string } | null;
  status: string;
  /** How many beat rows are under it, promoted or not. */
  beats: number;
}

export const sceneCardOf = (file: ProjectFile, outline: Outline, item: OutlineItem): SceneCard | null => {
  if (item.kind !== 'scene') return null;

  const beats = outlineChildren(outline, item.id).filter((child) => child.kind === 'beat').length;
  const promoted = promotedOf(file, item);

  if (promoted?.kind !== 'unit') {
    return {
      inScript: false,
      title: item.title,
      number: null,
      synopsis: item.body,
      purpose: null,
      pov: null,
      lane: null,
      status: item.status,
      beats,
    };
  }

  const unit = promoted.unit;
  const lane = file.lanes.find((candidate) => candidate.id === unit.laneId);
  return {
    inScript: true,
    title: unit.title,
    number: unit.sequenceLabel,
    synopsis: unit.summary,
    purpose: unit.grid.purpose,
    pov: unit.grid.pov,
    lane: lane ? { id: lane.id as string, name: lane.name } : null,
    status: unit.status,
    beats,
  };
};
