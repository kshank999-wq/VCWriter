import { describe, expect, it } from 'vitest';
import {
  contentsDocumentHtml,
  contentsEntries,
  createProjectFile,
  documentBodyXml,
  fillContentsPages,
  hasContents,
  headingPagesIn,
  mainDocument,
  type DocNode,
  type WpDocument,
} from '../index.js';

/** A table of contents (addendum 42 §19, from Ken: *go ahead with the table of contents*). */
const heading = (level: number, id: string, text: string): DocNode => ({ type: 'heading', attrs: { level, headingId: id }, content: [{ type: 'text', text }] });
const content: DocNode = {
  type: 'doc',
  content: [
    { type: 'tableOfContents' },
    heading(1, 'h1', 'Arrival'),
    { type: 'paragraph', content: [{ type: 'text', text: 'The ferry docks.' }] },
    heading(2, 'h2', 'The Harbour'),
    heading(4, 'h4', 'Too deep'),
    heading(1, 'h3', 'Departure'),
  ],
};
const doc = (numbering: 'none' | 'decimal' = 'none'): WpDocument => {
  const file = createProjectFile({ title: 'Letter', format: 'document' });
  return { ...(mainDocument(file) as WpDocument), content, headingNumbering: numbering };
};

describe('the table of contents', () => {
  it('lists the headings to three levels, numbered where the document numbers them', () => {
    expect(hasContents(content)).toBe(true);
    expect(contentsEntries(doc()).map((one) => [one.level, one.text])).toEqual([
      [1, 'Arrival'],
      [2, 'The Harbour'],
      [1, 'Departure'],
    ]);
    expect(contentsEntries(doc('decimal')).map((one) => one.number)).toEqual(['1', '1.1', '2']);
  });

  it('sets the table in place of its block, anchors the headings, and fills page numbers once known', () => {
    const html = '<div data-toc="" class="wp-toc-block"></div><h1 data-heading-id="h1">Arrival</h1><h2 data-heading-id="h2">The Harbour</h2><h1 data-heading-id="h3">Departure</h1>';
    const set = contentsDocumentHtml(doc(), html);
    expect(set).toContain('<h2 class="wp-toc-heading">Contents</h2>');
    expect(set).toContain('href="#h-h2"');
    expect(set).toContain('id="h-h2" data-heading-id="h2"');
    const pages = headingPagesIn([{ body: '<h1 data-heading-id="h1">' }, { body: '<p>x</p>' }, { body: '<h2 data-heading-id="h2"><h1 data-heading-id="h3">' }]);
    expect([...pages]).toEqual([['h1', 1], ['h2', 3], ['h3', 3]]);
    const filled = fillContentsPages(set, pages);
    expect(filled).toContain('data-toc-page="h2">3</span>');
  });

  it('goes to Word as a TOC field over the outline levels, Word asked to fill it in', () => {
    const body = documentBodyXml(doc());
    expect(body.context.hasContents).toBe(true);
    expect(body.xml).toContain('TOC \\o "1-3" \\h \\z \\u');
    expect(body.xml).toContain('<w:pStyle w:val="TOC2"/>');
    expect(body.xml).toContain('The Harbour');
  });
});
