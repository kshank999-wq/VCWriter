import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  beginStory,
  bookRows,
  createProjectFile,
  moveFigureBefore,
  pagePlace,
  pagesUnder,
  partsOf,
  placeFigure,
  removeBookRow,
  updateBeat,
  whatGoesWithRow,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * The rail as one list (addendum 20 §9a, from Ken): the book in the order it
 * is bound, a row per thing, containment by depth and nothing else.
 */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

/** A novel of two chapters, the first carrying a picture in its words. */
const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const asset = assetSchema.parse({
    id: '22222222-2222-4222-8222-222222222222',
    projectId: file.project.id,
    kind: 'image',
    name: 'harbour.png',
    data: PNG,
    width: 1200,
    height: 800,
    altText: 'The harbour',
    createdAt: file.savedAt,
    updatedAt: file.savedAt,
  });
  file = { ...file, assets: [asset] };

  const one = file.units[0]!;
  file = addMarker(file, { unitId: one.id, kind: 'chapter', title: 'The Road' }).file;
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        para('p1', 'One.'),
        { id: 'f1' as never, type: 'figure' as const, text: 'The harbour at dusk', characterId: null, attributes: { assetId: asset.id } },
        para('p2', 'Two.'),
      ],
    },
  });

  const two = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Second' });
  file = addMarker(two.file, { unitId: two.unit.id, kind: 'chapter', title: 'The Lane' }).file;
  const made = addBeat(file, { unitId: two.unit.id });
  file = updateBeat(made.file, made.beat.id, { manuscript: { elements: [para('p3', 'Three.')] } });
  return file;
};

describe('the book as one list', () => {
  it('runs front matter, the story and the back matter in one sequence, with no headings to read', () => {
    const rows = bookRows(novel());
    expect(rows.map((row) => `${'  '.repeat(row.depth)}${row.title}`)).toEqual([
      'Half title',
      'Title page',
      'Copyright',
      'Contents',
      'The Road',
      '  The harbour at dusk',
      'The Lane',
      'About the author',
    ]);
  });

  it('sits a picture under the chapter it is in, and nothing else is nested', () => {
    const rows = bookRows(novel());
    expect(rows.filter((row) => row.depth > 0).map((row) => row.kind)).toEqual(['picture']);
    expect(rows.find((row) => row.title === 'The harbour at dusk')?.depth).toBe(1);
  });

  it('names a picture page by its picture rather than by the word for the kind', () => {
    let file = novel();
    file = addPart(file, 'plate', { assetId: '22222222-2222-4222-8222-222222222222', inFront: true }).file;
    expect(bookRows(file).map((row) => row.title)).toContain('harbour.png');
  });

  it('lists a picture page facing a chapter just before that chapter', () => {
    let file = novel();
    const marker = file.markers.find((one) => one.title === 'The Lane')!;
    file = addPart(file, 'plate', { assetId: '22222222-2222-4222-8222-222222222222', beforeMarkerId: marker.id as string }).file;
    const titles = bookRows(file).map((row) => row.title);
    expect(titles.indexOf('harbour.png')).toBe(titles.indexOf('The Lane') - 1);
  });
});

describe('taking a row out', () => {
  it('takes a story added by accident away whole, its empty section with it', () => {
    let file = createProjectFile({ title: 'Nine Doors', format: 'short_story', author: 'M. Shank' });
    file = addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'The Door' }).file;
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [para('p1', 'One.')] } });
    const units = file.units.length;
    file = beginStory(file, { title: 'New story' }).file;
    expect(file.units.length).toBe(units + 1);

    const row = bookRows(file).find((one) => one.title === 'New story')!;
    expect(whatGoesWithRow(file, row)).toContain('Nothing is written in it');
    const after = removeBookRow(file, row);
    expect(after.units.length).toBe(units);
    expect(after.markers.some((marker) => marker.title === 'New story')).toBe(false);
    expect(bookRows(after).map((one) => one.title)).not.toContain('New story');
  });

  it('keeps every word when a chapter that holds writing is taken out', () => {
    const file = novel();
    const row = bookRows(file).find((one) => one.title === 'The Lane')!;
    expect(whatGoesWithRow(file, row)).toContain('not a word is cut');
    const after = removeBookRow(file, row);
    expect(after.beats.flatMap((beat) => beat.manuscript.elements.map((element) => element.text))).toContain('Three.');
    expect(after.units.length).toBe(file.units.length);
    expect(after.markers.length).toBe(file.markers.length - 1);
  });

  it('takes a picture out of the writing and leaves it in the library', () => {
    const file = novel();
    const row = bookRows(file).find((one) => one.kind === 'picture')!;
    const after = removeBookRow(file, row);
    expect(bookRows(after).some((one) => one.kind === 'picture')).toBe(false);
    expect(after.assets.length).toBe(file.assets.length);
  });

  it('takes a part out by the same press', () => {
    const file = novel();
    const row = bookRows(file).find((one) => one.title === 'Copyright')!;
    expect(partsOf(removeBookRow(file, row)).some((part) => part.kind === 'copyright')).toBe(false);
  });
});

