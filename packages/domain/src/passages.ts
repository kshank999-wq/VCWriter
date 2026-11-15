import { isInstructional } from './formats.js';
import { moveBeat } from './mutations.js';
import { trackLevelOf } from './outline.js';
import { beatsForUnit } from './selectors.js';
import type { Beat } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * **Passages** (from Ken, 15 November: *the only thing that'll show up in the
 * script view is the chapters, the sections, and then the subsections.
 * Anything under a subsection would just be considered a passage of that
 * section. And so when you write it, it doesn't title it… these passages will
 * show up in the right-hand note screen in the subsection… And you can edit
 * those and add them just like normal*).
 *
 * In an instructional book a row of the outline deeper than a subsection
 * (`trackLevelOf` → `beneath`) is a passage. On the track it is still a beat —
 * its words are in the book, in reading order, straight after its subsection —
 * but it is **not a subsection**: no heading, no number, no box of its own on
 * the track. It belongs to the subsection it follows, whose writing screen
 * lists it beside the page. Nothing is stored to say so: move the row up a
 * level in the outline and it is a subsection again.
 */

/** Every beat that is a passage, by id. Empty outside an instructional book. */
export const passageBeatIds = (file: ProjectFile): ReadonlySet<string> => {
  const out = new Set<string>();
  if (!isInstructional(file.project.format)) return out;
  const beats = new Set(file.beats.map((beat) => beat.id as string));
  for (const outline of file.outlines ?? []) {
    for (const item of outline.items) {
      if (item.boundBeatId && beats.has(item.boundBeatId as string) && trackLevelOf(outline, item) === 'beneath') {
        out.add(item.boundBeatId as string);
      }
    }
  }
  return out;
};

export const isPassage = (file: ProjectFile, beatId: BeatId | string, passages = passageBeatIds(file)): boolean =>
  passages.has(beatId as string);

/** A section's subsections as the track draws them: its beats, less the passages. */
export const trackBeatsForUnit = (file: ProjectFile, unitId: StructuralUnitId, passages = passageBeatIds(file)): Beat[] =>
  beatsForUnit(file, unitId).filter((beat) => !passages.has(beat.id as string));

/** The passages a subsection holds: the passages straight after it, in reading order. */
export const passagesOf = (file: ProjectFile, beatId: BeatId | string, passages = passageBeatIds(file)): Beat[] => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat || passages.has(beat.id as string)) return [];
  const order = beatsForUnit(file, beat.unitId);
  const out: Beat[] = [];
  for (let index = order.findIndex((one) => one.id === beat.id) + 1; index < order.length; index += 1) {
    const next = order[index] as Beat;
    if (!passages.has(next.id as string)) break;
    out.push(next);
  }
  return out;
};

/** The subsection a passage belongs to: the nearest subsection before it. Null for one that is not a passage. */
export const subsectionOfPassage = (file: ProjectFile, beatId: BeatId | string, passages = passageBeatIds(file)): Beat | null => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat || !passages.has(beat.id as string)) return null;
  const order = beatsForUnit(file, beat.unitId);
  for (let index = order.findIndex((one) => one.id === beat.id) - 1; index >= 0; index -= 1) {
    const before = order[index] as Beat;
    if (!passages.has(before.id as string)) return before;
  }
  return null;
};

/**
 * A subsection moved on the track, **with its passages**: `index` counts the
 * subsections the track draws in the section it goes to (the moving one left
 * out), and the passages follow it there in their order, so a subsection never
 * leaves its words behind under another one. Outside a book, with no
 * passages, this is `moveBeat`.
 */
export const moveTrackBeat = (
  file: ProjectFile,
  input: { beatId: BeatId; toUnitId: StructuralUnitId; index: number },
): ProjectFile => {
  const passages = passageBeatIds(file);
  const block = [input.beatId, ...passagesOf(file, input.beatId, passages).map((one) => one.id)];
  if (passages.size === 0) return moveBeat(file, input);
  const moving = new Set(block.map((id) => id as string));
  const shown = beatsForUnit(file, input.toUnitId).filter(
    (beat) => !moving.has(beat.id as string) && !passages.has(beat.id as string),
  );
  const anchor = shown[input.index] ?? null;
  let current = file;
  let previous: BeatId | null = null;
  for (const id of block) {
    // Each lands before the anchor (or at the end), the passages each after the one before.
    const siblings = beatsForUnit(current, input.toUnitId).filter((beat) => beat.id !== id);
    const index =
      previous !== null
        ? siblings.findIndex((beat) => beat.id === previous) + 1
        : anchor
          ? siblings.findIndex((beat) => beat.id === anchor.id)
          : siblings.length;
    current = moveBeat(current, { beatId: id, toUnitId: input.toUnitId, index });
    previous = id;
  }
  return current;
};
