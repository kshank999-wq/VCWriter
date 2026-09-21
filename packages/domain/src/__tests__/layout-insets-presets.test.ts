import { describe, expect, it } from 'vitest';
import {
  BOOK_PRESETS,
  addMarker,
  addPart,
  addPartInset,
  partOfInset,
  partTakesInsets,
  partsOf,
  removePartInset,
  updatePart,
  updatePartInset,
  applyBookPreset,
  bookBlocks,
  bookFigures,
  bookPresetOf,
  bookSettingsOf,
  createProjectFile,
  ebookOf,
  figurePlacement,
  placeBookFigure,
  renderBookBlock,
  setBookSettings,
  updateBeat,
  chapterPageStyleSchema,
  geometryOf,
  type BookRenderContext,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * Layout stages 6 and 7 (addendum 20 §8, §6): a figure cut into the text at
 * a side, and the three type presets.
 */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const unit = file.units[0]!;
  file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: 'The Road' }).file;
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
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        { id: 'p1' as never, type: 'paragraph', text: 'One.', characterId: null, attributes: {} },
        { id: 'f1' as never, type: 'figure', text: 'The harbour at dusk', characterId: null, attributes: { assetId: asset.id } },
        { id: 'p2' as never, type: 'paragraph', text: 'Two, beside the picture.', characterId: null, attributes: {} },
        { id: 'p3' as never, type: 'paragraph', text: 'Three.', characterId: null, attributes: {} },
      ],
    },
  });
  return file;
};

const contextFor = (file: ProjectFile): BookRenderContext => {
  const settings = bookSettingsOf(file);
  const asset = file.assets[0]!;
  return {
    settings,
    geometry: geometryOf(settings, 'novel', 100),
    chapterStyle: chapterPageStyleSchema.parse({}),
    paragraphStyle: 'indented',
    pictures: new Map([[asset.id as string, { data: asset.data, altText: asset.altText, width: asset.width, height: asset.height }]]),
    names: { title: 'The Lamp', author: 'M. Shank', imprint: '' },
    titlePage: { title: '', author: '', titleImage: '' },
    contents: [],
    index: null,
  } as unknown as BookRenderContext;
};

