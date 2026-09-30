import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { onlyLiving } from './graveyard.js';
import { structureNumbers } from './numbering.js';
import { nounsFor } from './formats.js';
import { nowIso } from './entities/common.js';
import { researchItemSchema } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { ResearchItem } from './entities/research.js';
import type { StoryEntityRef } from './entities/links.js';
import type { BeatId, ResearchItemId, StoryMarkerId, StructuralUnitId } from './ids.js';

/**
 * The table of contents, and the notes filed under it (addendum 28).
 *
 * From Ken, for the instructional book: *there needs to be a table of
 * contents, where you can define all your chapters ahead of time and add
 * chapters as you go… so you have a table of contents that you fill out that
 * also populates the research section. So when you bring in some rough notes,
 * you can divide it into those sections without dropping it in as beats, but
 * it'll show up in the research section under those defined chapters. And
 * it'll tell you, like in a screenplay, if you used that note or not.*
 *
 * **The audit paid a twenty-sixth time and paid most of the structure.** A
 * chapter is a `chapter` story marker (addendum 19 §1), the Outliner has had a
 * Chapter row since that addendum, and `structureNumbers` has numbered a book
 * 1 / 1.1 / 1.1.1 with nothing stored since addendum 16 §15. So the table of
 * contents is not a new record and not a new screen: **it is the chapters and
 * sections the book already has, read in order**, which is what `contentsShelf`
 * returns. Ken's *Chapter One Mathematics* is a marker whose number is derived
 * and whose title is typed — two things the record has carried all along — and
 * his *1.1 Division, 1.2 Multiplication* is `structureNumbers` unchanged.
 *
 * What was missing is one field and one reading.
 *
 * **A note can now name where in the book it belongs** (`place` on the research
 * item), and everything else here is read off that. Three rules hold it.
 *
 * **A place is a reference and never a folder.** Filing under Chapter 3 by
 * making a folder called *Chapter 3* would be a second record of one fact,
 * free to disagree the moment the chapter is renamed, moved or deleted.
 *
 * **One place, and the chapter above it is a reading.** A note filed under
 * section 1.2 is under chapter 1 because that is where 1.2 falls, so moving
 * the section moves the note with nothing run — `divisionSpan`'s own argument,
 * which addendum 25 leaned on three times.
 *
 * **How far along a note is, is read and never stored.** This is the fault the
 * module found: `usage`, `usedAt`, `usedInBeatIds` and `usedConfirmed` have
 * been on a research item since 0001 and **nothing has ever computed them** —
 * `markResearchUsed` sets a flag by hand. So a note went on reading *used*
 * after the beat it fed was cut, and read *unused* the moment it was really
 * written unless somebody remembered to press something. Ken asked for the
 * light *like in a screenplay*, and the screenplay side has had the right
 * answer since the Character Creator was built (addendum 08 §2: *used is a
 * reading, never a stored flag*). `noteProgress` is that answer here.
 */

// ------------------------------------------------------------- where it goes

/** A place in the book a note can be filed under: a chapter, or a section. */
export type NotePlace =
  | { kind: 'chapter'; markerId: StoryMarkerId }
  | { kind: 'section'; unitId: StructuralUnitId };

/** The same place as the reference the record stores. */
export const placeRef = (place: NotePlace): StoryEntityRef =>
  place.kind === 'chapter'
    ? { type: 'story_marker', id: place.markerId as string }
    : { type: 'unit', id: place.unitId as string };

/** The place a stored reference names, or null where it names neither. */
export const placeOf = (ref: StoryEntityRef | null): NotePlace | null => {
  if (!ref) return null;
  if (ref.type === 'story_marker') return { kind: 'chapter', markerId: ref.id as StoryMarkerId };
  if (ref.type === 'unit') return { kind: 'section', unitId: ref.id as StructuralUnitId };
  return null;
};

const samePlace = (a: NotePlace, b: NotePlace): boolean =>
  a.kind === 'chapter' && b.kind === 'chapter'
    ? (a.markerId as string) === (b.markerId as string)
    : a.kind === 'section' && b.kind === 'section'
      ? (a.unitId as string) === (b.unitId as string)
      : false;

