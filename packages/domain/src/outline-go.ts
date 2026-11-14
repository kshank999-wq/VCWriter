import { sortByOrderKey } from './ordering.js';
import { beatsForUnit } from './selectors.js';
import type { Beat } from './entities/structure.js';
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
