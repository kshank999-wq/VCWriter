import { unitsInStoryOrder } from './selectors.js';
import { onlyLiving } from './graveyard.js';
import { outlineNumbers, structureNumbers } from './numbering.js';
import { outlineRows, rowTitle } from './outline.js';
import { nounsFor } from './formats.js';
import { nowIso } from './entities/common.js';
import { researchItemSchema } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { ResearchItem } from './entities/research.js';
import type { StoryEntityRef } from './entities/links.js';
import type { BeatId, OutlineItemId, ResearchItemId, StoryMarkerId, StructuralUnitId } from './ids.js';

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

/**
 * A place in the book a note can be filed under.
 *
 * Three kinds, and the third is §4c's whole data change: a chapter in the
 * manuscript, a section in the manuscript, or a **row of the Outliner** that is
 * still a plan. Which of the three it is, is never asked by the screen — it
 * drops a note on a box and the box carries its place.
 */
export type NotePlace =
  | { kind: 'chapter'; markerId: StoryMarkerId }
  | { kind: 'section'; unitId: StructuralUnitId }
  | { kind: 'plan'; itemId: OutlineItemId };

/** The same place as the reference the record stores. */
export const placeRef = (place: NotePlace): StoryEntityRef =>
  place.kind === 'chapter'
    ? { type: 'story_marker', id: place.markerId as string }
    : place.kind === 'section'
      ? { type: 'unit', id: place.unitId as string }
      : { type: 'outline_item', id: place.itemId as string };

/** The place a stored reference names, or null where it names none of them. */
export const placeOf = (ref: StoryEntityRef | null): NotePlace | null => {
  if (!ref) return null;
  if (ref.type === 'story_marker') return { kind: 'chapter', markerId: ref.id as StoryMarkerId };
  if (ref.type === 'unit') return { kind: 'section', unitId: ref.id as StructuralUnitId };
  if (ref.type === 'outline_item') return { kind: 'plan', itemId: ref.id as OutlineItemId };
  return null;
};

/** The one string that identifies a place, so nothing compares three pairs. */
export const placeKey = (place: NotePlace): string =>
  place.kind === 'chapter'
    ? `c:${place.markerId}`
    : place.kind === 'section'
      ? `s:${place.unitId}`
      : `p:${place.itemId}`;

const samePlace = (a: NotePlace, b: NotePlace): boolean => placeKey(a) === placeKey(b);

/**
 * The place a stored place means **now** (§4c).
 *
 * The one rule that makes planning safe: a note filed under a plan row is
 * filed under whatever that row **became**. Pressing *Add to track* in the
 * Outliner binds the row to a chapter marker or a unit, and from that moment
 * this answers with the chapter — so the notes a writer sorted while the book
 * was still an outline turn up under the real chapter with nothing run, and
 * nothing is rewritten on promotion.
 *
 * It is the module's own sentence (*one place, and the chapter above it is a
 * reading*) pointed at the binding rather than at the story order, and it is
 * what stops promotion losing the filing: without it the plan box drops out of
 * the shelf, the chapter box has nothing under it, and a morning's sorting is
 * invisible while still perfectly stored.
 *
 * Where the binding names a record that has gone it answers with the plan
 * again, which is the same answer the shelf gives — the box comes back.
 */
export const placeNow = (file: ProjectFile, place: NotePlace | null): NotePlace | null => {
  if (!place || place.kind !== 'plan') return place;
  for (const outline of file.outlines ?? []) {
    const row = outline.items.find((one) => (one.id as string) === (place.itemId as string));
    if (!row) continue;
    if (row.boundMarkerId && file.markers.some((m) => (m.id as string) === (row.boundMarkerId as string))) {
      return { kind: 'chapter', markerId: row.boundMarkerId };
    }
    if (row.boundUnitId && file.units.some((u) => (u.id as string) === (row.boundUnitId as string))) {
      return { kind: 'section', unitId: row.boundUnitId };
    }
    return place;
  }
  return place;
};

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
  if (place.kind === 'chapter') {
    return file.markers.some((marker) => (marker.id as string) === (place.markerId as string));
  }
  if (place.kind === 'section') {
    return file.units.some((unit) => (unit.id as string) === (place.unitId as string));
  }
  // A plan row deleted in the Outliner is the same answer: the note reads
  // unfiled rather than filed nowhere, with nothing run.
  return (file.outlines ?? []).some((outline) =>
    outline.items.some((row) => (row.id as string) === (place.itemId as string)),
  );
};

