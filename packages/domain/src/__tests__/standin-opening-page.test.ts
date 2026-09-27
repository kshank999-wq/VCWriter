import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addUnit,
  blankSpot,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pagePlace,
  placeFigure,
  setBlankPage,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **The page a chapter opens on, where its heading stands in** (addendum 20
 * §9s, from Ken: *when I select page two and I try to make it blank, that
 * doesn't work… it also doesn't allow me to put a picture. The way it should
 * work is I should be able to double click that page and put a blank page or
 * a picture there… and then that page two goes to page three. So if I want
 * to open with a picture, I can*).
 *
 * §9l stands a unit's own title in where the manuscript carries no heading —
 * a book imported before §9j taught the importer to keep a bare numeral. The
 * block it makes is **not a manuscript element**: its id names the unit. So
 * `pagePlace` answered a press with an id in no collection, every act looked
 * it up, found nothing and **returned the document unchanged** — a page that
 * read as one nothing could be done to.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** Ken's book: a story whose sections carry no heading element of their own. */
const imported = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  const ids: string[] = [];
  for (const title of ['I.', 'II.', 'III.']) {
    const made = addUnit(file, { trackId: track, title });
    file = made.file;
    ids.push(made.unit.id as string);
    const beat = addBeat(file, { unitId: made.unit.id, title });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [1, 2, 3].map((n) => para(`${title} para ${n}. ${'word '.repeat(70)}`)) },
    } as never);
  }
  return addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title: 'In For A Pound' }).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

const shape = (file: ProjectFile): string[] => {
  const { blocks, laid } = lay(file);
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return laid.pages.map((page) => page.pieces.map((piece) => byId.get(piece.blockId)?.kind).join('+') || 'left-blank');
};

/** Every id a writer can actually point at. */
const elementIds = (file: ProjectFile): Set<string> =>
  new Set(file.beats.flatMap((beat) => beat.manuscript.elements.map((element) => element.id as string)));

/**
 * The page a chapter opens on whose heading stands in. The **first** section
 * carries the story's own marker, so a picture at its head belongs in front
 * of the story's opening and §9p already puts it there; these are the ones
 * with no marker of their own, which is every numeral after the first.
 */
const secondOpening = (file: ProjectFile): number => {
  const { rows } = lay(file);
  const opens = rows.filter((row) => row.says === 'Chapter opens');
  return opens[2]!.sheet;
};

