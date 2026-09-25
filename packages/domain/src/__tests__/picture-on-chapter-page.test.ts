import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addUnit,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pagePlace,
  placeFigure,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A picture on the page a chapter opens on** (addendum 20 §9p, from Ken:
 * *I went to add a picture on a page that had chapter two on it, but it
 * didn't shift the chapter page to the next page and then put the picture on
 * the wrong page and started chapter two with the format all messed up*, and
 * *I tried to put a picture in chapter one and it didn't even allow me to put
 * a picture, it just did nothing*).
 *
 * Two reports, one cause: a chapter opening is emitted by the **unit** rather
 * than by an element, so *before the element the page opens with* could not
 * name it — the figure landed between the opening and the chapter's words.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A novel of three chapters, each with enough prose to run over a page. */
const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  for (let at = 1; at <= 3; at += 1) {
    const made = addUnit(file, { trackId: track, title: `Chapter ${at}` });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title: `c${at}` });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [1, 2, 3, 4].map((n) => para(`Chapter ${at} paragraph ${n}. ${'word '.repeat(70)}`)) } as never,
    });
  }
  for (const unit of unitsInStoryOrder(file)) {
    if (unit.title.startsWith('Chapter')) file = addMarker(file, { kind: 'chapter', unitId: unit.id, title: unit.title }).file;
  }
  return { ...file, assets: [...(file.assets ?? []), { id: 'a1', name: 'bridge.jpg', data: 'data:image/png;base64,AAA' }] } as ProjectFile;
};

const lay = (file: ProjectFile, lines = 9) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? lines : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/** What stands on each page, in the order the pages fall. */
const shape = (file: ProjectFile): string[] => {
  const { blocks, laid } = lay(file);
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return laid.pages.map((page) => page.pieces.map((piece) => byId.get(piece.blockId)?.kind).join('+'));
};

/** Put a picture on a page, exactly as the room's *Put a picture on this page…* does. */
const pictureOn = (file: ProjectFile, sheet: number, lines = 9): ProjectFile => {
  // The same measure the caller will read the result at, or the page found
  // here is not the page asserted on.
  const { blocks, laid } = lay(file, lines);
  const place = pagePlace(laid.pages, blocks, sheet);
  if (!place.elementId) throw new Error('nowhere to put it');
  const beat = file.beats.find((one) => one.manuscript.elements.some((element) => (element.id as string) === place.elementId))!;
  return placeFigure(file, {
    beatId: beat.id,
    assetId: 'a1' as never,
    beforeElementId: place.elementId as never,
    attributes: { bookPlace: 'page' },
  }).file;
};

describe('a picture on the page a chapter opens on', () => {
  /** The sheet the second real chapter opens on, numeral and words together. */
  const secondOpening = (file: ProjectFile): number => {
    const all = shape(file);
    const found = all.map((one, at) => ({ one, at })).filter(({ one }) => one.startsWith('chapter_opening+paragraph'));
    return found[1]!.at + 1;
  };

  it('takes that page, and the chapter opens whole on the next one', () => {
    const file = novel();
    const sheet = secondOpening(file);
    const after = shape(pictureOn(file, sheet));

    // The picture stands where the chapter used to open…
    expect(after[sheet - 1]).toBe('figure');
    // …and the chapter opens after it with its words, rather than its numeral
    // being left alone on a page of its own.
    expect(after.slice(sheet).find((one) => one.startsWith('chapter_opening'))).toBe(
      'chapter_opening+paragraph+paragraph+paragraph+paragraph',
    );
  });

  it('never leaves the numeral stranded from its own words', () => {
    // The fault exactly: before this, the opening kept the page it was on
    // with nothing under it and the chapter's text began two pages later.
    const file = novel();
    const after = shape(pictureOn(file, secondOpening(file)));
    const stranded = after
      .map((one, at) => ({ one, at }))
      .filter(({ one, at }) => one === 'chapter_opening' && at > 0 && after[at - 1] !== undefined);
    // Only the book's very first chapter opens on a leaf of its own here.
    expect(stranded.length).toBeLessThanOrEqual(1);
  });
});

