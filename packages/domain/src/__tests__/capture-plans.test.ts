import { describe, expect, it } from 'vitest';
import {
  approveCapture,
  addBlock,
  addResearchCategory,
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
    const framed = addBlock(made.file, made.board.id, { title: 'Act one' }).file;
    const spine = blocksOf(boardsOf(framed)[0]!)[0]!;

    const done = approveCapture(framed, note(), {
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
    // Its own division (from Ken: *when you pick the category in the app…
    // there needs to be those divisions*): a Dialogue folder, made for it.
    expect(said.decision).toEqual({ kind: 'research_folder', name: 'Dialogue' });

    // A `scene` note goes to a Scene folder in Research — never into the
    // manuscript, which this module may not file into.
    const scene = suggestRouting(project(), note({ category: 'scene' }));
    expect(scene.reason).toContain('You said Scene');
    expect(scene.decision).toEqual({ kind: 'research_folder', name: 'Scene' });
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

describe('notes from VC Writer Notes come in as they read on the phone (from Ken)', () => {
  it('takes the title from the phone, keeps the category and the day it was caught, and makes the division', async () => {
    const { approveCapture, captureTitle } = await import('../index.js');
    const book = createProjectFile({ title: 'Guide', format: 'instructional' });
    const capture = note({
      category: 'sub',
      subjectName: 'Constructing sentences adverbs',
      rawText: "If you're going to use an adverb, make it fight the verb.",
      capturedAt: '2026-11-05T22:56:32.891Z',
    });
    expect(captureTitle(capture)).toBe('Constructing sentences adverbs');
    const route = suggestRouting(book, capture);
    expect(route.decision).toEqual({ kind: 'research_folder', name: 'Subsection' });
    const done = approveCapture(book, capture, route.decision!);
    const item = done.file.researchItems.at(-1)!;
    expect(item.title).toBe('Constructing sentences adverbs');
    expect(item.captureCategory).toBe('sub');
    expect(item.capturedAt).toBe('2026-11-05T22:56:32.891Z');
    expect(done.file.researchCategories.find((one) => one.id === item.categoryId)?.name).toBe('Subsection');
    // The next one goes into the same folder, not a second one.
    const again = approveCapture(done.file, note({ category: 'sub', subjectName: 'Another' }), suggestRouting(done.file, note({ category: 'sub' })).decision!);
    expect(again.file.researchCategories.filter((one) => one.name === 'Subsection')).toHaveLength(1);
  });

  it('files a note into the folder its title names', () => {
    let file = createProjectFile({ title: 'Guide', format: 'instructional' });
    file = addResearchCategory(file, { name: 'Characterization' }).file;
    const route = suggestRouting(file, note({ category: 'idea', subjectName: 'characterization' }));
    expect(route.decision?.kind).toBe('research');
    const folder = file.researchCategories.find((one) => one.name === 'Characterization')!;
    expect(route.decision).toEqual({ kind: 'research', categoryId: folder.id });
  });

  it('repairs notes brought in earlier under their first line, and leaves a title the writer changed', async () => {
    const { repairCaptureTitles, approveCapture } = await import('../index.js');
    const book = createProjectFile({ title: 'Guide', format: 'instructional' });
    const ideas = book.researchCategories.find((one) => one.systemKey === 'ideas')!;
    const first = note({ subjectName: 'Good sentences', rawText: 'Now good sentences do without adverbs.' });
    const second = note({ subjectName: 'Delay', rawText: 'Delay delay delay.' });
    // As an earlier build filed them: titled by the first line.
    let file = approveCapture(book, first, { kind: 'research', categoryId: ideas.id, title: 'Now good sentences do without adverbs.' }).file;
    const a = approveCapture(file, second, { kind: 'research', categoryId: ideas.id, title: 'My own name for it' });
    file = a.file;
    const firstItem = file.researchItems.find((one) => one.title === 'Now good sentences do without adverbs.')!;
    const secondItem = file.researchItems.find((one) => one.title === 'My own name for it')!;
    const captures = [
      { ...first, status: 'approved' as const, resultRef: { type: 'research_item' as const, id: firstItem.id } },
      { ...second, status: 'approved' as const, resultRef: { type: 'research_item' as const, id: secondItem.id } },
    ];
    const repaired = repairCaptureTitles(file, captures as never);
    expect(repaired.researchItems.find((one) => one.id === firstItem.id)!.title).toBe('Good sentences');
    expect(repaired.researchItems.find((one) => one.id === secondItem.id)!.title).toBe('My own name for it');
    expect(repairCaptureTitles(repaired, captures as never)).toBe(repaired);
  });
});
