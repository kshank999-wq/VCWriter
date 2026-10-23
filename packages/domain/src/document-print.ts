import { DOCUMENT_CITATION_CSS, noteHtml, type DocumentCitations } from './document-citations.js';
import { pageSize } from './document.js';
import { headingNumbers } from './document-outline.js';
import { headerFooterCss, printedDate } from './document-pages.js';
import type { WpDocument } from './entities/document.js';

/**
 * **How a document's words are set**, on screen and on paper (addendum 42).
 *
 * One stylesheet, scoped under `.wp-doc`, for the editor and for the printed
 * page alike. So the size of a heading, the indent of a quote and the shading
 * of a table header are decided once, and the page that prints is the page
 * that was written. The defaults are Word's: Calibri 11 pt, 1.08 line height,
 * 8 pt after a paragraph.
 */
export const DOCUMENT_CONTENT_CSS = `
.wp-doc { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.08; color: #000; tab-size: 4; -moz-tab-size: 4; white-space: pre-wrap; word-wrap: break-word; }
.wp-doc p { margin: 0 0 8pt; }
.wp-doc p[data-doc-style="title"] { font-size: 28pt; line-height: 1; margin: 0 0 4pt; letter-spacing: -0.5pt; }
.wp-doc p[data-doc-style="subtitle"] { font-size: 14pt; color: #595959; margin: 0 0 8pt; }
.wp-doc h1, .wp-doc h2, .wp-doc h3, .wp-doc h4, .wp-doc h5, .wp-doc h6 { font-weight: 700; margin: 12pt 0 4pt; line-height: 1.1; page-break-after: avoid; break-after: avoid; }
.wp-doc h1 { font-size: 16pt; }
.wp-doc h2 { font-size: 13pt; }
.wp-doc h3 { font-size: 12pt; }
.wp-doc h4, .wp-doc h5, .wp-doc h6 { font-size: 11pt; }
.wp-doc h5, .wp-doc h6 { font-style: italic; }
.wp-doc blockquote { margin: 0 0.5in 8pt; font-style: italic; color: #404040; }
.wp-doc ul, .wp-doc ol { margin: 0 0 8pt; padding-left: 0.5in; }
.wp-doc li > p { margin: 0 0 2pt; }
.wp-doc ul ul { list-style-type: circle; }
.wp-doc ul ul ul { list-style-type: square; }
.wp-doc ol[type="a"] { list-style-type: lower-alpha; }
.wp-doc ol[type="A"] { list-style-type: upper-alpha; }
.wp-doc ol[type="i"] { list-style-type: lower-roman; }
.wp-doc ol[type="I"] { list-style-type: upper-roman; }
.wp-doc pre { font-family: Consolas, "Courier New", monospace; font-size: 10pt; background: #f4f4f4; padding: 6pt 8pt; margin: 0 0 8pt; white-space: pre-wrap; }
.wp-doc code { font-family: Consolas, "Courier New", monospace; font-size: 0.95em; }
.wp-doc hr { border: none; border-top: 1px solid #808080; margin: 8pt 0; }
.wp-doc a { color: #0563c1; text-decoration: underline; }
.wp-doc img { max-width: 100%; height: auto; }
.wp-doc table { border-collapse: collapse; width: 100%; margin: 0 0 8pt; table-layout: fixed; }
.wp-doc th, .wp-doc td { border: 1px solid #000; padding: 2pt 5pt; vertical-align: top; }
.wp-doc th { background: #f2f2f2; font-weight: 700; text-align: left; }
.wp-doc th > p, .wp-doc td > p { margin: 0; }
.wp-doc mark { padding: 0; }
.wp-doc .wp-heading-number { margin-right: 0.5em; }
.wp-doc .wp-page-break { break-after: page; page-break-after: always; height: 0; border: none; margin: 0; }
`;

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A safe file name for the PDF of a document called this. */
export const suggestedPdfName = (title: string): string => {
  const base = (title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
  return `${base}.pdf`;
};

/**
 * The page the printer and the PDF are made from: the editor's HTML in the
 * shared stylesheet, on the document's own paper and margins.
 *
 * The browser sets it into pages, which is the honest division of labour: a
 * document reflows, and only the thing laying it out knows where page two
 * begins. A page break the writer asked for is honoured; a heading is kept
 * off the foot of a page.
 */
/**
 * The heading numbers set into the editor's HTML (addendum 42 §14), in front
 * of each heading as the page shows them. The editor draws them as
 * decorations, which its HTML does not carry, so they are put back here from
 * the same numbering.
 */
export const numberHeadingsHtml = (document: WpDocument, html: string): string => {
  const numbers = headingNumbers(document.content, document.headingNumbering);
  if (numbers.size === 0) return html;
  return html.replace(/<h([1-6])\b([^>]*\sdata-heading-id="([^"]+)"[^>]*)>/g, (whole, _level: string, _attrs: string, id: string) => {
    const number = numbers.get(id);
    return number ? `${whole}<span class="wp-heading-number">${escape(number)}</span>` : whole;
  });
};