describe('a figure cut into the text (stage 6)', () => {
  it('stands across the measure until placed, and the manuscript never reads the placement', () => {
    const file = novel();
    const figure = file.beats[0]!.manuscript.elements[1]!;
    expect(figurePlacement(figure)).toEqual({ place: 'measure', span: 0.4, side: 'either', standoff: 1 });
    const kinds = bookBlocks(file).map((block) => `${block.kind}${block.inset ? '+inset' : ''}`);
    expect(kinds.filter((kind) => kind.startsWith('paragraph') || kind === 'figure')).toEqual(['paragraph', 'figure', 'paragraph', 'paragraph']);
  });

  it('rides in the paragraph after it once placed at a side, which is then set whole', () => {
    const file = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.35 });
    const figure = file.beats[0]!.manuscript.elements[1]!;
    expect(figure.attributes).toEqual({ assetId: '22222222-2222-4222-8222-222222222222', bookPlace: 'left', bookSpan: 0.35 });
    // The manuscript's own element list is untouched in order and kind.
    expect(file.beats[0]!.manuscript.elements.map((element) => element.type)).toEqual(['paragraph', 'figure', 'paragraph', 'paragraph']);

    const blocks = bookBlocks(file);
    const kinds = blocks.map((block) => `${block.kind}${block.inset ? '+inset' : ''}`).filter((kind) => kind.startsWith('paragraph') || kind === 'figure');
    expect(kinds).toEqual(['paragraph', 'paragraph+inset', 'paragraph']);
    const wrapped = blocks.find((block) => block.inset)!;
    expect(wrapped.inset).toMatchObject({ place: 'left', span: 0.35, figureId: 'f1', caption: 'The harbour at dusk' });
    expect(wrapped.unbreakable).toBe(true);
    expect(wrapped.text).toBe('Two, beside the picture.');
  });

  it('clamps the span, and across the measure clears what was written', () => {
    let file = placeBookFigure(novel(), 'f1', { place: 'right', span: 0.9 });
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!)).toEqual({ place: 'right', span: 0.6, side: 'either', standoff: 1 });
    file = placeBookFigure(file, 'f1', { place: 'measure', span: 0.4 });
    expect(file.beats[0]!.manuscript.elements[1]!.attributes).toEqual({ assetId: '22222222-2222-4222-8222-222222222222' });
  });

  it('stands across the measure where nothing follows to cut into', () => {
    let file = novel();
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          { id: 'p1' as never, type: 'paragraph', text: 'One.', characterId: null, attributes: {} },
          { id: 'f1' as never, type: 'figure', text: 'Last', characterId: null, attributes: { assetId: '22222222-2222-4222-8222-222222222222', bookPlace: 'left' } },
        ],
      },
    });
    const kinds = bookBlocks(file).map((block) => block.kind);
    expect(kinds.filter((kind) => kind === 'figure')).toEqual(['figure']);
  });

  it('draws the inset as a float inside the paragraph, its proportions declared, tagged for the screen', () => {
    const file = placeBookFigure(novel(), 'f1', { place: 'right', span: 0.3 });
    const wrapped = bookBlocks(file).find((block) => block.inset)!;
    const html = renderBookBlock(wrapped, contextFor(file));
    expect(html).toContain('<p class="bk-p bk-has-inset">');
    expect(html).toContain('<span class="bk-inset bk-inset-right" data-figure="f1" style="width:30%;--bk-standoff:1.00em">');
    expect(html).toContain('aspect-ratio:1200 / 800');
    expect(html).toContain('<span class="bk-inset-caption">The harbour at dusk</span>');
    expect(html).toContain('Two, beside the picture.</p>');
  });

  it('draws an art page as the picture alone, edge to edge, with its description spoken and never printed', () => {
    const file = addPart(novel(), 'plate', { assetId: '22222222-2222-4222-8222-222222222222', caption: 'The harbour at dawn', inFront: true }).file;
    const plate = bookBlocks(file).find((block) => block.kind === 'plate')!;
    const html = renderBookBlock(plate, contextFor(file));
    expect(html).toContain('<div class="bk-display bk-plate bk-plate-art">');
    expect(html).toContain('alt="The harbour"');
    expect(html).not.toContain('bk-caption');
    expect(html).not.toContain('The harbour at dawn');
    // Without a picture there is nothing to fill the page with, and it says so.
    const empty = addPart(novel(), 'plate', { caption: 'Missing' }).file;
    const bare = renderBookBlock(bookBlocks(empty).find((block) => block.kind === 'plate')!, contextFor(empty));
    expect(bare).toContain('<div class="bk-display bk-plate">');
    expect(bare).toContain('No picture chosen');
  });

  it('cuts a picture into a paragraph of a foreword, the same inset the manuscript makes, and keeps it when the paragraph goes', () => {
    let file = addPart(novel(), 'foreword', { text: 'One.\n\nTwo, with the picture beside it.\n\nThree.' }).file;
    const foreword = partsOf(file).find((part) => part.kind === 'foreword')!;
    expect(partTakesInsets('foreword')).toBe(true);
    expect(partTakesInsets('dedication')).toBe(false);
    expect(partTakesInsets('contents')).toBe(false);
    const made = addPartInset(file, foreword.id, { assetId: '22222222-2222-4222-8222-222222222222', paragraph: 1, place: 'right', span: 0.9, caption: 'At the harbour' });
    file = made.file;
    expect(made.insetId).not.toBeNull();
    const blocks = bookBlocks(file).filter((block) => block.partId === foreword.id);
    expect(blocks.map((block) => (block.inset ? 'paragraph+inset' : block.kind))).toEqual(['part_opening', 'paragraph', 'paragraph+inset', 'paragraph']);
    const cut = blocks[2]!;
    expect(cut.inset).toMatchObject({ place: 'right', span: 0.6, figureId: made.insetId, caption: 'At the harbour' });
    expect(cut.unbreakable).toBe(true);
    const html = renderBookBlock(cut, contextFor(file));
    expect(html).toContain('<p class="bk-p bk-has-inset">');
    expect(html).toContain(`<span class="bk-inset bk-inset-right" data-figure="${made.insetId}" style="width:60%;--bk-standoff:1.00em">`);
    expect(partOfInset(file, made.insetId!)?.id).toBe(foreword.id);
    // The text shortened under it: the picture rides in the last paragraph rather than vanishing.
    const shorter = updatePart(file, foreword.id, { text: 'Only one paragraph now.' });
    const last = bookBlocks(shorter).filter((block) => block.partId === foreword.id);
    expect(last.map((block) => Boolean(block.inset))).toEqual([false, true]);
    // No paragraph at all: nothing to cut into, and the picture waits.
    const empty = updatePart(file, foreword.id, { text: '' });
    expect(bookBlocks(empty).filter((block) => block.partId === foreword.id).some((block) => block.inset)).toBe(false);
    // Moved to the left and narrower, then taken out.
    const moved = updatePartInset(file, foreword.id, made.insetId!, { place: 'left', span: 0.25 });
    expect(bookBlocks(moved).find((block) => block.inset)!.inset).toMatchObject({ place: 'left', span: 0.25 });
    const gone = removePartInset(moved, foreword.id, made.insetId!);
    expect(bookBlocks(gone).some((block) => block.inset)).toBe(false);
    // A part with no paragraphs to speak of refuses one.
    const dedication = addPart(file, 'dedication', { text: 'For M.' });
    expect(addPartInset(dedication.file, dedication.partId!, {}).insetId).toBeNull();
  });

  it('makes a picture a page of its own inside the story, on the side asked for, with no head or folio', () => {
    const base = novel();
    // Across the measure, it flows with the text and carries a folio.
    const flowing = bookBlocks(base).find((block) => block.kind === 'figure')!;
    expect(flowing.display).toBe(false);
    expect(flowing.folio).toBe(true);
    expect(flowing.starts).toBe('none');
    // A page of its own: display, no folio, and it does not wait for a paragraph.
    const paged = placeBookFigure(base, 'f1', { place: 'page', span: 0.4, side: 'either', standoff: 1 });
    const blocks = bookBlocks(paged);
    const page = blocks.find((block) => block.kind === 'figure')!;
    expect(page.display).toBe(true);
    expect(page.folio).toBe(false);
    expect(page.starts).toBe('page');
    expect(blocks.some((block) => block.inset)).toBe(false);
    // It stands where the writer put it: between the paragraphs it was written between.
    const kinds = blocks.filter((block) => block.kind === 'paragraph' || block.kind === 'figure').map((block) => block.kind);
    expect(kinds).toEqual(['paragraph', 'figure', 'paragraph', 'paragraph']);
    // A side is a side of the spread, and it is stored as one word.
    const versoFile = placeBookFigure(base, 'f1', { place: 'page', span: 0.4, side: 'verso', standoff: 1 });
    expect(bookBlocks(versoFile).find((block) => block.kind === 'figure')!.starts).toBe('verso');
    expect(figurePlacement(versoFile.beats[0]!.manuscript.elements[1]!)).toMatchObject({ place: 'page', side: 'verso' });
    expect(bookBlocks(placeBookFigure(base, 'f1', { place: 'page', span: 0.4, side: 'recto', standoff: 1 })).find((block) => block.kind === 'figure')!.starts).toBe('recto');
    // The picture is the page, edge to edge, the art page's own rule.
    const html = renderBookBlock(page, contextFor(paged));
    expect(html).toContain('bk-plate-art');
    expect(html).toContain('data-figure="f1"');
    expect(html).not.toContain('bk-caption');
  });

  it('keeps the border the writer asked for round a picture cut into the text', () => {
    const wide = placeBookFigure(novel(), 'f1', { place: 'right', span: 0.3, side: 'either', standoff: 2 });
    expect(figurePlacement(wide.beats[0]!.manuscript.elements[1]!).standoff).toBe(2);
    const html = renderBookBlock(bookBlocks(wide).find((block) => block.inset)!, contextFor(wide));
    expect(html).toContain('--bk-standoff:2.00em');
    // It is clamped to what a page can take, and a figure across the measure keeps none.
    const huge = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4, side: 'either', standoff: 99 });
    expect(figurePlacement(huge.beats[0]!.manuscript.elements[1]!).standoff).toBe(3);
    const plain = placeBookFigure(huge, 'f1', { place: 'measure', span: 0.4, side: 'either', standoff: 2 });
    expect(plain.beats[0]!.manuscript.elements[1]!.attributes).toEqual({ assetId: '22222222-2222-4222-8222-222222222222' });
  });

  it('lists the figures for the rail with where each sits', () => {
    const file = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4 });
    expect(bookFigures(file)).toEqual([
      {
        elementId: 'f1',
        beatId: file.beats[0]!.id,
        caption: 'The harbour at dusk',
        assetId: '22222222-2222-4222-8222-222222222222',
        assetName: 'harbour.png',
        placement: { place: 'left', span: 0.4, side: 'either', standoff: 1 },
        chapterTitle: 'The Road',
        decorative: false,
      },
    ]);
  });

  it('floats in the eBook too', () => {
    const file = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4 });
    const pkg = ebookOf(file);
    const chapter = pkg.entries.find((entry) => entry.path.endsWith('-chapter.xhtml'))!;
    expect(String(chapter.data)).toContain('<p class="p"><span class="inset inset-left" style="width:40%"><img src="../images/img-001.png" alt="The harbour"/><span class="cap">The harbour at dusk</span></span>Two, beside the picture.</p>');
  });
});

describe('the type presets (stage 7)', () => {
  it('sets the whole style at once, and is read back rather than stored', () => {
    const fresh = createProjectFile({ title: 'T', format: 'novel' });
    // A new book is the classic style already.
    expect(bookPresetOf(bookSettingsOf(fresh))).toBe('classic');
    const modern = applyBookPreset(fresh, 'modern');
    expect(bookSettingsOf(modern)).toMatchObject(BOOK_PRESETS.modern);
    expect(bookPresetOf(bookSettingsOf(modern))).toBe('modern');
    expect(bookPresetOf(bookSettingsOf(applyBookPreset(fresh, 'textbook')))).toBe('textbook');
    expect((modern.settings.book as { preset?: string }).preset).toBeUndefined();
  });

  it('becomes custom the moment a field is changed by hand, and the trim is not part of it', () => {
    const fresh = createProjectFile({ title: 'T', format: 'novel' });
    expect(bookPresetOf(bookSettingsOf(setBookSettings(fresh, { ornament: '* * *' })))).toBeNull();
    expect(bookPresetOf(bookSettingsOf(setBookSettings(fresh, { trim: { width: 6, height: 9 } })))).toBe('classic');
  });
});
