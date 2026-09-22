import { describe, expect, it } from 'vitest';
import {
  PART_TEMPLATES,
  addPart,
  bookBlocks,
  bookSettingsOf,
  chapterPageStyleSchema,
  createProjectFile,
  geometryOf,
  partHangsAtFoot,
  partHasStyle,
  partStyleOf,
  partStyleVars,
  partTemplateOf,
  partTemplatePatch,
  partsOf,
  renderBookBlock,
  setTitlePage,
  updatePart,
  type BookRenderContext,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * A designed page of the front matter (addendum 20 §9): the half title, the
 * title page, a dedication and an epigraph, each with a template, a face and
 * its lines of type, stored on the part and read by the one printer.
 */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'the-lamp-final-v3', format: 'novel', author: 'M. Shank' });
  const asset = assetSchema.parse({
    id: '33333333-3333-4333-8333-333333333333',
    projectId: file.project.id,
    kind: 'image',
    name: 'title-art.png',
    data: PNG,
    width: 1100,
    height: 1700,
    altText: '',
    createdAt: file.savedAt,
    updatedAt: file.savedAt,
  });
  file = { ...file, assets: [asset] };
  return file;
};

const contextFor = (file: ProjectFile): BookRenderContext => {
  const settings = bookSettingsOf(file);
  return {
    settings,
    geometry: geometryOf(settings, 'novel', 100),
    chapterStyle: chapterPageStyleSchema.parse({}),
    paragraphStyle: 'indented',
    pictures: new Map(file.assets.map((asset) => [asset.id as string, { data: asset.data, altText: asset.altText, width: asset.width, height: asset.height }])),
    names: { title: file.project.title, author: file.project.author, imprint: settings.imprint },
    titlePage: { ...file.settings.titlePage },
    contents: [],
    index: { letters: [] },
  } as unknown as BookRenderContext;
};

