import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addResearchItem,
  addUnit,
  updateUnit,
  contentsShelf,
  createProjectFile,
  describeContents,
  describeContentsRow,
  fileNoteUnder,
  filingOffer,
  noteInBeats,
  noteProgress,
  notesUnder,
  placeStillThere,
  deleteResearchItem,
  addMarker,
  addItem,
  createOutline,
  findOutline,
  promoteRow,
  removeItem,
  unfileNote,
  updateBeat,
  type ProjectFile,
  type OutlineItemId,
  type ResearchItemId,
  type StoryMarkerId,
  type StructuralUnitId,
} from '../index.js';

/**
 * The table of contents, and the notes filed under it (addendum 28).
 *
 * The claim under all of it: **the table of contents is the chapters the book
 * already has, read in order**, and where a note stands is read off one
 * reference. Nothing here stores a number, a chapter for a section, or how far
 * along a note is — so the assertions that matter are the ones where something
 * is moved or cut and the answer follows with nothing run.
 */

/** A textbook: two chapters, two sections each. */
const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Arithmetic', format: 'instructional' });
  const trackId = file.tracks[0]!.id;
  // A new project is seeded with one section, so the first is renamed rather
  // than added — otherwise the book opens with an unnumbered section standing
  // in front of chapter one, which is a real state and a different test.
  const seeded = file.units[0]!;
  file = updateUnit(file, seeded.id, { title: 'Division' });
  const units: StructuralUnitId[] = [seeded.id];
  for (const title of ['Multiplication', 'Fractions', 'Decimals']) {
    const made = addUnit(file, { trackId, title });
    file = made.file;
    units.push(made.unit.id);
  }
  // Chapter one opens on Division, chapter two on Fractions.
  const one = addMarker(file, { unitId: units[0]!, kind: 'chapter', title: 'Mathematics' });
  file = one.file;
  const two = addMarker(file, { unitId: units[2]!, kind: 'chapter', title: 'Numbers' });
  file = two.file;
  return { file, units, chapters: [one.marker.id, two.marker.id] as StoryMarkerId[] };
};

const note = (file: ProjectFile, title: string) => {
  const next = addResearchItem(file, { categoryId: file.researchCategories[0]!.id, title });
  const made = next.researchItems[next.researchItems.length - 1]!;
  return { file: next, id: made.id as ResearchItemId };
};

describe('the table of contents', () => {
  it('is the chapters and sections the book already has, numbered', () => {
    const made = book();
    const rows = contentsShelf(made.file);

    // Chapter, its two sections, chapter, its two sections.
    expect(rows.map((row) => row.number)).toEqual(['1', '1.1', '1.2', '2', '2.1', '2.2']);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 0, 1, 1]);
    expect(rows[0]!.title).toBe('Mathematics');
    expect(rows[1]!.title).toBe('Division');
  });

  /**
   * Ken's own example, and the half worth pinning: the number is worked out
   * from where the chapter falls, so a chapter nobody has titled still reads
   * as a chapter — which is what lets somebody lay out ten of them in a
   * minute and name them afterwards.
   */
  it('numbers a chapter nobody has titled', () => {
    const made = book();
    const bare = addMarker(made.file, { unitId: made.units[0]!, kind: 'chapter', title: '' });
    const rows = contentsShelf(bare.file);

    expect(rows[0]!.number).toBe('1');
    expect(describeContentsRow(rows[0]!, bare.file)).toBe('1. Untitled chapter');
    expect(describeContentsRow(rows[1]!, bare.file)).toBe('1.1 Division');
  });
});

