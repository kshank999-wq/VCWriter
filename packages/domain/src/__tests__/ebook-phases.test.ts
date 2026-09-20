import { describe, expect, it } from 'vitest';
import {
  PREVIEW_DEVICES,
  addBeat,
  addMarker,
  bookBlocks,
  bookSettingsOf,
  chapterPageStyleSchema,
  createProjectFile,
  ebookOf,
  ebookReportHtml,
  epubBytes,
  fixedEbookOf,
  geometryOf,
  layPages,
  markFigureDecorative,
  packagedCheck,
  preflightEbook,
  previewDocument,
  previewSections,
  setBookSettings,
  updateBeat,
  updateGraphic,
  type BookRenderContext,
  type Measured,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * eBook phases 3 and 4 (addendum 23 §9–§11): the device preview, the check
 * on the packaged bytes, the report, the fixed-layout book read off the
 * laid pages, and the accessibility reading with decorative pictures.
 */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const ASSET = '22222222-2222-4222-8222-222222222222';
const COVER = '33333333-3333-4333-8333-333333333333';

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const unit = file.units[0]!;
  file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: 'The Road' }).file;
  const harbour = assetSchema.parse({ id: ASSET, projectId: file.project.id, kind: 'image', name: 'harbour.png', data: PNG, width: 1200, height: 800, createdAt: file.savedAt, updatedAt: file.savedAt });
  const cover = assetSchema.parse({ id: COVER, projectId: file.project.id, kind: 'image', name: 'cover.png', data: RED, width: 1600, height: 2560, createdAt: file.savedAt, updatedAt: file.savedAt });
  file = { ...file, assets: [harbour, cover] };
  const beat = addBeat(file, { unitId: unit.id, title: 'a' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: 'p1' as never, type: 'paragraph', text: 'One, with an “opening” — and more.', characterId: null, attributes: {} },
        { id: 'f1' as never, type: 'figure', text: 'The harbour at dusk', characterId: null, attributes: { assetId: ASSET } },
        { id: 'p2' as never, type: 'paragraph', text: 'Two.', characterId: null, attributes: {} },
        { id: 'sb' as never, type: 'scene_break', text: '', characterId: null, attributes: {} },
        { id: 'p3' as never, type: 'paragraph', text: 'Three.', characterId: null, attributes: {} },
      ],
    },
  });
  return file;
};

/** The book laid with made-up line counts, as the screen would have measured it. */
const laidOf = (file: ProjectFile) => {
  const settings = bookSettingsOf(file);
  const blocks = bookBlocks(file);
  const measured: Measured = new Map(blocks.map((block) => [block.id, block.kind === 'figure' ? 12 : 3]));
  const geometry = geometryOf(settings, 'novel', 40);
  const laid = layPages(blocks, measured, geometry, settings, { title: 'The Lamp', author: 'M. Shank' });
  const pictures = new Map(file.assets.map((asset) => [asset.id as string, { data: asset.data, altText: asset.altText, width: asset.width, height: asset.height }]));
  const context = {
    settings,
    geometry,
    chapterStyle: chapterPageStyleSchema.parse({}),
    paragraphStyle: 'indented',
    pictures,
    names: { title: 'The Lamp', author: 'M. Shank', imprint: '' },
    titlePage: { title: '', author: '', titleImage: '' },
    contents: [],
    index: null,
  } as unknown as BookRenderContext;
  return { pages: laid.pages, blocks, context };
};

const entry = (pkg: ReturnType<typeof ebookOf>, path: string): string => {
  const found = pkg.entries.find((one) => one.path === path);
  if (!found) throw new Error(`no ${path}`);
  return typeof found.data === 'string' ? found.data : `<${found.data.length} bytes>`;
};

