import { describe, expect, it } from 'vitest';
import {
  addReference,
  archiveReference,
  bringInReferences,
  createProjectFile,
  duplicateReference,
  fromRows,
  isLinkedLibrary,
  relinkLibrary,
  factDifferences,
  linkExisting,
  sameSourceIn,
  linkState,
  linkedLibraries,
  settleLink,
  syncLinkedLibrary,
  toRows,
  unlinkReference,
  updateReference,
  type ProjectFile,
  type ReferenceId,
} from '../index.js';

/**
 * One library, live between projects (addendum 43 §29): a source brought in
 * stays linked to the project it came from, and the two are brought back
 * into step whenever the library is opened.
 */

const THE_SEA = '/projects/the-sea.vcw';

const pair = (): { book: ProjectFile; letters: ProjectFile; bookId: ReferenceId; copyId: ReferenceId } => {
  let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
  const made = addReference(book, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', shortCode: 'J19' });
  book = made.file;
  let letters = createProjectFile({ title: 'Letters', format: 'document' });
  const brought = bringInReferences(letters, book.references, null, { path: THE_SEA, title: 'The Sea' });
  letters = brought.file;
  return { book, letters, bookId: made.reference.id, copyId: brought.added[0]!.id };
};

const factsOf = (file: ProjectFile, id: string) => file.references.find((one) => one.id === id)!;

describe('a linked source', () => {
  it('is brought in remembering where it came from, and the two start in step', () => {
    const { book, letters, bookId, copyId } = pair();
    const copy = factsOf(letters, copyId);
    expect(copy.link).toMatchObject({ path: THE_SEA, title: 'The Sea', referenceId: bookId });
    expect(linkState(copy, factsOf(book, bookId))).toBe('same');
    expect(linkedLibraries(letters)).toEqual([{ path: THE_SEA, title: 'The Sea', projectId: book.project.id, count: 1 }]);
    // Brought in without a link, it is this project's own.
    expect(bringInReferences(createProjectFile({ title: 'x', format: 'document' }), book.references).added[0]!.link).toBeNull();
  });

  it('takes a change made in the library', () => {
    const { book, letters, bookId, copyId } = pair();
    const changed = updateReference(book, bookId, { publisher: 'Sea Press', place: 'Boston' });
    const synced = syncLinkedLibrary(letters, new Map([[THE_SEA, changed]]));
    expect(synced.pulled).toBe(1);
    expect(factsOf(synced.file, copyId)).toMatchObject({ publisher: 'Sea Press', place: 'Boston' });
    expect(synced.origins.size).toBe(0);
    // And is in step afterwards: nothing more moves.
    expect(syncLinkedLibrary(synced.file, new Map([[THE_SEA, changed]])).pulled).toBe(0);
  });

  it('sends a change made here to the library, keeping the library’s own short code', () => {
    const { book, letters, copyId, bookId } = pair();
    const edited = updateReference(letters, copyId, { title: 'On Tides and Harbours', shortCode: 'mine' });
    const synced = syncLinkedLibrary(edited, new Map([[THE_SEA, book]]));
    expect(synced.pushed).toBe(1);
    const library = synced.origins.get(THE_SEA)!;
    expect(factsOf(library, bookId)).toMatchObject({ title: 'On Tides and Harbours', shortCode: 'J19' });
    expect(linkState(factsOf(synced.file, copyId), factsOf(library, bookId))).toBe('same');
  });

  it('moves nothing where both changed, and lets the writer choose', () => {
    const { book, letters, copyId, bookId } = pair();
    const there = updateReference(book, bookId, { date: '2020' });
    const here = updateReference(letters, copyId, { date: '2021' });
    const synced = syncLinkedLibrary(here, new Map([[THE_SEA, there]]));
    expect(synced.pulled + synced.pushed).toBe(0);
    expect(synced.conflicts).toHaveLength(1);
    const conflict = synced.conflicts[0]!;
    const taken = settleLink(synced.file, conflict, there, 'theirs');
    expect(factsOf(taken.file, copyId).date).toBe('2020');
    expect(taken.library).toBeNull();
    const kept = settleLink(synced.file, conflict, there, 'ours');
    expect(factsOf(kept.library!, bookId).date).toBe('2021');
    expect(linkState(factsOf(kept.file, copyId), factsOf(kept.library!, bookId))).toBe('same');
  });

  it('becomes this project’s own where its source has gone from the library, and waits where the library cannot be read', () => {
    const { book, letters, copyId, bookId } = pair();
    const archived = archiveReference(book, bookId, true);
    const synced = syncLinkedLibrary(letters, new Map([[THE_SEA, archived]]));
    expect(synced.gone).toBe(1);
    expect(factsOf(synced.file, copyId).link).toBeNull();
    expect(syncLinkedLibrary(letters, new Map([[THE_SEA, null]])).file).toBe(letters);
  });

  it('is unlinked on request, is not linked when duplicated, and keeps its link through the cloud', () => {
    const { letters, copyId } = pair();
    expect(factsOf(unlinkReference(letters, copyId), copyId).link).toBeNull();
    expect(duplicateReference(letters, copyId).reference!.link).toBeNull();
    const back = fromRows(toRows(letters));
    expect(factsOf(back, copyId).link).toEqual(factsOf(letters, copyId).link);
  });
});

describe('a source already here, linked (§30)', () => {
  const both = (date: string) => {
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    const there = addReference(book, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', shortCode: 'J19' });
    book = there.file;
    let letters = createProjectFile({ title: 'Letters', format: 'document' });
    const here = addReference(letters, { title: 'On Tides', authors: ['Jones, Robert'], date, shortCode: 'mine' });
    letters = here.file;
    return { book, letters, there: there.reference, here: here.reference };
  };

  it('finds the same source here, and says what differs', () => {
    const { letters, there, here } = both('2021');
    expect(sameSourceIn(letters, there)?.id).toBe(here.id);
    expect(factDifferences(here, there)).toEqual([{ field: 'date', here: '2021', there: '2019' }]);
  });

  it('links two that agree as they stand', () => {
    const { book, letters, there, here } = both('2019');
    const linked = linkExisting(letters, here.id, there, { path: THE_SEA, title: 'The Sea' }, 'ours');
    expect(factsOf(linked, here.id).shortCode).toBe('mine');
    expect(linkState(factsOf(linked, here.id), there)).toBe('same');
    expect(syncLinkedLibrary(linked, new Map([[THE_SEA, book]])).pushed).toBe(0);
  });

  it('takes the library’s facts where told, and sends this one’s at the next opening where told', () => {
    const { book, letters, there, here } = both('2021');
    const taken = linkExisting(letters, here.id, there, { path: THE_SEA, title: 'The Sea' }, 'theirs');
    expect(factsOf(taken, here.id).date).toBe('2019');
    expect(linkState(factsOf(taken, here.id), there)).toBe('same');

    const kept = linkExisting(letters, here.id, there, { path: THE_SEA, title: 'The Sea' }, 'ours');
    expect(factsOf(kept, here.id).date).toBe('2021');
    const synced = syncLinkedLibrary(kept, new Map([[THE_SEA, book]]));
    expect(synced.pushed).toBe(1);
    expect(factsOf(synced.origins.get(THE_SEA)!, there.id)).toMatchObject({ date: '2021', shortCode: 'J19' });
  });

  it('leaves a source that is already linked as it is', () => {
    const { letters, copyId, book, bookId } = pair();
    expect(linkExisting(letters, copyId, factsOf(book, bookId), { path: '/elsewhere.vcw', title: 'Elsewhere' }, 'theirs')).toEqual(letters);
  });
});

describe('a library that has moved (§31)', () => {
  it('knows the library by its project, wherever its file is', () => {
    const { book, letters, copyId } = pair();
    const link = factsOf(letters, copyId).link!;
    expect(link.projectId).toBe(book.project.id);
    const [library] = linkedLibraries(letters);
    expect(isLinkedLibrary(library!, book)).toBe(true);
    expect(isLinkedLibrary(library!, createProjectFile({ title: 'The Sea', format: 'instructional' }))).toBe(false);
    // A link from before ids were kept goes by its path alone.
    expect(isLinkedLibrary({ projectId: '' }, createProjectFile({ title: 'x', format: 'novel' }))).toBe(true);
  });

  it('follows the library to its new place, and carries on in step from there', () => {
    const { book, letters, copyId, bookId } = pair();
    const moved = relinkLibrary(letters, THE_SEA, '/elsewhere/sea.vcw', { id: book.project.id, title: 'The Sea' });
    expect(factsOf(moved, copyId).link).toMatchObject({ path: '/elsewhere/sea.vcw', projectId: book.project.id });
    const changed = updateReference(book, bookId, { publisher: 'Sea Press' });
    expect(syncLinkedLibrary(moved, new Map([['/elsewhere/sea.vcw', changed]])).pulled).toBe(1);
    // A link that had no id learns it.
    const old = { ...letters, references: letters.references.map((one) => (one.link ? { ...one, link: { ...one.link, projectId: '' } } : one)) };
    expect(factsOf(relinkLibrary(old, THE_SEA, THE_SEA, { id: book.project.id, title: 'The Sea' }), copyId).link!.projectId).toBe(book.project.id);
    // Nothing to follow leaves the project as it was.
    expect(relinkLibrary(letters, '/nowhere.vcw', '/elsewhere.vcw', { id: 'x', title: 'x' })).toBe(letters);
  });
});