describe('filing a note', () => {
  it('says what a drop would do before it can be asked for', () => {
    const made = book();
    const put = note(made.file, 'Long division worked example');
    const offer = filingOffer(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });

    expect(offer.may).toBe(true);
    expect(offer.says).toContain('1. Mathematics');
    // The one thing a writer needs told: filing changes where it is in the
    // book and nothing about the note.
    expect(offer.says).toContain('The note itself does not change');
  });

  it('files it, and the chapter lists it', () => {
    const made = book();
    const put = note(made.file, 'Long division worked example');
    const filed = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });

    const under = notesUnder(filed, { kind: 'chapter', markerId: made.chapters[0]! });
    expect(under.map((one) => one.title)).toEqual(['Long division worked example']);
    // And its folder is untouched.
    expect(filed.researchItems[0]!.categoryId).toBe(put.file.researchItems[0]!.categoryId);
  });

  it('refuses to file it twice, and says so', () => {
    const made = book();
    const put = note(made.file, 'A note');
    const place = { kind: 'chapter' as const, markerId: made.chapters[0]! };
    const filed = fileNoteUnder(put.file, put.id, place);

    const again = filingOffer(filed, put.id, place);
    expect(again.may).toBe(false);
    expect(again.says).toContain('already under');
    expect(fileNoteUnder(filed, put.id, place)).toBe(filed);
  });

  /** A note has one place, so filing it elsewhere is a move and says so. */
  it('moves it rather than filing it twice', () => {
    const made = book();
    const put = note(made.file, 'A note');
    let file = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });

    const offer = filingOffer(file, put.id, { kind: 'section', unitId: made.units[2]! });
    expect(offer.says).toContain('Move');
    file = fileNoteUnder(file, put.id, { kind: 'section', unitId: made.units[2]! });

    expect(notesUnder(file, { kind: 'chapter', markerId: made.chapters[0]! })).toEqual([]);
    expect(notesUnder(file, { kind: 'section', unitId: made.units[2]! })).toHaveLength(1);
  });

  it('takes it back off without touching the note', () => {
    const made = book();
    const put = note(made.file, 'A note');
    const filed = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });
    const off = unfileNote(filed, put.id);

    expect(off.researchItems[0]!.place).toBeNull();
    expect(off.researchItems[0]!.title).toBe('A note');
  });
});

describe('a place that has gone', () => {
  /**
   * The reason a place is a reference and never a folder: deleting the
   * chapter takes the note back to unplaced by itself, rather than leaving an
   * orphan folder holding notes about nothing.
   */
  it('reads as unplaced when its chapter is deleted, with nothing run', () => {
    const made = book();
    const put = note(made.file, 'A note');
    const filed = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });
    expect(noteProgress(filed, filed.researchItems[0]!)).toBe('planned');

    const gone: ProjectFile = {
      ...filed,
      markers: filed.markers.filter((marker) => marker.id !== made.chapters[0]!),
    };
    expect(placeStillThere(gone, { kind: 'chapter', markerId: made.chapters[0]! })).toBe(false);
    expect(noteProgress(gone, gone.researchItems[0]!)).toBe('unfiled');
  });
});

describe('the three lights', () => {
  it('reads unplaced, then placed, then in the book', () => {
    const made = book();
    const put = note(made.file, 'A note');
    let file = put.file;
    expect(noteProgress(file, file.researchItems[0]!)).toBe('unfiled');

    file = fileNoteUnder(file, put.id, { kind: 'section', unitId: made.units[0]! });
    expect(noteProgress(file, file.researchItems[0]!)).toBe('planned');

    // Written: a beat exists that came from it. The older spelling of that
    // fact is `usedInBeatIds`, which `markResearchUsed` has written by hand
    // since 0001 and which nothing ever re-read.
    const beat = addBeat(file, { unitId: made.units[0]!, title: 'Long division' });
    file = beat.file;
    file = {
      ...file,
      researchItems: file.researchItems.map((one) => ({ ...one, usedInBeatIds: [beat.beat.id] })),
    };
    expect(noteProgress(file, file.researchItems[0]!)).toBe('written');
  });

  /**
   * The fault this module found, asserted rather than described: a note
   * marked used by hand went on reading *used* after the beat it fed was cut.
   * The light is a reading now, so cutting the beat takes it back by itself.
   */
  it('goes back to placed when the beat it fed is cut', () => {
    const made = book();
    const put = note(made.file, 'A note');
    let file = fileNoteUnder(put.file, put.id, { kind: 'section', unitId: made.units[0]! });
    const beat = addBeat(file, { unitId: made.units[0]!, title: 'Long division' });
    file = beat.file;
    file = {
      ...file,
      researchItems: file.researchItems.map((one) => ({
        ...one,
        usage: 'used' as const,
        usedInBeatIds: [beat.beat.id],
      })),
    };
    expect(noteProgress(file, file.researchItems[0]!)).toBe('written');

    const cut: ProjectFile = { ...file, beats: file.beats.filter((one) => one.id !== beat.beat.id) };
    // The stored flag still says `used` — and the light no longer does.
    expect(cut.researchItems[0]!.usage).toBe('used');
    expect(noteInBeats(cut, cut.researchItems[0]!)).toEqual([]);
    expect(noteProgress(cut, cut.researchItems[0]!)).toBe('planned');
  });
});

