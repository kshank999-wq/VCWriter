import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_STYLES_XML,
  buildDocumentDocx,
  createProjectFile,
  docHeadings,
  docPlainText,
  docWordCount,
  docxToDocContent,
  documentBodyXml,
  formatName,
  halfPoints,
  isWordProcessor,
  mainDocument,
  pageSize,
  parseProjectFile,
  pictureSize,
  readDocx,
  serializeProjectFile,
  setDocumentContent,
  setDocumentPageSetup,
  startsHere,
  textToDocContent,
  wordColour,
  type DocNode,
  type WpDocument,
} from '../index.js';

/**
 * The word processor's document (addendum 42).
 *
 * What is pinned: a Document project is one document and other formats have
 * none; the plain text and counts read the editor's tree as Word would; and
 * the Word file says each thing in Word's own terms, read back by the same
 * reader every other import uses.
 */

const text = (value: string, marks?: DocNode['marks']): DocNode => (marks ? { type: 'text', text: value, marks } : { type: 'text', text: value });
const para = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const heading = (level: number, value: string): DocNode => ({ type: 'heading', attrs: { level }, content: [text(value)] });
const item = (value: string, nested?: DocNode): DocNode => ({ type: 'listItem', content: nested ? [para(text(value)), nested] : [para(text(value))] });

const LETTER: DocNode = {
  type: 'doc',
  content: [
    { type: 'paragraph', attrs: { docStyle: 'title' }, content: [text('A Letter')] },
    heading(1, 'Opening'),
    para(text('Dear '), text('Ken', [{ type: 'bold' }]), text(', it is '), text('raining', [{ type: 'italic' }]), text('.')),
    { type: 'bulletList', content: [item('apples', { type: 'orderedList', attrs: { type: 'a' }, content: [item('green')] }), item('pears')] },
    { type: 'orderedList', attrs: { start: 3 }, content: [item('third')] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(text('Name'))] }, { type: 'tableHeader', content: [para(text('Age'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [para(text('Both'))] }] },
      ],
    },
    { type: 'pageBreak' },
    heading(2, 'Closing'),
    para(text('See ', []), text('the site', [{ type: 'link', attrs: { href: 'https://vc-writer.com' } }])),
    { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('Yours', [{ type: 'textStyle', attrs: { color: '#c9a45c', fontSize: '14pt', fontFamily: 'Georgia, serif' } }])] },
  ],
};

const documentOf = (content: DocNode): WpDocument => {
  const file = createProjectFile({ title: 'Letters', format: 'document' });
  const doc = mainDocument(file)!;
  return mainDocument(setDocumentContent(file, doc.id, content))!;
};

describe('the format', () => {
  it('is offered on the new-project screen as Document', () => {
    expect(isWordProcessor('document')).toBe(true);
    expect(isWordProcessor('novel')).toBe(false);
    expect(startsHere('document')).toBe(true);
    expect(formatName('document')).toBe('Document');
  });

  it('starts as one empty document, and every other format holds none', () => {
    const file = createProjectFile({ title: 'Letters', format: 'document' });
    expect(file.documents).toHaveLength(1);
    expect(file.documents[0]?.title).toBe('Letters');
    expect(docPlainText(file.documents[0]!.content)).toBe('');
    expect(createProjectFile({ title: 'Lamp', format: 'novel' }).documents).toEqual([]);
  });

  it('survives a save and a reopen, and a file from before documents opens with none', () => {
    const file = createProjectFile({ title: 'Letters', format: 'document' });
    const doc = mainDocument(file)!;
    const changed = setDocumentContent(file, doc.id, LETTER);
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(changed)));
    expect(mainDocument(reopened)?.content).toEqual(LETTER);
    const old = JSON.parse(serializeProjectFile(createProjectFile({ title: 'Old', format: 'novel' })));
    delete old.documents;
    expect(parseProjectFile(old).documents).toEqual([]);
  });

  it('counts each change to the body as a revision', () => {
    const file = createProjectFile({ title: 'Letters', format: 'document' });
    const doc = mainDocument(file)!;
    const once = setDocumentContent(file, doc.id, textToDocContent('one'));
    const twice = setDocumentContent(once, doc.id, textToDocContent('two'));
    expect(mainDocument(twice)?.revision).toBe(2);
  });

  it('turns the page for landscape, and keeps margins it was not asked about', () => {
    const file = createProjectFile({ title: 'Letters', format: 'document' });
    const doc = mainDocument(file)!;
    const turned = setDocumentPageSetup(file, doc.id, { orientation: 'landscape', margins: { left: 1.5 } });
    const setup = mainDocument(turned)!.pageSetup;
    expect(pageSize(setup)).toEqual({ width: 11, height: 8.5 });
    expect(setup.margins).toEqual({ top: 1, right: 1, bottom: 1, left: 1.5 });
  });
});

describe('reading the words', () => {
  it('reads one block to a line, list items and table cells included', () => {
    expect(docPlainText(LETTER).split('\n')).toEqual([
      'A Letter',
      'Opening',
      'Dear Ken, it is raining.',
      'apples',
      'green',
      'pears',
      'third',
      'Name',
      'Age',
      'Both',
      'Closing',
      'See the site',
      'Yours',
    ]);
  });

  it("counts words as Word does, apostrophes and hyphens inside a word", () => {
    expect(docWordCount(textToDocContent("Ken's well-made plan — done."))).toBe(4);
  });

  it('lists the headings in order, for the navigation pane', () => {
    expect(docHeadings(LETTER)).toEqual([
      { level: 1, text: 'Opening', index: 1 },
      { level: 2, text: 'Closing', index: 7 },
    ]);
  });
});

