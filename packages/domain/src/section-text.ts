import { isInstructional } from './formats.js';
import { addBeat, updateBeat } from './mutations.js';
import { beatsForUnit } from './selectors.js';
import type { Beat } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * **A section's own text** (from Ken, 21 November: *if you look at the
 * outliner and you look at the chapters, that's the chapter heading. Then you
 * need to be able to write directly under the 1.1… section 1.1, I should be
 * able to write that without another subheading. Otherwise, every single
 * paragraph or every single thought would be divided up by another
 * subheading*).
 *
 * In an instructional book a section's first beat, with its heading off, is
 * the section's text: printed straight under *1.1 Why Do You Want to Write?*,
 * numbered nothing, shown on the track as the section's text rather than as a
 * subsection. Subsections follow it, each with its heading unless the writer
 * switches it off. Nothing is stored to say so: switch the heading on and it
 * is a subsection again.
 */

export const isSectionText = (file: ProjectFile, beat: Beat): boolean => {
  if (!isInstructional(file.project.format) || beat.headingShown !== false) return false;
  return beatsForUnit(file, beat.unitId)[0]?.id === beat.id;
};

/** The section's text, if it has any yet. */
export const sectionTextOf = (file: ProjectFile, unitId: StructuralUnitId | string): Beat | null => {
  const first = beatsForUnit(file, unitId as StructuralUnitId)[0];
  return first && isSectionText(file, first) ? first : null;
};

/** Somewhere to write the section's text: the one it has, or a new one, first in the section and headed by nothing. */
export const writeSectionText = (file: ProjectFile, unitId: StructuralUnitId | string): { file: ProjectFile; beatId: BeatId } => {
  const existing = sectionTextOf(file, unitId);
  if (existing) return { file, beatId: existing.id };
  const added = addBeat(file, { unitId: unitId as StructuralUnitId, index: 0 });
  return { file: updateBeat(added.file, added.beat.id, { headingShown: false }), beatId: added.beat.id };
};