// -------------------------------------------------------------- how far along

/**
 * How far a note has got, read every time (§2).
 *
 * Three lights rather than two, which is Ken's choice and the better one for
 * the way a textbook is written: while a book is being planned most notes sit
 * in the middle for weeks, and a red light that never moves stops being read
 * at all — the validator's *not crying wolf* rule (addendum 18 stage 3)
 * pointed at a colour.
 *
 *  - `unfiled` — nobody has decided where it goes.
 *  - `planned` — it is filed under a chapter or a section, or an outline row
 *    references it, but nothing in the manuscript has come from it yet.
 *  - `written` — a beat that **still exists** came from it.
 *
 * Every one of them comes off the work, so cutting the beat takes the note
 * back to `planned` and deleting the chapter takes it back to `unfiled`, with
 * nothing run.
 */
export type NoteProgress = 'unfiled' | 'planned' | 'written';

/**
 * Which beats a note is in, counting only beats that still exist.
 *
 * Two sources, and the second is the older spelling of the first. An outline
 * row that **references** the note and is bound to a beat is the chain the
 * Outliner builds (addendum 06 §5); `usedInBeatIds` is what `markResearchUsed`
 * has written by hand since 0001. Both are honoured, and both are filtered
 * through the beats the project actually has — which is the whole fix: a
 * hand-marked note whose beat was cut stops reading *written* by itself.
 */
export const noteInBeats = (file: ProjectFile, item: ResearchItem): BeatId[] => {
  const alive = new Set(file.beats.map((beat) => beat.id as string));
  const found = new Set<string>();

  for (const beatId of item.usedInBeatIds) {
    if (alive.has(beatId as string)) found.add(beatId as string);
  }
  for (const outline of file.outlines ?? []) {
    for (const row of outline.items) {
      if (row.source?.type !== 'research_item') continue;
      if ((row.source.id as string) !== (item.id as string)) continue;
      if (row.boundBeatId && alive.has(row.boundBeatId as string)) found.add(row.boundBeatId as string);
    }
  }
  return [...found] as BeatId[];
};

/** Whether any outline row references this note, bound or not. */
const plannedInOutline = (file: ProjectFile, item: ResearchItem): boolean =>
  (file.outlines ?? []).some((outline) =>
    outline.items.some(
      (row) => row.source?.type === 'research_item' && (row.source.id as string) === (item.id as string),
    ),
  );

/**
 * Whether the place a note names still exists.
 *
 * A chapter can be deleted and a section can be cut, and a note pointing at
 * one that has gone is **unfiled** rather than mysteriously filed nowhere —
 * the place is a reference, so this is the reading that makes deleting a
 * chapter safe with nothing run.
 */
export const placeStillThere = (file: ProjectFile, place: NotePlace | null): boolean => {
  if (!place) return false;
  return place.kind === 'chapter'
    ? file.markers.some((marker) => (marker.id as string) === (place.markerId as string))
    : file.units.some((unit) => (unit.id as string) === (place.unitId as string));
};

export const noteProgress = (file: ProjectFile, item: ResearchItem): NoteProgress => {
  if (noteInBeats(file, item).length > 0) return 'written';
  if (placeStillThere(file, placeOf(item.place))) return 'planned';
  if (plannedInOutline(file, item)) return 'planned';
  return 'unfiled';
};

/** What the light means, in words, for the row it sits on. */
export const describeProgress = (progress: NoteProgress): string =>
  progress === 'written'
    ? 'In the book'
    : progress === 'planned'
      ? 'Placed, not written yet'
      : 'Not placed yet';

// ------------------------------------------------------------ the whole shelf

/** A chapter or a section, as the table of contents lists it. */
export interface ContentsRow {
  place: NotePlace;
  /** `1`, `1.2` — worked out from where it falls, and stored nowhere. */
  number: string;
  /** The writer's own words. A chapter with none still has a number. */
  title: string;
  /** What it is about, where the chapter page carries one. */
  summary: string;
  /** 0 for a chapter, 1 for a section under it. */
  depth: number;
  /** The notes filed here, newest work last, in the order they were filed. */
  notes: ResearchItem[];
  /** How many of those notes are in the book already. */
  written: number;
}

