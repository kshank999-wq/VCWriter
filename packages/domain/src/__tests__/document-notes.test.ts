import { describe, expect, it } from 'vitest';
import {
  buildDocumentDocx,
  citeDocumentHtml,
  createProjectFile,
  documentBodyXml,
  documentCitations,
  mainDocument,
  romanNumeral,
  withWriterNotes,
  writerNotesIn,
  type DocNode,
  type WpDocument,
} from '../index.js';

/**
 * **Footnotes and endnotes** (addendum 42 §18, from Ken: *let's get the word
 * processor going*): the writer's own, numbered with a footnote style's
 * citation notes as Word numbers them, set at the foot of the page or the end
 * of the document, and carried into Word as Word's own.
 */
const note = (id: string, kind: 'foot' | 'end', text: string): DocNode => ({ type: 'footnote', attrs: { id, kind, text } });
const content: DocNode = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'The bridge is out.' }, note('a1', 'foot', 'It fell in 1987.')] },
    { type: 'paragraph', content: [{ type: 'text', text: 'The river rose.' }, note('b2', 'end', 'See the flood records.'), note('c3', 'foot', 'Twice that year.')] },
  ],
};
const empty = () => {
  const file = createProjectFile({ title: 'Letter', format: 'document' });
  return { file, cites: documentCitations(file, mainDocument(file)!.id as string) };
};

describe('the writer’s notes', () => {
  it('finds them in order, and numbers footnotes 1, 2 and endnotes i, ii', () => {
    expect(writerNotesIn(content).map((one) => `${one.kind}:${one.id}`)).toEqual(['foot:a1', 'end:b2', 'foot:c3']);
    const cites = withWriterNotes(empty().cites, content);
    expect(cites.notes.map((one) => [one.marker, one.text])).toEqual([
      ['1', 'It fell in 1987.'],
      ['2', 'Twice that year.'],
    ]);
    expect(cites.endnotes.map((one) => [one.marker, one.text])).toEqual([['i', 'See the flood records.']]);
    expect(romanNumeral(14)).toBe('xiv');
  });

  it('prints the markers in the text, footnotes under Notes and endnotes under Endnotes', () => {
    const cites = withWriterNotes(empty().cites, content);
    const html =
      '<p>The bridge is out.<sup class="wp-footnote" data-footnote="a1" data-kind="foot"></sup></p>' +
      '<p>The river rose.<sup class="wp-endnote" data-footnote="b2" data-kind="end"></sup><sup class="wp-footnote" data-footnote="c3" data-kind="foot"></sup></p>';
    const set = citeDocumentHtml(cites, html);
    expect(set).toContain('id="wp-ref-1">1</a>');
    expect(set).toContain('id="wp-ref-2">2</a>');
    expect(set).toContain('id="wp-endref-1">i</a>');
    expect(set).toContain('<h2>Notes</h2>');
    expect(set).toContain('<h2>Endnotes</h2>');
    expect(set).toContain('It fell in 1987.');
    // At the foot of each page instead, the notes are left to the page setter; endnotes stay at the end.
    const paged = citeDocumentHtml(cites, html, false);
    expect(paged).not.toContain('<h2>Notes</h2>');
    expect(paged).toContain('<h2>Endnotes</h2>');
  });

  it('goes to Word as Word’s own footnotes and endnotes', async () => {
    const { file } = empty();
    const document = { ...(mainDocument(file) as WpDocument), content };
    const body = documentBodyXml(document);
    expect(body.context.footnotes).toEqual(['It fell in 1987.', 'Twice that year.']);
    expect(body.context.endnotes).toEqual(['See the flood records.']);
    expect(body.xml).toContain('<w:footnoteReference w:id="1"/>');
    expect(body.xml).toContain('<w:endnoteReference w:id="1"/>');
    const names = new TextDecoder('latin1').decode(await buildDocumentDocx(document));
    expect(names).toContain('word/footnotes.xml');
    expect(names).toContain('word/endnotes.xml');
  });
});