describe('the device preview (phase 3)', () => {
  it('shows a section as the package carries it, pictures put back, at the size of a screen', () => {
    const pkg = ebookOf(novel());
    const chapter = previewSections(pkg).find((section) => section.title === 'The Road')!;
    const device = PREVIEW_DEVICES.find((one) => one.id === 'kindle')!;
    const html = previewDocument(pkg, chapter.href, device, 1.3)!;
    expect(html).toContain('html { font-size: 130%; }');
    expect(html).toContain(`column-width: ${device.width}px`);
    expect(html).toContain('<h1 class="chapter-title">');
    // The picture is the data URL again rather than a path into a zip nobody has opened.
    expect(html).toContain(`src="${PNG}"`);
    expect(html).not.toContain('src="../images/');
    // The stylesheet rides inside, so the frame needs no second file.
    expect(html).toContain('p.p { margin: 0; text-indent: 1.3em');
    expect(previewDocument(pkg, 'text/nope.xhtml', device)).toBeNull();
  });

  it('lists the reading order without the navigation document', () => {
    const pkg = ebookOf(novel());
    expect(previewSections(pkg).map((section) => section.title)).not.toContain('Contents');
    expect(previewSections(pkg).map((section) => section.title)).toContain('The Road');
  });
});

describe('the check after packaging (phase 3)', () => {
  it('reads the archive back: mimetype first and stored, every file once, lengths and checksums as written', async () => {
    const pkg = ebookOf(novel(), { modified: '2026-09-20T10:00:00Z' });
    const bytes = await epubBytes(pkg);
    const findings = packagedCheck(bytes, pkg);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('info');
    expect(findings[0]?.text).toMatch(/^Checked after packaging: \d+ files, the mimetype first and stored/);
  });

  it('says what is wrong with a damaged or foreign archive', async () => {
    const pkg = ebookOf(novel(), { modified: '2026-09-20T10:00:00Z' });
    const bytes = await epubBytes(pkg);
    // A byte of the mimetype's content flipped: the text is wrong.
    const broken = bytes.slice();
    broken[38] = 'X'.charCodeAt(0);
    const texts = packagedCheck(broken, pkg).map((finding) => finding.text);
    expect(texts.some((text) => text.includes('rather than application/epub+zip'))).toBe(true);
    // The package's own copy of a file changed after it was written: same length, other checksum.
    const changed = { ...pkg, entries: pkg.entries.map((one) => (one.path === 'META-INF/container.xml' ? { ...one, data: String(one.data).replace('OEBPS/content.opf', 'OEBPS/content.opg') } : one)) };
    expect(packagedCheck(bytes, changed).map((finding) => finding.text)).toContain("META-INF/container.xml's checksum in the archive is not the package's.");
    expect(packagedCheck(new Uint8Array([1, 2, 3]), pkg)[0]?.text).toMatch(/not a zip archive/);
    // A file the package expects and the archive lacks.
    const shorter = { ...pkg, entries: [...pkg.entries, { path: 'OEBPS/text/ghost.xhtml', mediaType: 'application/xhtml+xml', data: '<x/>' }] };
    expect(packagedCheck(bytes, shorter).map((finding) => finding.text)).toContain('OEBPS/text/ghost.xhtml was not written into the archive.');
  });
});

describe('the report (phase 3)', () => {
  it('is one HTML page: target, files, findings, what was done, the package’s parts, the pictures, the store’s checklist', async () => {
    const pkg = ebookOf(novel(), { modified: '2026-09-20T10:00:00Z' });
    const preflight = preflightEbook(pkg);
    const packaged = packagedCheck(await epubBytes(pkg), pkg);
    const html = ebookReportHtml(pkg, preflight, [{ name: 'the-lamp.epub', bytes: 20480 }], packaged);
    expect(html).toContain('<title>The Lamp — eBook export report</title>');
    expect(html).toContain('<dt>Target</dt><dd>Universal EPUB</dd>');
    expect(html).toContain('<td>the-lamp.epub</td><td class="n">20 KB</td>');
    expect(html).toContain('has no description for a reader who cannot see it');
    expect(html).toContain('Checked after packaging');
    expect(html).toContain('<td>text/001-half-title.xhtml</td><td>application/xhtml+xml</td>');
    expect(html).toContain('<td>harbour.png</td><td>1200 × 800 px</td><td>needs a description</td>');
    expect(html).toContain('Upload the EPUB to each store');
  });
});

