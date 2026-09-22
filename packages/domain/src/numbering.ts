import { nowIso } from './entities/common.js';
import { isInstructional, nounsFor } from './formats.js';
import { outlineChildren } from './outline.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import type { BeatId, StoryMarkerId, StructuralUnitId } from './ids.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';

/**
 * Decimal section numbering (addendum 16 §15).
 *
 * A textbook is a **numbered outline**: section 1, and under it 1.1, 1.2, 1.3.
 * That is what Ken asked for, and it is the one thing an instructional book
 * needs that a novel does not — a novel's chapters are numbered, but nothing
 * inside a chapter is.
 *
 * **Nothing here is stored, and there is nowhere to type a number.** Every
 * figure is counted from where a division falls in the story order, so dragging
 * section four above section two makes it section two, and everything under it
 * renumbers, with nothing run. This is the same absence the chapter page's
 * number rests on (addendum 02 §12a), the figure's (addendum 16 §3) and the
 * book index's page numbers (addendum 10 §3) — by now it is simply how this
 * project numbers things.
 *
 * `sequenceLabel` on a unit is **not** this. It is a stored string the FDX
 * import writes ("Sc. 4", "Chapter 2") and nothing else ever sets, so it is
 * empty on every division made inside the application. A stored label and a
 * counted number are two answers to one question, and this module is the
 * answer that cannot go stale.
 */

/** What a project can do about its divisions' numbers. `decimal`, or nothing. */
export type SectionNumbering = 'decimal' | 'none';

/**
 * Turn the numbering on or off.
 *
 * The only thing there is to set: *whether*, never *what*. A control that let
 * somebody type "3" against the fourth section would be a control that can
 * disagree with the book.
 */
export const setSectionNumbering = (file: ProjectFile, sectionNumbering: SectionNumbering): ProjectFile => ({
  ...file,
  settings: { ...file.settings, sectionNumbering },
  project: { ...file.project, updatedAt: nowIso() },
});

export interface StructureNumbers {
  /**
   * Chapter marker id → `"1"`, `"2"` (addendum 19 §6). Empty when the scheme
   * is `none`, and empty on a book with no chapters, where the units are the
   * top level.
   */
  chapters: ReadonlyMap<string, string>;
  /** Unit id → `"1"`, `"2"`, `"3"` — or `"1.1"`, `"1.2"` under a chapter. Empty when the scheme is `none`. */
  units: ReadonlyMap<string, string>;
  /** Beat id → `"1.1"`, `"1.2"` — or `"1.1.1"` under a chapter. Empty when the scheme is `none`. */
  subs: ReadonlyMap<string, string>;
}

const EMPTY: StructureNumbers = { chapters: new Map(), units: new Map(), subs: new Map() };

/**
 * Whether this project numbers its divisions at all.
 *
 * Only an instructional book does by default, and only because a textbook's
 * structure *is* its numbering. A novel that wanted 1.1 could say so, which is
 * why this reads a setting rather than the format alone.
 */
export const numbersDivisions = (file: ProjectFile): boolean => {
  const scheme = file.settings.sectionNumbering ?? 'decimal';
  if (scheme === 'none') return false;
  return isInstructional(file.project.format);
};

/**
 * Every division's number, counted.
 *
 * Units are numbered in **story order** rather than in the order the document
 * happens to hold them, because the number a reader sees is a fact about where
 * a section falls in the book. Subsections are numbered within their own
 * section, so 2.1 follows 1.3.
 *
 * **Three levels once there is a chapter** (addendum 19 §6). A chapter is a
 * `chapter` marker, and a unit belongs to the last chapter whose marker fell
 * at or before it — the same reading `divisionSpan` makes — so chapter 2's
 * first section is 2.1 and its first subsection 2.1.1, and dragging chapter
 * four above chapter two renumbers everything under both with nothing run.
 * A book with no chapters numbers as it always has: the third level appears
 * when the first chapter does. **A unit before the first chapter carries no
 * number** — it is a section of no chapter, with no path to the front of the
 * book, and inventing one would collide with the sections that have.
 */
