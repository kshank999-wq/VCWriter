import { workingCast } from './characters.js';
import { onlyLiving } from './graveyard.js';
import type { ProjectFile } from './project-file.js';
import type { Beat } from './entities/structure.js';
import type { ManuscriptElementId } from './ids.js';

/**
 * What is already anchored to a passage (addendum 25 §7, the handoff's margin
 * mark).
 *
 * The ask is the Character Creator's — *show in the margin where a passage is
 * already linked* — and the reading is **not**, deliberately. A mark that
 * showed characterization and nothing else would be beside a paragraph
 * carrying a theme, an index heading and a promise, saying nothing about any
 * of them: it would be a mark that lies about what it means. `usage_links` has
 * been the polymorphic anchor since the Character Creator was built and every
 * module since has widened it rather than adding one of its own, so **one
 * reading answers for all of them** and a module built next month is marked
 * the day it anchors to an element.
 *
 * **Nothing is stored.** Cutting the paragraph takes its mark with it; taking
 * the pin off takes the mark off, with nothing run.
 */

/** The kinds of thing that can be anchored to a line of the manuscript. */
export type PassageMarkKind =
  | 'characterization'
  | 'arc_point'
  | 'theme'
  | 'motif'
  | 'thread'
  | 'index';

export interface PassageMark {
  kind: PassageMarkKind;
  /**
   * What it is, in the writer's own words — *Silas Crane · Miserly*, *Grief*,
   * *lenses, Fresnel*. Named rather than counted, because a mark reading *3*
   * tells a writer to go and look where a mark reading what it is does not.
   */
  says: string;
}

const MARK_WORDS: Record<PassageMarkKind, string> = {
  characterization: 'Character',
  arc_point: 'Arc',
  theme: 'Theme',
  motif: 'Motif',
  thread: 'Link',
  index: 'Index',
};

/**
 * Everything anchored to each element of one beat, by element id.
 *
 * **Only what is anchored to a *passage*.** A pin made against the beat as a
 * whole carries no `elementId` — which is deliberate and means *somewhere in
 * this scene* — so putting its mark against the first paragraph would be
 * inventing a position the writer did not give.
 */
export const passageMarks = (
  file: ProjectFile,
  beat: Beat,
): Map<ManuscriptElementId, PassageMark[]> => {
  const out = new Map<ManuscriptElementId, PassageMark[]>();
  const put = (elementId: ManuscriptElementId, mark: PassageMark) => {
    const held = out.get(elementId) ?? [];
    held.push(mark);
    out.set(elementId, held);
  };

  // Who a characterization item belongs to, and under which trait — the two
  // things a writer needs to recognise their own work from the margin.
  const cast = new Map(workingCast(file).map((one) => [one.id as string, one.name]));
  const traits = new Map(file.characterTraits.map((one) => [one.id as string, one.name]));

  for (const link of file.usageLinks) {
    if (link.beatId !== beat.id || link.elementId === null) continue;
    const elementId = link.elementId;

    if (link.ownerKind === 'characterization') {
      const item = file.characterizationItems.find((one) => (one.id as string) === link.ownerId);
      if (!item) continue;
      const who = cast.get(item.characterId as string);
      // A buried character's work is off every list, so its mark goes too.
      if (who === undefined) continue;
      const trait = item.traitId ? traits.get(item.traitId as string) : undefined;
      put(elementId, { kind: 'characterization', says: trait ? `${who} · ${trait}` : who });
      continue;
    }

    if (link.ownerKind === 'arc_point') {
      const point = file.arcPoints.find((one) => (one.id as string) === link.ownerId);
      if (!point) continue;
      const who = cast.get(point.characterId as string);
      if (who === undefined) continue;
      put(elementId, { kind: 'arc_point', says: `${who} · ${point.text}` });
      continue;
    }

    // `onlyLiving` rather than a filter written here: a buried record is off
    // every list in the program, and a margin is a list (addendum 24 §5i).
    if (link.ownerKind === 'theme') {
      const named = onlyLiving(file.themes).find((one) => (one.id as string) === link.ownerId);
      if (!named) continue;
      put(elementId, { kind: 'theme', says: named.name });
      continue;
    }

    if (link.ownerKind === 'motif') {
      const named = onlyLiving(file.motifs).find((one) => (one.id as string) === link.ownerId);
      if (!named) continue;
      put(elementId, { kind: 'motif', says: named.name });
      continue;
    }

    const thread = onlyLiving(file.threads).find((one) => (one.id as string) === link.ownerId);
    if (!thread) continue;
    put(elementId, { kind: 'thread', says: thread.name });
  }

  // The index is anchored to an element too, and is its own table rather than
  // a usage link because a mark carries a heading the writer typed (addendum
  // 10 §2). One more reader here, not a second answer — and **no `onlyLiving`**:
  // an index mark is not a graveyard kind, so there is nothing buried to skip.
  for (const mark of file.indexMarks) {
    if (mark.beatId !== beat.id) continue;
    const says = mark.subTerm.trim().length > 0 ? `${mark.term} · ${mark.subTerm}` : mark.term;
    put(mark.elementId, { kind: 'index', says });
  }

  return out;
};

/**
 * What the mark says when the pointer rests on it.
 *
 * Every one named, rather than *4 links*: the whole point of a margin is
 * being able to tell without going anywhere.
 */
export const describePassageMarks = (marks: readonly PassageMark[]): string =>
  marks.map((mark) => `${MARK_WORDS[mark.kind]}: ${mark.says}`).join('\n');
