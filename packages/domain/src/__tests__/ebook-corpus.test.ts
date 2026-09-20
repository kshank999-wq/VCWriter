import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  appendImportedStory,
  beginStory,
  createProjectFile,
  ebookOf,
  epubBytes,
  packagedCheck,
  preflightEbook,
  setBookSettings,
  updateBeat,
  type ProjectFile,
} from '../index.js';
import { assetSchema } from '../entities/asset.js';

/**
 * The regression corpus (addendum 23 §9, Ken's §18): the books an exporter
 * is most likely to get wrong, each built here and exported, and what must
 * hold of every one — well-formed by construction, every link landing,
 * nothing blocking, and the same package twice. The desktop's test parses
 * every file as XML; EPUBCheck was run over the same books by hand (§9).
 */

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const TYPOGRAPHY = [
  '“Smart quotes,” she said, ‘and single ones too.’',
  'An em dash — like this — and an en dash 1–2, and an ellipsis… so.',
  'Accents: café, naïve, façade, Zoë, Ærø, señor, Straße.',
  'Greek: Ἐν ἀρχῇ ἦν ὁ λόγος. Cyrillic: Война и мир. Arabic: ألف ليلة وليلة. Japanese: 吾輩は猫である。',
  'Marks *inside* the **text**, and an ampersand & a less-than < and a greater-than >.',
];

const withChapters = (file: ProjectFile, count: number): ProjectFile => {
  const track = file.tracks[0]!;
  const units = [file.units[0]!];
  for (let index = 1; index < count; index += 1) {
    const made = addUnit(file, { trackId: track.id, title: `Unit ${index + 1}` });
    file = made.file;
    units.push(made.unit);
  }
  units.forEach((unit, index) => {
    file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: `Chapter the ${index + 1}` }).file;
    const beat = addBeat(file, { unitId: unit.id, title: `b${index}` });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: TYPOGRAPHY.map((text, n) => ({ id: `p-${index}-${n}` as never, type: 'paragraph' as const, text, characterId: null, attributes: {} })),
      },
    });
  });
  return file;
};

