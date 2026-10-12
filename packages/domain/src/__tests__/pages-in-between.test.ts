import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  blankOffer,
  blankPagesAt,
  BOOK_END,
  moveBlankPage,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  divisionRemoval,
  divisionStart,
  geometryOf,
  holdsWholeWorks,
  layPages,
  pagePlace,
  designOffer,
  pictureOffer,
  removeDivision,
  setBlankPages,
  setBookSettings,
  setChapterRecto,
  SHEET,
  sideOf,
  storiesOf,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **The pages in between** (addendum 20 §9ac, from Ken in one message about
 * one afternoon):
 *
 * > So in the layout screen, at the end of the chapter, I wanted to put the
 * > final picture and have a blank page… Then I wanted to put the title page
 * > for the next story. When I did that, I tried to add a page and then it
 * > added it on the wrong page, on the facing page of the new story. It erased
 * > the in-between page… But then when I flipped it, I'm now at the beginning
 * > of another story, but there's no pages in between and no way to put pages
 * > in between. It also merged story two and three together into one story for
 * > some reason… It shouldn't merge these stories ever. When you add a blank
 * > page, it should just shift everything down. So it's adding a front and
 * > back page… It's not just adding one side or the other. And you should be
 * > able to just put as many pages in between as you want. Then you can be
 * > able to turn a blank page into a chapter page with a blank back or not.
 *
 * **Both halves were measured before a line was written**, on a faithful
 * collection of three stories of three chapters each, and both of his readings
 * are the same rule: asking for one blank leaf in front of a story that opens
 * on a right-hand page grew the book by **two** where the text happened to end
 * on a verso and by **nothing** where the cutter had already left the gap. The
 * same press, two different results, and which one a writer got was decided by
 * where the words fell — *a front and back page* and *it erased the in-between
 * page* said of one fault from either side of it. Measured over fifteen
 * combinations of section length: two pages in five of them, none in ten.
 *
 * And the ×, which is how he reached it: on a story's own opening page
 * `pageRemoval` answered *the break goes and the words stay*, so the press
 * that was meant to take a page away took a **story** away, its chapters
 * joining the story before it.
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

/**
 * Ken's book, with the length of a section a parameter: the fault he reported
 * is parity, so the fixture has to be able to land a story's opening on either
 * side of the sheet.
 */
