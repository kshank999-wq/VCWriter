import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addPart,
  addUnit,
  blankReason,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  movePictureTo,
  pagePlace,
  pageRemoval,
  pagesUnder,
  pictureOffer,
  placeFigure,
  removeBookPage,
  sayBlankReason,
  setBackBlank,
  setBlankPage,
  updateBeat,
  type BeatId,
  type ProjectFile,
} from '../index.js';

/**
 * **The page as a row of the rail** (addendum 20 §9w, from Ken on a collection
 * he had just imported).
 *
 * Four reports, and what they have in common is that a page of the book was
 * the one thing in this room nothing could be done to:
 *
 * > there's numbered pages, page one, two, three. There's no way to delete
 * > those pages. There needs to be a little X in the left menu allowing you to
 * > delete them
 *
 * > then on page three, when I try to put a picture, it snaps it before page
 * > one for some reason
 *
 * > everything in the outliner should be in order and it should be draggable
 * > so you can move things around if you wanted to, the pages
 *
 * > there's a stray page that has a bunch of information on it that I want to
 * > remove, but I can't remove it … it says this page in front of one is
 * > already blank. Page says why. I don't know what this means
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

/** A collection like Ken's: stories, each divided into chapters by numerals. */
const collection = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  const story = (title: string, chapters: string[]) => {
    const ids: string[] = [];
    for (const chapter of chapters) {
      const made = addUnit(file, { trackId: track, title: chapter });
      file = made.file;
      ids.push(made.unit.id as string);
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title} ${chapter}` });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: {
          // Six paragraphs rather than three, so a chapter runs past its own
          // opening page and the book has a page of plain text on it — which
          // is the page Ken could not remove.
          elements: [head(chapter), ...[1, 2, 3, 4, 5, 6].map((n) => para(`${title} ${chapter} para ${n}. ${'word '.repeat(70)}`))],
        } as never,
      });
    }
    file = addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title }).file;
  };
  story('In For A Pound', ['I.', 'II.']);
  story('Simple Pleasures', ['I.']);
  return addPart(file, 'appendix', { title: 'Appendix' }).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/** A picture on a page of its own, put in before the first unit's first words. */
const withPicture = (file: ProjectFile, before: 'opening' | 'element'): { file: ProjectFile; elementId: string } => {
  const added = addGraphic(file, { name: 'plate.png', data: 'data:image/png;base64,AAA', width: 800, height: 600 });
  // The unit the first story's marker stands on — the project's seeded unit
  // comes before it and carries no writing.
  const first = added.file.markers[0]!.unitId;
  const beat = added.file.beats.find((one) => one.unitId === first && one.manuscript.elements.length > 0)!;
  const made = placeFigure(added.file, {
    beatId: beat.id as BeatId,
    assetId: added.asset.id,
    beforeElementId: beat.manuscript.elements[0]!.id as never,
    attributes: before === 'opening' ? { bookPlace: 'page', bookBeforeOpening: true } : { bookPlace: 'page' },
  });
  return { file: made.file, elementId: made.elementId as string };
};

const rowOf = (file: ProjectFile, is: (row: ReturnType<typeof lay>['rows'][number]) => boolean) =>
  lay(file).rows.find(is);

describe('what a × on a page row takes away', () => {
  it('takes away the blank leaf the writer put in, and says nothing else moves', () => {
    const file = collection();
    const { rows } = lay(file);
    const text = rows.find((row) => row.says === 'Text')!;
    const spot = text.elementId!;
    const with_ = setBlankPage(file, spot, true);
    const leaf = rowOf(with_, (row) => row.blankFor !== null)!;
    const removal = pageRemoval(lay(with_).rows, leaf.sheet);
    expect(removal.act).toBe('Take this page away');
    expect(removal.comfort).toMatch(/blank page goes/i);
    expect(removal.refusal).toBeNull();
    // And it really goes: the book is a page shorter and the leaf is gone.
    const after = removeBookPage(with_, leaf);
    expect(lay(after).rows).toHaveLength(lay(file).rows.length);
    expect(lay(after).rows.some((row) => row.blankFor !== null)).toBe(false);
  });

  it('takes the picture out of the writing and leaves it in the library', () => {
    const made = withPicture(collection(), 'element');
    const art = rowOf(made.file, (row) => row.says === 'Illustration')!;
    const removal = pageRemoval(lay(made.file).rows, art.sheet);
    expect(removal.act).toBe('Take this page away');
    expect(removal.comfort).toMatch(/stays in the library/);
    const after = removeBookPage(made.file, art);
    expect(lay(after).rows.some((row) => row.says === 'Illustration')).toBe(false);
    // The picture is the library's and is not touched (addendum 16 §9).
    expect(after.assets.some((one) => one.name === 'plate.png')).toBe(true);
  });

  it('refuses a leaf the cutter left, and names which of the two reasons it is', () => {
    // §9i's rule: a blank the recto convention produced is nobody's to remove,
    // and a page that will not go is exactly what Ken could not work out.
    const made = withPicture(collection(), 'element');
    const art = rowOf(made.file, (row) => row.says === 'Illustration')!;
    const rows = lay(made.file).rows;
    const left = rows.find((row) => row.blank && row.blankFor === null)!;
    expect(left).toBeTruthy();
    const removal = pageRemoval(rows, left.sheet);
    expect(removal.act).toBeNull();
    expect(removal.refusal).toMatch(/Nothing here to take away/);
    expect(removal.refusal).toMatch(/because/);
    expect(art.sheet).toBeGreaterThan(0);
  });

  it('refuses a page of the story’s words, and says where they are cut', () => {
    // Ken's stray page: the answer is not a × that silently does nothing but a
    // sentence saying the words are the manuscript's.
    const file = collection();
    const rows = lay(file).rows;
    const text = rows.find((row) => row.says === 'Text')!;
    expect(text).toBeTruthy();
    const removal = pageRemoval(rows, text.sheet);
    expect(removal.act).toBeNull();
    expect(removal.id).toBeNull();
    expect(removal.refusal).toMatch(/story’s own words/);
    expect(removal.refusal).toMatch(/Write page/);
    // And asking anyway changes not one page.
    expect(lay(removeBookPage(file, text)).rows).toEqual(rows);
  });

  it('points a chapter’s opening page at the row that takes the break out', () => {
    // It is not the writer's to remove as a *page*, and the break on it is —
    // which is a row with a × on it already, so that is where the sentence
    // sends them rather than to the manuscript.
    const file = collection();
    const rows = lay(file).rows;
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    const removal = pageRemoval(rows, opens.sheet);
    expect(removal.act).toBeNull();
    expect(removal.refusal).toMatch(/own row above/);
  });

  it('sends a part’s page to the row it already has', () => {
    const file = collection();
    const rows = lay(file).rows;
    const part = rows.find((row) => row.partId !== null)!;
    expect(pageRemoval(rows, part.sheet).act).toBeNull();
    expect(pageRemoval(rows, part.sheet).refusal).toMatch(/row of its own/);
  });
});

describe('why a page is blank', () => {
  it('is one reading, so no screen keeps its own copy of the three reasons', () => {
    const file = collection();
    const rows = lay(file).rows;
    const text = rows.find((row) => row.says === 'Text')!;
    const with_ = setBlankPage(file, text.elementId!, true);
    const mine = rowOf(with_, (row) => row.blankFor !== null)!;
    expect(blankReason(lay(with_).rows, mine.sheet)).toBe('writer');
    expect(sayBlankReason('writer')).toMatch(/you put it here/);
    expect(sayBlankReason('back')).toMatch(/back of the picture/);
    expect(sayBlankReason('recto')).toMatch(/right-hand page/);
  });

  it('is nothing at all on a page that is not blank', () => {
    const file = collection();
    const rows = lay(file).rows;
    expect(blankReason(rows, rows.find((row) => row.says === 'Text')!.sheet)).toBeNull();
  });
});

describe('a picture asked for on a division’s own opening page', () => {
  /**
   * §9t stopped the hoist where a unit opens twice — a collection's story
   * opens with its own page and again with its first chapter's numeral — so a
   * picture asked for on the numeral's page lands between the two, which is
   * right. The cost nobody noticed is that a picture asked for on the
   * **story's own page** landed there too, which is the next page along.
   */
  it('stands in front of the opening where the figure says so', () => {
    const before = lay(collection());
    const made = withPicture(collection(), 'opening');
    const rows = lay(made.file).rows;
    const art = rows.findIndex((row) => row.says === 'Illustration');
    const opens = rows.findIndex((row) => row.says === 'Chapter opens');
    expect(art).toBeGreaterThanOrEqual(0);
    // The picture comes first: the story's opening has moved on, which is the
    // page the writer pointed at.
    expect(art).toBeLessThan(opens);
    /**
     * **And the book did not grow**, which is the other half of Ken's report
     * measured: the story opens on a right-hand page, so the cutter had
     * already left the verso in front of it empty, and a picture of its own
     * fills *that* leaf. Correct typography, and from the writer's chair the
     * picture has moved back a page on its own — which is why
     * `pictureOffer.note` says so before the press rather than after it.
     */
    expect(rows).toHaveLength(before.rows.length);
    expect(before.rows[art]?.says).toBe('Blank');
  });

  it('stands between the two openings where it does not — §9t, unchanged', () => {
    const made = withPicture(collection(), 'element');
    const rows = lay(made.file).rows;
    const art = rows.findIndex((row) => row.says === 'Illustration');
    const opens = rows.findIndex((row) => row.says === 'Chapter opens');
    expect(art).toBeGreaterThan(opens);
  });

  it('is what the room reads off the page, and nothing older carries it', () => {
    // Nothing written before §9w has the attribute, which is why no existing
    // book moves — the whole suite passed unedited.
    const file = collection();
    const figures = file.beats.flatMap((beat) => beat.manuscript.elements);
    expect(figures.every((element) => element.attributes?.bookBeforeOpening === undefined)).toBe(true);
  });
});

describe('moving a picture to another page', () => {
  it('is one act, and it carries which opening the page in hand is', () => {
    const made = withPicture(collection(), 'element');
    const { blocks, laid, rows } = lay(made.file);
    // The story's own opening page: `beforeOpening` is its answer, so the
    // picture dragged onto it really lands on it.
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    const moved = movePictureTo(made.file, made.elementId, {
      spot: pagePlace(laid.pages, blocks, opens.sheet).elementId as string,
      of: 'story',
      beforeOpening: true,
      note: null,
      refusal: null,
    });
    const after = lay(moved).rows;
    expect(after.findIndex((row) => row.says === 'Illustration')).toBeLessThan(
      after.findIndex((row) => row.says === 'Chapter opens'),
    );
  });

  it('clears the answer again where an ordinary page is pointed at', () => {
    const made = withPicture(collection(), 'opening');
    const { blocks, laid, rows } = lay(made.file);
    const text = rows.filter((row) => row.says === 'Text').at(-1)!;
    const moved = movePictureTo(made.file, made.elementId, {
      spot: pagePlace(laid.pages, blocks, text.sheet).elementId as string,
      of: 'story',
      beforeOpening: false,
      note: null,
      refusal: null,
    });
    const element = moved.beats
      .flatMap((beat) => beat.manuscript.elements)
      .find((one) => (one.id as string) === made.elementId)!;
    expect(element.attributes?.bookBeforeOpening).toBeUndefined();
    // And it moved: the picture is no longer the first thing in the story.
    const after = lay(moved).rows;
    expect(after.findIndex((row) => row.says === 'Illustration')).toBeGreaterThan(
      after.findIndex((row) => row.says === 'Chapter opens'),
    );
  });
});

describe('whether a picture may be asked for on this page', () => {
  const offerOn = (file: ProjectFile, sheet: number) => {
    const { blocks, laid, rows } = lay(file);
    return pictureOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet);
  };

  it('is refused on a blank leaf, which had put the picture at the back of the book', () => {
    /**
     * The fault Ken reported, exactly: the menu refused here and said *Choose
     * a page first*, the **+ Picture** button carried the same words in its
     * title and acted anyway, and what it did was `addPart('plate')` — an art
     * page in the **back matter**. One reading now, so a picture asked for on
     * a page goes on that page or is refused in a sentence.
     */
    const file = collection();
    const leaf = lay(file).rows.find((row) => row.blank)!;
    const offer = offerOn(file, leaf.sheet);
    expect(offer.spot).toBeNull();
    expect(offer.of).toBeNull();
    expect(offer.refusal).toMatch(/nothing on it for a picture to stand before/);
    // And it says where it can go instead, rather than only refusing.
    expect(offer.refusal).toMatch(/page after it/);
  });

  it('is offered on a page of the story, and names the element it goes before', () => {
    const file = collection();
    const text = lay(file).rows.find((row) => row.says === 'Text')!;
    const offer = offerOn(file, text.sheet);
    expect(offer.of).toBe('story');
    expect(offer.spot).toBe(text.elementId);
    expect(offer.refusal).toBeNull();
    expect(offer.beforeOpening).toBe(false);
  });

  it('is offered on a part’s page, and names the part', () => {
    const file = collection();
    const part = lay(file).rows.find((row) => row.partId !== null)!;
    const offer = offerOn(file, part.sheet);
    expect(offer.of).toBe('part');
    expect(offer.spot).toBe(part.partId);
  });

  it('says the page a division opens on is the page a division opens on', () => {
    // Which of a collection's two openings the writer meant is not derivable
    // (§9t); they have just said it by pointing at a page, so the offer
    // carries it and the figure keeps it.
    const file = collection();
    const { blocks, laid, rows } = lay(file);
    const opens = rows.filter((row) => row.says === 'Chapter opens');
    const story = opens.find((row) => pagePlace(laid.pages, blocks, row.sheet).opensMarkerId !== null)!;
    expect(offerOn(file, story.sheet).beforeOpening).toBe(true);
    const text = rows.find((row) => row.says === 'Text')!;
    expect(offerOn(file, text.sheet).beforeOpening).toBe(false);
  });

  it('says a picture of its own will fill the empty leaf in front rather than add a page', () => {
    // *It snaps it before page one for some reason* — the reason, said before
    // the press (§9r's own answer for a blank leaf, pointed at a picture).
    const file = collection();
    const { blocks, laid, rows } = lay(file);
    const after = rows.find(
      (row) =>
        !row.blank &&
        row.partId === null &&
        rows.find((one) => one.sheet === row.sheet - 1)?.blank === true &&
        pagePlace(laid.pages, blocks, row.sheet).elementId !== null,
    )!;
    expect(after).toBeTruthy();
    const leaf = rows.find((one) => one.sheet === after.sheet - 1)!;
    // **And it names the page**, rather than leaving the writer to do the
    // arithmetic beside a rail that has already done it.
    expect(offerOn(file, after.sheet).note).toBe(
      `A picture of its own will stand on page ${leaf.counted}: the leaf in front of this page is empty, and it fills that rather than adding one.`,
    );
  });

  it('says nothing where the page in hand is the page it lands on', () => {
    // The note is for the one case that surprises somebody; said on every
    // page it would be noise, and noise is what gets a sentence stopped being
    // read on the day it matters.
    const file = collection();
    const rows = lay(file).rows;
    const plain = rows.find(
      (row) => row.says === 'Text' && rows.find((one) => one.sheet === row.sheet - 1)?.blank !== true,
    )!;
    expect(plain).toBeTruthy();
    expect(offerOn(file, plain.sheet).note).toBeNull();
  });
});

describe('a page standing in front of the division it belongs to', () => {
  /**
   * The gap the hoist opened, found by driving the room rather than by a test
   * (§9w). A picture asked for on a division's own opening page is emitted
   * *before* the opening, so its page carries no marker and no unit — and the
   * fold had nothing to give it to, so the picture's page and the leaf beside
   * it appeared **under no row at all**. The row went off the rail at exactly
   * the moment the picture landed where it was asked for, which is a worse
   * outcome than the fault being fixed.
   */
  it('is listed under the division it stands in front of', () => {
    const made = withPicture(collection(), 'opening');
    const { rows } = lay(made.file);
    const railed = bookRows(made.file);
    const under = pagesUnder(railed, rows);
    const claimed = new Set([...under.values()].flat().map((page) => page.sheet));
    const art = rows.find((page) => page.says === 'Illustration')!;
    // Every page from the picture onwards is under a row. A leaf among the
    // front matter is still nobody's, which §9m settled: a part has a row of
    // its own and does not fold.
    for (const page of rows) {
      if (page.partId !== null || page.sheet < art.sheet) continue;
      expect(claimed.has(page.sheet)).toBe(true);
    }
    // And the picture's own page is under the story, where `bookRows` puts
    // the picture itself.
    const story = railed.find((row) => row.kind === 'chapter')!;
    expect((under.get(story.id) ?? []).some((page) => page.sheet === art.sheet)).toBe(true);
  });

  it('leaves every other page under exactly one row, as §9m requires', () => {
    const made = withPicture(collection(), 'opening');
    const { rows } = lay(made.file);
    const under = pagesUnder(bookRows(made.file), rows);
    const seen = [...under.values()].flat().map((page) => page.sheet);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('why a page is blank, said rather than guessed', () => {
  it('calls the leaf behind a picture its back, and the cutter’s gap its own thing', () => {
    /**
     * Driving the room found this (§9w): the reason was worked out by looking
     * at what stood on the page **before** — a picture there was taken to
     * mean *this is its back* — and a picture that opens a division is
     * followed by the recto gap the cutter left, so the screen told the
     * writer it was a back page nobody had asked for. The block says so now.
     */
    const made = withPicture(collection(), 'element');
    // The leaf the writer asked for behind the picture: a **back**.
    const asked = setBackBlank(made.file, made.elementId, true);
    const rows = lay(asked).rows;
    const art = rows.find((row) => row.says === 'Illustration')!;
    const back = rows.find((row) => row.sheet === art.sheet + 1)!;
    expect(back.blankBack).toBe(true);
    expect(blankReason(rows, back.sheet)).toBe('back');

    // And a leaf the cutter left is its own thing, whatever stands in front
    // of it — which is what the guess got wrong.
    const gap = rows.find((row) => row.blank && !row.blankBack && row.partId === null)!;
    expect(gap).toBeTruthy();
    expect(blankReason(rows, gap.sheet)).toBe('recto');
  });
});

describe('the leaf behind a picture that stands in front of a chapter', () => {
  it('goes with it, and says it is a back rather than the cutter’s gap', () => {
    /**
     * Found by driving, not by a test (§9w): the back leaf was emitted where
     * the manuscript's own elements are and **not** on the hoist path, so a
     * picture in front of a chapter's opening lost it. The book looked right
     * — a picture on a recto followed by a chapter on a recto leaves the
     * verso between them empty anyway — and what was wrong was what the page
     * then said about itself: the cutter's reason, for a leaf the writer had
     * asked for. One helper now, read by all three paths.
     */
    const made = withPicture(collection(), 'opening');
    const asked = setBackBlank(made.file, made.elementId, true);
    const rows = lay(asked).rows;
    const art = rows.find((row) => row.says === 'Illustration')!;
    const back = rows.find((row) => row.sheet === art.sheet + 1)!;
    expect(back.blank).toBe(true);
    expect(back.blankBack).toBe(true);
    expect(blankReason(rows, back.sheet)).toBe('back');
    expect(pageRemoval(rows, back.sheet).refusal).toMatch(/back of the picture in front of it/);
  });
});
