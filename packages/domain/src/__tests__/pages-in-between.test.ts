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
  removeDivision,
  setBlankPages,
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

describe('a blank page is exactly one page', () => {
  /**
   * **Both parities, one answer** — which is the whole of the fix. The rule is
   * not *add a page*; it is that a leaf the writer put in by hand **stands the
   * automatic recto rule down**, so the pages they arranged are the pages they
   * get.
   */
  for (const paragraphs of [2, 3, 4, 5, 6]) {
    it(`moves the story's opening down exactly one page per leaf (${paragraphs} paragraphs a section)`, () => {
      const file = collection(paragraphs);
      const { marker } = thirdOpens(file);
      const opensAt = (one: ProjectFile) => thirdOpens(one).row.sheet;
      const at = opensAt(file);
      /**
       * **The one state the count is read against** is whether the cutter has
       * already left an empty leaf there, which is a page the writer can see.
       * Where it has, the first leaf asked for takes its place — the gap being
       * there *because* the page opens on a right-hand one, and that rule
       * standing down the moment the writer arranges the pages by hand — and
       * every leaf after it is one page. Where it has not, every leaf
       * including the first is one page.
       *
       * Both parities now give the same sentence; before this the first leaf
       * gave two pages in one of them and none in the other.
       */
      const gap = lay(file).rows.find((row) => row.sheet === at - 1)?.blank === true ? 1 : 0;
      for (const want of [1, 2, 3]) {
        const asked = setBlankPages(file, marker, want);
        expect(lay(asked).rows.filter((row) => row.blankFor === marker)).toHaveLength(want);
        expect(opensAt(asked)).toBe(at + want - gap);
      }
    });
  }

  it('says before the press that the first leaf takes the gap’s place', () => {
    const file = collection(5);
    const { place, rows, row } = thirdOpens(file);
    // The cutter's gap really is there: this is the parity §9r refused on.
    expect(rows.find((one) => one.sheet === row.sheet - 1)?.blank).toBe(true);
    const offer = blankOffer(place, rows, row.sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.act).toBe('Put a blank page here…');
    expect(offer.note).toMatch(/takes its place/);
  });

  it('asks for another from the leaf itself, which is where a writer stands', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const asked = setBlankPages(file, marker, 1);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((one) => one.blankFor === marker)!;
    const offer = blankOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.act).toBe('Put another blank page here…');
    expect(offer.spot).toBe(marker);
    expect(offer.leaves).toBe(1);
    expect(offer.fewer).toBe('Take the blank page away');
  });

  it('keeps the recto where the page leaves its own back blank, a back being a back', () => {
    /**
     * The one place the automatic rule is **not** stood down. A back has to be
     * the other side of the same sheet (§9j, Ken's own correction), so a page
     * whose back is left blank must open on a recto or the leaf behind it is
     * the next sheet's front.
     */
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const asked = setBlankPages(file, marker, 1);
    const both = {
      ...asked,
      markers: asked.markers.map((one) =>
        (one.id as string) === marker ? { ...one, page: { ...(one.page ?? {}), blankBefore: 1, backBlank: true } } : one,
      ),
    } as ProjectFile;
    const opening = bookBlocks(both).find((block) => block.id === marker)!;
    expect(opening.starts).toBe('recto');
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
    expect(offer.fewer).not.toBeNull();
  });

  it('reads the older spelling as one leaf, so no book moves', () => {
    const file = collection(5);
    const { marker } = thirdOpens(file);
    const older = {
      ...file,
      markers: file.markers.map((one) =>
        (one.id as string) === marker ? { ...one, page: { ...(one.page ?? {}), blankBefore: true } } : one,
      ),
    } as ProjectFile;
    expect(lay(older).rows.filter((row) => row.blankFor === marker)).toHaveLength(1);
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
    const asked = setBlankPages(file, marker, 1);
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