describe('a designed page', () => {
  it('is the half title, the title page, a dedication and an epigraph, and nothing read or written', () => {
    expect(partHasStyle('half_title')).toBe(true);
    expect(partHasStyle('title_page')).toBe(true);
    expect(partHasStyle('dedication')).toBe(true);
    expect(partHasStyle('epigraph')).toBe(true);
    expect(partHasStyle('contents')).toBe(false);
    expect(partHasStyle('foreword')).toBe(false);
    expect(partHasStyle('plate')).toBe(false);
  });

  it('reads its template back from where the block sits, and never stores one', () => {
    for (const template of PART_TEMPLATES) expect(partTemplateOf(partTemplatePatch(template))).toBe(template);
    expect(partTemplateOf({ align: 'center', drop: 31 })).toBeNull();
    const file = novel();
    const half = partsOf(file).find((part) => part.kind === 'half_title')!;
    expect(partTemplateOf(partStyleOf(half))).toBe('classic');
    expect(Object.keys(half.style)).toEqual([]);
    const moved = updatePart(file, half.id, { style: { ...partStyleOf(half), ...partTemplatePatch('low_left') } });
    const later = partsOf(moved).find((part) => part.kind === 'half_title')!;
    expect(partTemplateOf(partStyleOf(later))).toBe('low_left');
    expect(later.style).not.toHaveProperty('template');
  });

  it('starts each kind at the look it always had: a dedication in italic at reading size', () => {
    const file = novel();
    const dedication = addPart(file, 'dedication', { text: 'For M.' });
    const style = partStyleOf(partsOf(dedication.file).find((part) => part.id === dedication.partId)!);
    expect(style.title).toMatchObject({ size: 11, italic: true });
    expect(partStyleOf(partsOf(file).find((part) => part.kind === 'title_page')!).title).toMatchObject({ size: 24, italic: false });
  });

  it('says what the custom properties mean in one place, the book’s face standing for *book*', () => {
    const style = partStyleOf({ kind: 'title_page', style: { align: 'left', drop: 10, face: 'book', rule: true } });
    const vars = partStyleVars(style, 'sans');
    expect(vars['--pt-face']).toContain('Helvetica');
    expect(vars['--pt-drop']).toBe('10%');
    expect(vars['--pt-items']).toBe('flex-start');
    expect(vars['--pt-rule']).toBe('1px solid currentColor');
    expect(vars['--pt-title-size']).toBe('24pt');
    expect(vars['--pt-line-case']).toBe('uppercase');
    expect(partStyleVars(partStyleOf({ kind: 'half_title', style: { face: 'modern' } }), 'sans')['--pt-face']).toContain('Didot');
  });

  it('prints the half title and the title page in their style, with the typed title and the line under it, over the file’s name', () => {
    let file = setTitlePage(novel(), { title: 'The Lamp', episode: 'A novel' });
    const title = partsOf(file).find((part) => part.kind === 'title_page')!;
    file = updatePart(file, title.id, { style: { ...partStyleOf(title), ...partTemplatePatch('high_left'), rule: true } });
    const blocks = bookBlocks(file);
    const half = blocks.find((block) => block.kind === 'half_title')!;
    const page = blocks.find((block) => block.kind === 'title_page')!;
    expect(half.partStyle).toBeDefined();
    const halfHtml = renderBookBlock(half, contextFor(file));
    expect(halfHtml).toContain('The Lamp');
    expect(halfHtml).not.toContain('the-lamp-final-v3');
    expect(halfHtml).toContain('<div class="bk-drop"></div>');
    expect(halfHtml).toContain('--pt-drop:30%');
    const pageHtml = renderBookBlock(page, contextFor(file));
    expect(pageHtml).toContain('--pt-drop:10%');
    expect(pageHtml).toContain('--pt-items:flex-start');
    expect(pageHtml).toContain('--pt-rule:1px solid currentColor');
    expect(pageHtml).toContain('<p class="bk-subtitle">A novel</p>');
    expect(pageHtml).toContain('<p class="bk-author">M. Shank</p>');
  });

  it('is the picture alone, edge to edge, once full-page art is brought in', () => {
    let file = setTitlePage(novel(), { title: 'The Lamp' });
    const title = partsOf(file).find((part) => part.kind === 'title_page')!;
    file = updatePart(file, title.id, { assetId: '33333333-3333-4333-8333-333333333333' });
    const page = bookBlocks(file).find((block) => block.kind === 'title_page')!;
    expect(page.assetId).toBe('33333333-3333-4333-8333-333333333333');
    const html = renderBookBlock(page, contextFor(file));
    expect(html).toContain('bk-plate-art');
    expect(html).toContain('alt="The Lamp"');
    expect(html).not.toContain('bk-book-title');
    // Taken off again, the words come back.
    const words = renderBookBlock(bookBlocks(updatePart(file, title.id, { assetId: null })).find((block) => block.kind === 'title_page')!, contextFor(file));
    expect(words).toContain('bk-book-title');
  });
});

/**
 * The epigraph and the dedication (addendum 20 §7a, from Ken: *the epigraph
 * and dedication pages need the same style options*).
 *
 * Three things were withheld from exactly these two kinds while the half
 * title and the title page had them: a style for the lines under the words,
 * a rule, and a page of art.
 */
