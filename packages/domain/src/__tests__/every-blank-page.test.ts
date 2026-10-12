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
  createProjectFile,
  designOffer,
  designPage,
  geometryOf,
  layPages,
  pagePlace,
  PICTURE_BY_DESIGNING,
  pictureOffer,
  setBookSettings,
  tracksInOrder,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **Every single blank page, and one act on it** (addendum 20 §9ar, from Ken
 * after the fourth report of the same thing):
 *
 * > Still the same issue. Where it doesn't want me to put a picture on
 * > certain pages. So I tried to put a picture on page 68 and it put it
 * > instead of on the left, it put it on the right on page 69 for some
 * > reason… it just keeps going in circles and it never gets fixed. We need
 * > to think about this in another way… But every single page that should,
 * > that's blank should have the same ability to design it or put something
 * > on there or place a picture on the page.
 *
 * and then, with the answer:
 *
 * > If we just use the design a page function, it works fine. So instead of
 * > trying to do it the other way, we'll just make sure that it, the only way
 * > to do it is to design a page.
 *
 * **This is the test the four earlier reports did not have.** Each of them
 * was answered on the page it named — §9aa on a leaf between chapters, §9ab
 * on a leaf in the front matter, §9al on a leaf a rule was holding, §9ap on
 * the last page of the book — and each answer decided where it landed **from
 * the record it anchored to**, so the next shape of blank page was wrong
 * again and the room went round. What is asserted here is the sentence
 * rather than the page: walk **every** blank page of several real book
 * shapes, and on each one the act is offered, it lands on that page, and the
 * picture names it rather than offering a second answer.
 *
 * A test over one page cannot fail when the next shape is wrong, which is why
 * four of them passed through all four reports.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as never,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const withStory = (file: ProjectFile, trackId: string, title: string, index: number): ProjectFile => {
  const made = index === 0 ? { file, unit: unitsInStoryOrder(file)[0]! } : addUnit(file, { trackId: trackId as never, title, index });
  let next = made.file;
  next = addMarker(next, { unitId: made.unit.id, title, kind: 'chapter' }).file;
  const beat = addBeat(next, { unitId: made.unit.id, title: 'one' });
  return updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [para('Words. '.repeat(30)), para('More words. '.repeat(30))] } as never,
  });
};

/** The book shapes a blank page can turn up in, which is the whole point. */
const shapes = (): Record<string, ProjectFile> => {
  const out: Record<string, ProjectFile> = {};
  {
    let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
    const track = tracksInOrder(file)[0]!.id as string;
    for (const [at, title] of ['One', 'Two', 'Three'].entries()) file = withStory(file, track, title, at);
    out['a novel whose chapters open on a right-hand page'] = setBookSettings(file, { chaptersOpenRecto: true });
  }
  {
    let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'K. Shank' });
    const track = tracksInOrder(file)[0]!.id as string;
    for (const [at, title] of ['In For A Pound', 'FALLING', 'Gotta Have Faith'].entries()) file = withStory(file, track, title, at);
    file = addPart(file, 'about_the_author', { text: 'K. Shank writes.' }).file;
    out['a collection with back matter and a sheet between the stories'] = setBookSettings(file, { chaptersOpenRecto: true });
  }
  {
    let file = createProjectFile({ title: 'Ends Blank', format: 'novel', author: 'K. Shank' });
    const track = tracksInOrder(file)[0]!.id as string;
    for (const [at, title] of ['One', 'Two'].entries()) file = withStory(file, track, title, at);
    out['a book ending in blank pages the writer asked for'] = setBookSettings(file, {
      chaptersOpenRecto: true,
      blankAtEnd: 2,
    });
  }
  {
    let file = createProjectFile({ title: 'Dressed', format: 'novel', author: 'K. Shank' });
    const track = tracksInOrder(file)[0]!.id as string;
    for (const [at, title] of ['One', 'Two'].entries()) file = withStory(file, track, title, at);
    file = addPart(file, 'dedication', { title: 'Dedication', text: 'For nobody.' }).file;
    file = addPart(file, 'epigraph', { title: 'Epigraph', text: 'A line.' }).file;
    out['a book with front matter a leaf falls inside'] = setBookSettings(file, { chaptersOpenRecto: true });
  }
  return out;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, new Map(blocks.map((one) => [one.id, 1])), geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