describe('what the shelf says', () => {
  it('names what is still to place rather than what is done', () => {
    const made = book();
    const put = note(made.file, 'A note');
    expect(describeContents(put.file)).toContain('2 chapters');
    expect(describeContents(put.file)).toContain('1 note is not placed yet');

    const filed = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });
    expect(describeContents(filed)).toContain('every note is placed');
  });

  it('says where chapters come from when there are none', () => {
    const bare = createProjectFile({ title: 'Nothing yet', format: 'instructional' });
    expect(describeContents(bare)).toContain('Outliner');
  });

  /** A deleted note leaves the shelf, the graveyard's rule (addendum 24 §5j). */
  it('drops a deleted note off the chapter it was under', () => {
    const made = book();
    const put = note(made.file, 'A note');
    const filed = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });
    expect(notesUnder(filed, { kind: 'chapter', markerId: made.chapters[0]! })).toHaveLength(1);

    const buried = deleteResearchItem(filed, put.id);
    expect(notesUnder(buried, { kind: 'chapter', markerId: made.chapters[0]! })).toEqual([]);
  });
});

describe('the sentence says what the boxes show (addendum 28 §4b)', () => {
  /**
   * The boxes are **rows** and this sentence counted **chapters**, so a book
   * with sections and no chapter markers drew *No chapters yet* standing over
   * a box — two readings of one screen disagreeing, which is addendum 28 §3's
   * own fault (the note count against the boxes) a second time.
   */
  it('names the sections where there are sections and no chapters', () => {
    const file = createProjectFile({ title: 'Textbook', format: 'instructional' });
    const rows = contentsShelf(file);
    const said = describeContents(file);

    // Whatever the seed holds, the sentence may not deny what is drawn.
    if (rows.length > 0) {
      expect(said).not.toBe(
        'No chapters yet. Add them in the Outliner and they turn up here, and on the timeline.',
      );
      expect(said).toMatch(/section/i);
    }
    expect(said).toContain('Outliner');
  });
});

/**
 * The Outliner's chapters and sections, as boxes (addendum 28 §4c).
 *
 * From Ken, the third time: *just so the outliner chapters and sections show up
 * under the table of contents in little boxes… so you can drag and drop your
 * research and organize it under those names.*
 *
 * The fault was that `contentsShelf` read the **manuscript** and nothing else,
 * so a writer who plans his chapters in the Outliner and has promoted none of
 * them had nothing here to drop a note on. These are the assertions that would
 * have failed before it: a plan appears, it takes a note, it is listed once
 * after promotion, and the note it was given turns up under the chapter it
 * became with nothing run.
 */
