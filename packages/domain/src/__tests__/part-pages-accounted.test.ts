import { describe, expect, it } from 'vitest';
import {
  blankReason,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pageRemoval,
  pagesUnder,
  partCarriesOwnWords,
  partsOf,
  removeBookPage,
  rowHasUnder,
  sayBlankReason,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **Every page accounted for, blank or not** (addendum 20 §17e, from Ken:
 * *I added the title page and said, leave the back of it blank, but it left an
 * additional page blank*; *all pages need to be accounted for blank or not and
 * blank pages need to be able to be added and removed easily and show up in
 * the outliner in the left*).
 *
 * The two halves are one report. A book that grew by two leaves could not be
 * asked where they had gone, because **a part claimed no pages**: the blank
 * verso in front of a page that opens on a right-hand one, and the back-blank
 * §17d puts behind the title page, belonged to no row and appeared nowhere in
 * the rail. And the second blank was a right-hand page, which with the first
 * made a wholly blank spread — the copyright page's `verso` force, which the
 * pagination gives it for nothing where it is right.
 */

const book = (): ProjectFile =>
  createProjectFile({ title: 'The Lamp and the Lighthouse', format: 'novel', author: 'M. Shank' });

const titleId = (file: ProjectFile) => partsOf(file).find((one) => one.kind === 'title_page')!.id;

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((one) => [one.id, one.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { laid, rows: bookPageRows(laid.pages, blocks) };
};

const sheetOf = (rows: ReturnType<typeof lay>['rows'], file: ProjectFile, kind: 'title_page' | 'copyright') => {
  const part = partsOf(file).find((one) => one.kind === kind)!;
  return rows.find((page) => page.partId === part.id && !page.blank)!.sheet;
};

describe('the back of the title page left blank', () => {
  it('never leaves two blanks facing each other', () => {
    /**
     * **The report, and what was actually wrong with it.** The book gains two
     * leaves either way — everything after the blank moves on a page, and the
     * contents page opens on a right-hand one, so a blank falls in front of
     * it. That is the pagination doing what it should. What was wrong is
     * *which* leaves: with the copyright page forced to a left-hand page, the
     * two blanks fell side by side and a reader met a spread with nothing on
     * it, which no book does by accident.
     */
    const asked = updatePart(book(), titleId(book()), { backBlank: true });
    const { rows } = lay(asked);
    const blanks = rows.filter((page) => page.blank).map((page) => page.sheet);
    expect(blanks.length).toBeGreaterThan(1);
    // A spread is a verso and the recto after it: an even sheet and its
    // successor. None of the blanks may pair off that way.
    for (const sheet of blanks) {
      if (sheet % 2 === 0) expect(blanks).not.toContain(sheet + 1);
    }
  });

  it('puts the copyright page on the leaf after the blank rather than skipping it', () => {
    const asked = updatePart(book(), titleId(book()), { backBlank: true });
    const { rows } = lay(asked);
    const title = sheetOf(rows, asked, 'title_page');
    expect(rows.find((page) => page.sheet === title + 1)!.blank).toBe(true);
    expect(sheetOf(rows, asked, 'copyright')).toBe(title + 2);
  });

  it('changes nothing about a book that has not asked for it', () => {
    // The copyright page is still the back of the title page, because a title
    // page is a right-hand leaf one page long and the page after it is a
    // left-hand one whether or not anything forces it.
    const plain = book();
    const { rows } = lay(plain);
    expect(sheetOf(rows, plain, 'copyright')).toBe(sheetOf(rows, plain, 'title_page') + 1);
  });
});

describe('every page is under a row', () => {
  const claimedSheets = (file: ProjectFile) => {
    const { rows } = lay(file);
    const under = pagesUnder(bookRows(file), rows);
    return { rows, claimed: [...under.values()].flat().map((page) => page.sheet) };
  };

  it('accounts for every leaf of the book, the cutter’s own included', () => {
    // The half title opens on a right-hand page and so does the title page,
    // which leaves a blank between them: the one page in the front matter
    // that had no row anywhere.
    const { rows, claimed } = claimedSheets(book());
    expect(new Set(claimed).size).toBe(rows.length);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it('accounts for the back-blank too', () => {
    const asked = updatePart(book(), titleId(book()), { backBlank: true });
    const { rows, claimed } = claimedSheets(asked);
    expect(new Set(claimed).size).toBe(rows.length);
  });

  it('gives a part its own page and the leaf its recto rule left in front of it', () => {
    const file = book();
    const { rows } = lay(file);
    const under = pagesUnder(bookRows(file), rows);
    const title = partsOf(file).find((one) => one.kind === 'title_page')!;
    const held = (under.get(title.id) ?? []).map((page) => page.sheet);
    const own = sheetOf(rows, file, 'title_page');
    expect(held).toContain(own);
    // The half title opens on a right-hand page and so does the title page,
    // so a blank stands between them: the leaf the title page's own rule put
    // there, which is what `blankReason` says of it.
    expect(held).toContain(own - 1);
    expect(rows.find((page) => page.sheet === own - 1)!.blank).toBe(true);
  });
});

describe('the × on the leaf the writer asked for', () => {
  /**
   * **The one leaf he had deliberately asked for was the one with no act**
   * (§17e). §9i wrote the back-blank branch for a picture, §17d gave a part
   * the same switch and §9r a chapter page, and neither reached it — so the
   * row refused, and the sentence it refused with named the recto rule, which
   * is the reason for a different leaf two pages away.
   */
  const asked = () => updatePart(book(), titleId(book()), { backBlank: true });

  it('reaches the switch that made it, rather than refusing', () => {
    const file = asked();
    const { rows } = lay(file);
    const title = sheetOf(rows, file, 'title_page');
    const what = pageRemoval(file, rows, title + 1);
    expect(what.act).toBe('Take this page away');
    expect(what.what).toBe('back');
    expect(what.id).toBe(titleId(file));
    expect(what.comfort).toMatch(/stops leaving its back blank/);
    // And pressing it really does put the book back where it was.
    const back = removeBookPage(file, rows.find((page) => page.sheet === title + 1)!, what);
    expect(partsOf(back).find((one) => one.kind === 'title_page')!.backBlank).toBe(false);
    expect(lay(back).rows).toHaveLength(lay(book()).rows.length);
  });

  it('says what it is the back of, rather than naming a picture that is not there', () => {
    const file = asked();
    const { rows } = lay(file);
    const title = sheetOf(rows, file, 'title_page');
    expect(blankReason(rows, title + 1)).toBe('page_back');
    expect(sayBlankReason('page_back')).toMatch(/leave its back blank/);
    // The picture's own reason is untouched, which is what keeps this a fourth
    // answer rather than a change to the third.
    expect(sayBlankReason('back')).toMatch(/back of the picture/);
  });

  it('still answers the cutter’s own leaf with a refusal rather than an act', () => {
    // §9i's rule stands: a leaf the cutter left is not the writer's to remove
    // here, and the sentence names the page to set instead.
    const file = asked();
    const { rows } = lay(file);
    const title = sheetOf(rows, file, 'title_page');
    expect(blankReason(rows, title - 1)).toBe('recto');
    expect(pageRemoval(file, rows, title - 1).act).toBeNull();
  });
});

describe('the fold on a part', () => {
  it('is there where the part holds more than the page its row already names', () => {
    const file = book();
    const { rows } = lay(file);
    const railed = bookRows(file);
    const under = pagesUnder(railed, rows);
    const title = partsOf(file).find((one) => one.kind === 'title_page')!;
    const row = railed.find((one) => one.id === title.id)!;
    expect((under.get(title.id) ?? []).length).toBeGreaterThan(1);
    expect(rowHasUnder(railed, under, row)).toBe(true);
  });

  it('is absent where the part is its one page, rather than opening onto what the row just said', () => {
    const file = book();
    const { rows } = lay(file);
    const railed = bookRows(file);
    const under = pagesUnder(railed, rows);
    const half = partsOf(file).find((one) => one.kind === 'half_title')!;
    const row = railed.find((one) => one.id === half.id)!;
    expect((under.get(half.id) ?? []).length).toBe(1);
    expect(rowHasUnder(railed, under, row)).toBe(false);
  });
});

describe('the words on a page of its own', () => {
  it('are the writer’s on a dedication and an epigraph', () => {
    expect(partCarriesOwnWords('dedication')).toBe(true);
    expect(partCarriesOwnWords('epigraph')).toBe(true);
  });

  it('are the book’s on a half title and a title page, and the record’s on a copyright page', () => {
    // Those three print something read from elsewhere, so a box here would be
    // a second answer rather than the only one.
    expect(partCarriesOwnWords('half_title')).toBe(false);
    expect(partCarriesOwnWords('title_page')).toBe(false);
    expect(partCarriesOwnWords('copyright')).toBe(false);
  });

  it('are not asked of a page that flows, which has no block of words to set', () => {
    expect(partCarriesOwnWords('contents')).toBe(false);
    expect(partCarriesOwnWords('foreword')).toBe(false);
  });
});