export const structureNumbers = (file: ProjectFile): StructureNumbers => {
  if (!numbersDivisions(file)) return EMPTY;

  const chapters = new Map<string, string>();
  const units = new Map<string, string>();
  const subs = new Map<string, string>();

  const starts = new Map(
    file.markers.filter((marker) => marker.kind === 'chapter').map((marker) => [marker.unitId as string, marker]),
  );
  const chaptered = starts.size > 0;

  /** The chapter's number, or `''` at the top level; how many sections it has so far. */
  let prefix = '';
  let within = 0;

  unitsInStoryOrder(file).forEach((unit, at) => {
    const opens = starts.get(unit.id as string);
    if (opens) {
      prefix = String(chapters.size + 1);
      chapters.set(opens.id as string, prefix);
      within = 0;
    }
    // Before the first chapter of a chaptered book: no number, and nothing
    // under it numbered either.
    if (chaptered && prefix === '') return;

    within += 1;
    const number = chaptered ? `${prefix}.${within}` : String(at + 1);
    units.set(unit.id as string, number);
    beatsForUnit(file, unit.id).forEach((beat, under) => {
      subs.set(beat.id as string, `${number}.${under + 1}`);
    });
  });

  return { chapters, units, subs };
};

/** One chapter's number, or `''` where this book does not number, or has no chapters. */
export const numberOfChapter = (file: ProjectFile, markerId: StoryMarkerId): string =>
  structureNumbers(file).chapters.get(markerId as string) ?? '';

/** One section's number, or `''` where this book does not number them. */
export const numberOfUnit = (file: ProjectFile, unitId: StructuralUnitId): string =>
  structureNumbers(file).units.get(unitId as string) ?? '';

/** One subsection's number, or `''`. */
export const numberOfSub = (file: ProjectFile, beatId: BeatId): string =>
  structureNumbers(file).subs.get(beatId as string) ?? '';

/**
 * A division's number and title as one line — `1.2 Refraction`.
 *
 * The number goes **in front of the writer's own title and never replaces it**:
 * a section called *1.2* and nothing else is a section nobody can find in a
 * list, and the title is the part a writer actually reads.
 */
export const numberedTitle = (number: string, title: string, fallback: string): string => {
  const words = title.trim() || fallback;
  return number.length > 0 ? `${number} ${words}` : words;
};

/**
 * What the numbering is doing, in a sentence.
 *
 * Said where the control is, because a writer looking for the box to type a
 * number in should find out there is none rather than hunt for it — the same
 * sentence the chapter page's dialog carries, for the same reason.
 */
/**
 * The same numbering over an **outline** — 1, then 1.1, 1.2, then 1.2.1.
 *
 * Ken's ask was for the Outliner to read like a textbook's table of contents,
 * and an outline is the one place in the program where the tree is arbitrarily
 * deep, so the number is a *path* rather than two levels. It is counted from
 * where each row sits, exactly as the script's is, and the two agree by
 * construction once a row is promoted, because promotion puts the row's
 * section where its outline position says.
 *
 * **Only the structural kinds are numbered.** A note or an idea hanging under
 * section two is not section 2.3 — it is a thing the writer knows, and giving
 * it a number would put it in the book's table of contents. This is the rail's
 * rule (*a note gets no dot*) pointed at numbering.
 */