describe("the Outliner's chapters and sections, as boxes", () => {
  /** A book planned and not promoted: two chapters, two sections each. */
  const planned = () => {
    let file = createProjectFile({ title: 'Planned', format: 'instructional' });
    const made = createOutline(file, { name: 'Outline' });
    file = made.file;
    const outlineId = made.outline.id;
    const rowIds: Record<string, OutlineItemId> = {};
    for (const [key, title] of [
      ['one', 'Mathematics'],
      ['two', 'Numbers'],
    ] as const) {
      const row = addItem(file, outlineId, { kind: 'chapter', title });
      file = row.file;
      rowIds[key] = row.itemId!;
    }
    for (const [key, parent, title] of [
      ['division', 'one', 'Division'],
      ['times', 'one', 'Multiplication'],
      ['fractions', 'two', 'Fractions'],
    ] as const) {
      const row = addItem(file, outlineId, { kind: 'scene', parentId: rowIds[parent]!, title });
      file = row.file;
      rowIds[key] = row.itemId!;
    }
    return { file, outlineId, rows: rowIds };
  };

  it('lists a chapter nobody has promoted, numbered, as a plan', () => {
    const made = planned();
    const rows = contentsShelf(made.file).filter((row) => row.planned);

    expect(rows.map((row) => `${row.number} ${row.title}`)).toEqual([
      '1 Mathematics',
      '1.1 Division',
      '1.2 Multiplication',
      '2 Numbers',
      '2.1 Fractions',
    ]);
    // A chapter stands at depth 0 and its sections under it, the manuscript
    // half's own rule rather than a second one.
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 0, 1]);
  });

  /** A note or an idea in the outline is not a place in the book. */
  it('lists chapters and sections and nothing else', () => {
    const made = planned();
    const withNote = addItem(made.file, made.outlineId, {
      kind: 'note',
      parentId: made.rows['division']!,
      title: 'Look up long division',
    });
    const titles = contentsShelf(withNote.file).map((row) => row.title);
    expect(titles).not.toContain('Look up long division');
  });

  /** The ask itself: somewhere to drop rough material before it is a chapter. */
  it('takes a note, and changes nothing in the Outliner', () => {
    const made = planned();
    const put = note(made.file, 'Two ways to divide');
    const place = { kind: 'plan', itemId: made.rows['division']! } as const;

    const offer = filingOffer(put.file, put.id, place);
    expect(offer.may).toBe(true);
    expect(offer.says).toContain('Division');

    const filed = fileNoteUnder(put.file, put.id, place);
    expect(notesUnder(filed, place).map((one) => one.title)).toEqual(['Two ways to divide']);
    // It is placed, not written: nothing has reached the manuscript.
    expect(noteProgress(filed, filed.researchItems.find((one) => one.id === put.id)!)).toBe('planned');
    // **Nothing in the Outliner moved.** The same rows, the same titles, no
    // new row referencing the note — which is Ken's *not necessarily a
    // connection between the outliner and the research*.
    const before = findOutline(made.file, made.outlineId)!;
    const after = findOutline(filed, made.outlineId)!;
    expect(after.items).toEqual(before.items);
  });

  /**
   * **Listed once, and the notes follow the promotion.** This is the half that
   * would have lost a morning's sorting: the plan row drops off the shelf when
   * it is bound, so without `placeNow` the notes under it would be perfectly
   * stored and drawn nowhere.
   */
  it('becomes the chapter it was promoted to, carrying its notes', () => {
    const made = planned();
    const put = note(made.file, 'Two ways to divide');
    let file = fileNoteUnder(put.file, put.id, { kind: 'plan', itemId: made.rows['division']! });

    file = promoteRow(file, made.outlineId, made.rows['one']!).file;

    const rows = contentsShelf(file);
    // The chapter is in the book now, so it is drawn once and not as a plan.
    const chapters = rows.filter((row) => row.depth === 0 && row.title === 'Mathematics');
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.planned).toBe(false);

    // And the note is under the section it was sorted into, which is now a
    // section of the manuscript.
    const carrying = rows.filter((row) => row.notes.length > 0);
    expect(carrying).toHaveLength(1);
    expect(carrying[0]!.place.kind).toBe('section');
    expect(carrying[0]!.notes.map((one) => one.title)).toEqual(['Two ways to divide']);
  });

  /** A plan row deleted leaves its note unfiled, `placeStillThere`'s own rule. */
  it('reads a note as unfiled where the plan row has gone', () => {
    const made = planned();
    const put = note(made.file, 'Stray');
    const place = { kind: 'plan', itemId: made.rows['division']! } as const;
    let file = fileNoteUnder(put.file, put.id, place);
    expect(placeStillThere(file, place)).toBe(true);

    file = removeItem(file, made.outlineId, made.rows['division']!);
    expect(placeStillThere(file, place)).toBe(false);
    expect(noteProgress(file, file.researchItems.find((one) => one.id === put.id)!)).toBe('unfiled');
  });

  /** The sentence may not deny the boxes — §4b's rule, now counting plans. */
  it('counts a planned chapter as a chapter in the sentence', () => {
    const made = planned();
    expect(describeContents(made.file)).toMatch(/^2 chapters/);
  });
});

