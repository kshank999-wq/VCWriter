import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  blankOffer,
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
  pictureOffer,
  removeDivision,
  setBlankPages,
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

/** The third story's own opening page, which is the gap he was working in. */
const thirdOpens = (file: ProjectFile) => {
  const { blocks, laid, rows } = lay(file);
  const third = storiesOf(file)[2]!;
  const row = rows.find((one) => one.markerId === (third.placed.marker.id as string) && one.says === 'Chapter opens')!;
  return { blocks, laid, rows, row, place: pagePlace(laid.pages, blocks, row.sheet), marker: third.placed.marker.id as string };
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

  it('says before the press that a sheet is two pages', () => {
    const file = collection(5);
    const { place, rows, row } = thirdOpens(file);
    const offer = blankOffer(place, rows, row.sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.act).toBe('Put a blank sheet here…');
    expect(offer.note).toMatch(/two pages/);
    expect(offer.note).toMatch(/changes which side/);
  });

  it('asks for another from the sheet itself, which is where a writer stands', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const asked = setBlankPages(file, marker, SHEET);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((one) => one.blankFor === marker)!;
    const offer = blankOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.act).toBe('Put another blank sheet here…');
    expect(offer.spot).toBe(marker);
    // **Pages rather than sheets** (§9ae): the count is what the shift needs
    // it to be, and one sheet is two of them.
    expect(offer.pages).toBe(SHEET);
    expect(offer.fewer).toBe('Take the blank sheet away');
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
    const { blocks, laid, rows } = lay(full);
    const leaf = rows.find((one) => one.blankFor === marker)!;
    const offer = blankOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.act).toBeNull();
    expect(offer.refusal).toMatch(/as many as one place takes/);
    expect(offer.refusal).toMatch(/sheets/);
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
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const asked = setBlankPages(file, marker, SHEET);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((one) => one.blankFor === marker)!;
    const offer = pictureOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.takesLeaf).toBe(marker);
    expect(offer.note).toBeNull();
    // And where the leaf really is the cutter's, it still says so.
    const plain = thirdOpens(file);
    const cutters = pictureOffer(plain.place, plain.rows, plain.row.sheet);
    expect(cutters.note).toMatch(/fills that rather than adding one/);
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
describe('shifting a page half a sheet', () => {
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

  it('moves one page and swaps the side, where a sheet moved none', () => {
    const file = collection(5);
    const { row, place } = freeOpening(file);
    const spot = blankOffer(place, lay(file).rows, row.sheet).spot as string;
    const pages = lay(file).rows.length;
    const opensAt = (one: ProjectFile) =>
      lay(one).rows.find((item) => item.blankFor === null && item.says === 'Chapter opens' && item.sheet >= row.sheet)!.sheet;
    const at = opensAt(file);

    const shifted = setBlankPages(file, spot, 1);
    expect(lay(shifted).rows.filter((one) => one.blankFor === spot)).toHaveLength(1);
    expect(opensAt(shifted)).toBe(at + 1);
    // The whole of the ask: it is on the other side of the paper now.
    expect(opensAt(shifted) % 2).not.toBe(at % 2);

    /**
     * **And the book need not grow by it**, which measuring caught and the
     * sentence now says: the page moves and everything after it moves with
     * it, until the next division the book holds on a right-hand page takes
     * the odd page up into the gap that rule already leaves. The total is
     * therefore the wrong thing to assert — the **side** is the ask.
     */
    expect(lay(shifted).rows.length).toBeGreaterThanOrEqual(pages);

    // And the sheet beside it still moves nothing, which is the pair.
    const sheet = setBlankPages(file, spot, SHEET);
    expect(opensAt(sheet) % 2).toBe(at % 2);
    expect(lay(sheet).rows.length).toBe(pages + SHEET);
  });

  it('names the side it would land on, and says what it costs', () => {
    const file = collection(5);
    const { row, place, rows } = freeOpening(file);
    const offer = blankOffer(place, rows, row.sheet);
    expect(offer.shiftOn).toBe('Shift it on a page');
    expect(offer.shiftNote).toMatch(sideOf(row.sheet) === 'right' ? /left-hand side/ : /right-hand side/);
    // It says what it costs the pages after it — the sheet's own opposite —
    // and where that stops, which measuring is what found (see above).
    expect(offer.shiftNote).toMatch(/the pages after it swap sides with it/);
    expect(offer.shiftNote).toMatch(/as far as the next opening the book holds/);
    expect(offer.shiftNote).toMatch(/A blank sheet is the one that moves nothing/);
  });

  it('cannot shift back where nothing of the writer’s own stands in front', () => {
    const file = collection(5);
    const { row, place, rows } = freeOpening(file);
    const offer = blankOffer(place, rows, row.sheet);
    // Absent rather than a button that can only refuse, with the reason said.
    expect(offer.shiftBack).toBeNull();
    expect(offer.shiftRefusal).toMatch(/it can only shift on/);

    // One shift on, and back is there — the same field, one page fewer. The
    // **spot** is what is followed rather than the row, the laying having
    // moved every page after it by one.
    const spot = offer.spot as string;
    const shifted = setBlankPages(file, spot, 1);
    const moved = lay(shifted);
    const leaf = moved.rows.find((one) => one.blankFor === spot)!;
    const after = blankOffer(pagePlace(moved.laid.pages, moved.blocks, leaf.sheet), moved.rows, leaf.sheet);
    expect(after.spot).toBe(spot);
    expect(after.pages).toBe(1);
    expect(after.shiftBack).toBe('Shift it back a page');
    expect(after.shiftRefusal).toBeNull();
    // And taking it back leaves the book exactly the length it was.
    expect(lay(setBlankPages(shifted, spot, 0)).rows.length).toBe(lay(file).rows.length);
  });

  /**
   * **A page the book itself holds on one side says so** (§9ae), which is
   * §9r's measurement arriving at a control that cannot survive it: a
   * division forced onto a right-hand page already has the verso in front of
   * it left empty, so one page asked for there fills that gap and the page
   * does not move at all — a press that changes nothing a writer can see,
   * which is exactly the report §9ac began with.
   */
  it('frees the rule that holds the page, where that is what holds it', () => {
    /**
     * **The first answer here was a refusal and it was the wrong one.** A
     * division forced onto a right-hand page has the verso in front of it
     * left empty already, so one blank page there is taken up by that gap and
     * nothing moves — true, and on a book whose chapters all open recto it
     * made the control refuse on every page a writer would reach for.
     *
     * *Move this page to the other side* is one thing a writer wants, and
     * what really moves such a page is the **rule**, which §9x already made a
     * per-chapter field. So the shift writes that instead, and the mechanism
     * stays the room's business: one control, one sentence, two mechanisms
     * underneath.
     */
    const file = collection(5);
    const { place, rows, row } = thirdOpens(file);
    const offer = blankOffer(place, rows, row.sheet);
    expect(offer.shiftOn).toBe('Shift it on a page');
    expect(offer.shiftFrees).toBe(place.opensMarkerId);
    expect(offer.shiftNote).toMatch(/opens on a right-hand page, which is what holds it there/);
    expect(offer.shiftNote).toMatch(/a page shorter/);
    // One direction only: the page is on a right-hand side **because** of the
    // rule, so freeing it can put it nowhere but the left.
    expect(offer.shiftBack).toBeNull();
    expect(offer.shiftRefusal).toBeNull();
    // The sheet is still offered beside it: two pages are not absorbed.
    expect(offer.act).toBe('Put a blank sheet here…');

    // And the act really moves it, by the field it names.
    const freed = setChapterRecto(file, offer.shiftFrees as string, false);
    const was = row.sheet;
    const now = thirdOpens(freed).row.sheet;
    expect(now).toBe(was - 1);
    expect(now % 2).not.toBe(was % 2);
    expect(lay(freed).rows.length).toBe(lay(file).rows.length - 1);
  });

  it('is a half of the sheet the same screen offers, from one count', () => {
    const file = collection(5);
    const { row, place, rows } = freeOpening(file);
    const spot = blankOffer(place, rows, row.sheet).spot as string;
    // One shift and then a sheet is three pages, which is what one field
    // counting pages buys: the two acts cannot disagree about how many stand
    // there, because there is one number and they add one and two to it.
    const once = setBlankPages(file, spot, 1);
    const moved = lay(once);
    const leaf = moved.rows.find((one) => one.blankFor === spot)!;
    const offer = blankOffer(pagePlace(moved.laid.pages, moved.blocks, leaf.sheet), moved.rows, leaf.sheet);
    expect(offer.pages).toBe(1);
    const both = setBlankPages(once, spot, offer.pages + SHEET);
    expect(lay(both).rows.filter((one) => one.blankFor === spot)).toHaveLength(3);
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

