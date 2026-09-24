import { describe, expect, it } from 'vitest';
import {
  bookContentsOf,
  bookPageRows,
  bookSettingsSchema,
  geometryOf,
  layPages,
  type BookBlock,
  type BookSettings,
  type Measured,
} from '../index.js';

/**
 * Laying the pages (addendum 20 §4), with counts made up here — which is
 * all a measurement is to the cutter. The renderer may measure a line
 * differently and move a break; it can never move a chapter off a recto.
 */

const settings = (patch: Partial<BookSettings> = {}): BookSettings =>
  bookSettingsSchema.parse({ trim: { width: 6, height: 9 }, ...patch });

const geometry = (patch: Partial<BookSettings> = {}) => geometryOf(settings(patch), 'novel', 200);

const names = { title: 'The Lamp', author: 'M. Shank' };

const make = (input: Partial<BookBlock> & Pick<BookBlock, 'id' | 'kind'>): BookBlock => ({
  numbering: 'arabic',
  starts: 'none',
  display: false,
  folio: true,
  keepWithNext: false,
  unbreakable: false,
  text: '',
  spans: [],
  chapterTitle: '',
  ...input,
});

const front = (): BookBlock[] => [
  make({ id: 'half', kind: 'half_title', numbering: 'roman', starts: 'recto', display: true, folio: false }),
  make({ id: 'title', kind: 'title_page', numbering: 'roman', starts: 'recto', display: true, folio: false }),
  make({ id: 'copy', kind: 'copyright', numbering: 'roman', starts: 'verso', display: true, folio: false }),
  make({ id: 'contents', kind: 'contents', numbering: 'roman', starts: 'recto', chapterTitle: 'Contents' }),
];

const chapter = (n: number, paragraphs: number[]): BookBlock[] => [
  make({
    id: `ch${n}`,
    kind: 'chapter_opening',
    starts: 'recto',
    keepWithNext: true,
    unbreakable: true,
    chapterTitle: `Chapter ${n}`,
    chapter: { label: `Chapter ${n}`, title: '', epigraph: '', summary: '', image: null, align: 'center', template: 'graphic_middle' },
    leaf: false,
  }),
  ...paragraphs.map((_, index) =>
    make({ id: `ch${n}p${index}`, kind: 'paragraph', chapterTitle: `Chapter ${n}`, opensChapter: index === 0 }),
  ),
];

const measure = (pairs: Record<string, number>): Measured => new Map(Object.entries(pairs));

/** Lines per page for a 6 × 9 at the defaults: 7.375 in over 15 pt. */
const LINES = geometry().linesPerPage;

describe('the first leaves', () => {
  it('opens on a recto, puts the copyright on the verso of the title, and numbers the front in roman', () => {
    const blocks = [...front(), ...chapter(1, [5])];
    const laid = layPages(blocks, measure({ half: 1, title: 4, copy: 6, contents: 3, ch1: 8, ch1p0: 5 }), geometry(), settings(), names);
    const sides = laid.pages.map((page) => `${page.sheet}:${page.side}${page.blank ? ':blank' : ''}`);
    // Half title recto, blank verso, title recto, copyright verso, contents recto, blank verso, chapter recto.
    expect(sides).toEqual(['1:recto', '2:verso:blank', '3:recto', '4:verso', '5:recto', '6:verso:blank', '7:recto']);
    expect(laid.pages.map((page) => page.folio)).toEqual(['', '', '', '', 'v', '', '1']);
    expect(laid.pages[4]?.numbering).toBe('roman');
    expect(laid.pages[6]?.numbering).toBe('arabic');
    expect(laid.roman).toBe(6);
  });

  it('starts the story on a page when the book says chapters need not open recto', () => {
    // `bookBlocks` reads the setting and writes `page` on the opening; the
    // cutter only ever reads the block.
    const blocks = [...front(), ...chapter(1, [5]), ...chapter(2, [5])].map((block) =>
      block.kind === 'chapter_opening' ? { ...block, starts: 'page' as const } : block,
    );
    const runOn = settings({ chaptersOpenRecto: false });
    const laid = layPages(
      blocks,
      measure({ half: 1, title: 4, copy: 6, contents: 3, ch1: 8, ch1p0: 5, ch2: 8, ch2p0: 5 }),
      geometry(),
      runOn,
      names,
    );
    const two = laid.pages.find((page) => page.pieces.some((piece) => piece.blockId === 'ch2'))!;
    const one = laid.pages.find((page) => page.pieces.some((piece) => piece.blockId === 'ch1'))!;
    // On the very next leaf, whichever side that is: no blank between them.
    expect(two.sheet).toBe(one.sheet + 1);
    expect(laid.pages.some((page) => page.blank && page.sheet > one.sheet)).toBe(false);
  });
});

