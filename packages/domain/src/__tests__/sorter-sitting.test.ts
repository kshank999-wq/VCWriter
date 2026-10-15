import { describe, expect, it } from 'vitest';
import {
  addSortCategory,
  addSource,
  beginSession,
  cardsIn,
  contentsShelf,
  createProjectFile,
  everyNote,
  extractToCategory,
  extractToOutline,
  outlineDropOffer,
  referenceCard,
  sittingName,
  sittingsStanding,
  startDivision,
  unsortedOf,
  type ProjectFile,
  type NoteSessionId,
} from '../index.js';
import { withoutSeeds } from './sorter-fixture.js';

/**
 * **The sitting you can tell from another, every note at once, and the
 * outline as somewhere to sort into** (addendum 26 §17, from Ken in one
 * message: *there's something that says plus sitting. I'm not sure what that
 * is. And when you go to sort, if you hit sitting, it takes everything away…
 * you need to have a way to get back to see all the notes* … *when you add
 * chapters and sections to your outline, you need to have the ability when
 * you're sorting to drop it in those research sections*).
 */

const book = (): ProjectFile => createProjectFile({ title: 'Mathematics', format: 'instructional' });

const withSitting = (): { file: ProjectFile; id: NoteSessionId } => {
  const begun = beginSession(book(), 'Notes · 1 January');
  return { file: withoutSeeds(begun.file, begun.session.id), id: begun.session.id };
};

describe('a sitting you can tell from another', () => {
  it('names it for the day it was started', () => {
    expect(sittingName(book(), '2026-10-15T09:00:00.000Z')).toBe('Notes · 15 October');
  });

  it('numbers the second one started on the same day', () => {
    // The whole of the report: two sittings arrived under one name, so the
    // picker offered two identical rows over a screen reading *Nothing in yet*.
    const at = '2026-10-15T09:00:00.000Z';
    const first = beginSession(book(), sittingName(book(), at));
    expect(first.session.name).toBe('Notes · 15 October');
    expect(sittingName(first.file, at)).toBe('Notes · 15 October 2');
  });

  it('says what is in each one, which is what identifies it', () => {
    const begun = beginSession(book(), sittingName(book()));
    const withText = addSource(begun.file, {
      sessionId: begun.session.id,
      name: 'Typed notes',
      kind: 'typed',
      text: 'Refraction bends light.',
    });
    const second = beginSession(withText.file, sittingName(withText.file));
    const standing = sittingsStanding(second.file);
    expect(standing).toHaveLength(2);
    expect(standing[0]!.says).toContain('1 source');
    expect(standing[1]!.says).toContain('nothing in it yet');
    // Two sittings, two different sentences — which is the fix.
    expect(standing[0]!.says).not.toBe(standing[1]!.says);
  });
});

describe('every note at once', () => {
  it('lists every note of the sitting with the folder it is in', () => {
    const { file, id } = withSitting();
    const concept = addSortCategory(file, { sessionId: id, name: 'Concept' });
    const example = addSortCategory(concept.file, { sessionId: id, name: 'Example' });
    const withText = addSource(example.file, {
      sessionId: id,
      name: 'Typed notes',
      kind: 'typed',
      text: 'Refraction bends light at a boundary. Lenses are shaped glass.',
    });

    // Nothing filed yet, so there is nothing to list — and the list exists.
    expect(everyNote(withText.file, id)).toEqual([]);

    const first = extractToCategory(withText.file, {
      sourceId: withText.source.id,
      from: 0,
      to: 36,
      categoryId: concept.category.id,
    });
    const second = extractToCategory(first.file, {
      sourceId: withText.source.id,
      from: 37,
      to: 62,
      categoryId: example.category.id,
    });

    const all = everyNote(second.file, id);
    // **The one list this room never had**: both notes, from two folders, in
    // one place, each saying which folder it is in.
    expect(all).toHaveLength(2);
    expect(all.map((one) => one.where).sort()).toEqual(['Concept', 'Example']);

    // A reference is a second place to find one card (§10), never a second
    // card, so a note referenced into another folder is still listed once.
    const shared = referenceCard(second.file, first.card!.id, example.category.id);
    expect(cardsIn(shared, example.category.id)).toHaveLength(2);
    expect(everyNote(shared, id)).toHaveLength(2);
  });
});

describe('sorting straight into the outline', () => {
  /** A book with a chapter planned on its one section, so the shelf has rows. */
  const planned = (): { file: ProjectFile; id: NoteSessionId } => {
    const base = book();
    const unit = base.units[0]!;
    const withChapter = startDivision(base, unit.id, 'Light');
    const begun = beginSession(withChapter, sittingName(withChapter));
    return { file: withoutSeeds(begun.file, begun.session.id), id: begun.session.id };
  };

  it('reads the book rather than keeping a copy of it', () => {
    const { file } = planned();
    const rows = contentsShelf(file);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.title).toBe('Light');
    // Renaming the chapter renames the row, because there is no second record.
    const renamed = {
      ...file,
      markers: file.markers.map((one) => ({ ...one, title: 'Optics' })),
    };
    expect(contentsShelf(renamed)[0]!.title).toBe('Optics');
  });

  it('files a passage under a chapter and places it in one act', () => {
    const { file, id } = planned();
    const withText = addSource(file, {
      sessionId: id,
      name: 'Typed notes',
      kind: 'typed',
      text: 'Refraction bends light at a boundary.',
    });
    const row = contentsShelf(withText.file)[0]!;

    const offer = outlineDropOffer(withText.file, {
      sessionId: id,
      sourceId: withText.source.id,
      from: 0,
      to: 36,
      where: 'Light',
    });
    expect(offer.can).toBe(true);
    expect(offer.says).toContain('Light');
    // Said before the press, because where the note waits is the one thing a
    // writer would not guess.
    expect(offer.says).toContain('Unsorted');

    const done = extractToOutline(withText.file, {
      sessionId: id,
      sourceId: withText.source.id,
      from: 0,
      to: 36,
      place: row.place,
    });
    expect(done.card).not.toBeNull();

    // It is a note, it is in the pile, and it is under the chapter.
    const pile = unsortedOf(done.file, id)!;
    expect(cardsIn(done.file, pile.id).map((one) => one.id)).toContain(done.card!.id);
    expect(contentsShelf(done.file)[0]!.notes.map((one) => one.id)).toContain(done.card!.id);

    // And `everyNote` shows it, which is the list the room never had.
    const all = everyNote(done.file, id);
    expect(all).toHaveLength(1);
    expect(all[0]!.where).toBe('Unsorted');
  });

  it('keeps nothing at all where the place refuses', () => {
    const { file, id } = planned();
    const withText = addSource(file, {
      sessionId: id,
      name: 'Typed notes',
      kind: 'typed',
      text: 'Refraction bends light at a boundary.',
    });
    const row = contentsShelf(withText.file)[0]!;
    // A place the book does not have: the act must leave no card behind, which
    // is `captureFromScript`'s rule — a note made for a drop that did not land
    // is litter in a pile nobody asked to fill.
    const gone = {
      ...withText.file,
      markers: [],
      units: [],
    };
    const done = extractToOutline(gone, {
      sessionId: id,
      sourceId: withText.source.id,
      from: 0,
      to: 36,
      place: row.place,
    });
    expect(done.card).toBeNull();
    expect(everyNote(done.file, id)).toEqual([]);
  });
});