describe('a picture on the page it was added to', () => {
  it('goes in before the first thing on the page, so the words move down', () => {
    const file = novel();
    const beat = file.beats[0]!;
    const made = placeFigure(file, { beatId: beat.id, assetId: file.assets[0]!.id, beforeElementId: 'p2' as never });
    const elements = made.file.beats[0]!.manuscript.elements.map((element) => element.id as string);
    expect(elements).toEqual(['p1', 'f1', made.elementId, 'p2']);
  });

  it('makes a box with no picture in it, for one chosen afterwards', () => {
    const file = novel();
    const made = placeFigure(file, { beatId: file.beats[0]!.id, beforeElementId: 'p1' as never, attributes: { bookPlace: 'left' } });
    const box = made.file.beats[0]!.manuscript.elements[0]!;
    expect(box.type).toBe('figure');
    expect(box.attributes.assetId).toBeUndefined();
    expect(box.attributes.bookPlace).toBe('left');
  });

  it('moves a picture to the page the box was drawn on rather than making a second one', () => {
    const file = novel();
    const moved = moveFigureBefore(file, 'f1', 'p3');
    expect(moved.beats[0]!.manuscript.elements.map((element) => element.id as string)).toEqual(['p1', 'p2']);
    const other = moved.beats.find((beat) => beat.manuscript.elements.some((element) => (element.id as string) === 'p3'))!;
    expect(other.manuscript.elements.map((element) => element.id as string)).toEqual(['f1', 'p3']);
  });

  it('reads a page back to the element it opens with and the chapter it is in', () => {
    const pages = [
      { sheet: 1, pieces: [{ blockId: 'm1', from: 0, to: 1 }] },
      { sheet: 2, pieces: [{ blockId: 'p2', from: 0, to: 4 }] },
    ] as never;
    const blocks = [
      { id: 'm1', kind: 'chapter_opening' },
      { id: 'p2', kind: 'paragraph' },
    ] as never;
    // Page 2 is inside chapter m1 but does not open it: `markerId` is the
    // chapter in force, `opensMarkerId` the chapter whose opening stands on
    // **this** page, which §9r needs so a blank asked for on a chapter's own
    // page goes before the opening rather than splitting the chapter.
    expect(pagePlace(pages, blocks, 2)).toEqual({
      elementId: 'p2',
      partId: null,
      markerId: 'm1',
      opensMarkerId: null,
      opensAlone: false,
    });
    // And page 1, which does open it.
    expect(pagePlace(pages, blocks, 1).opensMarkerId).toBe('m1');
    expect(pagePlace(pages, blocks, 1).opensAlone).toBe(true);
  });
});

/**
 * The fold lists every page of a division (§9m, from Ken twice). The old
 * reading matched ids, and a unit with no title has no row to match — so its
 * pages fell back to the story and the numeral above them folded open short.
 */
describe('what a division folds open on', () => {
  /** Pages as `bookPageRows` reads them: a story, three numerals, one of them untitled. */
  const rail = [
    { id: 'story', kind: 'chapter', title: 'In For A Pound', label: '', depth: 0, half: 'body', draggable: true },
    { id: 'u1', kind: 'section', title: 'I.', label: '', depth: 1, half: 'body', draggable: false },
    { id: 'u3', kind: 'section', title: 'II.', label: '', depth: 1, half: 'body', draggable: false },
  ] as never as Parameters<typeof pagesUnder>[0];
  const page = (sheet: number, unitId: string | null, extra: Record<string, unknown> = {}) =>
    ({
      sheet,
      folio: String(sheet),
      counted: String(sheet),
      says: 'Text',
      markerId: 'story',
      unitId,
      partId: null,
      figureId: null,
      elementId: null,
      blankFor: null,
      blank: false,
      ...extra,
    }) as never;

  const pages = [
    { ...(page(1, null) as object), partId: 'front' } as never,
    page(2, null, { says: 'Chapter opens' }),
    page(3, 'u1', { says: 'Chapter opens' }),
    // The pages a unit per paragraph puts in an untitled unit — no row of
    // their own, and the whole of what the old reading lost.
    page(4, 'u2'),
    page(5, 'u2', { says: 'Illustration' }),
    page(6, 'u2', { says: 'Blank', blank: true }),
    page(7, 'u3', { says: 'Chapter opens' }),
    page(8, 'u4'),
  ];

  it('gives a numeral every page between it and the next, titled unit or not', () => {
    const under = pagesUnder(rail, pages);
    expect(under.get('u1')?.map((one) => one.sheet)).toEqual([3, 4, 5, 6]);
    expect(under.get('u3')?.map((one) => one.sheet)).toEqual([7, 8]);
  });

  it('leaves the story only the pages before its first numeral', () => {
    expect(pagesUnder(rail, pages).get('story')?.map((one) => one.sheet)).toEqual([2]);
  });

  it('accounts for every page of the story exactly once', () => {
    const under = pagesUnder(rail, pages);
    const listed = [...under.values()].flat().map((one) => one.sheet);
    expect([...listed].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('gives a part page to nobody, a part having a row of its own', () => {
    const under = pagesUnder(rail, pages);
    expect([...under.values()].flat().some((one) => one.sheet === 1)).toBe(false);
  });
});
