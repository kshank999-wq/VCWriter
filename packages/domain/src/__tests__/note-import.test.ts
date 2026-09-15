import { describe, expect, it } from 'vitest';
import {
  batchesInOrder,
  createProjectFile,
  describeBatch,
  graphicsInOrder,
  graphicsMadeBy,
  importFiles,
  itemsMadeBy,
  splitMarkdown,
  warningsIn,
  type ImportedFile,
  type ProjectFile,
  type ResearchCategoryId,
} from '../index.js';

/**
 * The research importer (addendum 16 §4).
 *
 * The rule the module exists for is §4's: **never silently discard unsupported
 * content; flag it and preserve the source file reference for review.** Most of
 * what follows is that rule from different angles, because an importer that
 * quietly drops nine files in two hundred is worse than no importer — the
 * author finds out a year later, looking for a note that was never there.
 */

const book = () => {
  const file: ProjectFile = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
  const shelf = (key: string) => file.researchCategories.find((one) => one.systemKey === key)!.id;
  return {
    file,
    plan: {
      notesCategoryId: shelf('notes') as ResearchCategoryId,
      inboxCategoryId: shelf('inbox') as ResearchCategoryId,
    },
  };
};

const text = (name: string, body: string): ImportedFile => ({ name, text: body });

describe('nothing is dropped silently', () => {
  it('names a file it cannot read, rather than skipping it', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      [text('notes.txt', 'A sample stands in for a population.'), { name: 'slides.key' }],
      plan,
    );

    expect(itemsMadeBy(done.batch)).toBe(1);
    const missed = warningsIn(done.batch);
    expect(missed).toHaveLength(1);
    // The filename survives, which is the whole point of the entry.
    expect(missed[0]!.name).toBe('slides.key');
    expect(missed[0]!.outcome).toBe('skipped');
    expect(missed[0]!.detail).toMatch(/key/);
  });

  it('says so when a file read fine and had nothing in it', () => {
    const { file, plan } = book();
    const done = importFiles(file, [text('empty.txt', '   \n  \n')], plan);
    // Not a failure, and still worth saying: somebody expected notes from it.
    expect(warningsIn(done.batch)[0]!.outcome).toBe('empty');
    expect(done.file.researchItems).toHaveLength(0);
  });

  it('separates “we do not read this” from “we tried and could not”', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      // Named as a picture, but the host could not decode it.
      [{ name: 'diagram.png' }, { name: 'deck.pptx' }],
      plan,
    );
    const [picture, deck] = warningsIn(done.batch);
    // Different answers for the reader: look at that file, versus convert it.
    expect(picture!.outcome).toBe('failed');
    expect(deck!.outcome).toBe('skipped');
  });

  it('gives every file an entry, in the order they were offered', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      [text('a.txt', 'one'), { name: 'b.zip' }, text('c.txt', 'three')],
      plan,
    );
    expect(done.batch.entries.map((one) => one.name)).toEqual(['a.txt', 'b.zip', 'c.txt']);
  });

  it('leads with what came in and says what did not in the same breath', () => {
    const { file, plan } = book();
    const done = importFiles(file, [text('a.txt', 'one'), { name: 'b.zip' }], plan);
    // A line that said only "1 note imported" would be true and would hide the
    // file nobody read, which is the failure §4 is written to prevent.
    expect(describeBatch(done.batch)).toMatch(/Brought in 1 note · 1 file needs a look/);
  });
});

