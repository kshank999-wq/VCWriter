import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  beginStory,
  blankHold,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  chapterPageSchema,
  createProjectFile,
  designOffer,
  designPage,
  geometryOf,
  layPages,
  pagePlace,
  pictureOffer,
  partsOf,
  setBlankPages,
  setChapterBlank,
  tracksInOrder,
  unitsInStoryOrder,
  updateBeat,
  type BookPageRow,
  type ProjectFile,
} from '../index.js';

/**
 * **Every blank page is a page you can design** (addendum 20 §9aq, from Ken:
 * *when I added the picture this time, I saw where it said design this page.
 * And I added another blank page. And it wouldn't have that same function…
 * But any blank page, I should be able to design the page. I didn't even get
 * to look at that function. And now I can't find it*).
 *
 * **Measured before a line was written**: one leaf asked for in front of a
 * page the book holds on a right-hand side produces **two** blank pages — the
 * writer's own and the one the cutter then has to leave — and only the first
 * carried *Design this page…*, the second drawing no control and no sentence
 * at all. Two pages side by side, identical to look at, one with an act and
 * one with nothing. That is the report word for word, and §9al's rule answers
 * it: **where a rule holds the page, the act frees the rule.**
 *
 * What this pins is **the walk rather than the report** (§9x's shape, and for
 * its reason): every blank page the room draws must carry the act, so a leaf
 * of a kind nobody has thought of yet fails here rather than shipping with a
 * writer unable to find a function they have already used.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as never,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A collection of three stories with back matter — Ken's own shape. */
const collection = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'K. Shank' });
  const track = tracksInOrder(file)[0]!;
  const first = unitsInStoryOrder(file)[0]!;
  file = addMarker(file, { unitId: first.id, title: 'The Harbour', kind: 'chapter' }).file;
  const opening = addBeat(file, { unitId: first.id, title: 'One' });
  file = updateBeat(opening.file, opening.beat.id, {
    manuscript: { elements: [para('Rain. '.repeat(200))] } as never,
  });
  for (const name of ['In For A Pound', 'Falling']) {
    const started = beginStory(file, { title: name, trackId: track.id });
    file = started.file;
    const beat = addBeat(file, { unitId: started.unitId, title: name });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [para(`${name}. `.repeat(200))] } as never,
    });
  }
  return addPart(file, 'about_the_author', { text: 'She writes at night.' }).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const settings = bookSettingsOf(file);
  const measured = new Map(blocks.map((one) => [one.id, one.kind === 'paragraph' ? 24 : 1]));
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

const pages = (file: ProjectFile): number => lay(file).laid.pages.length;

const offerOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  // `pagePlace` is what the room hands over, and on a blank leaf its walk
  // forward is where the anchor comes from (§9aa).
  return designOffer(
    pagePlace(laid.pages, blocks, sheet),
    rows,
    sheet,
    'stories',
  );
};

describe('every blank page the room draws', () => {
  it('carries the act, whoever is keeping it blank', () => {
    /**
     * The walk. A collection has all four kinds of blank page at once — the
     * verso in front of an opening, the sheets between the stories, the one
     * after the last of them, and whatever the writer put in — so this is the
     * whole set in one book rather than four fixtures.
     */
    let file = collection();
    const contents = partsOf(file).find((one) => one.kind === 'about_the_author')!;
    file = setBlankPages(file, contents.id, 1);
    const { rows } = lay(file);
    const blanks = rows.filter((row) => row.blank);
    expect(blanks.length).toBeGreaterThan(4);
    const kinds = new Set(blanks.map((row) => blankHold(rows, row.sheet)?.why));
    // All four reasons really are in this book, or the walk proves nothing.
    expect(kinds).toContain('recto');
    expect(kinds).toContain('between');
    expect(kinds).toContain('ending');
    expect(kinds).toContain('writer');
    for (const row of blanks) {
      const offer = offerOn(file, row.sheet);
      expect(offer.refusal, `page ${row.counted} (${blankHold(rows, row.sheet)?.why})`).toBeNull();
      expect(offer.beforeId, `page ${row.counted}`).not.toBeNull();
      expect(offer.note.length, `page ${row.counted}`).toBeGreaterThan(0);
    }
  });

  it('is designed on every one of them, and really lands on that page', () => {
    let file = collection();
    const { rows } = lay(file);
    for (const row of rows.filter((one) => one.blank)) {
      const { blocks, laid, rows: now } = lay(file);
      const made = designPage(
        file,
        pagePlace(laid.pages, blocks, row.sheet),
        now,
        row.sheet,
        'stories',
      );
      expect(made.refusal, `page ${row.counted}`).toBeNull();
      const after = lay(made.file).rows;
      const mine = after.find((one) => one.partId === made.partId);
      expect(mine, `page ${row.counted} has no page of its own`).toBeDefined();
    }
  });
});

