import { parseInline } from './entities/inline.js';
import type { DocMark, DocNode } from './entities/document.js';
import type { DocxDocument, DocxParagraph } from './import-docx.js';

/**
 * **Bringing a Word or text file into a document** (addendum 42 §4).
 *
 * The Word side reads what `import-docx.ts` already reads for every other
 * importer: paragraphs with their style, alignment, indent, emphasis, list
 * membership and pictures. It is turned into the editor's tree rather than
 * into beats. Headings stay headings, Title and Subtitle stay themselves, a
 * run of list items becomes a list, and pictures come in where they stood.
 *
 * That reader does not yet see tables, the kind of a list (bullets or
 * numbers) or its depth, so a table's cells arrive as paragraphs in reading
 * order and every list as bullets at one level. The words all arrive. The
 * addendum's limits list says so.
 */

const marksOf = (span: { bold?: boolean; italic?: boolean; underline?: boolean }): DocMark[] => {
  const marks: DocMark[] = [];
  if (span.bold) marks.push({ type: 'bold' });
  if (span.italic) marks.push({ type: 'italic' });
  if (span.underline) marks.push({ type: 'underline' });
  return marks;
};

/**
 * A paragraph's words with their emphasis, as the editor's text nodes — and,
 * where its footnotes are kept (addendum 43 §22), a citation node where each
 * note's reference stood, under the key the library gave it.
 */
const inlineOf = (paragraph: DocxParagraph, keys: ReadonlyMap<string, string> | null): DocNode[] => {
  const nodes: DocNode[] = [];
  parseInline(keys ? (paragraph.cited ?? paragraph.text) : paragraph.text).forEach((span) => {
    if (span.citation) {
      const key = keys?.get(span.citation);
      if (key) nodes.push({ type: 'citation', attrs: { key } });
      return;
    }
    // The reader marks a line break inside a paragraph as a newline.
    span.text.split('\n').forEach((piece, index) => {
      if (index > 0) nodes.push({ type: 'hardBreak' });
      if (!piece) return;
      const marks = marksOf(span);
      nodes.push(marks.length ? { type: 'text', text: piece, marks } : { type: 'text', text: piece });
    });
  });
  return nodes;
};

const pictureNodes = (paragraph: DocxParagraph): DocNode[] =>
  paragraph.pictures.map((picture) => ({
    type: 'image',
    attrs: {
      src: picture.dataUrl,
      alt: picture.name || null,
      ...(picture.width > 0 ? { width: Math.round(picture.width) } : {}),
    },
  }));

const blockAttrs = (paragraph: DocxParagraph): Record<string, unknown> => {
  const attrs: Record<string, unknown> = {};
  if (paragraph.align !== 'left') attrs['textAlign'] = paragraph.align;
  // Word's indent is in inches; the editor's is in half-inch steps.
  const steps = Math.round(paragraph.indentLeft / 0.5);
  if (steps > 0 && !paragraph.list) attrs['indent'] = Math.min(8, steps);
  return attrs;
};

const withAttrs = (node: DocNode, attrs: Record<string, unknown>): DocNode =>
  Object.keys(attrs).length ? { ...node, attrs: { ...node.attrs, ...attrs } } : node;

/**
 * A heading's or a title's boldness comes from its style, and the reader
 * folds a style's emphasis into the words. Kept, it would be an explicit
 * bold on every heading, which the editor's own heading style already is.
 */
const withoutBold = (nodes: DocNode[]): DocNode[] =>
  nodes.map((node) => {
    if (!node.marks) return node;
    const marks = node.marks.filter((mark) => mark.type !== 'bold');
    if (marks.length) return { ...node, marks };
    const { marks: _dropped, ...rest } = node;
    return rest;
  });

const blockOf = (paragraph: DocxParagraph, keys: ReadonlyMap<string, string> | null): DocNode => {
  const headed =
    paragraph.styleName === 'title' ||
    paragraph.styleName === 'subtitle' ||
    (paragraph.outline !== null && paragraph.outline <= 5);
  const content = headed ? withoutBold(inlineOf(paragraph, keys)) : inlineOf(paragraph, keys);
  const attrs = blockAttrs(paragraph);
  const style = paragraph.styleName;
  if (style === 'title' || style === 'subtitle') {
    return withAttrs({ type: 'paragraph', content }, { ...attrs, docStyle: style });
  }
  if (paragraph.outline !== null && paragraph.outline <= 5) {
    return withAttrs({ type: 'heading', attrs: { level: paragraph.outline + 1 }, content }, attrs);
  }
  return withAttrs(content.length ? { type: 'paragraph', content } : { type: 'paragraph' }, attrs);
};

const isQuote = (paragraph: DocxParagraph) =>
  paragraph.styleName === 'quote' || paragraph.styleName === 'intense quote';

/**
 * A Word document as the editor's tree. With `keys` (the file's own note keys
 * to the library's, from `notesIntoLibrary`), its footnotes come in as
 * citations; without, the words come in clean, as they always have.
 */
export const docxToDocContent = (docx: DocxDocument, keys: ReadonlyMap<string, string> | null = null): DocNode => {
  const blocks: DocNode[] = [];
  let list: DocNode | null = null;
  let quote: DocNode | null = null;

  docx.paragraphs.forEach((paragraph) => {
    if (paragraph.pageBreakBefore && blocks.length > 0) {
      list = null;
      quote = null;
      blocks.push({ type: 'pageBreak' });
    }
    const pictures = pictureNodes(paragraph);
    const block = blockOf(paragraph, keys);

    if (paragraph.list) {
      quote = null;
      if (!list) {
        list = { type: 'bulletList', content: [] };
        blocks.push(list);
      }
      list.content?.push({ type: 'listItem', content: [block.type === 'heading' ? { type: 'paragraph', content: block.content } : block] });
      pictures.forEach((picture) => blocks.push(picture));
      return;
    }
    list = null;

    if (isQuote(paragraph)) {
      if (!quote) {
        quote = { type: 'blockquote', content: [] };
        blocks.push(quote);
      }
      quote.content?.push(block);
      return;
    }
    quote = null;

    // A paragraph that is only a picture becomes the picture.
    if (pictures.length && !paragraph.plain.trim()) {
      blocks.push(...pictures);
      return;
    }
    blocks.push(block);
    blocks.push(...pictures);
  });

  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] };
};

/**
 * Plain text as the editor's tree: one paragraph per line. A blank line is
 * kept as an empty paragraph, since in a text file it is the writer's own
 * spacing.
 */
export const textToDocContent = (text: string): DocNode => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return {
    type: 'doc',
    content: lines.map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
  };
};
