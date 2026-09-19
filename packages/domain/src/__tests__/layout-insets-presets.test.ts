import { describe, expect, it } from 'vitest';
import {
  BOOK_PRESETS,
  addMarker,
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
    expect(figurePlacement(figure)).toEqual({ place: 'measure', span: 0.4 });
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
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!)).toEqual({ place: 'right', span: 0.6 });
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
    expect(html).toContain('<span class="bk-inset bk-inset-right" data-figure="f1" style="width:30%">');
    expect(html).toContain('aspect-ratio:1200 / 800');
    expect(html).toContain('<span class="bk-inset-caption">The harbour at dusk</span>');
    expect(html).toContain('Two, beside the picture.</p>');
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
        placement: { place: 'left', span: 0.4 },
        chapterTitle: 'The Road',
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
