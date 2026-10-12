import { describe, expect, it } from 'vitest';
import {
  PART_INFO,
  addBeat,
  anchorOf,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookRows,
  BOOK_END,
  addPart,
  bookSettingsOf,
  blankPagesAt,
  pagePlace,
  pictureOffer,
  createProjectFile,
  designOffer,
  designPage,
  geometryOf,
  halfOf,
  layPages,
  partCarriesOwnWords,
  partHasStyle,
  partPlacement,
  partTakesBlankBack,
  partParagraphs,
  partsOf,
  setBlankPages,
  unitsInStoryOrder,
  updateBeat,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **A page of your own** (addendum 20 §19, from Ken: *on blank pages, I want
 * this level of styling to where you can add a graphic at the top, you can
 * add text in it, you can add a graphic at the bottom… you're able to put the
 * text and everything in the dialog box*).
 *
 * §9aa named the blocker for this — *a part that can stand between two pages
 * of the story* — and the audit found it mostly built: `halfOf` has answered
 * **body** since plates faced chapters, and a part already carries a
 * template, a drop, a rule, an alignment, a face and its own words with a
 * screen of its own. What was new is **one kind and one anchor**.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as never,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const first = unitsInStoryOrder(file)[0]!;
  const made = addBeat(file, { unitId: first.id, title: 'One' });
  return updateBeat(made.file, made.beat.id, {
    manuscript: { elements: [para('A lamp. '.repeat(60)), para('Rain. '.repeat(60))] } as never,
  });
};

/** The element a leaf can hang on: the second paragraph of the story. */
const anchorElement = (file: ProjectFile): string =>
  file.beats.flatMap((beat) => beat.manuscript.elements)[1]!.id as string;

const laid = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const settings = bookSettingsOf(file);
  const measured = new Map(blocks.map((one) => [one.id, 1]));
  return layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
};

const length = (file: ProjectFile): number => laid(file).pages.length;

/** The book's pages as the rail reads them. */
const rowsOf = (file: ProjectFile) => bookPageRows(laid(file).pages, bookBlocks(file));

/**
 * **Asked of the real page rather than of a page object made up here** (§9aq).
 * `designOffer` reads `blankHold`, which is a walk over the laid pages, so a
 * fabricated row cannot answer whose rule holds a leaf — and a test that
 * fabricated one would go on passing while the room did something else, which
 * is §9ap's own lesson about an assertion that runs the act itself.
 */
const at = (file: ProjectFile, pick: (rows: ReturnType<typeof rowsOf>) => unknown) => {
  const pages = laid(file);
  const blocks = bookBlocks(file);
  const rows = bookPageRows(pages.pages, blocks);
  const row = pick(rows) as (typeof rows)[number] | undefined;
  if (!row) throw new Error('no such page');
  return { rows, row, place: pagePlace(pages.pages, blocks, row.sheet) };
};

const offerAt = (file: ProjectFile, pick: (rows: ReturnType<typeof rowsOf>) => unknown) => {
  const { place, rows, row } = at(file, pick);
  return designOffer(place, rows, row.sheet, 'chapters');
};

const designAt = (file: ProjectFile, pick: (rows: ReturnType<typeof rowsOf>) => unknown) => {
  const { place, rows, row } = at(file, pick);
  return designPage(file, place, rows, row.sheet, 'chapters');
};

/** The writer's own leaf hanging on this record. */
const leafOn = (id: string) => (rows: ReturnType<typeof rowsOf>) => rows.find((row) => row.blankFor === id);

describe('it is a part, which is what makes it a designed page', () => {
  it('is set like every other designed page, with nothing written twice', () => {
    /**
     * The whole of why this is a kind rather than a new record: `block`
     * placement is what gives it the template, the drop, the rule and the
     * alignment, `partHasStyle` gives it the type, and `partCarriesOwnWords`
     * gives it the box the writer types into — every one of them already
     * built and none of them written a second time.
     */
    expect(partPlacement('leaf')).toBe('block');
    expect(partHasStyle('leaf')).toBe(true);
    expect(partCarriesOwnWords('leaf')).toBe(true);
    expect(partTakesBlankBack('leaf')).toBe(true);
    // A book may have as many as a writer puts in.
    expect(PART_INFO.leaf.once).toBe(false);
  });

  it('stands in the story where it is anchored', () => {
    const file = novel();
    const at = anchorElement(file);
    const made = designAt(setBlankPages(file, at, 1), leafOn(at));
    const part = partsOf(made.file).find((one) => one.id === made.partId)!;
    expect(anchorOf(part)).toBe(at);
    expect(halfOf(part)).toBe('body');
  });

  it('reads one anchor, the plate’s own spelling included', () => {
    /**
     * `beforeMarkerId` is the older and narrower spelling that a plate facing
     * a chapter still writes; `anchorOf` answers for both, because *where
     * does this page stand* must have one answer.
     */
    expect(anchorOf({ beforeId: null, beforeMarkerId: 'm1' })).toBe('m1');
    expect(anchorOf({ beforeId: 'e1', beforeMarkerId: null })).toBe('e1');
    expect(anchorOf({ beforeId: null, beforeMarkerId: null })).toBeNull();
  });
});