/** Put a picture that is a page of its own before that element. */
const pictureBefore = (file: ProjectFile, before: string) => {
  const art = addGraphic(file, { name: 'ON THE BRIDGE', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
  const beat = art.file.beats.find((one) =>
    one.manuscript.elements.some((element) => (element.id as string) === before),
  )!;
  return placeFigure(art.file, {
    beatId: beat.id,
    assetId: art.asset.id as never,
    beforeElementId: before as never,
    caption: 'On the bridge',
    attributes: { bookPlace: 'page' },
  });
};

describe('a page whose heading stands in', () => {
  it('answers with a real element rather than the stand-in', () => {
    // The whole of the fault: the id came back, so nothing looked broken
    // until an act tried to find it in the manuscript.
    const file = imported();
    const { blocks, laid } = lay(file);
    const place = pagePlace(laid.pages, blocks, secondOpening(file));
    expect(place.elementId).toBeTruthy();
    expect(elementIds(file).has(place.elementId as string)).toBe(true);
  });

  it('answers with a real element on a chapter page that carries nothing else', () => {
    // §9p's fallback had the same hole one page over: it took the next body
    // block, which on this book is the following section's stand-in.
    const file = imported();
    const { blocks, laid, rows } = lay(file);
    const first = rows.find((row) => row.says === 'Chapter opens')!;
    const place = pagePlace(laid.pages, blocks, first.sheet);
    expect(place.elementId).toBeTruthy();
    expect(elementIds(file).has(place.elementId as string)).toBe(true);
  });

  it('takes a blank page, and the whole opening moves on', () => {
    // Ken's own sequence, and his own words for what should happen.
    const file = imported();
    const sheet = secondOpening(file);
    const { blocks, laid, rows } = lay(file);
    const spot = blankSpot(pagePlace(laid.pages, blocks, sheet), rows.find((row) => row.sheet === sheet)!)!;
    const after = setBlankPage(file, spot, true);
    expect(after).not.toBe(file);
    expect(shape(after)[sheet - 1]).toBe('blank');
    // The numeral and its words travel together, one page on.
    expect(shape(after)[sheet]).toBe(shape(file)[sheet - 1]);
    expect(shape(after).length).toBe(shape(file).length + 1);
  });

  it('opens with a picture, which stands in front of the numeral', () => {
    // *So if I want to open with a picture, I can.* The stand-in waits for
    // the page-figures in front of it rather than being drawn first.
    const file = imported();
    const sheet = secondOpening(file);
    const { blocks, laid } = lay(file);
    const before = pagePlace(laid.pages, blocks, sheet).elementId as string;
    const made = pictureBefore(file, before);
    expect(made.elementId).toBeTruthy();
    const drawn = shape(made.file);
    const at = drawn.findIndex((one) => one === 'figure');
    expect(at).toBeGreaterThan(-1);
    // The picture is the page, and the chapter opens after it.
    expect(drawn[at + 1]).toMatch(/^heading/);
  });

  it('stands between the story’s page and its numeral, never in front of both', () => {
    /**
     * §9t, and a correction to what this test first asserted. The section
     * carrying the story's marker **opens twice** — once with the story's own
     * page and again with its numeral — and §9p's hoist, written for a
     * chapter whose opening and first words share a page, carried a picture
     * asked for on the numeral's page all the way past the story's.
     *
     * Ken: *I go to add a picture on that page, which should shift that Roman
     * numeral to the following page. But instead it adds the picture on the
     * opposite of the chapter page.* So the hoist is now refused wherever
     * something else would stand between the picture and the opening.
     */
    const file = imported();
    const { blocks, laid, rows } = lay(file);
    const first = rows.find((row) => row.says === 'Chapter opens')!;
    const before = pagePlace(laid.pages, blocks, first.sheet).elementId as string;
    const drawn = shape(pictureBefore(file, before).file);
    const at = drawn.findIndex((one) => one === 'figure');
    expect(at).toBeGreaterThan(-1);
    // The story's page is still in front of it, and the numeral follows.
    expect(drawn[at - 1]).toBe('chapter_opening');
    expect(drawn[at + 1]).toMatch(/^heading/);
  });

  it('still prints the numeral where a section is nothing but pictures', () => {
    // The held-back head is flushed at the end of the unit, so it can never
    // be lost by a section that never reaches a paragraph.
    const file = imported();
    const sheet = secondOpening(file);
    const { blocks, laid } = lay(file);
    const before = pagePlace(laid.pages, blocks, sheet).elementId as string;
    const art = addGraphic(file, { name: 'Plate', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    const beat = art.file.beats.find((one) =>
      one.manuscript.elements.some((element) => (element.id as string) === before),
    )!;
    const made = placeFigure(art.file, {
      beatId: beat.id,
      assetId: art.asset.id as never,
      beforeElementId: before as never,
      caption: '',
      attributes: { bookPlace: 'page' },
    });
    const heads = bookBlocks(pictureBefore(file, before).file).filter((block) => block.standsIn === true);
    expect(heads).toHaveLength(3);
  });
});

describe('a book nobody has asked anything of', () => {
  it('is laid exactly as it was', () => {
    // The stand-in is unchanged in the printed order: this is a fix to what
    // a page *answers*, never to what it prints.
    const file = imported();
    expect(shape(file).filter((one) => one === 'blank')).toHaveLength(0);
    expect(bookBlocks(file).filter((block) => block.standsIn === true)).toHaveLength(3);
  });
});