/** The printing page's head: the paper, the margin boxes and the shared stylesheet. */
const printHead = (document: WpDocument, extra = ''): string => {
  const { width, height } = pageSize(document.pageSetup);
  const m = document.pageSetup.margins;
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<title>${escape(document.title || 'Untitled')}</title>` +
    '<style>' +
    `@page { size: ${width}in ${height}in; margin: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in; }` +
    // Headers, footers and page numbers in the page's margin boxes (addendum 42 §15).
    headerFooterCss(document, { title: document.title || '', date: printedDate() }) +
    'html, body { margin: 0; padding: 0; background: #fff; }' +
    '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
    DOCUMENT_CONTENT_CSS +
    DOCUMENT_CITATION_CSS +
    extra +
    '</style></head>'
  );
};

export const documentPrintHtml = (document: WpDocument, bodyHtml: string): string =>
  printHead(document) + `<body><div class="wp-doc">${numberHeadingsHtml(document, bodyHtml)}</div></body></html>`;

// ------------------------------------------------- pages with their notes

/**
 * **The space on a page the words and notes share** (addendum 43 §23), in
 * inches: the paper less its margins. The header and footer sit in the
 * margins, so they take none of it.
 */
export const documentPageBox = (document: WpDocument): { width: number; height: number } => {
  const { width, height } = pageSize(document.pageSetup);
  const m = document.pageSetup.margins;
  return { width: width - m.left - m.right, height: height - m.top - m.bottom };
};

/**
 * A hair less than the page, so a set page can never spill a line onto a
 * printed page of its own: the measure is in screen pixels and the printer
 * rounds.
 */
const PAGE_SHORT = 0.02;

/** How a set page is drawn: the words at the top, the notes at its foot, one page to a sheet. */
export const documentPageCss = (document: WpDocument): string => {
  const box = documentPageBox(document);
  return (
    `.wp-doc .wp-page { height: ${(box.height - PAGE_SHORT).toFixed(3)}in; display: flex; flex-direction: column; overflow: hidden; break-after: page; page-break-after: always; }` +
    '.wp-doc .wp-page:last-child { break-after: auto; page-break-after: auto; }' +
    '.wp-doc .wp-page-body { display: flow-root; }' +
    // A paragraph carried over: no space where it broke, and no first-line indent where it goes on.
    '.wp-doc .wp-split { margin-bottom: 0 !important; }' +
    '.wp-doc .wp-cont { margin-top: 0 !important; text-indent: 0 !important; }' +
    // An item carried over is not numbered or bulleted twice.
    '.wp-doc li.wp-cont { list-style-type: none; }' +
    `.wp-doc img { max-height: ${(box.height - 0.5).toFixed(2)}in; }`
  );
};

/** One set page: its words, as HTML, and the notes cited on it, by number from 1. */
export interface DocumentPage {
  body: string;
  /** The notes cited on the page, by number from 1, in order. */
  notes: number[];
  /**
   * **A long note carried on from the page before** (addendum 43 §24): the
   * rest of it, as HTML, set first at this page's foot under a rule the
   * width of the page, as a book carries one (§12).
   */
  carried?: string;
  /** The page's last note, cut where the page ends: its first lines, as HTML. */
  cut?: string;
}

/** A page's notes as they stand at its foot: what is carried on first, then its own. */
export const pageNotesHtml = (page: DocumentPage, cites: DocumentCitations): string => {
  const own = page.notes.map((n, at) => (page.cut !== undefined && at === page.notes.length - 1 ? page.cut : noteHtml(cites, n)));
  if (!page.carried && own.length === 0) return '';
  return `<div class="wp-page-notes${page.carried ? ' continues' : ''}">${page.carried ?? ''}${own.join('')}</div>`;
};

/**
 * **A document printed with its notes at the foot of each page** (addendum
 * 43 §23). The pages were set by the renderer, which alone can measure: the
 * words that fit, a paragraph broken between its lines where the page ends,
 * and room left at the foot for the notes cited above. This draws them,
 * each in a box the height of the page with its notes at the bottom.
 */
export const documentPagedHtml = (document: WpDocument, pages: readonly DocumentPage[], cites: DocumentCitations): string =>
  printHead(document, documentPageCss(document)) +
  '<body><div class="wp-doc">' +
  pages.map((page) => `<section class="wp-page"><div class="wp-page-body">${page.body}</div>${pageNotesHtml(page, cites)}</section>`).join('') +
  '</div></body></html>';

/**
 * The page the renderer measures in: the same stylesheet, a measure the width
 * of the page's words, nothing printed from it.
 */
export const documentMeasureHtml = (document: WpDocument): string => {
  const box = documentPageBox(document);
  return (
    printHead(document, documentPageCss(document)) +
    `<body><div class="wp-doc" style="width: ${box.width}in">` +
    '<div id="wp-flow"></div>' +
    `<div id="wp-page" class="wp-page-body" style="width: ${box.width}in"></div>` +
    `<div id="wp-notes" class="wp-page-notes" style="width: ${box.width}in"></div>` +
    '</div></body></html>'
  );
};
