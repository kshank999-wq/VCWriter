import { sortByOrderKey } from './ordering.js';
import { beatsForUnit } from './selectors.js';
import { addBeat, updateBeat } from './mutations.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, OutlineItemId } from './ids.js';

/**
 * **Go** between the Outliner and the writing screen (from Ken, 13 November:
 * *in the outliner, when you select a section, subsection, or whatever, or a
 * beat or a scene, it should have a go button next to it that will take you
 * to the writing screen exactly where that is… and in the writing screen, the
 * same thing — it'll take you to the outliner… at that same point*).
 */

/** The beat (or subsection) a row is written in, by its own binding only. */
const ownBeat = (file: ProjectFile, item: OutlineItem): Beat | null => {
  if (item.boundBeatId) return file.beats.find((one) => one.id === item.boundBeatId) ?? null;
  if (item.boundUnitId) return beatsForUnit(file, item.boundUnitId)[0] ?? null;
  return null;
};

/**
 * Where a row is written:
 *
 * - a beat or subsection: its own writing screen;
 * - a scene or section: its first beat's;
 * - a chapter, or a plan with rows under it: the first row under it that is
 *   on the track, in outline order;
 * - a row beneath a beat (a note, a character, a deeper level): the beat it
 *   hangs under, whose writing screen lists it on the right.
 *
 * Null where nothing near it is on the track yet.
 */
export const writingBeatForRow = (file: ProjectFile, outline: Outline, itemId: OutlineItemId | string): Beat | null => {
  const item = outline.items.find((one) => (one.id as string) === (itemId as string));
  if (!item) return null;
  const own = ownBeat(file, item);
  if (own) return own;

  // Down: the first row under it, in the order the outline shows them.
  const childrenOf = (parent: string) => sortByOrderKey(outline.items.filter((one) => (one.parentId as string | null) === parent));
  const down = (parent: string): Beat | null => {
    for (const child of childrenOf(parent)) {
      const found = ownBeat(file, child) ?? down(child.id as string);
      if (found) return found;
    }
    return null;
  };
  const below = down(item.id as string);
  if (below) return below;

  // Up: the nearest row above it that is on the track.
  for (let at = item.parentId; at; ) {
    const parent = outline.items.find((one) => one.id === at);
    if (!parent) break;
    const found = ownBeat(file, parent);
    if (found) return found;
    at = parent.parentId;
  }
  return null;
};

/**
 * The outline row a writing screen stands for: the row that **is** this beat,
 * or, where the beat has none, the row that is its scene or section. The
 * first outline that has one.
 */
export const outlineRowForBeat = (
  file: ProjectFile,
  beatId: BeatId | string,
): { outlineId: string; itemId: string } | null => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat) return null;
  for (const outline of file.outlines ?? []) {
    const row = outline.items.find((item) => item.boundBeatId === beat.id);
    if (row) return { outlineId: outline.id as string, itemId: row.id as string };
  }
  for (const outline of file.outlines ?? []) {
    const row = outline.items.find((item) => item.boundUnitId === beat.unitId);
    if (row) return { outlineId: outline.id as string, itemId: row.id as string };
  }
  return null;
};

/**
 * The section (or scene) a row is written in, by its own binding, the first
 * one under it, or the nearest above it: where a first subsection can go.
 */
const unitForRow = (file: ProjectFile, outline: Outline, item: OutlineItem): StructuralUnit | null => {
  const own = (row: OutlineItem) => (row.boundUnitId ? (file.units.find((one) => one.id === row.boundUnitId) ?? null) : null);
  if (own(item)) return own(item);
  const childrenOf = (parent: string) => sortByOrderKey(outline.items.filter((one) => (one.parentId as string | null) === parent));
  const down = (parent: string): StructuralUnit | null => {
    for (const child of childrenOf(parent)) {
      const found = own(child) ?? down(child.id as string);
      if (found) return found;
    }
    return null;
  };
  const below = down(item.id as string);
  if (below) return below;
  for (let at = item.parentId; at; ) {
    const parent = outline.items.find((one) => one.id === at);
    if (!parent) break;
    if (own(parent)) return own(parent);
    at = parent.parentId;
  }
  return null;
};

/**
 * **Go, even to a section with nothing written in it yet** (from Ken, 14
 * November: *the go button is greyed out* — on a section of his book that is
 * on the track and has no subsections). The writing screen writes into a
 * subsection, so a section with none has nowhere to open. Here it gets its
 * first one: titled as the section, its heading hidden so nothing extra
 * prints — the section's own opening text, which is what a hidden-heading
 * first subsection already is everywhere else.
 *
 * Returns the beat to open, with the file unchanged where one was already
 * there; null where nothing near the row is on the track.
 */
export const writingPlaceForRow = (
  file: ProjectFile,
  outline: Outline,
  itemId: OutlineItemId | string,
): { file: ProjectFile; beatId: string; made: boolean } | null => {
  const existing = writingBeatForRow(file, outline, itemId);
  if (existing) return { file, beatId: existing.id as string, made: false };
  const item = outline.items.find((one) => (one.id as string) === (itemId as string));
  if (!item) return null;
  const unit = unitForRow(file, outline, item);
  if (!unit) return null;
  const added = addBeat(file, { unitId: unit.id, title: unit.title });
  return { file: updateBeat(added.file, added.beat.id, { headingShown: false }), beatId: added.beat.id as string, made: true };
};

/** Whether Go can take this row anywhere, making nothing to find out. */
export const canWriteRow = (file: ProjectFile, outline: Outline, itemId: OutlineItemId | string): boolean => {
  if (writingBeatForRow(file, outline, itemId)) return true;
  const item = outline.items.find((one) => (one.id as string) === (itemId as string));
  return item ? unitForRow(file, outline, item) !== null : false;
};

/**
 * The Sculptor card a writing screen stands for (from Ken, 14 November: *go to
 * sculptor, and it'll take you to that position if it's in the sculptor. If
 * it's not in the sculptor yet, then it'll be grayed out*): the card bound to
 * this beat, or, where none is, the card bound to its scene or section. Null
 * where neither is on a board.
 */
export const sculptorNodeForBeat = (
  file: ProjectFile,
  beatId: BeatId | string,
): { boardId: string; nodeId: string } | null => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat) return null;
  for (const board of file.boards ?? []) {
    const node = board.nodes.find((one) => one.boundBeatId === beat.id);
    if (node) return { boardId: board.id as string, nodeId: node.id as string };
  }
  for (const board of file.boards ?? []) {
    const node = board.nodes.find((one) => one.boundUnitId === beat.unitId);
    if (node) return { boardId: board.id as string, nodeId: node.id as string };
  }
  return null;
};

/** Where a Sculptor card is written: its beat, or its scene's first beat. Null for an idea not on the track. */
export const writingBeatForNode = (
  file: ProjectFile,
  node: { boundBeatId: BeatId | null; boundUnitId: StructuralUnit['id'] | null },
): Beat | null => {
  if (node.boundBeatId) return file.beats.find((one) => one.id === node.boundBeatId) ?? null;
  if (node.boundUnitId) return beatsForUnit(file, node.boundUnitId)[0] ?? null;
  return null;
};