describe('the Word file', () => {
  const { xml, context } = documentBodyXml(documentOf(LETTER));

  it('uses Word’s own styles for title and headings', () => {
    expect(xml).toContain('<w:pStyle w:val="Title"/>');
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(DOCUMENT_STYLES_XML).toContain('w:styleId="Heading6"');
  });

  it('writes bold, italic, colour, size, face and alignment', () => {
    expect(xml).toMatch(/<w:b\/><\/w:rPr><w:t xml:space="preserve">Ken</);
    expect(xml).toMatch(/<w:i\/><\/w:rPr><w:t xml:space="preserve">raining</);
    expect(xml).toContain('<w:color w:val="C9A45C"/>');
    expect(xml).toContain('<w:sz w:val="28"/>');
    expect(xml).toContain('w:ascii="Georgia"');
    expect(xml).toContain('<w:jc w:val="center"/>');
  });

  it('makes real Word lists: a nested list numbers under its parent, and each top-level list starts afresh', () => {
    // Bullets with a lettered list under them share one instance; the "start
    // at 3" list is a second.
    expect(context.lists).toEqual([
      { numId: 1, abstract: 'bullet', start: 1 },
      { numId: 2, abstract: 'decimal', start: 3 },
    ]);
    expect(xml).toContain('<w:ilvl w:val="1"/><w:numId w:val="1"/>');
  });

  it('writes a table with a header shade and a spanning cell', () => {
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:gridSpan w:val="2"/>');
    expect(xml).toContain('w:fill="F2F2F2"');
  });

  it('writes a page break and a hyperlink with its target', () => {
    expect(xml).toContain('<w:br w:type="page"/>');
    expect(xml).toContain('<w:hyperlink r:id="rIdLink1">');
    expect(context.links).toEqual([{ rid: 'rIdLink1', href: 'https://vc-writer.com' }]);
  });

  it('is a zip carrying the document, its styles and its numbering', async () => {
    const bytes = await buildDocumentDocx(documentOf(LETTER));
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
    const names = new TextDecoder('latin1').decode(bytes);
    for (const part of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']) {
      expect(names).toContain(part);
    }
  });

  it('carries a pasted picture as a picture, at its own proportions', () => {
    // A 4 × 2 PNG: just enough header for the size to be read.
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    png.set([0, 0, 0, 4, 0, 0, 0, 2], 16);
    expect(pictureSize(png)).toEqual({ width: 4, height: 2 });
    const src = `data:image/png;base64,${btoa(String.fromCharCode(...png))}`;
    const withPicture = documentBodyXml(documentOf({ type: 'doc', content: [{ type: 'image', attrs: { src, alt: 'Chart', width: 200 } }] }));
    expect(withPicture.context.pictures).toHaveLength(1);
    expect(withPicture.xml).toContain('r:embed="rIdPic1"');
    expect(withPicture.xml).toContain(`cx="${200 * 9525}" cy="${100 * 9525}"`);
  });

  it('reads CSS colours and sizes as Word wants them', () => {
    expect(wordColour('#abc')).toBe('AABBCC');
    expect(wordColour('rgb(201, 164, 92)')).toBe('C9A45C');
    expect(wordColour('red')).toBeNull();
    expect(halfPoints('12pt')).toBe(24);
    expect(halfPoints('16px')).toBe(24);
  });
});

describe('the round trip', () => {
  it('comes back through the Word reader with its headings, emphasis, alignment and list', () => {
    const { xml } = documentBodyXml(documentOf(LETTER));
    const back = docxToDocContent(readDocx({ document: xml, styles: DOCUMENT_STYLES_XML }));
    const blocks = back.content ?? [];
    expect(blocks[0]).toMatchObject({ type: 'paragraph', attrs: { docStyle: 'title' } });
    expect(blocks[1]).toEqual({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Opening' }] });
    expect(blocks[2]?.content).toContainEqual({ type: 'text', text: 'Ken', marks: [{ type: 'bold' }] });
    expect(blocks.find((block) => block.type === 'bulletList')).toBeDefined();
    expect(blocks.some((block) => block.type === 'pageBreak')).toBe(true);
    expect(blocks.at(-1)).toMatchObject({ attrs: { textAlign: 'center' } });
    // Every word survives, tables' included, even where structure does not.
    for (const word of ['apples', 'green', 'Name', 'Both', 'Closing', 'Yours']) {
      expect(docPlainText(back)).toContain(word);
    }
  });

  it('reads plain text one paragraph to a line', () => {
    expect(textToDocContent('one\n\ntwo\n')).toEqual({
      type: 'doc',
      content: [para(text('one')), { type: 'paragraph' }, para(text('two'))],
    });
  });
});

describe('withMainDocument (addendum 42 §16)', () => {
  it('gives a Document project with no document an empty one, and leaves the rest alone', async () => {
    const { createProjectFile, withMainDocument, mainDocument } = await import('../index.js');
    const made = createProjectFile({ title: 'From the phone', format: 'document' });
    const bare = { ...made, documents: [] };
    const mended = withMainDocument(bare);
    expect(mainDocument(mended)?.title).toBe('From the phone');
    expect(mainDocument(mended)?.projectId).toBe(made.project.id);
    expect(withMainDocument(made)).toBe(made);
    const novel = createProjectFile({ title: 'A novel', format: 'novel' });
    expect(withMainDocument(novel)).toBe(novel);
  });
});