describe('the flow', () => {
  it('fills a page, splits a paragraph across the break, and never leaves one line alone', () => {
    const blocks = chapter(1, [LINES - 10, 12, 4]);
    const laid = layPages(
      blocks,
      measure({ ch1: 6, ch1p0: LINES - 10, ch1p1: 12, ch1p2: 4 }),
      geometry(),
      settings(),
      names,
    );
    const first = laid.pages[0]!;
    // Opening (6) + paragraph (LINES-10) leaves 4: the second paragraph starts here with 4 lines…
    const split = first.pieces.find((piece) => piece.blockId === 'ch1p1')!;
    expect(split.from).toBe(0);
    expect(split.to).toBe(4);
    expect(first.depth).toBe(LINES);
    // …and carries the other 8 to the verso.
    const second = laid.pages[1]!;
    expect(second.pieces[0]).toEqual({ blockId: 'ch1p1', from: 4, to: 12 });
  });

  it('refuses a widow by taking one line less', () => {
    // The paragraph would leave exactly one line for the next page.
    const blocks = chapter(1, [LINES - 6 + 1]);
    const laid = layPages(blocks, measure({ ch1: 6, ch1p0: LINES - 6 + 1 }), geometry(), settings(), names);
    const first = laid.pages[0]!;
    const piece = first.pieces.find((one) => one.blockId === 'ch1p0')!;
    expect(piece.to).toBe(LINES - 6 - 1);
    expect(laid.pages[1]?.pieces[0]).toEqual({ blockId: 'ch1p0', from: LINES - 7, to: LINES - 5 });
  });

  it('refuses an orphan by moving the paragraph whole', () => {
    // One line of room left: a paragraph of ten cannot leave its first line alone.
    const blocks = chapter(1, [LINES - 7, 10]);
    const laid = layPages(blocks, measure({ ch1: 6, ch1p0: LINES - 7, ch1p1: 10 }), geometry(), settings(), names);
    expect(laid.pages[0]!.pieces.map((piece) => piece.blockId)).toEqual(['ch1', 'ch1p0']);
    expect(laid.pages[1]!.pieces[0]).toEqual({ blockId: 'ch1p1', from: 0, to: 10 });
  });

  it('keeps a heading with the lines after it', () => {
    const blocks: BookBlock[] = [
      ...chapter(1, [LINES - 8]),
      make({ id: 'h', kind: 'heading', keepWithNext: true, unbreakable: true }),
      make({ id: 'after', kind: 'paragraph' }),
    ];
    const laid = layPages(blocks, measure({ ch1: 6, ch1p0: LINES - 8, h: 1, after: 9 }), geometry(), settings(), names);
    // Two lines left after the paragraph: the heading would fit, but it keeps the next.
    expect(laid.pages[0]!.pieces.map((piece) => piece.blockId)).toEqual(['ch1', 'ch1p0']);
    expect(laid.pages[1]!.pieces.map((piece) => piece.blockId)).toEqual(['h', 'after']);
  });

  it('runs a picture taller than a page over rather than losing it', () => {
    const blocks: BookBlock[] = [
      ...chapter(1, []),
      make({ id: 'fig', kind: 'figure', unbreakable: true }),
    ];
    const laid = layPages(blocks, measure({ ch1: 6, fig: LINES * 2 }), geometry(), settings(), names);
    const carried = laid.pages.flatMap((page) => page.pieces.filter((piece) => piece.blockId === 'fig'));
    expect(carried.length).toBeGreaterThan(1);
    expect(carried.at(-1)?.to).toBe(LINES * 2);
  });
});