describe('designing a blank page', () => {
  it('says what it would do before it can be asked for', () => {
    const file = novel();
    const at = anchorElement(file);
    const offer = offerAt(setBlankPages(file, at, 1), leafOn(at));
    expect(offer.refusal).toBeNull();
    expect(offer.leafId).toBe(at);
    expect(offer.beforeId).toBe(at);
    // **What it does, and no number** (§9al): the leaf becomes the page, and
    // what the book then does depends on the parity — driving it measured a
    // sentence promising *the book stays the length it is* taking 14 to 16.
    expect(offer.note).toMatch(/a picture, a few words, or both/);
  });

  it('refuses a page with writing on it, and nothing else', () => {
    /**
     * **This assertion is the one §9aq rewrote rather than worked around.** It
     * pinned the refusal *the book leaves this page blank, so it is not a page
     * to design — its own screen says why*, which is the thing Ken reported:
     * a leaf he asked for in front of a page the book holds on a right-hand
     * side produced **two** blank pages, and the second drew no control and no
     * sentence at all. §9al's rule answers it, so what is left to refuse is a
     * page that is not blank.
     */
    const file = novel();
    const written = offerAt(file, (rows) => rows.find((row) => !row.blank));
    expect(written.refusal).toMatch(/writing on this page/);
  });

  it('refuses the same things again, so the reading cannot be skipped', () => {
    // `trackRemoval`'s shape: a caller that did not read the offer gets the
    // same answer from the act.
    const file = novel();
    const out = designAt(file, (rows) => rows.find((row) => !row.blank));
    expect(out.partId).toBeNull();
    expect(out.refusal).not.toBeNull();
    expect(out.file).toBe(file);
  });

  it('takes the leaf, so the page is the leaf rather than a second page', () => {
    /**
     * `takePictureLeaf`'s rule said of words rather than of a picture: a page
     * is a page, so the leaf goes and the designed page takes its place.
     *
     * **What the book's length then does is not promised**, which is what
     * driving it taught (§9al's own rule): the leaf costs nothing by itself
     * and what follows depends on the parity and on whether the page after it
     * opens on a right-hand page — a 14-page book was measured going to 16.
     * So what is pinned is the leaf going, which is the part the act controls.
     */
    const file = novel();
    const at = anchorElement(file);
    const withLeaf = setBlankPages(file, at, 1);
    expect(blankPagesAt(withLeaf, at)).toBe(1);
    const made = designAt(withLeaf, leafOn(at));
    expect(made.refusal).toBeNull();
    expect(blankPagesAt(made.file, at)).toBe(0);
    // And the page is really in the book rather than merely recorded.
    expect(length(made.file)).toBeGreaterThan(0);
  });

  it('prints where the leaf stood, in the story', () => {
    const file = novel();
    const at = anchorElement(file);
    const made = designAt(setBlankPages(file, at, 1), leafOn(at));
    const written = updatePart(made.file, made.partId as string, { text: 'A page of my own.' });
    const blocks = bookBlocks(written);
    const mine = blocks.findIndex((one) => one.partId === made.partId);
    const anchored = blocks.findIndex((one) => one.id === at);
    expect(mine).toBeGreaterThan(-1);
    // In front of the paragraph it hangs on, which is a blank leaf's own rule.
    expect(mine).toBeLessThan(anchored);
    // And it prints the words.
    expect(blocks[mine]!.text || blocks.slice(mine, anchored).map((one) => one.text).join(' ')).toMatch(/A page of my own/);
  });

  it('is a row of the rail, so it is not a page nothing lists', () => {
    /**
     * §9w's stray page: a page in the book, reachable from the spread, and on
     * no row — which is how a writer ends up unable to work out how to be rid
     * of one.
     */
    const file = novel();
    const front = partsOf(file)[0]!;
    const made = designAt(setBlankPages(file, front.id, 1), leafOn(front.id));
    expect(bookRows(made.file).some((row) => row.id === made.partId)).toBe(true);
  });

  it('has a page of its own in the book’s pages', () => {
    const file = novel();
    const at = anchorElement(file);
    const made = designAt(setBlankPages(file, at, 1), leafOn(at));
    const rows = rowsOf(made.file);
    expect(rows.some((row) => row.partId === made.partId)).toBe(true);
  });
});

describe('nothing else moves', () => {
  it('leaves a book nobody has asked anything of exactly as it was', () => {
    const file = novel();
    expect(bookBlocks(file).some((one) => one.partId && partsOf(file).find((p) => p.id === one.partId)?.kind === 'leaf')).toBe(
      false,
    );
  });
});

