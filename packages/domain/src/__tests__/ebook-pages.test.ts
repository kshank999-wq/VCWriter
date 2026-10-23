import { describe, expect, it } from 'vitest';
import { EBOOK_RULES, addBeat, addMarker, bookBlocks, createProjectFile, ebookOf, updateBeat, type ProjectFile } from '../index.js';

/**
 * The printed book's page numbers in a reflowable eBook (addendum 43 §28):
 * a page-break marker where each printed page begins — at a block's start,
 * or among its words where a page turns inside a paragraph — a page list in
 * the navigation, and the package saying so.
 */

const book = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'novel', author: 'K. Shank' });
  file = addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'The Road' }).file;
  const beat = addBeat(file, { unitId: file.units[0]!.id, title: 'a' });
  return updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: 'e1', type: 'paragraph', text: 'The kettle *would not* boil. She waited.', characterId: null, attributes: {} },
        { id: 'e2', type: 'paragraph', text: 'North.', characterId: null, attributes: {} },
      ],
    },
  });
};

const text = (pkg: ReturnType<typeof ebookOf>, ending: string): string => {
  const found = pkg.entries.find((one) => one.path.endsWith(ending));
  if (!found || typeof found.data !== 'string') throw new Error(`no ${ending}`);
  return found.data;
};

describe('the print’s page numbers in the eBook', () => {
  it('marks each page where it begins, inside the words where a page turns mid-paragraph', () => {
    const file = book();
    const opening = bookBlocks(file).find((block) => block.kind === 'chapter_opening')!;
    const pkg = ebookOf(file, {
      printPages: [
        { label: '1', blockId: opening.id, at: 0 },
        // "The kettle *would " is 17 characters: page 2 begins inside the italics.
        { label: '2', blockId: 'e1', at: 17 },
        { label: '3', blockId: 'e2', at: 0 },
      ],
    });
    const chapter = text(pkg, '-chapter.xhtml');
    const mark = (n: string) => `<span epub:type="pagebreak" role="doc-pagebreak" id="page-${n}" aria-label="${n}"></span>`;
    expect(chapter).toContain(`${mark('1')}\n<h1 class="chapter-title">`);
    expect(chapter).toContain(`The kettle <em>would </em>${mark('2')}<em>not</em> boil.`);
    expect(chapter).toContain(`${mark('3')}\n<p class="p">North.</p>`);

    const nav = text(pkg, 'toc.xhtml');
    expect(nav).toContain('<nav epub:type="page-list" hidden="hidden">');
    expect(nav).toMatch(/<li><a href="text\/\d{3}-chapter\.xhtml#page-2">2<\/a><\/li>/);
    const opf = text(pkg, 'content.opf');
    expect(opf).toContain('<meta property="schema:accessibilityFeature">printPageNumbers</meta>');
    expect(opf).toContain('<meta property="a11y:pageBreakSource">The Lighthouse, print edition</meta>');
  });

  it('marks a blank page at the next thing printed, numbers a roman page by its place, and lists them in the EPUB 2 navigation', () => {
    const file = book();
    const target = (Object.keys(EBOOK_RULES) as (keyof typeof EBOOK_RULES)[]).find((one) => EBOOK_RULES[one].includeNcx)!;
    const pkg = ebookOf(file, {
      target,
      printPages: [
        { label: 'iv', blockId: 'e1', at: 0 },
        { label: '1', blockId: 'e1', at: 0 },
        { label: '2', blockId: 'e2', at: 0 },
      ],
    });
    const ncx = text(pkg, 'toc.ncx');
    expect(ncx).toContain('<meta name="dtb:totalPageCount" content="3"/>');
    expect(ncx).toContain('<meta name="dtb:maxPageNumber" content="2"/>');
    expect(ncx).toMatch(/<pageTarget id="pt-1" type="front" value="1"[^>]*><navLabel><text>iv<\/text>/);
    expect(ncx).toMatch(/<pageTarget id="pt-3" type="normal" value="2"/);
  });

  it('carries no page list where the book has not been laid', () => {
    const pkg = ebookOf(book());
    expect(text(pkg, 'toc.xhtml')).not.toContain('page-list');
    expect(text(pkg, 'content.opf')).not.toContain('printPageNumbers');
  });
});
