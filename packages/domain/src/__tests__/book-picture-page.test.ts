import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  beatsInScript,
  buildProjectFromImport,
  addPart,
  addUnit,
  backBlank,
  bookBlocks,
  bookFigures,
  bookPageRows,
  bookSettingsSchema,
  createProjectFile,
  geometryOf,
  layPages,
  partsOf,
  placeBookFigure,
  plateIntoStory,
  setBackBlank,
  setBlankBefore,
  textToProse,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * A picture inside the story, put on a page of the book (addendum 20 §9i,
 * from Ken: *I can drag it in between the pages, and it will change the
 * numbering of the pages… the illustration will count as a numbered page but
 * there'll be no printing of the page number on that page*, and then *you
 * need to have an option for the back page to be blank, so the illustration
 * doesn't bleed through*).
 *
 * Two facts carry the module and both are tested here rather than described:
 * a picture page **counts** and **prints nothing**, and the leaf behind it
 * does the same when the writer asks for one.
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const settings = () => bookSettingsSchema.parse({ trim: { width: 6, height: 9 } });

/**
 * The pages, with made-up counts — which is all a measurement is to the
 * cutter. A paragraph is deep enough to take a page of its own, so what is
 * asserted about where the words land is legible.
 */
const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const laid = layPages(
    blocks,
    new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 30 : 1])),
    geometryOf(settings(), 'novel', 200),
    settings(),
    { title: 'The Lamp', author: 'M. Shank' },
  );
  const index = new Map(blocks.map((block) => [block.id, block]));
  const kindsOn = (page: (typeof laid.pages)[number]) => page.pieces.map((piece) => index.get(piece.blockId)?.kind);
  return { pages: laid.pages, blocks, kindsOn };
};

