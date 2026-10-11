import { describe, expect, it } from 'vitest';
import {
  PART_INFO,
  addBeat,
  anchorOf,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookRows,
  bookSettingsOf,
  blankPagesAt,
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
    const made = designPage(setBlankPages(file, at, 1), { blank: true, blankFor: at } as never);
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
    const offer = designOffer({ blank: true, blankFor: at } as never);
    expect(offer.refusal).toBeNull();
    expect(offer.leafId).toBe(at);
    // **What it does, and no number** (§9al): the leaf becomes the page, and
    // what the book then does depends on the parity — driving it measured a
    // sentence promising *the book stays the length it is* taking 14 to 16.
    expect(offer.note).toMatch(/a picture, a few words, or both/);
  });

  it('refuses a page the book is keeping blank, and says where to look', () => {
    /**
     * A blank page is one of three things (§9i) and only the writer's own may
     * be designed: the leaf the cutter left before a recto is held by a rule
     * rather than by anybody's intention, and the back of a picture exists in
     * order to have nothing on it.
     */
    const cutters = designOffer({ blank: true, blankFor: null } as never);
    expect(cutters.refusal).toMatch(/Its own screen says why/);
    expect(designOffer({ blank: false, blankFor: null } as never).refusal).toMatch(/writing on this page/);
    expect(designOffer(null).refusal).not.toBeNull();
  });

  it('refuses the same things again, so the reading cannot be skipped', () => {
    // `trackRemoval`'s shape: a caller that did not read the offer gets the
    // same answer from the act.
    const file = novel();
    const out = designPage(file, { blank: true, blankFor: null } as never);
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
    const made = designPage(withLeaf, { blank: true, blankFor: at } as never);
    expect(made.refusal).toBeNull();
    expect(blankPagesAt(made.file, at)).toBe(0);
    // And the page is really in the book rather than merely recorded.
    expect(length(made.file)).toBeGreaterThan(0);
  });

  it('prints where the leaf stood, in the story', () => {
    const file = novel();
    const at = anchorElement(file);
    const made = designPage(setBlankPages(file, at, 1), { blank: true, blankFor: at } as never);
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
    const made = designPage(setBlankPages(file, front.id, 1), { blank: true, blankFor: front.id } as never);
    expect(bookRows(made.file).some((row) => row.id === made.partId)).toBe(true);
  });

  it('has a page of its own in the book’s pages', () => {
    const file = novel();
    const at = anchorElement(file);
    const made = designPage(setBlankPages(file, at, 1), { blank: true, blankFor: at } as never);
    const rows = bookPageRows(laid(made.file).pages, bookBlocks(made.file));
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
