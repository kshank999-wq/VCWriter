import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
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