describe('a blank leaf in front of a part', () => {
  /**
   * **The other half of the report** (§9aq, from Ken: *I didn't even get to
   * look at that function. And now I can't find it*). The blank block in front
   * of a part carries that part's id so the rail can fold the row under it,
   * and `onPage` read it as *this page is the part's own page* — so the room's
   * `openPage`, which short-circuits on that field, sent a writer who
   * double-clicked their own blank page to the screen that sets the **contents
   * page**, where nothing says anything about the leaf.
   */
  const withLeaf = (): { file: ProjectFile; partId: string } => {
    const made = addPart(collection(), 'contents');
    const part = partsOf(made.file).find((one) => one.kind === 'contents')!;
    return { file: setBlankPages(made.file, part.id, 1), partId: part.id };
  };

  it('is not the part’s own page', () => {
    const { file, partId } = withLeaf();
    const { blocks, laid, rows } = lay(file);
    const leaf = rows.find((row) => row.blankFor === partId)!;
    // The rail still files the row under that part — that is what the id on
    // the block is for.
    expect(leaf.partId).toBe(partId);
    // And the place does not, because nothing of the part prints here.
    expect(pagePlace(laid.pages, blocks, leaf.sheet).partId).toBeNull();
  });

  it('answers a picture with a page of its own rather than with the part’s', () => {
    /**
     * §9aa's own comment says this in so many words — *a leaf in the front
     * matter given one would put it on the page ahead rather than on itself* —
     * and guarded only the walk forward with it.
     */
    const { file, partId } = withLeaf();
    const { blocks, laid, rows } = lay(file);
    const leaf = rows.find((row) => row.blankFor === partId)!;
    const offer = pictureOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet, 'stories');
    expect(offer.refusal).toBeNull();
    expect(offer.ownPageOnly).toBe(true);
    expect(offer.newPageBefore).toBe(partId);
    expect(offer.takesLeaf).toBe(partId);
  });

  it('carries the act, which is what could not be found', () => {
    const { file, partId } = withLeaf();
    const { rows } = lay(file);
    const leaf = rows.find((row) => row.blankFor === partId)!;
    const offer = offerOn(file, leaf.sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.leafId).toBe(partId);
    expect(offer.beforeId).toBe(partId);
  });
});