describe('every blank page of every book shape', () => {
  it('offers a page of your own, and the picture names that act rather than a second one', () => {
    for (const [name, file] of Object.entries(shapes())) {
      const { blocks, laid, rows } = lay(file);
      const blanks = rows.filter((row) => row.blank);
      expect(blanks.length, `${name} has no blank page to walk`).toBeGreaterThan(0);
      for (const row of blanks) {
        const place = pagePlace(laid.pages, blocks, row.sheet);
        const where = `${name}, the blank page at sheet ${row.sheet}`;
        expect(designOffer(place, rows, row.sheet, 'works').refusal, where).toBeNull();
        /**
         * **One answer, said once.** A blank page that still offered the
         * picture would be the second answer this whole section removes, and
         * it is what every one of the four reports was standing on.
         */
        expect(pictureOffer(place, rows, row.sheet, 'works').refusal, where).toBe(PICTURE_BY_DESIGNING);
      }
    }
  });

  it('says on every one of them what the page becomes, which is the word “picture”', () => {
    /**
     * **The fault only looking caught** (§9ar). On a leaf the cutter left —
     * nearly every blank page in a book — the note was `sayBlankFreed`'s
     * alone, which says what happens to the **book**: true, and the word
     * *picture* then appeared nowhere on the one panel a writer opens in
     * order to put a picture on the page. Driven in the real room on a
     * collection, seven blank pages, not one of them saying it.
     *
     * That is this whole run of reports in miniature — the act there, the
     * sentence true, and the question nobody was asking answered — so what
     * is pinned is the sentence rather than the mechanism, on every page.
     */
    for (const [name, file] of Object.entries(shapes())) {
      const { blocks, laid, rows } = lay(file);
      for (const row of rows.filter((one) => one.blank)) {
        const note = designOffer(pagePlace(laid.pages, blocks, row.sheet), rows, row.sheet, 'works').note;
        expect(note, `${name}, the blank page at sheet ${row.sheet}`).toMatch(/picture/);
      }
    }
  });

  it('lands that page on the page it was asked for, with the book no longer', () => {
    /**
     * **The claim a writer can check**, and the one every report has been
     * about: *I tried to put a picture on page 68 and it put it on page 69*.
     *
     * Measured over these four shapes: of seventeen blank pages, fourteen
     * take the page on the very sheet that was pointed at and the book is
     * exactly as long as it was. The three that are not are the **second
     * page of a separating sheet** between two whole works, which is one
     * object of two pages — designing it takes the sheet away and stands the
     * page where the sheet began, which is what `sayBlankFreed` says before
     * the press, and the book is shorter rather than longer. So the page is
     * never further on than the one pointed at, which is the direction the
     * reports were all in.
     */
    for (const [name, file] of Object.entries(shapes())) {
      const { blocks, laid, rows } = lay(file);
      for (const row of rows.filter((one) => one.blank)) {
        const place = pagePlace(laid.pages, blocks, row.sheet);
        const made = designPage(file, place, rows, row.sheet, 'works');
        const where = `${name}, the blank page at sheet ${row.sheet}`;
        expect(made.refusal, where).toBeNull();
        const after = lay(made.file);
        const own = after.rows.find((one) => one.partId === made.partId);
        expect(own, `${where}: the page it made is on no page of the book`).toBeDefined();
        expect(own!.sheet, where).toBeLessThanOrEqual(row.sheet);
        expect(after.laid.pages.length, `${where}: the book grew`).toBeLessThanOrEqual(laid.pages.length);
      }
    }
  });

  it('is never further on than the page that was pointed at, which is the whole report', () => {
    /**
     * Said on its own because it is the sentence rather than the mechanism:
     * **a page asked for on page 68 never arrives on page 69.** The sheet
     * case moves it one page *back* and says so; nothing moves it forward.
     */
    const file = shapes()['a collection with back matter and a sheet between the stories']!;
    const { blocks, laid, rows } = lay(file);
    const moved: number[] = [];
    for (const row of rows.filter((one) => one.blank)) {
      const made = designPage(file, pagePlace(laid.pages, blocks, row.sheet), rows, row.sheet, 'works');
      const own = lay(made.file).rows.find((one) => one.partId === made.partId)!;
      if (own.sheet !== row.sheet) moved.push(row.sheet - own.sheet);
    }
    // Every one that moves, moves back by exactly the one page of a sheet.
    for (const by of moved) expect(by).toBe(1);
  });
});