const collection = (paragraphs: number): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'K. Shank' });
  const track = file.tracks[0]!.id;
  const story = (title: string) => {
    const ids: string[] = [];
    for (const chapter of ['I.', 'II.', 'III.']) {
      const made = addUnit(file, { trackId: track, title: chapter });
      file = made.file;
      ids.push(made.unit.id as string);
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title} ${chapter}` });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: {
          elements: [
            head(chapter),
            ...Array.from({ length: paragraphs }, (_, n) => para(`${title} ${chapter} ${n}. ${'word '.repeat(80)}`)),
          ],
        } as never,
      });
    }
    file = addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title }).file;
  };
  story('In For A Pound');
  story('Simple Pleasures');
  story('Falling');
  return addPart(file, 'contents', {}).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/**
 * **The last page the story's own words land on** (§9ao). It used to be the
 * last row with no `partId`, which the sheet ending the story made wrong: that
 * answer is now a blank page the book put there, and a test about where a
 * writer's words end has to mean the words.
 */
const lastWords = (rows: ReturnType<typeof lay>['rows']) =>
  rows.filter((one) => one.partId === null && !one.blank).at(-1)!;

/** The third story's own opening page, which is the gap he was working in. */
const thirdOpens = (file: ProjectFile) => {
  const { blocks, laid, rows } = lay(file);
  const third = storiesOf(file)[2]!;
  const row = rows.find((one) => one.markerId === (third.placed.marker.id as string) && one.says === 'Chapter opens')!;
  return { blocks, laid, rows, row, place: pagePlace(laid.pages, blocks, row.sheet), marker: third.placed.marker.id as string };
};

/**
 * **The offer on a page, with the page after it** (§9an). *After this page*
 * is *in front of the next one*, so the reading takes both places — and the
 * helper exists so no assertion here can forget the second and quietly
 * prove that side is absent.
 */
const offerOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  return blankOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet, pagePlace(laid.pages, blocks, sheet + 1));
};

describe('a blank page is a sheet', () => {
  /**
   * **Both parities, one answer** (addendum 20 §9ad, from Ken: *I think the
   * problem is, when you enter a blank page, it's entering a blank half page…
   * if you insert a blank page, it's blank on front and back, like a
   * separating page*).
   *
   * §9ac read the same sentence as a complaint about a press that sometimes
   * cost two pages and spent its design making one leaf one page, standing the
   * recto rule down to do it. It was a **specification**: a reader holds a
   * sheet rather than a side. Two pages is also what makes the press
   * predictable, which is what §9ac was reaching for — an even number cannot
   * change which side anything after it is on — so the book's length, the
   * opening's page and the side it opens on are all answerable, which they
   * were not before. Every one of these assertions spelled the half-leaf out
   * and is **rewritten rather than worked around**.
   */
  for (const paragraphs of [2, 3, 4, 5, 6]) {
    it(`puts in two pages and moves nothing across the spine (${paragraphs} paragraphs a section)`, () => {
      const file = collection(paragraphs);
      const { marker } = thirdOpens(file);
      const opensAt = (one: ProjectFile) => thirdOpens(one).row.sheet;
      const at = opensAt(file);
      const pages = lay(file).rows.length;
      for (const want of [1, 2, 3]) {
        const asked = setBlankPages(file, marker, want * SHEET);
        expect(lay(asked).rows.filter((row) => row.blankFor === marker)).toHaveLength(want * 2);
        expect(lay(asked).rows.length).toBe(pages + want * 2);
        expect(opensAt(asked)).toBe(at + want * 2);
        // The story still opens on the side of the paper it opened on.
        expect(opensAt(asked) % 2).toBe(at % 2);
      }
    });
  }

  /**
   * **The unit is a page and the choice is a side** (§9an). The sheet is
   * still what two of them make, and the note is where that is said — which
   * is what lets one press be one page without the parity being a surprise.
   */
  it('offers a page on either side, and says what two of them make', () => {
    const file = collection(5);
    // A page the book does not hold on a side, so the note is the ordinary
    // one rather than the recto rule's (which the §9ae test below pins).
    const { rows } = lay(file);
    const row = rows.find(
      (one) => one.says === 'Chapter opens' && one.sheet > 1 && !rows.some((before) => before.sheet === one.sheet - 1 && before.blank),
    )!;
    const offer = offerOn(file, row.sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.before.act).toBe('A blank page before this one');
    expect(offer.after.act).toBe('A blank page after this one');
    expect(offer.note).toMatch(/swap sides with it/);
    expect(offer.note).toMatch(/Put two in and nothing moves/);
  });

  it('asks for another from the leaf itself, which is where a writer stands', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const asked = setBlankPages(file, marker, SHEET);
    const leaf = lay(asked).rows.find((one) => one.blankFor === marker)!;
    const offer = offerOn(asked, leaf.sheet);
    expect(offer.before.act).toBe('A blank page before this one');
    expect(offer.before.spot).toBe(marker);
    // **Pages rather than sheets** (§9an): one number, said in the unit the
    // two presses add to and the × takes from.
    expect(offer.pages).toBe(SHEET);
    expect(offer.fewer).toBe('Take one away');
  });

  it('leaves the chapter’s own recto rule exactly as it found it', () => {
    /**
     * §9ac stood the rule down so that one leaf could be one page; §9ad takes
     * that back, two pages being unable to change a side. The opening's
     * `starts` is therefore the book's answer whether or not sheets stand in
     * front of it, which is what makes the arithmetic above hold.
     */
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const plain = bookBlocks(file).find((block) => block.id === marker)!;
    const asked = bookBlocks(setBlankPages(file, marker, 2 * SHEET)).find((block) => block.id === marker)!;
    expect(plain.starts).toBe('recto');
    expect(asked.starts).toBe('recto');
  });

  it('refuses past the ceiling, saying how many a place takes', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const full = setBlankPages(file, marker, 99);
    const leaf = lay(full).rows.find((one) => one.blankFor === marker)!;
    const offer = offerOn(full, leaf.sheet);
    expect(offer.before.act).toBeNull();
    expect(offer.refusal).toMatch(/as many as one place takes/);
    expect(offer.refusal).toMatch(/blank pages/);
    expect(offer.fewer).not.toBeNull();
  });

  it('reads the older spelling as one sheet, so no book moves', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const older = {
      ...file,
      markers: file.markers.map((one) =>
        (one.id as string) === marker ? { ...one, page: { ...(one.page ?? {}), blankBefore: true } } : one,
      ),
    } as ProjectFile;
    expect(lay(older).rows.filter((row) => row.blankFor === marker)).toHaveLength(2);
  });
});

describe('a story is never run together with the one before it', () => {
  it('is the format’s question and nothing else’s', () => {
    expect(holdsWholeWorks('short_story')).toBe(true);
    expect(holdsWholeWorks('series')).toBe(true);
    expect(holdsWholeWorks('novel')).toBe(false);
    expect(holdsWholeWorks('instructional')).toBe(false);
    expect(holdsWholeWorks('screenplay')).toBe(false);
  });

  it('refuses the reading and the act alike', () => {
    const file = collection(4);
    const third = storiesOf(file)[2]!;
    const reading = divisionRemoval(file, third.placed.marker.id);
    expect(reading.refusal).toContain('never run together with the one before');
    expect(reading.comfort).toBe('');
    const after = removeDivision(file, third.placed.marker.id);
    expect(storiesOf(after).map((story) => story.placed.marker.title)).toEqual([
      'In For A Pound',
      'Simple Pleasures',
      'Falling',
    ]);
  });
});

describe('a blank page can become a chapter page', () => {
  /**
   * **What makes a leaf into a chapter page is a break started on the section
   * it stands in front of** (§9ac, from Ken: *then you can be able to turn a
   * blank page into a chapter page with a blank back or not*).
   *
   * §9ab put that act on the Add menu and read the **row's** `opensUnitId`,
   * which on a leaf is nothing at all — so the one page a writer is most
   * likely to be standing on when they want a story to begin there could not
   * ask for it. §9aa's walk forward answers the same question of the place.
   */
  it('answers with the section the leaf stands in front of', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    // A leaf of the writer's own, standing in front of the story's opening.
    const asked = setBlankPages(file, marker, SHEET);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((one) => one.blankFor === marker)!;
    const place = pagePlace(laid.pages, blocks, leaf.sheet);
    // The row itself says nothing: no section opens on a blank page.
    expect(leaf.opensUnitId).toBeNull();
    expect(place.opensUnitId).not.toBeNull();
    // And because a story already begins there, the act says so rather than
    // starting a second break on the same section.
    expect(divisionStart(asked, place.opensUnitId as never).refusal).toContain('already begins');
  });

  it('starts one where the section it stands in front of carries no break', () => {
    const file = collection(5);
    const third = storiesOf(file)[2]!;
    // The story's second chapter: a section that opens a page and has no
    // marker, which is what a writer points at when they want a story to
    // begin there.
    const second = third.sections[1]!;
    const asked = setBlankPages(file, second.id as string, 0);
    const offer = divisionStart(asked, second.id);
    expect(offer.refusal).toBeNull();
    expect(offer.act).toBe('Start a story here…');
  });
});

describe('a picture on a blank sheet', () => {
  /**
   * **The sentence about a picture landing a page earlier is not about this
   * press** (§9ad). §9w says it where the cutter has left a gap in front of
   * the page in hand; standing on a sheet the **writer** put in, the picture
   * takes that sheet and lands exactly where they pointed, so naming the gap
   * in front of it would name a page the act never touches.
   */
  it('says nothing about the gap in front of the writer’s own sheet', () => {
    /**
     * **Asked of the act that now runs** (§9ar). The argument is untouched —
     * standing on a sheet the *writer* put in, what goes there takes that
     * sheet and lands exactly where they pointed, so naming the gap in front
     * of it would name a page the act never touches — and what carries it is
     * the design route, the picture having had three landing rules on a blank
     * page and none of them the writer's own press.
     */
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const asked = setBlankPages(file, marker, SHEET);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((one) => one.blankFor === marker)!;
    const offer = designOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.leafId).toBe(marker);
    expect(offer.note).not.toMatch(/fills that rather than adding one/);
    // And where the leaf really is the cutter's, the room still says so.
    const plain = thirdOpens(file);
    const cutters = pictureOffer(plain.place, plain.rows, plain.row.sheet);
    expect(cutters.refusal ?? cutters.note ?? '').toMatch(/Design this page|fills that rather than adding one/);
  });
});

/**
 * **Half a sheet** (addendum 20 §9ae, from Ken: *we also need the ability to
 * shift a page to the left or right. So when you select a page, it will shift
 * half a page. So if it's on the left-hand side, it'll swap it to the
 * right-facing page. If it's on the right, it'll swap it to the back of that
 * page*).
 *
 * §9ad's sheet is the act that moves **nothing** across the spine; this is the
 * only other thing a writer can want in the same place, and the two write one
 * field. What is pinned here is the pair of them: a sheet never changes a
 * side and a shift always does, which is what makes two controls honest where
 * one would have to guess.
 */
describe('a blank page on either side of the page in hand', () => {
  /**
   * A page the book does not hold on one side: a chapter **inside** a story
   * starts a new page and never a forced recto (addendum 22 §6), so it is a
   * page a writer may really move — which is most of a book, the openings a
   * rule holds being the exception the offer names.
   */
  const freeOpening = (file: ProjectFile) => {
    const { blocks, laid, rows } = lay(file);
    const row = rows.find(
      (one) => one.says === 'Chapter opens' && one.sheet > 1 && !rows.some((before) => before.sheet === one.sheet - 1 && before.blank),
    )!;
    return { row, rows, place: pagePlace(laid.pages, blocks, row.sheet), blocks, laid };
  };

  it('moves one page and swaps the side, where two of them move none', () => {
    const file = collection(5);
    const { row } = freeOpening(file);
    const spot = offerOn(file, row.sheet).before.spot as string;
    const pages = lay(file).rows.length;
    const opensAt = (one: ProjectFile) =>
      lay(one).rows.find((item) => item.blankFor === null && item.says === 'Chapter opens' && item.sheet >= row.sheet)!.sheet;
    const at = opensAt(file);

    const one = setBlankPages(file, spot, 1);
    expect(lay(one).rows.filter((item) => item.blankFor === spot)).toHaveLength(1);
    expect(opensAt(one)).toBe(at + 1);
    // The whole of the ask: it is on the other side of the paper now.
    expect(opensAt(one) % 2).not.toBe(at % 2);

    /**
     * **And the book need not grow by it**, which measuring caught and the
     * note now says: the page moves and everything after it moves with it,
     * until the next division the book holds on a right-hand page takes the
     * odd page up into the gap that rule already leaves. The total is
     * therefore the wrong thing to assert — the **side** is the ask.
     */
    expect(lay(one).rows.length).toBeGreaterThanOrEqual(pages);

    // And two of them still move nothing, which is the pair §9ad settled.
    const sheet = setBlankPages(file, spot, SHEET);
    expect(opensAt(sheet) % 2).toBe(at % 2);
    expect(lay(sheet).rows.length).toBe(pages + SHEET);
  });

  /**
   * **The side it goes on is the choice** (§9an, from Ken: *when I add a
   * blank page, I need to be able to decide whether it goes after or before.
   * So it'll have to ask you, enter a blank page before this page or after
   * this page*).
   *
   * This is the one that could not be said at all. A writer standing on the
   * last page of a story and asking for a leaf got one **in front of those
   * words**, with the story's own ending pushed over the page — which is the
   * report, and the reason there were two vocabularies for one field and
   * neither of them had an *after*.
   */
  it('puts a leaf behind this page by putting it in front of the next', () => {
    /**
     * **The sheet that ends the story is switched off here on purpose**
     * (§9ao): it stands in exactly the place this test is about, so with it on
     * the page after the story's last words carries nothing of the book and
     * there is nothing for a leaf to hang on — which is §9ao's own behaviour
     * and is asserted below rather than worked around here.
     */
    const file = setBookSettings(collection(5), { sheetAfterWorks: false });
    const { rows } = lay(file);
    const last = lastWords(rows);
    const offer = offerOn(file, last.sheet);
    expect(offer.after.act).toBe('A blank page after this one');
    // The next page's own record, which is what makes *after* need no field.
    expect(offer.after.spot).not.toBe(offer.before.spot);

    const put = setBlankPages(file, offer.after.spot as string, 1);
    const now = lay(put).rows;
    // The story's last words stay where they were, and the leaf is after them.
    expect(now.find((one) => one.sheet === last.sheet)?.blank).toBe(false);
    expect(now.find((one) => one.sheet === last.sheet + 1)?.blank).toBe(true);
    expect(now.length).toBe(rows.length + 1);
  });

  /**
   * **And with the sheet on, the page he asked for is already there** (§9ao,
   * from Ken: *I'm trying to add a blank page after the story is over*).
   *
   * The refusal is the useful half: a leaf hangs on a record and a page the
   * book left blank carries none, which this used to answer with a sentence
   * about records. It names the reason and the row that takes it away —
   * §9w's rule that a refusal must be able to reach the reason.
   */
  it('says the page after the story is already blank, and why', () => {
    const file = collection(5);
    const { rows } = lay(file);
    const last = lastWords(rows);
    const offer = offerOn(file, last.sheet);
    expect(offer.after.act).toBeNull();
    expect(offer.after.spot).toBeNull();
    expect(offer.after.refusal).toMatch(/already blank/);
    expect(offer.after.refusal).toMatch(/blank sheet after the last of the works/);
    expect(offer.after.refusal).toMatch(/row of its own/);
    // And the page before this one is still the writer's to use.
    expect(offer.before.act).toBe('A blank page before this one');
  });

  /**
   * **And the last page of the book has one after it too** (§9ao, from Ken:
   * *there's a blank page before this one, but we need a blank page after this
   * one also… I can't put a page after the end once I remove it*).
   *
   * This asserted the refusal §9an wrote — *there is nothing after it for a
   * leaf to stand in front of* — which is a true sentence about the mechanism
   * and a poor answer to somebody asking for a page a book plainly has. The
   * **book** is the record, so the side is offered and the assertion is its
   * own opposite.
   */
  it('offers a page after the last one, hung on the book itself', () => {
    const file = collection(5);
    const { rows } = lay(file);
    const end = rows[rows.length - 1]!;
    const offer = offerOn(file, end.sheet);
    expect(offer.after.act).toBe('A blank page after this one');
    expect(offer.after.spot).toBe(BOOK_END);
    expect(offer.after.refusal).toBeNull();
    // Nothing follows it, so the note is the simplest one there is.
    expect(offer.after.note).toMatch(/Nothing comes after it/);

    const put = setBlankPages(file, BOOK_END, 1);
    const now = lay(put).rows;
    expect(now).toHaveLength(rows.length + 1);
    const leaf = now[now.length - 1]!;
    expect(leaf.blank).toBe(true);
    expect(leaf.blankFor).toBe(BOOK_END);
    // And it is the writer's, so the page's own × reaches it.
    expect(blankPagesAt(put, BOOK_END)).toBe(1);
    expect(blankPagesAt(setBlankPages(put, BOOK_END, 0), BOOK_END)).toBe(0);
  });

  it('takes one away again, and is absent where none of the writer’s own stand', () => {
    const file = collection(5);
    const { row } = freeOpening(file);
    const offer = offerOn(file, row.sheet);
    // Absent rather than a button that can only refuse.
    expect(offer.fewer).toBeNull();

    const spot = offer.before.spot as string;
    const put = setBlankPages(file, spot, 1);
    const leaf = lay(put).rows.find((one) => one.blankFor === spot)!;
    const after = offerOn(put, leaf.sheet);
    expect(after.before.spot).toBe(spot);
    expect(after.pages).toBe(1);
    expect(after.fewer).toBe('Take the blank page away');
    // And taking it back leaves the book exactly the length it was.
    expect(lay(setBlankPages(put, spot, 0)).rows.length).toBe(lay(file).rows.length);
  });

  /**
   * **A page the book itself holds on one side says what the press costs**
   * (§9ac, §9an).
   *
   * A division forced onto a right-hand page already has the verso in front
   * of it left empty, so the first blank page asked for there **takes that
   * gap's place and becomes the writer's** — the book does not grow, and the
   * leaf now has a × of its own and can take a picture.
   *
   * **And the shift is gone** (§9an, from Ken: *we need to remove shift a
   * page, that doesn't really make any sense*). §9ae had given that gap a
   * second act which wrote the division's `opensRecto` instead, under words
   * named for what it did to the page in hand; the ability is not lost, a
   * leaf the cutter left being removed by removing its reason, which is the
   * page's own × (§9x). These assertions pinned that act and are **rewritten
   * rather than worked around**.
   */
  it('takes the gap’s place where the book already leaves one, and says so', () => {
    const file = collection(5);
    const { row } = thirdOpens(file);
    const offer = offerOn(file, row.sheet);
    expect(offer.before.act).toBe('A blank page before this one');
    expect(offer.before.note).toMatch(/takes its place and becomes yours/);
    // There is no second act beside it: one button, one thing it does.
    expect(Object.keys(offer.before).sort()).toEqual(['act', 'note', 'refusal', 'spot']);

    // And the press really does cost nothing, which is what the note claims.
    const spot = offer.before.spot as string;
    const put = setBlankPages(file, spot, 1);
    expect(lay(put).rows.length).toBe(lay(file).rows.length);
    expect(lay(put).rows.filter((one) => one.blankFor === spot)).toHaveLength(1);
    // The leaf is the writer's now, so the page's own × reaches it.
    expect(thirdOpens(put).row.sheet).toBe(row.sheet);
  });

  /**
   * **One number, and the two presses add to it** (§9an). The sheet and the
   * shift were two acts over one field counted in two units, which is what
   * let them disagree about how many stood there; there is one unit now.
   */
  it('counts in pages, so three presses are three pages', () => {
    const file = collection(5);
    const { row } = freeOpening(file);
    const spot = offerOn(file, row.sheet).before.spot as string;
    let put = file;
    for (let n = 0; n < 3; n += 1) {
      const leaf = lay(put).rows.find((one) => one.blankFor === spot);
      const at = leaf ? leaf.sheet : row.sheet;
      const offer = offerOn(put, at);
      expect(offer.pages).toBe(n);
      put = setBlankPages(put, spot, offer.pages + 1);
    }
    expect(lay(put).rows.filter((one) => one.blankFor === spot)).toHaveLength(3);
  });

  /**
   * **And the writer's own leaf moves** (§9an, from Ken: *in the right menu
   * outliner, I should be able to grab that blank page and just move it down
   * below page 174*). One page off one record and onto another — a page is
   * not a record, so there is nothing about a page number to change.
   */
  it('moves a blank page from one record to another, and the numbering follows', () => {
    // The sheet ending the story stands where this one works, as above.
    const file = setBookSettings(collection(5), { sheetAfterWorks: false });
    const { rows } = lay(file);
    const last = lastWords(rows);
    const offer = offerOn(file, last.sheet);
    const from = offer.after.spot as string;
    const to = offer.before.spot as string;

    const put = setBlankPages(file, from, 1);
    expect(lay(put).rows.find((one) => one.sheet === last.sheet + 1)?.blank).toBe(true);

    const moved = moveBlankPage(put, from, to);
    expect(blankPagesAt(moved, from)).toBe(0);
    expect(blankPagesAt(moved, to)).toBe(1);
    /**
     * **The record is what moves, and the leaf follows it** — which page it
     * lands on is the cutter's, so that is what is asserted rather than a
     * sheet number.
     *
     * **And the length is deliberately not asserted**, which measuring is
     * what taught: a leaf dropped in front of an element that begins
     * mid-page breaks that page too (§9af), so the words it was sharing with
     * need a page of their own and the book is one longer. That is the
     * cutter doing its work rather than the move doing something extra, and
     * a test that pinned the total here would be pinning the laying.
     */
    const now = lay(moved).rows;
    expect(now.filter((one) => one.blankFor === from)).toHaveLength(0);
    expect(now.filter((one) => one.blankFor === to)).toHaveLength(1);
  });

  it('refuses a move that would change nothing, or that has nothing to move', () => {
    const file = collection(5);
    const { row } = freeOpening(file);
    const spot = offerOn(file, row.sheet).before.spot as string;
    const put = setBlankPages(file, spot, 1);
    // The act refuses the same things the drop target does.
    expect(moveBlankPage(put, spot, spot)).toBe(put);
    expect(moveBlankPage(file, spot, 'nothing-here')).toBe(file);
  });

  it('says the opening will move, before a picture is put on its page', () => {
    /**
     * From Ken: *when I go to add a picture to that page, there needs to be
     * some kind of warning or ask if you want to make this a chapter page…
     * it adds the picture in the right place, but moves that text to the
     * next page*. The act is §9p's and is right; what was missing is that it
     * said so only in the `?`, after the press.
     */
    const file = collection(5);
    const { place, rows, row } = freeOpening(file);
    expect(place.opensMarkerId ?? place.opensUnitId).not.toBeNull();
    const offer = pictureOffer(place, rows, row.sheet);
    if (place.opensMarkerId) {
      expect(offer.note).toMatch(/the opening moves on a page/);
      expect(offer.note).toMatch(/Setting this page’s own art instead/);
    }

    // And where the cutter has left a leaf in front, the picture fills that
    // and the opening does **not** move — one note, two readings, never both.
    const held = thirdOpens(file);
    expect(pictureOffer(held.place, held.rows, held.row.sheet).note).toMatch(/fills that rather than adding one/);
  });
});

