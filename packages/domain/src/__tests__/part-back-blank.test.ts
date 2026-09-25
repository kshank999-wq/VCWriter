import { describe, expect, it } from 'vitest';
import {
  bookBlocks,
  createProjectFile,
  partTakesBlankBack,
  partsOf,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **Leaving the back of a designed page blank** (addendum 20 §17d, from Ken:
 * *on the title page, there needs to be an option to leave the back of the
 * page blank, because it could be a printed page on different paper*).
 *
 * It is §9i's mechanism asked of a **part** rather than of an element, and
 * what these pin is the rule §9j had to correct once already: **the back of a
 * leaf is its other side**, so the page takes a recto and the blank that
 * follows really is behind it.
 */

const book = (): ProjectFile =>
  createProjectFile({ title: 'The Lamp and the Lighthouse', format: 'novel', author: 'M. Shank' });

const titleId = (file: ProjectFile) => partsOf(file).find((one) => one.kind === 'title_page')!.id;

const blocksOf = (file: ProjectFile) => bookBlocks(file);

describe('a page that leaves its back blank', () => {
  it('changes nothing until it is asked for', () => {
    // The default is false, so every book made before this prints exactly
    // what it printed — which the whole suite passing unedited is the proof
    // of, and this states.
    const before = blocksOf(book());
    expect(before.some((one) => one.kind === 'blank')).toBe(false);
  });

  it('takes a recto and puts the blank behind it', () => {
    const start = book();
    const file = updatePart(start, titleId(start), { backBlank: true });
    const blocks = blocksOf(file);
    const at = blocks.findIndex((one) => one.kind === 'title_page');
    expect(at).toBeGreaterThanOrEqual(0);
    // The leaf it is on must be a recto, or the blank after it would be the
    // next page along rather than its own back (§9j, Ken's own correction).
    expect(blocks[at]!.starts).toBe('recto');
    const back = blocks[at + 1]!;
    expect(back.kind).toBe('blank');
    expect(back.partId).toBe(titleId(file));
  });

  it('prints no number on the blank, and still counts it', () => {
    const blocks = blocksOf(updatePart(book(), titleId(book()), { backBlank: true }));
    const back = blocks.find((one) => one.kind === 'blank')!;
    // Counting is what the cutter does to everything (§9i); only `shows`
    // consults the folio, so the leaf is page N and prints nothing.
    expect(back.folio).toBe(false);
    expect(back.display).toBe(true);
    expect(back.starts).toBe('page');
  });

  it('moves the copyright page off the title page’s reverse', () => {
    // Which is the whole of what Ken asked for: a title page on heavier or
    // coloured stock has nothing printed on its back.
    const plain = blocksOf(book());
    const plainAt = plain.findIndex((one) => one.kind === 'title_page');
    expect(plain[plainAt + 1]!.kind).toBe('copyright');

    const start = book();
    const asked = blocksOf(updatePart(start, titleId(start), { backBlank: true }));
    const at = asked.findIndex((one) => one.kind === 'title_page');
    expect(asked[at + 1]!.kind).toBe('blank');
    expect(asked[at + 2]!.kind).toBe('copyright');
  });

  it('inserts one blank block, and the copyright page’s verso does the rest', () => {
    // **Worth pinning, because it looks like a fault and is not.** A
    // copyright page is a verso by convention, so blanking the title page's
    // back sends it to the *next left-hand page* — two leaves on, with a
    // second blank falling out of the pagination rather than out of here.
    // One block is added; the screen says *the next left-hand page* rather
    // than *the next leaf* because of it.
    const start = book();
    const asked = blocksOf(updatePart(start, titleId(start), { backBlank: true }));
    expect(asked.filter((one) => one.kind === 'blank')).toHaveLength(1);
    expect(asked.find((one) => one.kind === 'copyright')!.starts).toBe('verso');
  });
});

describe('which pages may be asked', () => {
  it('is every page that is a leaf of its own', () => {
    for (const kind of ['title_page', 'half_title', 'dedication', 'epigraph', 'copyright'] as const) {
      expect(partTakesBlankBack(kind)).toBe(true);
    }
  });

  it('is not a page that flows', () => {
    // A contents page and an index run to as many pages as they need, so
    // there is no single back to leave — `partPlacement`'s own predicate,
    // rather than a second list of kinds.
    expect(partTakesBlankBack('contents')).toBe(false);
    expect(partTakesBlankBack('index')).toBe(false);
  });

  it('ignores the flag on a page that flows rather than obeying it half way', () => {
    const contents = partsOf(book()).find((one) => one.kind === 'contents')!;
    const blocks = blocksOf(updatePart(book(), contents.id, { backBlank: true }));
    expect(blocks.some((one) => one.kind === 'blank')).toBe(false);
  });
});