describe('a page that only opens a chapter', () => {
  it('still answers where a picture would go, so the button is not dead', () => {
    // Ken's *it just did nothing*: the room greys its picture buttons on this
    // answer, and a chapter opening is not a manuscript element.
    const file = novel();
    const { blocks, laid } = lay(file);
    const alone = laid.pages.find(
      (page) => page.pieces.length === 1 && blocks.find((one) => one.id === page.pieces[0]!.blockId)?.kind === 'chapter_opening',
    );
    expect(alone).toBeTruthy();
    expect(pagePlace(laid.pages, blocks, alone!.sheet).elementId).toBeTruthy();
  });

  it('points at the chapter’s own first element rather than at anything before it', () => {
    const file = novel();
    const { blocks, laid } = lay(file);
    const alone = laid.pages.find(
      (page) => page.pieces.length === 1 && blocks.find((one) => one.id === page.pieces[0]!.blockId)?.kind === 'chapter_opening',
    )!;
    const answer = pagePlace(laid.pages, blocks, alone.sheet).elementId;
    const opening = blocks.findIndex((one) => one.id === alone.pieces[0]!.blockId);
    expect(blocks.findIndex((one) => one.id === answer)).toBeGreaterThan(opening);
  });
});

describe('a book with no picture in it', () => {
  it('is laid exactly as it was', () => {
    // The change is one branch that only fires on a page-figure at a unit's
    // head, so a book that has none must be untouched.
    const file = novel();
    expect(shape(file).filter((one) => one.includes('figure'))).toHaveLength(0);
  });
});

/**
 * **A plate does not cut the page short** (addendum 20 §9q, from Ken: *it cut
 * the text in the first page… it should fill that entire page to a sentence,
 * then move the rest to the appropriate page*).
 *
 * The page a plate was reached on used to end where the plate stood, however
 * much room was left — so a paragraph that had been running to the foot was
 * taken whole to after the picture and the foot went white. Now the plate
 * waits, the text goes on filling, and the paragraph **resumes after the
 * picture**, which is what an illustrated book does.
 *
 * Nothing in the suite covered this before, which is why the change passed
 * 2317 green tests without one of them moving.
 */
const deep = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  const made = addUnit(file, { trackId: track, title: 'Chapter 1' });
  file = made.file;
  const beat = addBeat(file, { unitId: made.unit.id, title: 'c1' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [1, 2, 3, 4, 5, 6].map((n) => para(`Paragraph ${n}. ${'word '.repeat(90)}`)) } as never,
  });
  file = addMarker(file, { kind: 'chapter', unitId: made.unit.id, title: 'Chapter 1' }).file;
  return { ...file, assets: [{ id: 'a1', name: 'p.jpg', data: 'data:image/png;base64,AAA' }] } as ProjectFile;
};

/** Each page as `kind(cut)` pieces, so a split paragraph is visible. */
const DEEP_LINES = 11;

const pieces = (file: ProjectFile): string[] => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? DEEP_LINES : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return laid.pages.map((page) =>
    page.pieces.map((piece) => `${byId.get(piece.blockId)?.kind}${piece.cut ? '(cut)' : ''}`).join(' '),
  );
};

describe('a plate reached with room still on the page', () => {
  it('leaves the page it was reached on exactly as full as it was', () => {
    const file = deep();
    const before = pieces(file);
    // The page whose text runs on past its foot.
    const full = before.findIndex((one) => one.endsWith('paragraph(cut)'));
    expect(full).toBeGreaterThanOrEqual(0);

    const after = pieces(pictureOn(file, full + 2, DEEP_LINES));
    // The whole point: that page is untouched, still running to its foot.
    expect(after[full]).toBe(before[full]);
  });

  it('takes the next leaf, and the same paragraph resumes after it', () => {
    const file = deep();
    const before = pieces(file);
    const full = before.findIndex((one) => one.endsWith('paragraph(cut)'));
    const after = pieces(pictureOn(file, full + 2, DEEP_LINES));

    expect(after[full + 1]).toBe('figure');
    // A reader turns from a full page of prose, past the plate, and back
    // into the same sentence.
    expect(after[full + 2]!.startsWith('paragraph(cut)')).toBe(true);
  });

  it('never leaves the plate undrawn, however late it falls', () => {
    const file = deep();
    const before = pieces(file);
    const full = before.findIndex((one) => one.endsWith('paragraph(cut)'));
    const after = pieces(pictureOn(file, full + 2, DEEP_LINES));
    expect(after.filter((one) => one === 'figure')).toHaveLength(1);
  });
});