describe('the fixed-layout book (phase 4)', () => {
  it('writes a document per laid page at the trim, pre-paginated, sides on the spine, pictures as files', () => {
    const file = setBookSettings(novel(), { ebook: { coverAssetId: COVER, layout: 'fixed' } as never });
    const laid = laidOf(file);
    const pkg = fixedEbookOf(file, laid, { modified: '2026-09-20T10:00:00Z' });
    expect(pkg.layout).toBe('fixed');
    expect(pkg.pages?.count).toBe(laid.pages.length);
    expect(pkg.pages?.width).toBe(Math.round(laid.context.geometry.trim.width * 96));
    // One page, one file, in order; the cover first.
    const pageEntries = pkg.entries.filter((one) => /text\/\d{3}-page\.xhtml$/.test(one.path));
    expect(pageEntries).toHaveLength(laid.pages.length);
    expect(pkg.sections[0]).toMatchObject({ id: 'cover', spread: 'center' });
    expect(pkg.sections[1]).toMatchObject({ id: 'page-001', spread: 'right' });
    expect(pkg.sections[2]).toMatchObject({ id: 'page-002', spread: 'left' });

    const opf = entry(pkg, 'OEBPS/content.opf');
    expect(opf).toContain('prefix="rendition: http://www.idpf.org/vocab/rendition/#"');
    expect(opf).toContain('<meta property="rendition:layout">pre-paginated</meta>');
    expect(opf).toContain('<itemref idref="page-001" properties="rendition:page-spread-right"/>');
    expect(opf).toContain('<itemref idref="page-002" properties="rendition:page-spread-left"/>');
    // The navigation document is in the manifest and not the spine.
    expect(opf).toContain('properties="nav"');
    expect(opf).not.toContain('<itemref idref="nav"/>');
    expect(opf).not.toContain('displayTransformability');

    const first = entry(pkg, 'OEBPS/text/001-page.xhtml');
    expect(first).toContain(`<meta name="viewport" content="width=${pkg.pages!.width}, height=${pkg.pages!.height}"/>`);
    expect(first).toContain('<section class="bk-page recto');
    expect(first).toContain('href="../css/page.css"');
    // The picture page: the data URL became a file in the package, alt kept.
    const pictured = pageEntries.map((one) => String(one.data)).find((text) => text.includes('bk-figure-image'))!;
    expect(pictured).toContain('src="../images/img-001.png"');
    expect(pictured).not.toContain('data:image');
    expect(pkg.images[0]).toMatchObject({ name: 'harbour.png', width: 1200, height: 800, needsDescription: true });
    // No named entity but the five XML ones.
    for (const one of pageEntries) expect(String(one.data)).not.toContain('&nbsp;');
    expect(pkg.log[0]).toMatch(/kept as laid/);
    expect(pkg.log[1]).toMatch(/faces are not embedded/);
  });

  it('lists the chapters and the parts by the page each opens on', () => {
    const file = novel();
    const pkg = fixedEbookOf(file, laidOf(file));
    const titles = pkg.nav.map((item) => item.title);
    expect(titles).toContain('The Road');
    expect(titles).toContain('Half title');
    const nav = entry(pkg, 'OEBPS/toc.xhtml');
    expect(nav).toMatch(/<li><a href="text\/\d{3}-page\.xhtml">The Road<\/a><\/li>/);
    // The page's stylesheet is the room's: the same custom properties, at the trim.
    const css = entry(pkg, 'OEBPS/css/page.css');
    expect(css).toContain('--bk-face:');
    expect(css).toContain('.bk-page {');
  });

  it('is refused by a store that does not take it, warned about where reach is limited, and warned about on a book of text', () => {
    const file = novel();
    const laid = laidOf(file);
    const d2d = preflightEbook(fixedEbookOf(file, laid, { target: 'd2d' }));
    expect(d2d.findings.map((one) => one.text)).toContain('Draft2Digital does not take a fixed-layout EPUB; export it reflowable for this store.');
    expect(d2d.blocking).toBe(true);
    const ingram = preflightEbook(fixedEbookOf(file, laid, { target: 'ingram' })).findings.map((one) => one.text);
    expect(ingram.some((text) => text.includes('fewer shelves'))).toBe(true);
    const universal = preflightEbook(fixedEbookOf(file, laid, { target: 'universal' })).findings;
    expect(universal.some((one) => one.severity === 'warning' && one.text.startsWith('Fixed layout on a book of text'))).toBe(true);
    // The reflowable book says nothing of the kind.
    expect(preflightEbook(ebookOf(file)).findings.some((one) => one.text.startsWith('Fixed layout'))).toBe(false);
  });

  it('previews a page scaled to the device', () => {
    const file = novel();
    const pkg = fixedEbookOf(file, laidOf(file));
    const device = PREVIEW_DEVICES.find((one) => one.id === 'phone')!;
    const html = previewDocument(pkg, 'text/001-page.xhtml', device)!;
    expect(html).toContain('transform: scale(');
    expect(html).toContain('<div id="page">');
  });
});