describe('the furniture', () => {
  it('puts the author on the verso and the chapter on the recto, and nothing on a display page', () => {
    const blocks = [...front(), ...chapter(1, [LINES * 3])];
    const laid = layPages(
      blocks,
      measure({ half: 1, title: 4, copy: 6, contents: 3, ch1: 6, ch1p0: LINES * 3 }),
      geometry(),
      settings(),
      names,
    );
    const flow = laid.pages.filter((page) => !page.blank && !page.display && page.numbering === 'arabic');
    const verso = flow.find((page) => page.side === 'verso')!;
    const recto = flow.find((page) => page.side === 'recto' && !page.pieces.some((p) => p.blockId === 'ch1'))!;
    expect(verso.runningHead).toBe('M. Shank');
    expect(recto.runningHead).toBe('Chapter 1');
    expect(laid.pages[0]!.runningHead).toBe('');
    // The page the chapter opens on carries none either: the heading is the head.
    const opening = laid.pages.find((page) => page.pieces.some((piece) => piece.blockId === 'ch1'))!;
    expect(opening.opens).toBe(true);
    expect(opening.runningHead).toBe('');
  });

  it('numbers the story from 1 and leaves a chapter opening unnumbered when the book says so', () => {
    const blocks = [...front(), ...chapter(1, [3])];
    const quiet = settings({ folioOnOpening: false });
    const leafy = blocks.map((block) => (block.kind === 'chapter_opening' ? { ...block, display: true, leaf: true, folio: false } : block));
    const laid = layPages(leafy, measure({ half: 1, title: 4, copy: 6, contents: 3, ch1: 6, ch1p0: 3 }), geometry(), quiet, names);
    const opening = laid.pages.find((page) => page.pieces.some((piece) => piece.blockId === 'ch1'))!;
    expect(opening.number).toBe(1);
    expect(opening.folio).toBe('');
    const after = laid.pages[laid.pages.indexOf(opening) + 1]!;
    expect(after.folio).toBe('2');
  });

  it('says where every block landed, and reads the contents off it', () => {
    const blocks = [...front(), ...chapter(1, [LINES * 2]), ...chapter(2, [3])];
    const laid = layPages(
      blocks,
      measure({ half: 1, title: 4, copy: 6, contents: 3, ch1: 6, ch1p0: LINES * 2, ch2: 6, ch2p0: 3 }),
      geometry(),
      settings(),
      names,
    );
    expect(laid.where.get('ch1')).toEqual({ numbering: 'arabic', number: 1 });
    const rows = bookContentsOf(blocks, laid);
    expect(rows.map((row) => [row.label, row.page])).toEqual([
      ['Chapter 1', 1],
      ['Chapter 2', laid.where.get('ch2')!.number],
    ]);
    // Chapter 2 opens on a recto: an odd page.
    expect(laid.where.get('ch2')!.number % 2).toBe(1);
  });
});

describe('balancing', () => {
  it('cuts both pages of a spread to one depth where both run on', () => {
    // Paragraphs that each want to leave a widow on the verso: the verso is
    // cut a line short, and the recto is cut to match rather than standing a
    // line deeper beside it.
    const paragraphs = Array.from({ length: 12 }, () => LINES - 6 + 1);
    const blocks = chapter(1, paragraphs);
    const counts: Record<string, number> = { ch1: 6 };
    paragraphs.forEach((lines, index) => {
      counts[`ch1p${index}`] = lines;
    });
    const laid = layPages(blocks, measure(counts), geometry(), settings(), names);
    const spreads = laid.pages.filter((page) => page.sheet >= 2 && page.sheet <= 5);
    const verso = spreads.find((page) => page.sheet === 2)!;
    const recto = spreads.find((page) => page.sheet === 3)!;
    expect(verso.depth).toBe(recto.depth);
    expect(verso.target).toBe(recto.target);
    // And no page is ever deeper than the block allows.
    for (const page of laid.pages) expect(page.depth).toBeLessThanOrEqual(LINES);
  });
});

/**
 * The pages of a chapter, for the rail (addendum 20 §9h, from Ken: *you
 * should be able to drop down each chapter and see how many pages… and on
 * that page you can see which one is art and which one is not*).
 *
 * The room could name a chapter and a part and nothing between them, so a
 * press on a page in the story fell through to the chapter in force — which
 * is how a picture asked for on page nine landed on chapter two's own leaf.
 */