/**
 * **Which leaf you are standing on** (addendum 20 §19a, from Ken: *I'm trying
 * to put a logo on the last page… if I add a page after and go on that, it's
 * adding the page on the page before for some reason*).
 *
 * Measured on his shape before a line was written: a book ending in two blank
 * pages, standing on the **last** of them and asking for a picture, put the
 * picture on the page **before** it and left the last one blank. `blankFor`
 * named the record and a record may carry several leaves, so every one of
 * them answered the same act.
 */
describe('a record with several leaves', () => {
  const ended = (leaves: number): ProjectFile => {
    let file = novel();
    file = addPart(file, 'plate', { title: 'BACKPAGE.png', inFront: false }).file;
    return setBlankPages(file, BOOK_END, leaves);
  };

  const blanks = (file: ProjectFile) => {
    const pages = laid(file);
    const rows = bookPageRows(pages.pages, bookBlocks(file));
    return { rows, blank: rows.filter((row) => row.blank && row.blankFor === BOOK_END) };
  };

  it('says which of them each page is', () => {
    const { blank } = blanks(ended(2));
    expect(blank).toHaveLength(2);
    expect(blank.map((row) => row.blankAt)).toEqual([0, 1]);
  });

  it('designs the one you are standing on, and not the one before it', () => {
    const file = ended(2);
    const { blank } = blanks(file);
    for (const [at, row] of blank.entries()) {
      const made = designAt(file, (rows) => rows.find((one) => one.sheet === row.sheet));
      expect(made.refusal).toBeNull();
      const after = blanks(made.file).rows;
      const mine = after.findIndex((one) => one.partId === made.partId);
      // Exactly as many blank pages stand in front of it as stood in front of
      // the leaf it was made from — which is the whole of the report.
      expect(after.slice(0, mine).filter((one) => one.blank && one.blankFor === BOOK_END)).toHaveLength(at);
      expect(after.slice(mine + 1).filter((one) => one.blank && one.blankFor === BOOK_END)).toHaveLength(1 - at);
    }
  });

  it('offers the index to the act, so a picture lands where it is asked for', () => {
    const file = ended(2);
    const pages = laid(file);
    const blocks = bookBlocks(file);
    const { blank } = blanks(file);
    for (const [at, row] of blank.entries()) {
      const offer = pictureOffer(pagePlace(pages.pages, blocks, row.sheet), blanks(file).rows, row.sheet, 'stories');
      expect(offer.takesLeaf).toBe(BOOK_END);
      expect(offer.takesLeafAt).toBe(at);
    }
  });

  it('takes the page rather than forcing a right-hand one', () => {
    /**
     * A dedication and an epigraph open on a recto because that is the front
     * matter's convention. A page made from a blank leaf must take **that**
     * page, or the cutter leaves a verso in front of it and the page arrives
     * one late — which is §19's own *14 pages became 16*, measured again
     * here and found to be this.
     */
    const file = ended(2);
    const { blank } = blanks(file);
    const made = designAt(file, (rows) => rows.find((one) => one.sheet === blank[1]!.sheet));
    const block = bookBlocks(made.file).find((one) => one.partId === made.partId)!;
    expect(block.starts).toBe('page');
  });
});

/**
 * **A picture on a page whose words are records** (§19a, from Ken: *on the
 * reader's extra page there needs to be the ability to add a picture*).
 */
describe('what a page prints, counted once', () => {
  it('reads a reader extra’s own records rather than its empty text', () => {
    /**
     * `partOwnBlocks` has read a glossary's, a bibliography's and a reader
     * extra's paragraphs off their **records** since §17a, with the comment
     * over it saying *the page and the panel cannot then disagree about what
     * it says*. The panel never asked: it counted `part.text`, which on those
     * three is empty whatever is on the page — so the control that cuts a
     * picture into the words could only ever refuse.
     */
    const made = addPart(novel(), 'reader_extra');
    const part = partsOf(made.file).find((one) => one.kind === 'reader_extra')!;
    expect(partParagraphs(part)).toHaveLength(0);

    const filled = updatePart(made.file, part.id, {
      about: {
        kind: 'also_by',
        titles: [
          { id: 'a', title: 'The Harbour', series: '' },
          { id: 'b', title: 'Low Water', series: '' },
        ],
      },
    } as never);
    const now = partsOf(filled).find((one) => one.id === part.id)!;
    expect(partParagraphs(now)).toEqual(['The Harbour', 'Low Water']);
  });

  it('is still a prose part’s own words where it has no records', () => {
    const made = addPart(novel(), 'afterword');
    const part = partsOf(made.file).find((one) => one.kind === 'afterword')!;
    const written = updatePart(made.file, part.id, { text: 'One.\n\nTwo.' });
    expect(partParagraphs(partsOf(written).find((one) => one.id === part.id)!)).toEqual(['One.', 'Two.']);
  });
});