/**
 * The book's chapters and sections in order, with the notes filed under each.
 *
 * **It is a reading and nothing about it is stored** — the sixth time this
 * project has made a fact about the work a reading rather than a column. Add a
 * chapter and a row appears; drag a section into another chapter and its notes
 * go with it; delete a chapter and its notes read as unfiled again, each with
 * nothing run.
 *
 * A section is listed under the chapter it falls in, which is
 * `structureNumbers`' own rule read back rather than a second walk.
 */
export const contentsShelf = (file: ProjectFile): ContentsRow[] => {
  const numbers = structureNumbers(file);
  const living = onlyLiving(file.researchItems);

  const byChapter = new Map<string, ResearchItem[]>();
  const bySection = new Map<string, ResearchItem[]>();
  for (const item of living) {
    const place = placeOf(item.place);
    if (!place) continue;
    const key = place.kind === 'chapter' ? (place.markerId as string) : (place.unitId as string);
    const into = place.kind === 'chapter' ? byChapter : bySection;
    into.set(key, [...(into.get(key) ?? []), item]);
  }

  const opens = new Map(
    file.markers
      .filter((marker) => marker.kind === 'chapter')
      .map((marker) => [marker.unitId as string, marker]),
  );

  const rows: ContentsRow[] = [];
  const countWritten = (notes: ResearchItem[]) =>
    notes.filter((note) => noteProgress(file, note) === 'written').length;

  unitsInStoryOrder(file).forEach((unit) => {
    const marker = opens.get(unit.id as string);
    if (marker) {
      const notes = byChapter.get(marker.id as string) ?? [];
      rows.push({
        place: { kind: 'chapter', markerId: marker.id },
        number: numbers.chapters.get(marker.id as string) ?? '',
        title: marker.title,
        summary: marker.page?.summary ?? '',
        depth: 0,
        notes,
        written: countWritten(notes),
      });
    }
    const notes = bySection.get(unit.id as string) ?? [];
    rows.push({
      place: { kind: 'section', unitId: unit.id },
      number: numbers.units.get(unit.id as string) ?? '',
      title: unit.title,
      summary: unit.summary ?? '',
      depth: opens.size > 0 ? 1 : 0,
      notes,
      written: countWritten(notes),
    });
  });

  return rows;
};

/** One row by the place it is, or null where the place has gone. */
export const contentsRowAt = (file: ProjectFile, place: NotePlace | null): ContentsRow | null => {
  if (!place) return null;
  return contentsShelf(file).find((row) => samePlace(row.place, place)) ?? null;
};

/** Every note filed at one place, in the order they were filed. */
export const notesUnder = (file: ProjectFile, place: NotePlace): ResearchItem[] =>
  contentsRowAt(file, place)?.notes ?? [];

/**
 * How the row reads on the screen: its number and its title, or its number
 * alone where nobody has titled it yet.
 *
 * **A chapter with no title is still Chapter One**, which is what lets Ken
 * lay out ten chapters in a minute and name them afterwards — the number is
 * derived, so there is nothing to type for it and nothing to keep in step.
 */
export const describeContentsRow = (row: ContentsRow, file: ProjectFile): string => {
  const nouns = nounsFor(file.project.format);
  const noun = row.depth === 0 ? 'Chapter' : nouns.unit;
  const named = row.title.trim();
  // A chapter number takes a full stop and a multi-level one does not, which
  // is how books set them: *1. Mathematics*, then *1.1 Division*. Driving the
  // screen is what caught it — `1.1.` reads as an unfinished third level.
  const number = row.number ? (row.number.includes('.') ? row.number : `${row.number}.`) : '';
  if (number && named) return `${number} ${named}`;
  if (number) return `${number} Untitled ${noun.toLocaleLowerCase()}`;
  return named || `Untitled ${noun.toLocaleLowerCase()}`;
};

// --------------------------------------------------------------- filing a note

export interface FilingOffer {
  /** What a drop would do, or why it would do nothing. */
  says: string;
  /** False where the place has gone, or the note is already there. */
  may: boolean;
}

