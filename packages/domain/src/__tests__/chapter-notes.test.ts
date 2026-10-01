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
  unfileNote,
  updateBeat,
  type ProjectFile,
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
