import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  beginStory,
  crc32,
  createProjectFile,
  ebookMetadataOf,
  ebookOf,
  ebookReport,
  epubBytes,
  preflightEbook,
  safeName,
  setBookSettings,
  updateBeat,
  writeZip,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * The eBook (addendum 23): one EPUB 3.3 package read off the book's blocks,
 * and a preflight that says what a store would say first.
 */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'novel', author: 'K. Shank & M. Shank' });
  file = { ...file, project: { ...file.project, synopsis: 'A keeper, a storm, a debt.' } };
  const track = file.tracks[0]!;
  const first = file.units[0]!;
  const second = addUnit(file, { trackId: track.id, title: 'Two' });
  file = second.file;
  file = addMarker(file, { unitId: first.id, kind: 'chapter', title: 'The Road' }).file;
  file = addMarker(file, { unitId: second.unit.id, kind: 'chapter', title: '' }).file;
  const asset = assetSchema.parse({
    id: '22222222-2222-4222-8222-222222222222',
    projectId: file.project.id,
    kind: 'image',
    name: 'harbour.png',
    data: PNG,
    width: 1200,
    height: 800,
    altText: 'The harbour at dusk',
    createdAt: file.savedAt,
    updatedAt: file.savedAt,
  });
  const cover = assetSchema.parse({
    id: '33333333-3333-4333-8333-333333333333',
    projectId: file.project.id,
    kind: 'image',
    name: 'cover.jpg',
    data: JPEG,
    width: 1600,
    height: 2560,
    createdAt: file.savedAt,
    updatedAt: file.savedAt,
  });
  file = { ...file, assets: [asset, cover] };
  const beat = addBeat(file, { unitId: first.id, title: 'a' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: 'e1', type: 'paragraph', text: 'The kettle *would not* boil. She **waited**.', characterId: null, attributes: {} },
        { id: 'e2', type: 'scene_break', text: '', characterId: null, attributes: {} },
        { id: 'e3', type: 'blockquote', text: 'Not tonight.', characterId: null, attributes: {} },
        { id: 'e4', type: 'figure', text: 'The harbour', characterId: null, attributes: { assetId: asset.id } },
        { id: 'e5', type: 'heading', text: 'Later', characterId: null, attributes: {} },
        { id: 'e6', type: 'paragraph', text: 'Rain <on> the "water" & more.', characterId: null, attributes: {} },
      ],
    },
  });
  const beat2 = addBeat(file, { unitId: second.unit.id, title: 'b' });
  file = updateBeat(beat2.file, beat2.beat.id, {
    manuscript: { elements: [{ id: 'e7', type: 'paragraph', text: 'North.', characterId: null, attributes: {} }] },
  });
  file = setBookSettings(file, { imprint: 'Point Press', ornament: '❦' });
  return file;
};

const entry = (pkg: ReturnType<typeof ebookOf>, path: string): string => {
  const found = pkg.entries.find((one) => one.path === path);
  if (!found) throw new Error(`no ${path}`);
  return typeof found.data === 'string' ? found.data : `<${found.data.length} bytes>`;
};