export const outlineNumbers = (file: ProjectFile, outline: Outline): ReadonlyMap<string, string> => {
  const numbers = new Map<string, string>();
  if (!numbersDivisions(file)) return numbers;

  const numbered = (item: OutlineItem): boolean => item.kind === 'scene' || item.kind === 'beat';

  const walk = (parentId: OutlineItem['parentId'], prefix: string): void => {
    let at = 0;
    for (const child of outlineChildren(outline, parentId)) {
      // Unnumbered, and it does not break the run: a note between 1.1 and
      // what follows leaves the next section 1.2 rather than 1.3. Nothing
      // under it is numbered either — a section hanging off a note has no
      // path to the front of the book, and inventing one would collide with
      // the section's real siblings.
      if (!numbered(child)) continue;
      at += 1;
      const number = prefix.length > 0 ? `${prefix}.${at}` : String(at);
      numbers.set(child.id as string, number);
      walk(child.id, number);
    }
  };

  // The top level is the manuscript's reading (addendum 19 §6): with a
  // Chapter row anywhere at the top, a section belongs to the last chapter
  // above it and numbers 1.1, 1.2 under it, whether it hangs under the row or
  // sits beside it; before the first chapter it carries no number. With no
  // chapter row, the sections are the top level, as they always were.
  const top = outlineChildren(outline, null);
  if (!top.some((item) => item.kind === 'chapter')) {
    walk(null, '');
    return numbers;
  }
  let chapter = 0;
  let within = 0;
  for (const item of top) {
    if (item.kind === 'chapter') {
      chapter += 1;
      within = 0;
      numbers.set(item.id as string, String(chapter));
      // Its sections, in their order, and their subsections under them.
      for (const child of outlineChildren(outline, item.id)) {
        if (!numbered(child)) continue;
        within += 1;
        const number = `${chapter}.${within}`;
        numbers.set(child.id as string, number);
        walk(child.id, number);
      }
      continue;
    }
    if (!numbered(item) || chapter === 0) continue;
    within += 1;
    const number = `${chapter}.${within}`;
    numbers.set(item.id as string, number);
    walk(item.id, number);
  }
  return numbers;
};

/**
 * Why a row has no number, where a writer might expect one (addendum 19 §6);
 * null where it has one, or where nothing here numbers at all.
 *
 * The sentence the Outliner puts beside a section that sits above the first
 * chapter, because a number that is simply missing looks like a fault and a
 * number that says why it is missing is a fact about the book.
 */
export const whyUnnumbered = (file: ProjectFile, outline: Outline, item: OutlineItem): string | null => {
  if (!numbersDivisions(file)) return null;
  if (item.kind !== 'scene' && item.kind !== 'beat') return null;
  if (outlineNumbers(file, outline).has(item.id as string)) return null;
  const nouns = nounsFor(file.project.format);
  const top = outlineChildren(outline, null);
  if (item.parentId === null && top.some((row) => row.kind === 'chapter')) {
    return `No number: it comes before the first chapter, so it is a ${nouns.unit.toLowerCase()} of no chapter.`;
  }
  return `No number: it sits under something that is not a ${nouns.unit.toLowerCase()}, so it has no place in the run.`;
};

export const describeNumbering = (file: ProjectFile): string => {
  const nouns = nounsFor(file.project.format);
  if (!numbersDivisions(file)) {
    return `${nouns.unitPlural} are not numbered. Their titles stand on their own.`;
  }
  const unit = nouns.unit.toLowerCase();
  const chaptered = file.markers.some((marker) => marker.kind === 'chapter');
  if (chaptered) {
    return (
      `Chapters are numbered 1, 2, 3, ${nouns.unitPlural.toLowerCase()} 1.1, 1.2, 1.3 and ` +
      `${nouns.subPlural.toLowerCase()} 1.1.1, 1.1.2. Every figure is worked out from where that ` +
      `${unit} falls, so moving one renumbers whatever it passes; a ${unit} before the first chapter ` +
      `has no number. There is nowhere to type a number.`
    );
  }
  return (
    `${nouns.unitPlural} are numbered 1, 2, 3 and ${nouns.subPlural.toLowerCase()} 1.1, 1.2, 1.3. ` +
    `Every figure is worked out from where that ${unit} falls, so moving one renumbers ` +
    `whatever it passes. There is nowhere to type a number.`
  );
};
