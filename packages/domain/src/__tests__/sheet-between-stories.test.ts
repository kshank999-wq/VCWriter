import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  blankReason,
  createProjectFile,
  geometryOf,
  layPages,
  pageRemoval,
  pagePlace,
  pictureOffer,
  removeBookPage,
  sayBlankReason,
  setBookSettings,
  setSheetBefore,
  SHEET,
  updateBeat,
  type ProjectFile,
  type ProjectFormat,
} from '../index.js';

/**
 * **A full blank sheet between one whole work and the next** (addendum 22 §9,
 * from Ken: *between stories, there needs to be a full blank sheet*).
 *
 * What he was looking at: a collection where one story ran into the next with
 * nothing between them at all, or with the single empty verso the recto rule
 * leaves — which is a **gap** and not a separation, the previous story being
 * printed on its back. A reader turning that page has not been told anything
 * ended.
 *
 * The rule it has to live with is §9ad's: **a sheet is two pages**, and an
 * even number cannot change which side anything after it falls on. So every
 * story goes on opening exactly where the recto rule already put it, and what
 * the reader gains is a spread with nothing on either page.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const head = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'heading' as const,
  text,
  characterId: null,
  attributes: {},
});

/** Ken's own shape: three stories, each divided into chapters by numerals. */
const book = (format: ProjectFormat = 'short_story', titles = ['The Harbour', 'In For A Pound', 'Falling']): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format, author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  for (const title of titles) {
    const ids: string[] = [];
    for (const chapter of ['I.', 'II.']) {
      const made = addUnit(file, { trackId: track, title: chapter });
      file = made.file;
      ids.push(made.unit.id as string);
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title} ${chapter}` });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: {
          elements: [head(chapter), ...[1, 2, 3].map((n) => para(`${title} ${chapter} para ${n}. ${'word '.repeat(70)}`))],
        } as never,
      });
    }
    file = addMarker(file, { kind: format === 'series' ? 'episode' : 'chapter', unitId: ids[0] as never, title }).file;
  }
  return addPart(file, 'appendix', { title: 'Appendix' }).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/**
 * Where each story opens, by sheet, so a change of side would show.
 *
 * A story opens **twice** on a collection — its own page, then its first
 * numeral (addendum 22 §6) — so this is the first page of each, by marker.
 */
const openings = (file: ProjectFile): number[] => {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const row of lay(file).rows) {
    if (row.says !== 'Chapter opens' || !row.markerId || seen.has(row.markerId)) continue;
    seen.add(row.markerId);
    out.push(row.sheet);
  }
  return out;
};

describe('the sheet between one story and the next', () => {
  it('stands between every pair of stories and in front of none of the first', () => {
    const rows = lay(book()).rows;
    const between = rows.filter((row) => row.blankBetween !== null);
    // Three stories, two gaps, two pages each.
    expect(between).toHaveLength(2 * SHEET);
    // Nothing before the first story carries one: the front matter is already
    // in front of it, and a separation is between two things.
    const firstStory = rows.find((row) => row.markerId !== null && row.says === 'Chapter opens')!;
    expect(between.every((row) => row.sheet > firstStory.sheet)).toBe(true);
  });

  it('is both sides of one leaf, which is what makes it a sheet rather than a gap', () => {
    const rows = lay(book()).rows;
    const sheets = rows.filter((row) => row.blankBetween !== null).map((row) => row.sheet);
    // Consecutive pairs, so the reader turns a page and meets nothing again.
    for (let at = 0; at < sheets.length; at += 2) {
      expect(sheets[at + 1]).toBe((sheets[at] as number) + 1);
    }
    // And both of them really print nothing.
    for (const sheet of sheets) expect(rows.find((row) => row.sheet === sheet)!.blank).toBe(true);
  });

  /**
   * **The half that had to be measured** (§9ad). Two pages is an even number,
   * so the parity of everything after it is untouched — which is the only
   * reason this could be made the default without moving a single opening.
   */
  it('changes which side nothing falls on, and costs exactly two pages a gap', () => {
    const file = book();
    const off = setBookSettings(file, { sheetBetweenWorks: false });
    const before = openings(off);
    const after = openings(file);
    expect(before).toHaveLength(3);
    // Each story moves on by the sheets in front of it and by nothing else.
    expect(after).toEqual(before.map((sheet, at) => sheet + at * SHEET));
    // The side of the paper is what a sheet may never change.
    expect(after.map((sheet) => sheet % 2)).toEqual(before.map((sheet) => sheet % 2));
    expect(lay(file).laid.pages.length - lay(off).laid.pages.length).toBe(2 * SHEET);
  });

  it('is absent on a novel, whose chapters are divisions of one work', () => {
    let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
    const track = file.tracks[0]!.id;
    for (const title of ['One', 'Two']) {
      const made = addUnit(file, { trackId: track, title });
      file = made.file;
      const beat = addBeat(file, { unitId: made.unit.id, title });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: { elements: [para(`${title}. ${'word '.repeat(90)}`)] } as never,
      });
      file = addMarker(file, { kind: 'chapter', unitId: made.unit.id as never, title }).file;
    }
    expect(lay(file).rows.some((row) => row.blankBetween !== null)).toBe(false);
  });

  it('is there on a series too, an episode being a whole work as well', () => {
    expect(lay(book('series')).rows.some((row) => row.blankBetween !== null)).toBe(true);
  });

  it('says it is the book leaving one, in the format’s own word', () => {
    const { rows } = lay(book());
    const sheet = rows.find((row) => row.blankBetween !== null)!.sheet;
    expect(blankReason(rows, sheet)).toBe('between');
    expect(sayBlankReason('between', 'the leaf', 'stories')).toContain('between stories');
    expect(sayBlankReason('between', 'the leaf', 'episodes')).toContain('between episodes');
    // The default never lies on any format that can reach this reason.
    expect(sayBlankReason('between')).toContain('between works');
  });

  /**
   * **It is not the recto gap, and that is the one it must be told from**
   * (§9w's own finding): they fall in the same place and only one of them is
   * there because somebody asked for a separation.
   */
  it('is not read as the leaf the recto rule leaves', () => {
    const { rows } = lay(book());
    for (const row of rows.filter((one) => one.blankBetween !== null)) {
      expect(blankReason(rows, row.sheet)).not.toBe('recto');
    }
  });
});

describe('getting rid of one', () => {
  it('has a × on both of its pages, naming what the press does', () => {
    const file = book();
    const { rows } = lay(file);
    for (const row of rows.filter((one) => one.blankBetween !== null)) {
      const removal = pageRemoval(file, rows, row.sheet);
      expect(removal.act).toBe('Take this page away');
      expect(removal.what).toBe('between');
      expect(removal.comfort).toContain('both its pages');
      // **This story and never the book**: a × on one page that reached a
      // book-wide setting would act on something nobody is looking at.
      expect(removal.comfort).toContain('every other story keeps its sheet');
    }
  });

  it('takes this story’s separation and leaves every other one standing', () => {
    const file = book();
    const { rows } = lay(file);
    const row = rows.find((one) => one.blankBetween !== null)!;
    const after = removeBookPage(file, row, pageRemoval(file, rows, row.sheet));
    expect(lay(after).rows.filter((one) => one.blankBetween !== null)).toHaveLength(SHEET);
    // Both pages went, and the book is two shorter rather than one.
    expect(lay(file).laid.pages.length - lay(after).laid.pages.length).toBe(SHEET);
  });

  /**
   * **Null means the book's** (`opensRecto`'s shape), so a work set on its own
   * keeps its answer when the book changes its mind, and one that was never
   * touched follows.
   */
  it('keeps a story’s own answer when the book’s changes', () => {
    const file = book();
    const marker = file.markers[1]!.id as string;
    const only = setSheetBefore(setBookSettings(file, { sheetBetweenWorks: false }), marker, true);
    expect(lay(only).rows.filter((one) => one.blankBetween !== null)).toHaveLength(SHEET);
    const none = setSheetBefore(file, marker, false);
    expect(lay(none).rows.filter((one) => one.blankBetween !== null)).toHaveLength(SHEET);
  });

  it('refuses a picture on it, and names the × rather than a setting', () => {
    const file = book();
    const { blocks, laid, rows } = lay(file);
    const row = rows.find((one) => one.blankBetween !== null)!;
    const offer = pictureOffer(pagePlace(laid.pages, blocks, row.sheet), rows, row.sheet, 'stories');
    expect(offer.spot).toBeNull();
    expect(offer.refusal).toContain('between stories');
    expect(offer.refusal).toContain('The × on its row');
  });
});