const holds = async (file: ProjectFile, target = 'universal') => {
  const pkg = ebookOf(file, { target, modified: '2026-09-20T09:00:00Z' });
  const preflight = preflightEbook(pkg);
  const bytes = await epubBytes(pkg);
  const packaged = packagedCheck(bytes, pkg);
  expect(preflight.findings.filter((one) => one.severity === 'error').map((one) => one.text)).toEqual([]);
  expect(packaged.map((one) => one.severity)).toEqual(['info']);
  // Every content file well-formed in the cheap sense the domain can check: balanced, closed, escaped.
  for (const entry of pkg.entries) {
    if (typeof entry.data !== 'string' || !/\.(xhtml|opf|ncx|xml)$/.test(entry.path)) continue;
    expect(entry.data, entry.path).not.toMatch(/<br>|<img [^>]*[^/]>|&nbsp;|&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
  }
  const again = ebookOf(file, { target, modified: '2026-09-20T09:00:00Z' });
  expect(again.entries.map((one) => (typeof one.data === 'string' ? one.data : one.data.length))).toEqual(
    pkg.entries.map((one) => (typeof one.data === 'string' ? one.data : one.data.length)),
  );
  return { pkg, preflight, bytes };
};

describe('the regression corpus', () => {
  it('a plain twenty-chapter novel: twenty files, twenty contents entries, nothing blocking', async () => {
    const file = withChapters(createProjectFile({ title: 'Twenty', format: 'novel', author: 'K. Shank' }), 20);
    const { pkg } = await holds(file);
    expect(pkg.sections.filter((section) => section.kind === 'chapter')).toHaveLength(20);
    expect(pkg.nav.filter((item) => item.title.startsWith('Chapter the'))).toHaveLength(20);
    expect(pkg.entries.filter((one) => one.path.endsWith('-chapter.xhtml'))).toHaveLength(20);
  });

  it('smart quotes, dashes, ellipses, accents and non-Latin script come through as themselves', async () => {
    const file = withChapters(createProjectFile({ title: 'Ærø — a “story”', format: 'novel', author: 'Zoë Straße' }), 1);
    const { pkg } = await holds(file);
    const chapter = String(pkg.entries.find((one) => one.path.endsWith('-chapter.xhtml'))!.data);
    expect(chapter).toContain('“Smart quotes,” she said, ‘and single ones too.’');
    expect(chapter).toContain('An em dash — like this — and an en dash 1–2, and an ellipsis… so.');
    expect(chapter).toContain('café, naïve, façade, Zoë, Ærø, señor, Straße');
    expect(chapter).toContain('Ἐν ἀρχῇ ἦν ὁ λόγος');
    expect(chapter).toContain('吾輩は猫である');
    expect(chapter).toContain('ألف ليلة وليلة');
    expect(chapter).toContain('Marks <em>inside</em> the <strong>text</strong>, and an ampersand &amp; a less-than &lt; and a greater-than &gt;.');
    expect(pkg.fileName).toBe('aero-a-story.epub');
    expect(String(pkg.entries.find((one) => one.path.endsWith('content.opf'))!.data)).toContain('<dc:title id="title">Ærø — a “story”</dc:title>');
  });

  it('several authors are several creators, each an author', async () => {
    const file = withChapters(createProjectFile({ title: 'Two Hands', format: 'novel', author: 'K. Shank and M. Shank, with J. Doe' }), 1);
    const { pkg } = await holds(file);
    expect(pkg.metadata.authors).toEqual(['K. Shank', 'M. Shank', 'with J. Doe']);
    const opf = String(pkg.entries.find((one) => one.path.endsWith('content.opf'))!.data);
    expect(opf.match(/scheme="marc:relators">aut<\/meta>/g)).toHaveLength(3);
  });

  it('pictures inside and a cover outside: the files, the alt text, the cover beside the book', async () => {
    let file = withChapters(createProjectFile({ title: 'Pictures', format: 'novel', author: 'K. Shank' }), 2);
    const picture = assetSchema.parse({ id: '22222222-2222-4222-8222-222222222222', projectId: file.project.id, kind: 'image', name: 'harbour.png', data: PNG, width: 1200, height: 800, altText: 'The harbour', createdAt: file.savedAt, updatedAt: file.savedAt });
    const cover = assetSchema.parse({ id: '33333333-3333-4333-8333-333333333333', projectId: file.project.id, kind: 'image', name: 'cover.png', data: PNG, width: 1600, height: 2560, createdAt: file.savedAt, updatedAt: file.savedAt });
    file = { ...file, assets: [picture, cover] };
    const beat = file.beats[0]!;
    file = updateBeat(file, beat.id, {
      manuscript: { elements: [...beat.manuscript.elements, { id: 'fig' as never, type: 'figure', text: 'Boats', characterId: null, attributes: { assetId: picture.id } }] },
    });
    file = setBookSettings(file, { ebook: { coverAssetId: cover.id } as never });
    const { pkg } = await holds(file, 'apple');
    expect(pkg.images.map((one) => one.href)).toEqual(['images/img-001.png']);
    expect(pkg.cover?.fileName).toBe('pictures-cover.png');
    expect(String(pkg.entries.find((one) => one.path.endsWith('-chapter.xhtml'))!.data)).toContain('<img src="../images/img-001.png" alt="The harbour"/>');
    expect(pkg.sections[0]?.kind).toBe('cover');
  });

  it('parts before and after the story, each a file with its own landmark type', async () => {
    let file = withChapters(createProjectFile({ title: 'Parts', format: 'novel', author: 'K. Shank' }), 2);
    file = addPart(file, 'dedication', { text: 'For the lamp.' }).file;
    file = addPart(file, 'prologue', { text: 'Before.\n\nAnd before that.' }).file;
    file = addPart(file, 'epilogue', { text: 'After.' }).file;
    file = addPart(file, 'acknowledgements', { text: 'Thanks.' }).file;
    const { pkg } = await holds(file);
    const kinds = pkg.sections.map((section) => `${section.kind}:${section.title}`);
    expect(kinds).toContain('front:Dedication');
    expect(kinds).toContain('front:Prologue');
    expect(kinds).toContain('back:Epilogue');
    expect(kinds).toContain('back:Acknowledgements');
    expect(String(pkg.entries.find((one) => one.path.endsWith('-prologue.xhtml'))!.data)).toContain('epub:type="prologue"');
    expect(String(pkg.entries.find((one) => one.path.endsWith('-epilogue.xhtml'))!.data)).toContain('epub:type="epilogue"');
    // The prologue is before the first chapter and the epilogue after the last.
    const order = pkg.sections.map((section) => section.title);
    expect(order.indexOf('Prologue')).toBeLessThan(order.indexOf('Chapter the 1'));
    expect(order.indexOf('Epilogue')).toBeGreaterThan(order.indexOf('Chapter the 2'));
  });

  it('a collection: a file per story, titled as the story, with the imported one after the written one', async () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story', author: 'K. Shank' }), { title: 'The Road' }).file;
    const first = file.units.find((unit) => unit.inScript)!;
    const beat = addBeat(file, { unitId: first.id, title: 'a' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [{ id: 'r1' as never, type: 'paragraph', text: 'The road went on.', characterId: null, attributes: {} }] } });
    const added = appendImportedStory(
      file,
      { title: 'The Harbour', author: '', scenes: [{ heading: '', elements: [{ type: 'paragraph', text: 'Boats.' }] }], warnings: [], characters: [], locations: [], source: 'text' } as never,
      { title: 'The Harbour' },
    );
    file = added!.file;
    const { pkg } = await holds(file, 'kobo');
    const stories = pkg.sections.filter((section) => section.kind === 'chapter').map((section) => section.title);
    expect(stories).toEqual(['The Road', 'The Harbour']);
  });

  it('every store preset, on the same book, and only the rules the store states', async () => {
    let file = withChapters(createProjectFile({ title: 'Everywhere', format: 'novel', author: 'K. Shank' }), 3);
    const cover = assetSchema.parse({ id: '33333333-3333-4333-8333-333333333333', projectId: file.project.id, kind: 'image', name: 'cover.jpg', data: PNG, width: 1600, height: 2560, createdAt: file.savedAt, updatedAt: file.savedAt });
    file = { ...file, assets: [cover] };
    file = setBookSettings(file, { ebook: { coverAssetId: cover.id, isbn: '9781402894626' } as never });
    for (const target of ['universal', 'kindle', 'apple', 'nook', 'kobo', 'google', 'd2d', 'ingram']) {
      const { pkg, preflight } = await holds(file, target);
      expect(pkg.rules.id, target).toBe(target);
      expect(preflight.blocking, target).toBe(false);
    }
  });
});