describe('the eBook package', () => {
  it('reads the metadata off the project, the title page and the eBook settings', () => {
    const meta = ebookMetadataOf(novel(), { modified: '2026-09-19T10:11:12.345Z' });
    expect(meta.title).toBe('The Lighthouse');
    expect(meta.authors).toEqual(['K. Shank', 'M. Shank']);
    expect(meta.language).toBe('en-US');
    expect(meta.identifier.scheme).toBe('uuid');
    expect(meta.publisher).toBe('Point Press');
    expect(meta.description).toBe('A keeper, a storm, a debt.');
    expect(meta.modified).toBe('2026-09-19T10:11:12Z');

    const withIsbn = setBookSettings(novel(), { ebook: { isbn: '978-1-4028-9462-6', language: 'en-GB', seriesName: 'The Point', seriesNumber: '2' } as never });
    const own = ebookMetadataOf(withIsbn);
    expect(own.identifier).toEqual({ scheme: 'isbn', value: '9781402894626', urn: 'urn:isbn:9781402894626' });
    expect(own.language).toBe('en-GB');
    expect(own.series).toEqual({ name: 'The Point', number: '2' });
  });

  it('builds the container, the package document and a file per chapter, with the mimetype first', () => {
    const pkg = ebookOf(novel(), { modified: '2026-09-19T10:11:12Z' });
    expect(pkg.entries[0]).toMatchObject({ path: 'mimetype', data: 'application/epub+zip', stored: true });
    expect(entry(pkg, 'META-INF/container.xml')).toContain('full-path="OEBPS/content.opf"');

    const opf = entry(pkg, 'OEBPS/content.opf');
    expect(opf).toContain('version="3.0"');
    expect(opf).toContain('<dc:title id="title">The Lighthouse</dc:title>');
    expect(opf).toContain('<dc:creator id="creator-2">M. Shank</dc:creator>');
    expect(opf).toContain('<dc:language>en-US</dc:language>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-09-19T10:11:12Z</meta>');
    expect(opf).toContain('<dc:publisher>Point Press</dc:publisher>');
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('<spine toc="ncx">');
    // Every id an XML name: the default parts are named with a colon.
    for (const id of opf.match(/ id="([^"]+)"/g) ?? []) expect(id).not.toContain(':');
    expect(opf).toContain('<itemref idref="part-default-half-title"/>');

    // Front matter, then the two chapters, then the back matter, each a file of its own.
    const kinds = pkg.sections.map((section) => `${section.kind}:${section.title}`);
    // No cover is chosen in this fixture, so no cover page: the cover test has one.
    expect(kinds).toEqual([
      'front:Half title',
      'front:Title page',
      'front:Copyright',
      'front:Contents',
      'chapter:The Road',
      'chapter:Chapter 2',
      'back:About the author',
    ]);
    // The contents page is the navigation document, in the reading order
    // after the front matter and not listed in itself.
    expect(pkg.sections.find((section) => section.title === 'Contents')?.href).toBe('toc.xhtml');
    expect(opf).toMatch(/<itemref idref="part-default-copyright"\/>\n<itemref idref="nav"\/>\n<itemref idref="chapter-001"\/>/);
    expect(pkg.log.join(' ')).toMatch(/navigation document/);
  });

  it('writes the chapter as semantic XHTML: headings, emphasis, a separator, a figure with its description', () => {
    const pkg = ebookOf(novel());
    const road = entry(pkg, pkg.sections.find((section) => section.title === 'The Road')!.href.replace(/^/, 'OEBPS/'));
    expect(road).toContain('<section epub:type="chapter" id="chapter-001">');
    expect(road).toContain('<span class="chapter-label">Chapter 1</span><br/><span class="chapter-name">The Road</span>');
    expect(road).toContain('<p class="p first opens-small-caps">The kettle <em>would not</em> boil. She <strong>waited</strong>.</p>');
    expect(road).toContain('<p class="break" role="separator" aria-label="Scene break">❦</p>');
    expect(road).toContain('<blockquote><p>Not tonight.</p></blockquote>');
    expect(road).toContain('<figure class="figure"><img src="../images/img-001.png" alt="The harbour at dusk"/><figcaption>The harbour</figcaption></figure>');
    expect(road).toContain('<h2 class="heading">Later</h2>');
    // Escaped, so the file is well-formed whatever the writer typed.
    expect(road).toContain('Rain &lt;on&gt; the &quot;water&quot; &amp; more.');
    expect(road).not.toContain('<br>');
    // No page furniture anywhere.
    expect(road).not.toMatch(/bk-folio|bk-running|page-number/);
  });

  it('lists every section but the cover in the navigation document, and the landmarks', () => {
    const pkg = ebookOf(novel());
    const nav = entry(pkg, 'OEBPS/toc.xhtml');
    expect(nav).toContain('<nav epub:type="toc" id="toc">');
    expect(nav).toContain('<li><a href="text/004-chapter.xhtml">The Road</a></li>');
    expect(nav).not.toContain('Cover');
    expect(nav).toContain('<a epub:type="bodymatter" href="text/004-chapter.xhtml">The Road</a>');
    const covered = ebookOf(setBookSettings(novel(), { ebook: { coverAssetId: '33333333-3333-4333-8333-333333333333' } as never }));
    const withCover = entry(covered, 'OEBPS/toc.xhtml');
    expect(withCover).toContain('<a epub:type="cover" href="text/000-cover.xhtml">Cover</a>');
    // The cover is a landmark, never a contents entry.
    expect(withCover).not.toContain('<li><a href="text/000-cover.xhtml">');
    expect(entry(pkg, 'OEBPS/toc.ncx')).toContain('<text>The Road</text>');
  });

  it("carries the cover as the first page and the package's cover image", () => {
    const pkg = ebookOf(setBookSettings(novel(), { ebook: { coverAssetId: '33333333-3333-4333-8333-333333333333' } as never }));
    expect(pkg.cover?.href).toBe('images/cover.jpg');
    expect(pkg.cover?.fileName).toBe('the-lighthouse-cover.jpg');
    expect(pkg.sections[0]).toMatchObject({ kind: 'cover', href: 'text/000-cover.xhtml' });
    const opf = entry(pkg, 'OEBPS/content.opf');
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('<meta name="cover" content="cover-image"/>');
    expect(opf).toMatch(/<spine[^>]*>\n<itemref idref="cover"\/>/);
    expect(pkg.log.join(' ')).not.toMatch(/key art/);
  });

  it('is the same package twice, but for the moment it was made', () => {
    const file = novel();
    const first = ebookOf(file, { modified: '2026-09-19T10:00:00Z' });
    const second = ebookOf(file, { modified: '2026-09-19T11:00:00Z' });
    expect(first.entries.map((one) => one.path)).toEqual(second.entries.map((one) => one.path));
    const strip = (text: string) => text.replace(/dcterms:modified">[^<]+/, '');
    for (const one of first.entries) {
      if (typeof one.data !== 'string') continue;
      expect(strip(one.data)).toBe(strip(entry(second, one.path)));
    }
  });

  it('sets a collection as a book: a story to a chapter, titled and unnumbered', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story', author: 'K. Shank' }), { title: 'The Road' }).file;
    file = beginStory(file, { title: 'The Harbour' }).file;
    const pkg = ebookOf(file);
    const stories = pkg.sections.filter((section) => section.kind === 'chapter').map((section) => section.title);
    expect(stories).toEqual(['The Road', 'The Harbour']);
    const road = entry(pkg, `OEBPS/${pkg.sections.find((section) => section.title === 'The Road')!.href}`);
    expect(road).toContain('<h1 class="chapter-title">The Road</h1>');
  });

  it('leaves the index out and says why, and keeps a plate with the chapter it stands before', () => {
    let file = novel();
    file = addPart(file, 'index', {}).file;
    const marker = file.markers[0]!;
    file = addPart(file, 'plate', { assetId: '22222222-2222-4222-8222-222222222222', caption: 'Frontispiece', beforeMarkerId: marker.id }).file;
    const pkg = ebookOf(file);
    expect(pkg.log.join(' ')).toMatch(/index was left out/);
    expect(pkg.sections.some((section) => section.title === 'Index')).toBe(false);
    const plate = pkg.sections.find((section) => section.title === 'Art page');
    expect(plate).toBeDefined();
    expect(entry(pkg, `OEBPS/${plate!.href}`)).toContain('<figure class="plate"><img src="../images/img-001.png"');
    // One picture, however many times it is used.
    expect(pkg.images).toHaveLength(1);
  });

  it('names files a filesystem takes', () => {
    expect(safeName('The Lighthouse: A Novel!')).toBe('the-lighthouse-a-novel');
    expect(safeName('Café Élan')).toBe('cafe-elan');
    expect(safeName('   ')).toBe('book');
    expect(ebookOf(novel()).fileName).toBe('the-lighthouse.epub');
  });
});