/**
 * What filing this note here would do, said before it can be asked for.
 *
 * `trackRemoval`'s shape, for its reason: the sentence a writer acts on is
 * computed by the module that performs the act, so a screen cannot promise
 * something the act then refuses — and `fileNoteUnder` refuses the same things
 * again, so a caller cannot get past the reading by not reading it.
 */
export const filingOffer = (
  file: ProjectFile,
  itemId: ResearchItemId,
  place: NotePlace,
): FilingOffer => {
  const item = onlyLiving(file.researchItems).find((one) => (one.id as string) === (itemId as string));
  if (!item) return { says: 'That note is not on the shelf any more.', may: false };
  if (!placeStillThere(file, place)) {
    return { says: 'That part of the book is not there any more.', may: false };
  }

  const row = contentsRowAt(file, place);
  const where = row ? describeContentsRow(row, file) : 'the book';
  const already = placeOf(item.place);
  if (already && samePlace(already, place)) {
    return { says: `“${item.title}” is already under ${where}.`, may: false };
  }
  if (already) {
    const from = contentsRowAt(file, already);
    return {
      // Said because it is the one outcome a writer would not guess: a note
      // has one place, so dropping it somewhere else is a move rather than a
      // second filing, and the shelf it came off loses a row.
      says: `Move “${item.title}” from ${from ? describeContentsRow(from, file) : 'where it was'} to ${where}. The note itself does not change.`,
      may: true,
    };
  }
  return { says: `File “${item.title}” under ${where}. The note itself does not change.`, may: true };
};

/**
 * File a note under a chapter or a section.
 *
 * **It writes one field and touches nothing else** — not the note's folder,
 * not its words, not the manuscript. A note filed under a chapter is still in
 * the folder it was in and still reads there; where it is in the book and
 * which shelf it sits on are two questions, and answering the second by
 * moving it would lose the writer's own filing.
 */
export const fileNoteUnder = (
  file: ProjectFile,
  itemId: ResearchItemId,
  place: NotePlace,
): ProjectFile => {
  if (!filingOffer(file, itemId, place).may) return file;
  return {
    ...file,
    researchItems: file.researchItems.map((item) =>
      (item.id as string) === (itemId as string)
        ? researchItemSchema.parse({ ...item, place: placeRef(place), updatedAt: nowIso() })
        : item,
    ),
  };
};

/** Take a note back off the table of contents. Its folder is untouched. */
export const unfileNote = (file: ProjectFile, itemId: ResearchItemId): ProjectFile => {
  const item = file.researchItems.find((one) => (one.id as string) === (itemId as string));
  if (!item || item.place === null) return file;
  return {
    ...file,
    researchItems: file.researchItems.map((one) =>
      (one.id as string) === (itemId as string)
        ? researchItemSchema.parse({ ...one, place: null, updatedAt: nowIso() })
        : one,
    ),
  };
};

/**
 * What the shelf says at the top of the research room.
 *
 * It names what is **still to do** rather than what is done, because a writer
 * opening this room is looking for the next thing to place, and *18 notes* is
 * a figure they would then have to work out the rest of for themselves.
 */
export const describeContents = (file: ProjectFile): string => {
  const rows = contentsShelf(file);
  // Counted by what a row **is** rather than by its depth: on a book with no
  // chapters yet every section sits at depth 0, so counting depth said *4
  // chapters* about a book that had none. A row knows which it is.
  const chapters = rows.filter((row) => row.place.kind === 'chapter').length;
  if (chapters === 0) {
    return 'No chapters yet. Add them in the Outliner and they turn up here, and on the timeline.';
  }
  const filed = rows.reduce((total, row) => total + row.notes.length, 0);
  const loose = onlyLiving(file.researchItems).filter(
    (item) => noteProgress(file, item) === 'unfiled',
  ).length;

  const said = chapters === 1 ? '1 chapter' : `${chapters} chapters`;
  if (filed === 0 && loose === 0) return `${said}. Nothing filed under them yet.`;
  if (loose === 0) return `${said}, and every note is placed.`;
  const notes = loose === 1 ? '1 note is' : `${loose} notes are`;
  return `${said}. ${notes} not placed yet.`;
};