export const noteProgress = (file: ProjectFile, item: ResearchItem): NoteProgress => {
  if (noteInBeats(file, item).length > 0) return 'written';
  if (placeStillThere(file, placeNow(file, placeOf(item.place)))) return 'planned';
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
  /**
   * True where this is still a **plan** — a row of the Outliner that has not
   * been added to the track (§4c).
   *
   * Said rather than hidden, because a box for a chapter the book has and a box
   * for one that is still a plan are two different things, and a writer sorting
   * research wants to know which they are looking at. It is read off the row
   * rather than stored: pressing *Add to track* moves the box from one group to
   * the other with nothing run.
   */
  planned: boolean;
  /** The notes filed here, newest work last, in the order they were filed. */
  notes: ResearchItem[];
  /** How many of those notes are in the book already. */
  written: number;
}

/**
 * The book's chapters and sections in order, with the notes filed under each —
 * **the ones in the manuscript, and then the ones that are still plans** (§4c).
 *
 * **It is a reading and nothing about it is stored** — the sixth time this
 * project has made a fact about the work a reading rather than a column. Add a
 * chapter and a row appears; drag a section into another chapter and its notes
 * go with it; delete a chapter and its notes read as unfiled again, each with
 * nothing run.
 *
 * A section is listed under the chapter it falls in, which is
 * `structureNumbers`' own rule read back rather than a second walk.
 *
 * ## The Outliner's rows (§4c)
 *
 * From Ken: *just so the outliner chapters and sections show up under the table
 * of contents in little boxes… so you can drag and drop your research and
 * organize it under those names.*
 *
 * This read the **manuscript** and nothing else, which is why he asked three
 * times: he plans his chapters in the Outliner, nothing is promoted until he
 * presses *Add to track*, and so there was nothing here to drop a note on. A
 * plan is exactly when sorting rough material is worth doing, so the plan rows
 * are listed too.
 *
 * Two rules keep it honest.
 *
 * **A row that has become a chapter is listed once**, as the chapter it became
 * — `boundMarkerId` and `boundUnitId` have said which since addendum 19 §2, so
 * a promoted row drops out of this half by itself and no box is drawn twice.
 *
 * **The two groups are not mixed.** A plan has no place in the story order —
 * that is what makes it a plan — so there is nothing to interleave it with, and
 * a list that guessed would put a chapter a writer has not written between two
 * they have. The manuscript's rows first, in the story order; the Outliner's
 * after them, in the outline's own order.
 */