describe('the zip', () => {
  it('writes an archive with the mimetype first and stored', async () => {
    const bytes = await epubBytes(ebookOf(novel(), { modified: '2026-09-19T10:00:00Z' }));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // Method 0 (stored) and the name "mimetype" straight after the header.
    expect(view.getUint16(8, true)).toBe(0);
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(bytes.subarray(38, 58))).toBe('application/epub+zip');
    // The end-of-directory record closes it.
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  });

  it('deflates what is worth deflating and checks it', async () => {
    const words = new TextEncoder().encode('the same words '.repeat(200));
    const bytes = await writeZip([{ path: 'a.txt', data: words }]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(8, true)).toBe(8);
    expect(view.getUint32(18, true)).toBeLessThan(words.length);
    expect(view.getUint32(14, true)).toBe(crc32(words));
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('preflight', () => {
  it('passes a plain novel for the universal EPUB with only notes and the cover warning', () => {
    const report = preflightEbook(ebookOf(novel()));
    expect(report.blocking).toBe(false);
    expect(report.findings.filter((finding) => finding.severity === 'warning').map((finding) => finding.text)).toEqual([
      'No cover is chosen; the store will ask for one on its form.',
    ]);
    expect(report.findings.some((finding) => finding.text.includes('EPUBCheck'))).toBe(true);
  });

  it('refuses what a store refuses: no cover, no ISBN, a picture past the limit, a cover too small', () => {
    const file = novel();
    const apple = preflightEbook(ebookOf(file, { target: 'apple' }));
    expect(apple.blocking).toBe(true);
    expect(apple.findings.map((finding) => finding.text)).toContain('Apple Books needs the cover inside the book, and no cover is chosen.');

    const ingram = preflightEbook(ebookOf(setBookSettings(file, { ebook: { coverAssetId: '33333333-3333-4333-8333-333333333333' } as never }), { target: 'ingram' }));
    expect(ingram.findings.map((finding) => finding.text)).toContain('IngramSpark needs an eBook ISBN; none is given.');

    const big = { ...file, assets: file.assets.map((asset) => (asset.name === 'harbour.png' ? { ...asset, width: 3000, height: 2000 } : asset)) };
    const pixels = preflightEbook(ebookOf(big, { target: 'apple' }));
    expect(pixels.findings.some((finding) => /past Apple Books's 5.6 million pixels/.test(finding.text))).toBe(true);

    const small = { ...file, assets: file.assets.map((asset) => (asset.name === 'cover.jpg' ? { ...asset, width: 600, height: 900 } : asset)) };
    const cover = preflightEbook(ebookOf(setBookSettings(small, { ebook: { coverAssetId: '33333333-3333-4333-8333-333333333333' } as never }), { target: 'apple' }));
    expect(cover.findings.some((finding) => /at least 1400 px on its shorter side/.test(finding.text))).toBe(true);
  });

  it('warns about a picture nobody described, and an ISBN that is not one', () => {
    const file = { ...novel(), assets: novel().assets.map((asset) => ({ ...asset, altText: '' })) };
    const report = preflightEbook(ebookOf(file));
    expect(report.findings.some((finding) => finding.severity === 'warning' && /no description/.test(finding.text))).toBe(true);
    const bad = preflightEbook(ebookOf(setBookSettings(file, { ebook: { isbn: '12345' } as never })));
    expect(bad.findings.some((finding) => finding.severity === 'error' && /not 10 or 13 digits/.test(finding.text))).toBe(true);
  });

  it('finds a link that lands nowhere', () => {
    const pkg = ebookOf(novel());
    const broken = { ...pkg, entries: pkg.entries.filter((one) => one.path !== 'OEBPS/css/book.css') };
    const report = preflightEbook(broken);
    expect(report.findings.some((finding) => /points at OEBPS\/css\/book.css, which is not in the package/.test(finding.text))).toBe(true);
  });

  it('writes a report a person can read', () => {
    const pkg = ebookOf(novel(), { target: 'kobo' });
    const text = ebookReport(pkg, preflightEbook(pkg), [{ name: 'the-lighthouse.epub', bytes: 12345 }]);
    expect(text).toContain('Target: Kobo Writing Life');
    expect(text).toContain('the-lighthouse.epub');
    expect(text).toContain('At the store:');
  });
});
