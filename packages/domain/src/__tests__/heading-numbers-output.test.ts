import { describe, expect, it } from 'vitest';
import {
  createProjectFile,
  documentBodyXml,
  documentPrintHtml,
  mainDocument,
  numberHeadingsHtml,
  numberedPlainText,
  setDocumentContent,
  setHeadingNumbering,
  type DocNode,
  type WpDocument,
} from '../index.js';

/**
 * Heading numbers on paper (addendum 42 §14): the print and PDF page, the
 * Word file and a text export carry the numbers the screen draws, from the
 * same numbering.
 */

const heading = (headingId: string, level: number, text: string): DocNode => ({
  type: 'heading',
  attrs: { level, headingId },
  content: [{ type: 'text', text }],
});
const para = (text: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });

const BODY: DocNode = {
  type: 'doc',
  content: [para('Preface.'), heading('a', 1, 'Arrival'), para('The ferry docks.'), heading('b', 2, 'The harbour'), heading('c', 1, 'Departure')],
};

const make = (scheme: WpDocument['headingNumbering']): WpDocument => {
  let file = createProjectFile({ title: 'Notes', format: 'document' });
  file = setDocumentContent(file, mainDocument(file)!.id, BODY);
  return mainDocument(setHeadingNumbering(file, mainDocument(file)!.id, scheme))!;
};

const EDITOR_HTML =
  '<p>Preface.</p><h1 data-heading-id="a">Arrival</h1><p>The ferry docks.</p>' +
  '<h2 style="text-align: center" data-heading-id="b">The harbour</h2><h1 data-heading-id="c">Departure</h1>';

describe('heading numbers on paper', () => {
  it('sets each number in front of its heading on the printed page', () => {
    const html = documentPrintHtml(make('decimal'), EDITOR_HTML);
    expect(html).toContain('<h1 data-heading-id="a"><span class="wp-heading-number">1</span>Arrival</h1>');
    expect(html).toContain('data-heading-id="b"><span class="wp-heading-number">1.1</span>The harbour');
    expect(html).toContain('<span class="wp-heading-number">2</span>Departure');
    expect(numberHeadingsHtml(make('outline'), EDITOR_HTML)).toContain('<span class="wp-heading-number">I.</span>Arrival');
  });

  it('leaves the page alone when the document is not numbered', () => {
    expect(numberHeadingsHtml(make('none'), EDITOR_HTML)).toBe(EDITOR_HTML);
  });

  it('types the number and a tab in front of each heading in the Word file', () => {
    const { xml } = documentBodyXml(make('outline'));
    expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/>.*?<w:t[^>]*>I\.<\/w:t><\/w:r><w:r><w:tab\/><\/w:r>/);
    expect(xml).toMatch(/<w:t[^>]*>A\.<\/w:t><\/w:r><w:r><w:tab\/><\/w:r>/);
    expect(documentBodyXml(make('none')).xml).not.toContain('<w:tab/>');
  });

  it('writes the numbers into a text export', () => {
    expect(numberedPlainText(make('decimal'))).toBe('Preface.\n1 Arrival\nThe ferry docks.\n1.1 The harbour\n2 Departure');
    expect(numberedPlainText(make('none'))).toBe('Preface.\nArrival\nThe ferry docks.\nThe harbour\nDeparture');
  });
});