export const contentsShelf = (file: ProjectFile): ContentsRow[] => {
  const numbers = structureNumbers(file);
  const living = onlyLiving(file.researchItems);

  const filed = new Map<string, ResearchItem[]>();
  for (const item of living) {
    // Read **through the binding** (`placeNow`), so a note sorted under a plan
    // row turns up under the chapter that row became.
    const place = placeNow(file, placeOf(item.place));
    if (!place) continue;
    const key = placeKey(place);
    filed.set(key, [...(filed.get(key) ?? []), item]);
  }

  const opens = new Map(
    file.markers
      .filter((marker) => marker.kind === 'chapter')
      .map((marker) => [marker.unitId as string, marker]),
  );

  const rows: ContentsRow[] = [];
  const countWritten = (notes: ResearchItem[]) =>
    notes.filter((note) => noteProgress(file, note) === 'written').length;
  const add = (
    place: NotePlace,
    number: string,
    title: string,
    summary: string,
    depth: number,
    planned: boolean,
  ): void => {
    const notes = filed.get(placeKey(place)) ?? [];
    rows.push({ place, number, title, summary, depth, planned, notes, written: countWritten(notes) });
  };

  unitsInStoryOrder(file).forEach((unit) => {
    const marker = opens.get(unit.id as string);
    if (marker) {
      add(
        { kind: 'chapter', markerId: marker.id },
        numbers.chapters.get(marker.id as string) ?? '',
        marker.title,
        marker.page?.summary ?? '',
        0,
        false,
      );
    }
    add(
      { kind: 'section', unitId: unit.id },
      numbers.units.get(unit.id as string) ?? '',
      unit.title,
      unit.summary ?? '',
      opens.size > 0 ? 1 : 0,
      false,
    );
  });

  const markerIds = new Set(file.markers.map((marker) => marker.id as string));
  const unitIds = new Set(file.units.map((unit) => unit.id as string));

  for (const outline of file.outlines ?? []) {
    const planNumbers = outlineNumbers(file, outline);
    const chapters = outline.items.some((item) => item.kind === 'chapter');
    // In the outline's own reading order, and **folding is ignored** — a row
    // folded away in the Outliner an hour ago is not a chapter that has gone,
    // and `outlineRows` takes the whole set for exactly this (it honours a fold
    // only when asked to show everything).
    const everything = new Set(outline.items.map((item) => item.id as string));
    for (const { item } of outlineRows(outline, everything)) {
      // Chapters and sections, which is what Ken asked for and what the
      // manuscript half lists. A note or an idea in the outline is a thing the
      // writer knows rather than a place in the book — the rail's *a note gets
      // no dot* (addendum 16 §15) pointed at a box.
      if (item.kind !== 'chapter' && item.kind !== 'scene') continue;
      // **Listed once.** It is in the manuscript now, so the row above is it —
      // but only where the binding still resolves: a chapter deleted from the
      // book leaves the row behind, and a row that drew no box at all would
      // read as the plan having gone with it.
      if (item.boundMarkerId && markerIds.has(item.boundMarkerId as string)) continue;
      if (item.boundUnitId && unitIds.has(item.boundUnitId as string)) continue;
      add(
        { kind: 'plan', itemId: item.id },
        planNumbers.get(item.id as string) ?? '',
        rowTitle(file, item),
        item.body,
        // The manuscript half's own rule: a section stands under its chapter
        // where there are chapters and at the top where there are none.
        item.kind === 'chapter' ? 0 : chapters ? 1 : 0,
        true,
      );
    }
  }

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
/**
 * A row's number **as it is set** — the one place that decides its spelling.
 *
 * A chapter number takes a full stop and a multi-level one does not, which is
 * how books set them: *1. Mathematics*, then *1.1 Division*. Driving the
 * screen is what caught it twice: first as `1.1.`, reading as an unfinished
 * third level, and then as a box drawn `1` standing an inch above a heading
 * reading `1.`, which is **one row with two spellings of its own number** —
 * so this is read by the box, by the heading and by `describeContentsRow`
 * rather than each writing it out.
 */
export const contentsNumber = (row: ContentsRow): string =>
  row.number ? (row.number.includes('.') ? row.number : `${row.number}.`) : '';

export const describeContentsRow = (row: ContentsRow, file: ProjectFile): string => {
  const nouns = nounsFor(file.project.format);
  const noun = row.depth === 0 ? 'Chapter' : nouns.unit;
  const named = row.title.trim();
  const number = contentsNumber(row);
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
  // Read through the binding too, or filing a note onto the chapter a plan row
  // became would read as a move from somewhere it already is.
  const already = placeNow(file, placeOf(item.place));
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
  const chapters = rows.filter(
    (row) => row.place.kind === 'chapter' || (row.planned && row.depth === 0),
  ).length;
  if (chapters === 0) {
    // **It must say what is drawn under it.** The boxes are rows and this
    // sentence counts chapters, so on a book that has sections and no chapter
    // markers the two read as a contradiction — *No chapters yet* standing
    // over a box. That is the room's own fault from addendum 28 §3 (the note
    // count that disagreed with the boxes), and the fix is the same: name what
    // is actually there.
    const nouns = nounsFor(file.project.format);
    if (rows.length > 0) {
      const what = rows.length === 1 ? `1 ${nouns.unit.toLowerCase()}` : `${rows.length} ${nouns.unitPlural.toLowerCase()}`;
      return `${what}, and no chapters yet. Add chapters in the Outliner and these fall under them.`;
    }
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

/**
 * How many of the boxes are still plans (§4c), so the group can say what it is.
 *
 * A reading like everything else here: pressing *Add to track* in the Outliner
 * takes a box out of this count with nothing run.
 */
export const plannedContents = (file: ProjectFile): ContentsRow[] =>
  contentsShelf(file).filter((row) => row.planned);