describe('what freeing each rule costs, measured', () => {
  it('stands in the gap the book leaves in front of an opening, and the book does not grow', () => {
    /**
     * Nothing is turned off here: a designed page is a block that takes the
     * next page there is, and the verso in front of an opening **is** the next
     * page there is — §9ac's *the first blank asked for in that gap takes its
     * place and becomes the writer's*, said of a page rather than of a leaf.
     */
    const file = collection();
    const { rows } = lay(file);
    const gap = rows.find((row) => row.blank && blankHold(rows, row.sheet)?.why === 'recto')!;
    const before = pages(file);
    const offer = offerOn(file, gap.sheet);
    expect(offer.frees).toBeNull();
    expect(offer.note).toMatch(/does not grow/);
    const made = designPage(
      file,
      pagePlace(lay(file).laid.pages, lay(file).blocks, gap.sheet),
      rows,
      gap.sheet,
      'stories',
    );
    expect(pages(made.file)).toBe(before);
  });

  it('is printed on a back, with the switch going and no other page moving', () => {
    let file = collection();
    const marker = file.markers[1]!.id as string;
    file = setChapterBlank(file, marker, 'back', true);
    const { rows } = lay(file);
    const back = rows.find((row) => row.blank && blankHold(rows, row.sheet)?.frees === 'back')!;
    const before = pages(file);
    const offer = offerOn(file, back.sheet);
    expect(offer.frees).toEqual({ id: marker, rule: 'back' });
    const made = designPage(
      file,
      pagePlace(lay(file).laid.pages, lay(file).blocks, back.sheet),
      rows,
      back.sheet,
      'stories',
    );
    // The switch went with the press, so nothing is left holding a leaf there.
    expect(chapterPageSchema.parse(made.file.markers.find((one) => (one.id as string) === marker)?.page ?? {}).backBlank).toBe(
      false,
    );
    expect(pages(made.file)).toBe(before);
  });

  it('takes the separating sheet away and stands in its place', () => {
    const file = collection();
    const { rows } = lay(file);
    const sheet = rows.find((row) => row.blank && blankHold(rows, row.sheet)?.frees === 'sheet')!;
    const offer = offerOn(file, sheet.sheet);
    expect(offer.frees).toEqual({ id: sheet.blankBetween, rule: 'sheet' });
    expect(offer.note).toContain('That sheet goes');
    const made = designPage(
      file,
      pagePlace(lay(file).laid.pages, lay(file).blocks, sheet.sheet),
      rows,
      sheet.sheet,
      'stories',
    );
    const after = lay(made.file).rows;
    // No separation is left between those two works.
    expect(after.some((row) => row.blankBetween === sheet.blankBetween)).toBe(false);
  });

  it('takes the sheet after the last of them away, which is two pages for one', () => {
    const file = collection();
    const { rows } = lay(file);
    const ending = rows.find((row) => row.blank && blankHold(rows, row.sheet)?.frees === 'ending')!;
    const before = pages(file);
    const offer = offerOn(file, ending.sheet);
    expect(offer.frees).toEqual({ id: null, rule: 'ending' });
    const made = designPage(
      file,
      pagePlace(lay(file).laid.pages, lay(file).blocks, ending.sheet),
      rows,
      ending.sheet,
      'stories',
    );
    // Measured: two pages out and one back in.
    expect(pages(made.file)).toBe(before - 1);
    expect(made.file.settings.book?.sheetAfterWorks).toBe(false);
  });

  it('stands after the writer’s own leaves on the same record, never in front of them', () => {
    /**
     * The gap the cutter leaves falls immediately **before** the opening, so
     * it stands after any leaf the writer put in front of it. Anchoring at
     * nought would have put the designed page in front of their own blank
     * pages — which from the writer's chair is the page landing somewhere
     * they did not point at (§19a's own report, one control over).
     */
    let file = addPart(collection(), 'contents').file;
    const part = partsOf(file).find((one) => one.kind === 'contents')!;
    file = setBlankPages(file, part.id, 1);
    const { rows } = lay(file);
    const mine = rows.find((row) => row.blankFor === part.id)!;
    /**
     * **This is Ken's own sequence**: one leaf asked for in front of a page
     * the book holds on a right-hand side, and the gap the cutter then has to
     * leave standing immediately behind it. The contents page is the plainest
     * case of it, so the pair is really there to assert about — a test whose
     * case the parity never produced would assert nothing at all.
     */
    const gap = rows.find((row) => row.sheet > mine.sheet && row.blank && blankHold(rows, row.sheet)?.why === 'recto');
    expect(gap, 'the pair this is about is not in the fixture').toBeDefined();
    if (!gap) return;
    const offer = offerOn(file, gap.sheet);
    expect(offer.beforeId).toBe(part.id);
    expect(offer.leafAt).toBe(1);
    const made = designPage(
      file,
      pagePlace(lay(file).laid.pages, lay(file).blocks, gap.sheet),
      rows,
      gap.sheet,
      'stories',
    );
    const after: readonly BookPageRow[] = lay(made.file).rows;
    const at = after.findIndex((one) => one.partId === made.partId);
    // The writer's own leaf is still in front of it.
    expect(after.slice(0, at).some((one) => one.blankFor === part.id)).toBe(true);
  });
});