describe('pictures a reader cannot see (phase 4)', () => {
  it('asks for a description until one is given, and stops asking for a picture marked decorative', () => {
    const file = novel();
    const undescribed = ebookOf(file);
    expect(undescribed.images[0]?.needsDescription).toBe(true);
    expect(preflightEbook(undescribed).warnings).toBeGreaterThan(0);
    expect(entry(undescribed, 'OEBPS/content.opf')).not.toContain('alternativeText');
    expect(entry(undescribed, 'OEBPS/content.opf')).not.toContain('accessModeSufficient');

    const described = ebookOf(updateGraphic(file, ASSET as never, { altText: 'Boats at the harbour wall at dusk' }));
    expect(described.images[0]).toMatchObject({ described: true, needsDescription: false, alt: 'Boats at the harbour wall at dusk' });
    const opf = entry(described, 'OEBPS/content.opf');
    expect(opf).toContain('<meta property="schema:accessibilityFeature">alternativeText</meta>');
    expect(opf).toContain('<meta property="schema:accessModeSufficient">textual</meta>');
    expect(opf).toContain('<meta property="schema:accessibilityFeature">structuralNavigation</meta>');
    expect(opf).toContain('<meta property="schema:accessibilityFeature">displayTransformability</meta>');
    expect(opf).toContain('every picture is described');
    // No conformance is claimed: a certification is not a reading.
    expect(opf).not.toContain('conformsTo');

    const decorative = ebookOf(markFigureDecorative(file, 'f1', true));
    expect(decorative.images[0]).toMatchObject({ described: false, needsDescription: false });
    const chapter = entry(decorative, 'OEBPS/text/004-chapter.xhtml');
    expect(chapter).toContain('<img src="../images/img-001.png" alt="" role="presentation"/>');
    expect(preflightEbook(decorative).findings.some((one) => one.text.includes('no description'))).toBe(false);
    // Unmarking puts the ask back, and the attribute comes off rather than reading false.
    const back = markFigureDecorative(markFigureDecorative(file, 'f1', true), 'f1', false);
    expect(back.beats.flatMap((beat) => beat.manuscript.elements).find((element) => element.id === ('f1' as never))?.attributes).toEqual({ assetId: ASSET });
    expect(ebookOf(back).images[0]?.needsDescription).toBe(true);
  });
});
