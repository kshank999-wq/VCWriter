import { describe, expect, it } from 'vitest';
import {
  approveCapture,
  blocksOf,
  boardsOf,
  captureItemSchema,
  createBoard,
  createOutline,
  createProjectFile,
  filingFolder,
  newId,
  noteOffer,
  outlineRows,
  outlinesOf,
  researchCategoriesInOrder,
  suggestRouting,
  type CaptureItem,
  type CaptureItemId,
  type ProjectFile,
  type UserId,
} from '../index.js';

/**
 * A note off the phone, into a plan (addendum 09 §15).
 *
 * What is worth pinning is the pair: the note is **filed** and **placed**, and
 * neither happens without the other. Half of it is the outcome `captureFromScript`
 * was built to refuse — a thought filed into a folder while the writer was
 * watching a board, and nothing on the board.
 */

const note = (over: Partial<CaptureItem> = {}): CaptureItem =>
  captureItemSchema.parse({
    id: newId<CaptureItemId>(),
    userId: newId<UserId>(),
    source: 'mobile_voice',
    capturedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    rawText: 'a bell rings and nobody in the house moves',
    category: 'idea',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  });

const project = (): ProjectFile => createProjectFile({ title: 'Blackout', format: 'screenplay' });

describe('a note into the Outliner', () => {
  it('files it and puts a row that reads it', () => {
    const made = createOutline(project());
    const one = note();

    const done = approveCapture(made.file, one, { kind: 'outline', outlineId: made.outline.id });

    // Filed: the note is on the shelf, under what its category reads as.
    expect(done.file.researchItems).toHaveLength(1);
    expect(done.file.researchItems[0]?.body).toBe(one.rawText);
    // Placed: a row referencing it, never a second copy of the words.
    const rows = outlineRows(outlinesOf(done.file)[0]!);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.item.source).toEqual({
      type: 'research_item',
      id: done.file.researchItems[0]?.id,
    });
    expect(done.capture.status).toBe('approved');
  });

  it('takes the writer’s corrected words and leaves the note alone', () => {
    const made = createOutline(project());
    const one = note();

    const done = approveCapture(made.file, one, {
      kind: 'outline',
      outlineId: made.outline.id,
      title: 'The bell',
      body: 'A bell rings. Nobody in the house moves.',
    });

    expect(done.file.researchItems[0]?.title).toBe('The bell');
    expect(done.file.researchItems[0]?.body).toBe('A bell rings. Nobody in the house moves.');
    // `raw_text` is the recovery record (§9): a correction here never reaches it.
    expect(done.capture.rawText).toBe(one.rawText);
  });

  it('keeps nothing at all where the row cannot be made', () => {
    const file = project();
    // No outline, so an id that names none: the filing must not survive it.
    expect(() =>
      approveCapture(file, note(), { kind: 'outline', outlineId: newId() }),
    ).toThrow();
  });
});

describe('a note onto the board', () => {
  it('files it and puts a card carrying its words', () => {
    const made = createBoard(project());
    const one = note();

    const done = approveCapture(made.file, one, { kind: 'board', boardId: made.board.id });

    expect(done.file.researchItems).toHaveLength(1);
    const board = boardsOf(done.file)[0]!;
    // A block of its own in the spine, the board holding no reference (§2).
    expect(blocksOf(board).some((node) => node.title === done.file.researchItems[0]?.title)).toBe(true);
  });

  it('hangs it off a card when one was dropped on', () => {
    const made = createBoard(project());
    const spine = blocksOf(boardsOf(made.file)[0]!)[0]!;

    const done = approveCapture(made.file, note(), {
      kind: 'board',
      boardId: made.board.id,
      parentId: spine.id,
    });

    const board = boardsOf(done.file)[0]!;
    expect(board.nodes.some((node) => node.parentId === spine.id)).toBe(true);
  });
});

describe('what a drop would do, said first', () => {
  it('names the folder and refuses where there is no plan', () => {
    const bare = project();
    expect(noteOffer(bare, note(), 'outline')).toMatchObject({
      can: false,
      says: 'There is no outline yet to put it in.',
    });
    expect(noteOffer(bare, note(), 'board').can).toBe(false);

    const made = createOutline(bare);
    const offer = noteOffer(made.file, note(), 'outline');
    expect(offer.can).toBe(true);
    // The sentence names where it lands, which is the half a writer cannot see.
    expect(offer.says).toContain('Ideas');
  });
});

describe('where a note is filed when nobody said', () => {
  it('reads it off the note’s own category, then falls back', () => {
    const file = project();
    const folders = researchCategoriesInOrder(file);
    const ideas = folders.find((one) => one.systemKey === 'ideas');
    const people = folders.find((one) => one.systemKey === 'characters');

    expect(filingFolder(file, note({ category: 'idea' }), null)).toBe(ideas?.id);
    expect(filingFolder(file, note({ category: 'character' }), null)).toBe(people?.id);
    // A word this build has never heard of is still a note, so it lands where
    // a general thought goes — never in the cast, which is merely the first
    // folder a screenplay has.
    expect(filingFolder(file, note({ category: 'something-new' }), null)).toBe(ideas?.id);
    // What the writer chose beats all of it.
    expect(filingFolder(file, note({ category: 'idea' }), people!.id)).toBe(people?.id);
  });
});

describe('what the suggestion says about a word it has no folder for', () => {
  it('names the category the writer said rather than claiming none', () => {
    // Driving the desk found this: a `dialogue` note on a screenplay read *No
    // category identified*, said to somebody who had just said one out loud.
    // A screenplay has no General Notes shelf, so the mapped folder is absent —
    // which is not the same as nothing having been said.
    const said = suggestRouting(project(), note({ category: 'dialogue' }));
    expect(said.reason).toContain('You said Dialogue');
    expect(said.reason).not.toContain('No category identified');
    expect(said.decision?.kind).toBe('research');

    // And a `scene` note, which has no folder **on purpose**: this module may
    // not file into the manuscript, so it waits where general thoughts wait.
    const scene = suggestRouting(project(), note({ category: 'scene' }));
    expect(scene.reason).toContain('You said Scene');
    expect(scene.reason).toContain('unless you place it yourself');
  });

  it('reads the structural words in the format’s own vocabulary', () => {
    // `null` was being passed for the format, so a note said against a scene
    // read back as *Scene or chapter* on a screenplay that has scenes.
    const script = suggestRouting(project(), note({ category: 'unit' }));
    expect(script.reason).toContain('You said Scene');

    const book = createProjectFile({ title: 'The Lamp', format: 'novel' });
    expect(suggestRouting(book, note({ category: 'unit' })).reason).toContain('You said Chapter');
  });
});