describe('the pages of a chapter', () => {
  const laid = (extra: BookBlock[] = []) => {
    const blocks = [...front(), ...chapter(1, [1, 2, 3]), ...extra, ...chapter(2, [1, 2])];
    const counts: Record<string, number> = { contents: 4 };
    for (const block of blocks) counts[block.id] = counts[block.id] ?? (block.kind === 'paragraph' ? LINES : 6);
    return { blocks, laid: layPages(blocks, measure(counts), geometry(), settings(), names) };
  };

  it('gives every page a row, under the chapter in force, saying what stands on it', () => {
    const { blocks, laid: pages } = laid();
    const rows = bookPageRows(pages.pages, blocks);
    expect(rows).toHaveLength(pages.pages.length);
    // Every page of the book is there once, in order, keyed by its sheet.
    expect(rows.map((row) => row.sheet)).toEqual(pages.pages.map((page) => page.sheet));

    const ofChapterOne = rows.filter((row) => row.markerId === 'ch1');
    expect(ofChapterOne.length).toBeGreaterThan(1);
    // The first of them is the one the chapter opens on; the rest are its text.
    expect(ofChapterOne[0]!.says).toBe('Chapter opens');
    expect(ofChapterOne.slice(1).every((row) => row.says === 'Text' || row.says === 'Blank')).toBe(true);
    // The front matter belongs to a part rather than to a chapter, so the
    // rail does not sit the half title under chapter one.
    expect(rows.filter((row) => row.partId !== null).every((row) => row.markerId === null)).toBe(true);
  });

  it('names a picture page as one, and hands the rail the figure to edit', () => {
    const art = make({ id: 'art1', kind: 'figure', display: true, folio: false, starts: 'page', unbreakable: true, chapterTitle: 'Chapter 1' });
    const { blocks, laid: pages } = laid([art]);
    const rows = bookPageRows(pages.pages, blocks);
    const picture = rows.find((row) => row.figureId === 'art1');

    expect(picture).toBeDefined();
    expect(picture!.says).toBe('Illustration');
    // It is in chapter one, which is what lets the rail sit it under that row.
    expect(picture!.markerId).toBe('ch1');
    // And nothing else on the book claims to be a picture.
    expect(rows.filter((row) => row.says === 'Illustration')).toHaveLength(1);
  });
});

/**
 * A picture page counts and prints nothing (addendum 20 §9i, from Ken: *the
 * illustration will count as a numbered page but there'll be no printing of
 * the page number on that page… if you have page six and the opposite page is
 * an illustration, the illustration will be page seven and the story picks up
 * at eight*).
 *
 * This is what `layPages` has always done — the count advances on every page
 * and only *printing* the number asks whether the block carries a folio — so
 * the test exists to hold it rather than to change it. Ken named the rule; a
 * rule nobody has written down is one the next change can take away.
 */
describe('a page that carries no number', () => {
  it('still counts, so the story picks up after it', () => {
    const art = make({ id: 'art1', kind: 'figure', display: true, folio: false, starts: 'page', unbreakable: true, chapterTitle: 'Chapter 1' });
    const blocks = [...chapter(1, [1, 2, 3]), art, ...chapter(2, [1])];
    const counts: Record<string, number> = {};
    for (const block of blocks) counts[block.id] = block.kind === 'paragraph' ? LINES : 6;
    const laid = layPages(blocks, measure(counts), geometry(), settings(), names);

    const at = laid.pages.findIndex((page) => page.pieces.some((piece) => piece.blockId === 'art1'));
    expect(at).toBeGreaterThan(0);
    const before = laid.pages[at - 1]!;
    const picture = laid.pages[at]!;
    const after = laid.pages[at + 1];

    // It prints no number of its own…
    expect(picture.folio).toBe('');
    // …and it is still the next number: six, then the picture is seven, and
    // whatever follows is eight.
    expect(picture.number).toBe(before.number + 1);
    if (after) expect(after.number).toBe(picture.number + 1);
    // Nothing else is set over it either.
    expect(picture.runningHead).toBe('');
  });
});