describe('what splits is what the file says splits', () => {
  it('splits markdown on its headings, because the author put them there', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      [text('lecture.md', '# Sampling\n\nA sample stands in.\n\n# Inference\n\nWhat follows from it.')],
      plan,
    );

    expect(done.file.researchItems.map((one) => one.title)).toEqual(['Sampling', 'Inference']);
    expect(itemsMadeBy(done.batch)).toBe(2);
  });

  it('keeps what comes before the first heading', () => {
    const items = splitMarkdown('lecture.md', 'An opening thought.\n\n# Sampling\n\nThe rest.');
    // Common, and usually the point of the file — never thrown away.
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe('lecture');
    expect(items[0]!.body).toBe('An opening thought.');
  });

  it('leaves plain text as one note however many blank lines it has', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      [text('notes.txt', 'First thought.\n\nSecond thought.\n\nThird thought.')],
      plan,
    );
    // A blank line is not the author saying "these are separate", and
    // shattering somebody's notes into fragments is hard to undo.
    expect(done.file.researchItems).toHaveLength(1);
    expect(done.file.researchItems[0]!.body).toContain('Third thought.');
  });
});

describe('what an import keeps', () => {
  it('keeps the original filename as the note’s source', () => {
    const { file, plan } = book();
    const done = importFiles(file, [text('lecture-notes-final-v3.txt', 'Something.')], plan);

    const item = done.file.researchItems[0]!;
    // A title is the author's to change; the trail back is only here.
    expect(item.source).toBe('lecture-notes-final-v3.txt');
    expect(item.origin).toBe('import');
    expect(item.title).toBe('lecture-notes-final-v3');
  });

  it('puts pictures in the graphics library, not in the notes', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      [{ name: 'histogram.png', dataUrl: 'data:image/png;base64,AA', width: 800, height: 600 }],
      plan,
    );

    expect(graphicsMadeBy(done.batch)).toBe(1);
    expect(done.file.researchItems).toHaveLength(0);
    expect(graphicsInOrder(done.file)[0]!.name).toBe('histogram.png');
    // Where §9's caption and alt text are waiting for it.
    expect(graphicsInOrder(done.file)[0]!.altText).toBe('');
  });

  it('files into the inbox when asked, so classification can wait', () => {
    const { file, plan } = book();
    const done = importFiles(file, [text('a.txt', 'one')], { ...plan, toInbox: true });
    expect(done.file.researchItems[0]!.categoryId).toBe(plan.inboxCategoryId);

    const straight = importFiles(file, [text('a.txt', 'one')], plan);
    expect(straight.file.researchItems[0]!.categoryId).toBe(plan.notesCategoryId);
  });

  it('records each import, newest first', () => {
    const { file, plan } = book();
    const first = importFiles(file, [text('a.txt', 'one')], plan);
    const second = importFiles(first.file, [text('b.txt', 'two')], plan);

    expect(second.file.importBatches).toHaveLength(2);
    expect(batchesInOrder(second.file)).toHaveLength(2);
  });

  it('links each entry to what it made, so a batch can be reviewed', () => {
    const { file, plan } = book();
    const done = importFiles(file, [text('lecture.md', '# One\n\nA.\n\n# Two\n\nB.')], plan);

    const entry = done.batch.entries[0]!;
    expect(entry.itemIds).toHaveLength(2);
    // And those ids are really in the project.
    for (const id of entry.itemIds) {
      expect(done.file.researchItems.some((one) => (one.id as string) === id)).toBe(true);
    }
  });
});

describe('a bulk import', () => {
  it('takes a folder of mixed files and accounts for all of them', () => {
    const { file, plan } = book();
    const done = importFiles(
      file,
      [
        text('01-sampling.md', '# Sampling\n\nA.\n\n# Bias\n\nB.'),
        text('02-inference.txt', 'What follows.'),
        { name: 'fig1.png', dataUrl: 'data:image/png;base64,AA', width: 400, height: 300 },
        { name: 'old-notes.pages' },
        text('03-empty.txt', ''),
      ],
      plan,
    );

    expect(itemsMadeBy(done.batch)).toBe(3);
    expect(graphicsMadeBy(done.batch)).toBe(1);
    expect(warningsIn(done.batch)).toHaveLength(2);
    // Five files in, five entries out. Nothing unaccounted for.
    expect(done.batch.entries).toHaveLength(5);
  });
});