/** Two chapters of plain words, with one picture in the first. */
const book = (): { file: ProjectFile; assetId: string; figureId: string } => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const asset = assetSchema.parse({
    id: '33333333-3333-4333-8333-333333333333',
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
  const later = addBeat(file, { unitId: two.unit.id, title: 'b' });
  file = updateBeat(later.file, later.beat.id, { manuscript: { elements: [para('p3', 'Three.')] } });

  return { file, assetId: asset.id as string, figureId: 'f1' };
};

describe('a picture on a page of its own', () => {
  it('counts as a page and prints no number, and the story picks up on the next one', () => {
    const { file, figureId } = book();
    const { pages, kindsOn } = lay(placeBookFigure(file, figureId, { place: 'page' }));
    const at = pages.findIndex((page) => kindsOn(page).includes('figure'));
    expect(at).toBeGreaterThan(0);
    const picture = pages[at]!;
    const before = pages[at - 1]!;
    const after = pages[at + 1]!;

    // Ken's own arithmetic: page six, the illustration is page seven, and the
    // story picks up at eight.
    expect(picture.number).toBe(before.number + 1);
    expect(after.number).toBe(picture.number + 1);
    // …with nothing printed on it. Not a folio and not a running head.
    expect(picture.folio).toBe('');
    expect(picture.runningHead).toBe('');
    expect(before.folio).not.toBe('');
  });

  it('leaves the leaf behind it blank when the writer asks, and that leaf counts too', () => {
    const { file, figureId } = book();
    const placed = placeBookFigure(file, figureId, { place: 'page' });
    expect(bookFigures(placed)[0]!.backBlank).toBe(false);

    const asked = setBackBlank(placed, figureId, true);
    expect(bookFigures(asked)[0]!.backBlank).toBe(true);
    const kinds = bookBlocks(asked).map((block) => block.kind);
    expect(kinds[kinds.indexOf('figure') + 1]).toBe('blank');

    const { pages, kindsOn } = lay(asked);
    const at = pages.findIndex((page) => kindsOn(page).includes('figure'));
    const back = pages[at + 1]!;
    const then = pages[at + 2]!;
    // 44 text, 45 picture, 46 blank, 47 text: only 44 and 47 wear a number.
    expect(back.folio).toBe('');
    expect(back.number).toBe(pages[at]!.number + 1);
    expect(then.number).toBe(back.number + 1);
    expect(then.folio).not.toBe('');

    // And asking twice is one leaf, not two.
    expect(bookBlocks(setBackBlank(asked, figureId, true)).filter((block) => block.kind === 'blank')).toHaveLength(1);
    expect(bookBlocks(setBackBlank(asked, figureId, false)).some((block) => block.kind === 'blank')).toBe(false);
  });

  /**
   * The answer goes with the page. A picture cut into the text has no back
   * leaf to leave, so an answer left behind on it would come back the next
   * time it was made a page again — a setting nobody could see, changing the
   * book when something else was asked for.
   */
  it('forgets the blank leaf when the picture stops being a page', () => {
    const { file, figureId } = book();
    const asked = setBackBlank(placeBookFigure(file, figureId, { place: 'page' }), figureId, true);
    const cut = placeBookFigure(asked, figureId, { place: 'left' });
    const element = cut.beats[0]!.manuscript.elements.find((one) => (one.id as string) === figureId)!;
    expect(backBlank(element)).toBe(false);
    expect(bookBlocks(cut).some((block) => block.kind === 'blank')).toBe(false);
  });
});

describe('a blank page the writer puts in', () => {
  it('takes a page, slides what followed down, and prints nothing', () => {
    const { file } = book();
    const laid = lay(file);
    const rows = bookPageRows(laid.pages, laid.blocks);
    const words = rows.find((row) => row.says === 'Text')!;
    const before = words.folio;

    const asked = setBlankBefore(file, words.elementId!, true);
    const after = lay(asked);
    const now = bookPageRows(after.pages, after.blocks);
    const leaf = now.find((row) => row.sheet === words.sheet)!;

    // The blank stands where the words stood, and they are a page further on.
    expect(leaf.says).toBe('Blank');
    expect(leaf.folio).toBe('');
    expect(leaf.blankFor).toBe(words.elementId);
    const moved = now.find((row) => row.elementId === words.elementId)!;
    expect(moved.sheet).toBe(words.sheet + 1);
    expect(Number(moved.folio)).toBe(Number(before) + 1);

    // …and it goes away again by the same field, leaving the book as it was.
    expect(bookBlocks(setBlankBefore(asked, words.elementId!, false)).some((block) => block.kind === 'blank')).toBe(false);
  });

  /**
   * A leaf the cutter left — the verso before a chapter that opens on a
   * recto — is not the writer's to remove there, and saying otherwise would
   * offer a button that cannot keep its word.
   */
  it('is told apart from a leaf the cutter left', () => {
    const { file } = book();
    const laid = lay(file);
    const rows = bookPageRows(laid.pages, laid.blocks);
    const left = rows.find((row) => row.says === 'Blank');
    if (left) expect(left.blankFor).toBeNull();
  });
});

describe('bringing an art page into the story', () => {
  it('becomes a picture page in the writing, at the page it was dropped on, and the part goes', () => {
    const { file, assetId } = book();
    const made = addPart(file, 'plate', { caption: 'The harbour' });
    const withArt = { ...made.file, book: made.file.book };
    const plateId = made.partId!;
    // The picture the plate carries.
    const carrying = partsOf(withArt).find((part) => part.id === plateId)!;
    expect(carrying.kind).toBe('plate');
    const ready = {
      ...withArt,
      settings: {
        ...withArt.settings,
        book: {
          ...withArt.settings.book,
          parts: partsOf(withArt).map((part) => (part.id === plateId ? { ...part, assetId } : part)),
        },
      },
    } as ProjectFile;

    const laid = lay(ready);
    const rows = bookPageRows(laid.pages, laid.blocks);
    const onWords = rows.find((row) => row.elementId !== null && row.says !== 'Picture')!;
    const brought = plateIntoStory(ready, plateId, onWords.elementId!);

    expect(brought.elementId).not.toBeNull();
    // The plate is gone: one picture, in one place.
    expect(partsOf(brought.file).some((part) => part.id === plateId)).toBe(false);
    const figure = bookFigures(brought.file).find((one) => one.elementId === brought.elementId)!;
    expect(figure.placement.place).toBe('page');
    expect(figure.assetId).toBe(assetId);
  });

  it('refuses what is not a plate, and a page with nothing to stand before', () => {
    const { file } = book();
    const contents = partsOf(file).find((part) => part.kind === 'contents')!;
    expect(plateIntoStory(file, contents.id, 'p1').elementId).toBeNull();
    const made = addPart(file, 'plate');
    expect(plateIntoStory(made.file, made.partId!, 'no-such-element').elementId).toBeNull();
    expect(plateIntoStory(made.file, made.partId!, 'no-such-element').file).toBe(made.file);
  });
});

/**
 * A collection's chapters (addendum 20 §9j, from Ken: *the first chapter has
 * a Roman numeral I with a period, but it still doesn't recognise it in the
 * layout… page two is actually Roman numeral one, and the page format is
 * incorrect, where it should look like a chapter page*).
 *
 * Two faults met here, and both were one-liners standing on a wrong reason.
 */
describe('the first chapter of a story', () => {
  const collection = (): ProjectFile => {
    const words = (n: number) => `${`Word${n} `.repeat(40)}`.trim();
    const text = ['I.', '', words(1), '', words(2), '', 'II.', '', words(3), '', 'III.', '', words(4)].join('\n');
    let file = buildProjectFromImport(textToProse(text, { title: 'In For A Pound' }), {
      format: 'short_story',
      title: "Villain's Tales",
    }).file;
    const first = unitsInStoryOrder(file)[0]!;
    return addMarker(file, { unitId: first.id, kind: 'chapter', title: 'In For A Pound' }).file;
  };

  /**
   * The importer drops the first heading because it names the story. A bare
   * numeral names nothing — the story was named by the file on disk — so
   * dropping it lost the one chapter heading that could not be got back.
   */
  it('keeps a bare numeral the importer used to eat as the story’s title', () => {
    const file = collection();
    const units = unitsInStoryOrder(file);
    expect(units.map((unit) => unit.title)).toEqual(['I.', 'II.', 'III.']);
    for (const unit of units) {
      const first = beatsInScript(file, unit.id).flatMap((beat) => beat.manuscript.elements)[0];
      expect(first?.type).toBe('heading');
      expect(first?.text).toBe(unit.title);
    }
  });

  it('opens a page of its own, like every other chapter in the book', () => {
    const blocks = bookBlocks(collection());
    const heads = blocks.filter((block) => block.kind === 'heading');
    expect(heads.map((block) => block.text)).toEqual(['I.', 'II.', 'III.']);
    // Each one starts a page — the whole of what *looks like a chapter page*
    // means here — and none is left running on under the story's own opening.
    for (const head of heads) expect(head.starts).toBe('page');
  });

  /**
   * A page belongs to the division running on it. The unit in force used to
   * run past its own writing, so folding the last chapter of a story open
   * listed the next story's opening page and the blank leaf before it.
   */
  it('does not lend its pages to the story after it', () => {
    const file = collection();
    const laid = lay(file);
    const rows = bookPageRows(laid.pages, laid.blocks);
    const units = new Set(unitsInStoryOrder(file).map((unit) => unit.id as string));
    for (const row of rows) {
      if (row.unitId === null) continue;
      expect(units.has(row.unitId)).toBe(true);
    }
    // And the numeral's own page says a chapter opens on it.
    const opens = rows.filter((row) => row.says === 'Chapter opens');
    expect(opens.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * The back of a leaf is the other side of that sheet (§9j, from Ken: *when
 * you insert a picture on the left-hand page, leaving a blank page just makes
 * the next page blank — it's not the back of the page*).
 */
describe('which side a picture with a blank back takes', () => {
  it('takes a right-hand page, so the leaf after it really is its back', () => {
    const { file, figureId } = book();
    const plain = bookBlocks(placeBookFigure(file, figureId, { place: 'page' })).find((block) => block.kind === 'figure')!;
    expect(plain.starts).toBe('page');

    const asked = setBackBlank(placeBookFigure(file, figureId, { place: 'page' }), figureId, true);
    const figure = bookBlocks(asked).find((block) => block.kind === 'figure')!;
    expect(figure.starts).toBe('recto');

    const { pages, kindsOn } = lay(asked);
    const at = pages.findIndex((page) => kindsOn(page).includes('figure'));
    expect(pages[at]!.side).toBe('recto');
    // The blank really is behind it: the same sheet's other side.
    expect(pages[at + 1]!.side).toBe('verso');
    expect(kindsOn(pages[at + 1]!)).toContain('blank');
    // …and the words start again on the page after that.
    expect(pages[at + 2]!.folio).not.toBe('');
  });
});

/**
 * A chapter inside a story that the manuscript never gave a heading
 * (addendum 20 §9l, from Ken: *how that page is formatted, it should be the
 * same for the first chapter*).
 *
 * §9j taught the importer to keep a bare numeral. A book imported before that
 * has a first section with no heading element at all, and one chapter in the
 * book opening differently from every other is a fault whichever way it was
 * arrived at — so the unit's own title stands in.
 */
describe('a section whose heading the manuscript lost', () => {
  const eaten = (): ProjectFile => {
    const words = (n: number) => `${`Word${n} `.repeat(40)}`.trim();
    const text = ['I.', '', words(1), '', 'II.', '', words(2), '', 'III.', '', words(3)].join('\n');
    let file = buildProjectFromImport(textToProse(text, { title: 'In For A Pound' }), {
      format: 'short_story',
      title: "Villain's Tales",
    }).file;
    const first = unitsInStoryOrder(file)[0]!;
    file = addMarker(file, { unitId: first.id, kind: 'chapter', title: 'In For A Pound' }).file;
    // What an older import left behind: the numeral gone from the words.
    const beat = beatsInScript(file, first.id)[0]!;
    return updateBeat(file, beat.id, {
      manuscript: { elements: beat.manuscript.elements.filter((one) => one.type !== 'heading') },
    });
  };

  it('opens its page anyway, with the words the rail already shows', () => {
    const file = eaten();
    const heads = bookBlocks(file).filter((block) => block.kind === 'heading');
    expect(heads.map((block) => block.text)).toEqual(['I.', 'II.', 'III.']);
    for (const head of heads) expect(head.starts).toBe('page');
    // The manuscript is untouched: the page is made, the writing is not.
    const first = unitsInStoryOrder(file)[0]!;
    expect(beatsInScript(file, first.id).flatMap((beat) => beat.manuscript.elements).some((one) => one.type === 'heading')).toBe(
      false,
    );
  });

  /** Nothing is invented: a section the writer left unnamed prints nothing. */
  it('prints none where the section has no title either', () => {
    let file = eaten();
    const first = unitsInStoryOrder(file)[0]!;
    file = { ...file, units: file.units.map((unit) => (unit.id === first.id ? { ...unit, title: '' } : unit)) };
    expect(bookBlocks(file).filter((block) => block.kind === 'heading').map((block) => block.text)).toEqual(['II.', 'III.']);
  });
});

describe('every page says which page it is', () => {
  /**
   * From Ken: *it should say page two, page three, page four, page five… and
   * if there is an illustration on a page it will say page three and have
   * something that says illustration, or if it's blank, it'll say blank.*
   */
  it('counts an illustration and a blank leaf like any other page, though neither prints a folio', () => {
    const { file, figureId } = book();
    const asked = setBackBlank(placeBookFigure(file, figureId, { place: 'page' }), figureId, true);
    const laid = lay(asked);
    const rows = bookPageRows(laid.pages, laid.blocks);
    const art = rows.find((row) => row.says === 'Illustration')!;
    const back = rows[rows.indexOf(art) + 1]!;

    // Neither prints a number…
    expect(art.folio).toBe('');
    expect(back.folio).toBe('');
    // …and both know which page they are.
    expect(Number(art.counted)).toBeGreaterThan(0);
    expect(Number(back.counted)).toBe(Number(art.counted) + 1);
    expect(back.says).toBe('Blank');
    // Every page in the book has one, printed or not.
    for (const row of rows) expect(row.counted.length).toBeGreaterThan(0);
  });
});