/**
 * The section the project is born with (addendum 28 §4d).
 *
 * From Ken, sending §4c's ask back word for word: *it has a section for the
 * outliner that creates chapter one. We don't need that anymore.* §4c read that
 * as the route it had just added. It is the **box**: `createProjectFile` seeds
 * one unit called *Chapter One*, and on a fresh book it was the only thing this
 * screen drew, under a sentence saying there were no chapters.
 *
 * What these pin is the pair: the phantom goes, and **the same rule catches
 * nothing a writer made** — which is the half worth testing, a hide being far
 * easier to get too wide than too narrow.
 */
describe('the seeded starting section', () => {
  const fresh = () => createProjectFile({ title: 'Fresh', format: 'instructional' });

  it('is not a box, and the sentence no longer has one to deny', () => {
    const file = fresh();
    expect(file.units).toHaveLength(1);
    expect(file.units[0]!.title).toBe('Chapter One');

    expect(contentsShelf(file)).toEqual([]);
    expect(describeContents(file)).toMatch(/No chapters yet/);
  });

  it('comes back the moment a word is written in it', () => {
    let file = fresh();
    const beat = file.beats[0]!;
    file = {
      ...file,
      beats: file.beats.map((one) =>
        one.id === beat.id
          ? {
              ...one,
              manuscript: {
                ...one.manuscript,
                elements: [{ ...(one.manuscript.elements[0] ?? {}), id: 'e1', type: 'action', text: 'A word.' }],
              },
            }
          : one,
      ),
    } as ProjectFile;

    expect(contentsShelf(file)).toHaveLength(1);
  });

  it('comes back the moment a chapter is put on it', () => {
    const file = fresh();
    const made = addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'Mathematics' });
    // The chapter and the section it opens on: two rows, neither hidden.
    expect(contentsShelf(made.file).map((row) => row.title)).toEqual(['Mathematics', 'Chapter One']);
  });

  it('comes back the moment an outline row is promoted into it', () => {
    let file = fresh();
    const outline = createOutline(file, { name: 'Outline' });
    file = outline.file;
    const row = addItem(file, outline.outline.id, { kind: 'scene', title: 'Division' });
    file = row.file;
    // Promotion binds the row to a unit; with one unit that unit is the seed.
    file = promoteRow(file, outline.outline.id, row.itemId!).file;

    const bound = (file.outlines ?? [])[0]!.items.some((one) => one.boundUnitId !== null);
    expect(bound).toBe(true);
    expect(contentsShelf(file).some((r) => r.place.kind === 'section' && !r.planned)).toBe(true);
  });

  /**
   * **The rule may not reach a second section.** A book with two units has had
   * somebody's hand in it, so neither is the seed however empty they are — this
   * is the assertion that stops the hide widening into work a writer did.
   */
  it('never hides a section where the book has more than one', () => {
    const file = fresh();
    const second = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Multiplication' });
    expect(contentsShelf(second.file).map((row) => row.title)).toEqual(['Chapter One', 'Multiplication']);
  });

  /** And the planned chapters still stand on their own, which is the ask. */
  it('leaves the Outliner plans as the only boxes on a fresh book', () => {
    let file = fresh();
    const outline = createOutline(file, { name: 'Outline' });
    file = outline.file;
    const chapter = addItem(file, outline.outline.id, { kind: 'chapter', title: 'Mathematics' });
    file = chapter.file;
    file = addItem(file, outline.outline.id, {
      kind: 'scene',
      parentId: chapter.itemId!,
      title: 'Division',
    }).file;

    expect(contentsShelf(file).map((row) => `${row.title} ${row.planned ? '(plan)' : ''}`.trim())).toEqual([
      'Mathematics (plan)',
      'Division (plan)',
    ]);
  });
});
