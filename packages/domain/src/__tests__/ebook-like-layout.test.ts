import { describe, expect, it } from 'vitest';
import { assetSchema } from '../entities/asset.js';
import { addBeat, addUnit, beginStory, createProjectFile, ebookOf, ebookCss, previewDocument, PREVIEW_DEVICES, updateBeat, type EbookPackage } from '../index.js';

/**
 * The eBook sets the book the way the Layout does (addendum 23 §13, from
 * Ken: *it doesn't really look anything like the layout, which it should*).
 */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const collection = () => {
  let file = createProjectFile({ title: "Villain's Tales", format: 'short_story', author: 'K.M. Shank' });
  const story = beginStory(file, { title: 'In For A Pound...' });
  file = story.file;
  const picture = (id: string, name: string) =>
    assetSchema.parse({ id, projectId: file.project.id, kind: 'image', name, data: PNG, width: 800, height: 1200, createdAt: file.savedAt, updatedAt: file.savedAt });
  const art = picture('33333333-3333-4333-8333-333333333333', 'art.png');
  const plate = picture('44444444-4444-4444-8444-444444444444', 'plate.png');
  file = { ...file, assets: [art, plate], markers: file.markers.map((m) => (m.id === story.markerId ? { ...m, page: { ...(m.page ?? {}), assetId: art.id, template: 'full_page' } } : m)) } as never;
  const el = (id: string, type: string, text: string, attributes: Record<string, unknown> = {}) => ({ id: id as never, type, text, characterId: null, attributes });
  let made = addBeat(file, { unitId: story.unitId, title: 'one' });
  file = updateBeat(made.file, made.beat.id, { manuscript: { elements: [el('h1', 'heading', 'I.'), el('p1', 'paragraph', 'My uncle taught me two lessons.')] } as never });
  const track = file.units.find((unit) => unit.id === story.unitId)!.trackId;
  const second = addUnit(file, { trackId: track, title: '' });
  made = addBeat(second.file, { unitId: second.unit.id, title: 'two' });
  return updateBeat(made.file, made.beat.id, {
    manuscript: { elements: [el('f2', 'figure', '', { bookPlace: 'page', assetId: plate.id }), el('h2', 'heading', 'II.'), el('p2', 'paragraph', 'I walked into the house.')] } as never,
  });
};

const text = (pkg: EbookPackage, href: string): string => {
  const found = pkg.entries.find((entry) => entry.path === `OEBPS/${href}`);
  return typeof found?.data === 'string' ? found.data : '';
};

describe('the eBook, set as the Layout sets it', () => {
  const pkg = ebookOf(collection());
  const order = pkg.sections.filter((section) => section.id !== 'nav');

  it('gives full-page story art a screen of its own and does not print the title under it', () => {
    const art = order.find((section) => section.id.endsWith('-art'))!;
    expect(text(pkg, art.href)).toContain('<body class="art">');
    expect(text(pkg, art.href)).toContain('<div class="art-page"><img src="../images/');
    const chapter = order[order.indexOf(art) + 1]!;
    expect(text(pkg, chapter.href)).toContain('<h1 class="chapter-title titled-by-art">In For A Pound...</h1>');
    expect(ebookCss(collection())).toContain('h1.titled-by-art { display: none; }');
  });

  it('opens a numbered section on a fresh screen, centred, in the chapter-number type', () => {
    const all = order.map((section) => text(pkg, section.href)).join('');
    expect(all).toContain('<h2 class="section-open">I.</h2>');
    expect(all).toContain('<h2 class="section-open">II.</h2>');
    // And the line after it opens as a chapter's first line does.
    expect(all).toMatch(/<h2 class="section-open">II\.<\/h2>\s*(<span[^>]*><\/span>)?<p class="p first/);
    const css = ebookCss(collection());
    expect(css).toMatch(/h2\.section-open \{[^}]*text-align: center;[^}]*page-break-before: always;/);
  });

  it('puts an illustrated page inside a story on a screen of its own, and carries the story on after it', () => {
    const arts = order.filter((section) => section.href.includes('-art.xhtml'));
    expect(arts.length).toBeGreaterThanOrEqual(1);
    const plate = arts[arts.length - 1]!;
    expect(text(pkg, plate.href)).toContain('<body class="art">');
    expect(text(pkg, order[order.indexOf(plate) + 1]!.href)).toContain('II.');
  });

  it('lists each story once in the contents, however many files it took', () => {
    const toc = text(pkg, 'toc.xhtml').split('epub:type="landmarks"')[0]!;
    expect(toc.match(/In For A Pound\.\.\./g)).toHaveLength(1);
  });

  it('previews an art page edge to edge and a text page inside the reading app’s head and foot', () => {
    const kindle = PREVIEW_DEVICES.find((device) => device.id === 'kindle')!;
    const art = order.find((section) => section.id.endsWith('-art'))!;
    expect(previewDocument(pkg, art.href, kindle)).toContain('<body class="art">');
    const words = previewDocument(pkg, order.find((section) => section.id === 'chapter-001')!.href, kindle)!;
    expect(words).toContain('<div id="head">In For A Pound...</div>');
    expect(words).toContain('<div id="folio"></div>');
  });
});