describe('the epigraph and the dedication', () => {
  const withWords = (kind: 'epigraph' | 'dedication', text: string) => {
    const file = novel();
    const made = addPart(file, kind, { text });
    return made.file;
  };

  it('sets the lines under the words apart from the words', () => {
    const file = withWords('epigraph', 'The bell rang across the water twice.\n— W. H. Auden');
    const block = bookBlocks(file).find((one) => one.partId === partsOf(file).find((p) => p.kind === 'epigraph')?.id)!;
    const html = renderBookBlock(block, contextFor(file));
    // The first line is the words; everything under it is an attribution.
    expect(html).toContain('<p>The bell rang across the water twice.</p>');
    expect(html).toContain('<p class="bk-words-under">— W. H. Auden</p>');
  });

  it('starts with both lines set the same, so an older page is unchanged', () => {
    const file = withWords('dedication', 'For Mara\nwho heard the bell first');
    const style = partStyleOf(partsOf(file).find((one) => one.kind === 'dedication')!);
    // The lines under the words default to the words rather than to the title
    // page's tracked capitals, which is what the page always drew.
    expect(style.line).toEqual(style.title);
    expect(style.line.size).toBe(11);
    expect(style.line.italic).toBe(true);
  });

  it('takes a rule, which was the title page’s alone', () => {
    const file = withWords('epigraph', 'The bell rang.');
    const part = partsOf(file).find((one) => one.kind === 'epigraph')!;
    const ruled = updatePart(file, part.id, { style: { ...partStyleOf(part), rule: true } });
    const vars = partStyleVars(partStyleOf(partsOf(ruled).find((one) => one.kind === 'epigraph')!), 'old_style');
    expect(vars['--pt-rule']).toBe('1px solid currentColor');
  });

  it('takes a page of art, the words being in the picture', () => {
    const file = withWords('dedication', 'For Mara');
    const part = partsOf(file).find((one) => one.kind === 'dedication')!;
    const arted = updatePart(file, part.id, { assetId: file.assets[0]!.id as string });
    const block = bookBlocks(arted).find((one) => one.partId === part.id)!;
    const html = renderBookBlock(block, contextFor(arted));
    // The art page's own markup, the same one every designed page draws.
    expect(html).toContain('bk-plate-art');
    expect(html).toContain('<img class="bk-plate-image"');
    // Nothing is set over it.
    expect(html).not.toContain('For Mara<');
  });
});

/**
 * The copyright page (addendum 20 §7a, from Ken: *the copyright page needs the
 * same style options*). It was the one designed page with **no style at all** —
 * `partHasStyle` refused it and its look was in the stylesheet.
 */
describe('the copyright page', () => {
  const withNotice = (text: string) => addPart(novel(), 'copyright', { text }).file;

  it('is a designed page now, and the only one that hangs at the foot', () => {
    expect(partHasStyle('copyright')).toBe(true);
    // Which is what the page *is* rather than a choice: a copyright block a
    // third of the way down is not a copyright page, and it is long enough
    // that a drop would push it off the foot.
    expect(partHangsAtFoot('copyright')).toBe(true);
    for (const kind of ['half_title', 'title_page', 'dedication', 'epigraph'] as const) {
      expect(partHangsAtFoot(kind)).toBe(false);
    }
  });

  it('starts as the small print the stylesheet drew, ranged left', () => {
    const style = partStyleOf(partsOf(withNotice('Copyright © M. Shank')).find((one) => one.kind === 'copyright')!);
    expect(style.align).toBe('left');
    expect(style.title.italic).toBe(false);
    expect(style.title.case).toBe('as_typed');
    // Nine point where the stylesheet said 0.8em — 8.8 at an eleven-point
    // body — because furniture does not grow when the body does.
    expect(style.title.size).toBe(9);
  });

  it('carries its own type to the page, where nothing could reach before', () => {
    const file = withNotice('Copyright © M. Shank\nAll rights reserved.');
    const part = partsOf(file).find((one) => one.kind === 'copyright')!;
    const set = updatePart(file, part.id, {
      style: { ...partStyleOf(part), face: 'sans', align: 'center', rule: true, title: { ...partStyleOf(part).title, size: 7, case: 'capitals' } },
    });
    const block = bookBlocks(set).find((one) => one.partId === part.id)!;
    const html = renderBookBlock(block, contextFor(set));
    expect(html).toContain('--pt-title-size:7pt');
    expect(html).toContain('--pt-title-case:uppercase');
    expect(html).toContain('--pt-align:center');
    expect(html).toContain('--pt-rule:1px solid currentColor');
    expect(html).toContain('Helvetica');
    // The notice itself is untouched; only how it is set changed.
    expect(html).toContain('Copyright © M. Shank');
  });
});
