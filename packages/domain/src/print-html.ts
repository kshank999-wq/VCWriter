import { layoutFor, paginateProject, type ManuscriptOptions, type Page, type PageLine } from './pagination.js';
import { isProseFormat } from './editing.js';
import type { ProjectFile } from './project-file.js';

/**
 * The printable document (spec §6: formatted print preview and PDF export).
 *
 * One function produces the HTML for both, so what the writer sees in preview
 * is the file they get. It is a string builder rather than a component because
 * the PDF export runs in the Electron main process, which has no React — and
 * because generating it there means the renderer never hands raw HTML to a
 * window that will be printed.
 *
 * Geometry comes from the same layout the on-screen preview uses: 12pt Courier
 * at 6 lines to the inch, so `line-height: 1` is exactly one industry line and
 * a page holds exactly the 55 the paginator allowed for.
 */

export interface PrintOptions extends ManuscriptOptions {
  /** A title page precedes the manuscript unless this is explicitly false. */
  includeTitlePage?: boolean;
  // `includeChapterPages` comes from ManuscriptOptions: the paginator decides
  // whether the leaves are there at all, and this renderer draws what it gets.
  /** Diagonal marking for drafts sent out for notes. */
  watermark?: string;
  /**
   * The page number, top right from page two. On unless asked otherwise: a
   * script without page numbers is unusable in a room, and the only reason
   * to turn them off is a document that is not going to be read as pages.
   */
  includePageNumbers?: boolean;
  /**
   * The day and time this was printed, in the corner. **Off.** It is not
   * part of the document; it dates a draft that may be circulated for weeks,
   * and a writer who wants it can ask for it.
   */
  includePrintedAt?: boolean;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * A line's text with its emphasis. Spaces are preserved by the stylesheet's
 * `white-space: pre`, and each span is escaped on its own, so styling can
 * never introduce markup.
 */
const renderSpans = (line: PageLine): string => {
  if (line.spans.length === 0) return escapeHtml(line.text);
  return line.spans
    .map((span) => {
      const text = escapeHtml(span.text);
      if (!span.bold && !span.italic && !span.underline) return text;
      const open = `${span.bold ? '<b>' : ''}${span.italic ? '<i>' : ''}${span.underline ? '<u>' : ''}`;
      const close = `${span.underline ? '</u>' : ''}${span.italic ? '</i>' : ''}${span.bold ? '</b>' : ''}`;
      return `${open}${text}${close}`;
    })
    .join('');
};

const renderPage = (page: Page, isProse: boolean, options: PrintOptions): string => {
  // A leaf between chapters is a page of the book, not of the manuscript.
  if (page.chapter) return renderChapterPage(page, isProse, options);
  const lines = page.lines
    .map((line) => {
      if (line.text.length === 0) return '<div class="line"> </div>';
      // A scene number is set in the margins at both edges — where a
      // shooting script puts it — so it never takes room from the sixty
      // characters the text itself is set in.
      const mark = line.mark
        ? `<span class="scene-number left">${escapeHtml(line.mark)}</span>` +
          `<span class="scene-number right">${escapeHtml(line.mark)}</span>`
        : '';
      return `<div class="line ${line.type}" style="padding-left:${line.indent}ch">${mark}${renderSpans(line)}</div>`;
    })
    .join('\n');
  return `<section class="page${isProse ? ' prose' : ''}">${pageNumber(page, options)}${printedAt(options)}\n${lines}\n</section>`;
};

/** Page numbers sit top right from page two, as scripts and manuscripts do. */
const pageNumber = (page: Page, options: PrintOptions): string =>
  options.includePageNumbers !== false && page.number > 1
    ? `<div class="page-number">${page.number}.</div>`
    : '';

/**
 * When the printing was made, on every page rather than once at the end —
 * pages get separated. Off unless asked for: the date is not part of the
 * document, and a draft circulated for a fortnight should not argue about
 * when it was printed.
 */
const printedAt = (options: PrintOptions): string =>
  options.includePrintedAt ? `<div class="printed-at">${escapeHtml(new Date().toLocaleString())}</div>` : '';

/**
 * The leaf a chapter opens with (addendum 02 §11): its number, its name, an
 * epigraph and a device, in whatever combination the writer left switched
 * on. A page with none of them switched on is a blank leaf, which is also a
 * thing books do.
 */
const renderChapterPage = (page: Page, isProse: boolean, options: PrintOptions): string => {
  const chapter = page.chapter as NonNullable<Page['chapter']>;
  const parts: string[] = [];
  if (chapter.label.length > 0) parts.push(`<h2 class="chapter-label">${escapeHtml(chapter.label)}</h2>`);
  if (chapter.title.length > 0) parts.push(`<p class="chapter-title">${escapeHtml(chapter.title)}</p>`);
  if (chapter.image) {
    // The source is a data URL held in the project; it is escaped as an
    // attribute like any other, and nothing else about it is trusted.
    parts.push(
      `<img class="chapter-device" alt="${escapeHtml(chapter.image.name)}" ` +
        `style="width:${Math.round(chapter.image.width)}%" src="${escapeHtml(chapter.image.dataUrl)}" />`,
    );
  }
  if (chapter.epigraph.trim().length > 0) {
    parts.push(`<p class="chapter-epigraph">${escapeHtml(chapter.epigraph)}</p>`);
  }
  return `<section class="page chapter-page${isProse ? ' prose' : ''}" style="text-align:${chapter.align}">${pageNumber(page, options)}
  <div class="chapter-block">${parts.join('\n')}</div>
</section>`;
};

const renderTitlePage = (file: ProjectFile): string => {
  const title = escapeHtml(file.project.title || 'Untitled');
  const author = escapeHtml(file.project.author);
  return `<section class="page title-page">
  <div class="title-block">
    <h1>${title}</h1>
    ${author.length > 0 ? `<p class="byline">written by</p><p class="author">${author}</p>` : ''}
  </div>
</section>`;
};

const STYLES = `
  /* Zero, deliberately. The page's own padding is the manuscript's margin,
     and the @page margin is the only place a browser can draw its own
     furniture — the date, the time, the file's name, its own page numbers.
     With no band to draw in, none of it appears, and what prints is the
     document. */
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2f2f4;
    font-family: "Courier New", Courier, monospace;
    font-size: 12pt;
    line-height: 1;
    color: #000;
  }
  .page {
    position: relative;
    width: 8.5in;
    min-height: 11in;
    padding: 1in 1in 1in 1.5in;
    margin: 0 auto 24px;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    white-space: pre;
  }
  .line { min-height: 12pt; }
  .page-number { position: absolute; top: 0.5in; right: 1in; }
  /* In the margins at both edges, out of the text's sixty characters. */
  .scene-number { position: absolute; }
  .scene-number.left { left: 0.75in; }
  .scene-number.right { right: 0.75in; }
  .printed-at { position: absolute; bottom: 0.5in; left: 1.5in; font-size: 9pt; color: #555; }
  .title-page { display: flex; align-items: center; justify-content: center; text-align: center; }
  .title-block h1 { font-size: 12pt; font-weight: normal; text-transform: uppercase; margin: 0 0 4em; }
  .byline { margin: 0 0 1em; }
  .author { margin: 0; }
  .watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60pt;
    color: rgba(0, 0, 0, 0.06);
    transform: rotate(-30deg);
    pointer-events: none;
  }
  /* Annotated reference copies mark the beat labels as what they are. */
  .general { color: #444; }
  /* The leaf between chapters. Its block sits a third of the way down, which
     is where a book puts a chapter opening. */
  .chapter-page { display: flex; align-items: flex-start; justify-content: center; }
  .chapter-block { width: 100%; padding-top: 2.5in; }
  .chapter-label { font-size: 12pt; font-weight: normal; text-transform: uppercase; letter-spacing: 0.2em; margin: 0; }
  .chapter-title { margin: 1.5em 0 0; }
  .chapter-device { display: block; margin: 2em auto 0; max-width: 100%; }
  .chapter-epigraph { margin: 2.5em 0 0; white-space: pre-wrap; font-style: italic; }
  @media print {
    body { background: #fff; }
    .page {
      /* The padding stays: with @page at zero it *is* the margin now, and
         zeroing it here would print the manuscript against the paper's edge.
         Only the screen's furniture — the drop shadow, the gap between
         sheets — comes off. */
      width: 8.5in;
      min-height: 0;
      height: 11in;
      margin: 0;
      box-shadow: none;
      break-after: page;
      overflow: hidden;
    }
    .page:last-child { break-after: auto; }
  }
`;

export const renderPrintDocumentHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const pages = paginateProject(file, options);
  const isProse = isProseFormat(file.project.format);
  const body = [
    options.includeTitlePage === false ? '' : renderTitlePage(file),
    ...pages.map((page) => renderPage(page, isProse, options)),
  ]
    .filter((section) => section.length > 0)
    .join('\n');

  const watermark = options.watermark
    ? `<div class="watermark">${escapeHtml(options.watermark)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(file.project.title || 'Untitled')}</title>
<style>${STYLES}</style>
</head>
<body>
${watermark}
${body}
</body>
</html>`;
};

/** Page count for the export, title page included when there is one. */
export const printedPageCount = (file: ProjectFile, options: PrintOptions = {}): number =>
  paginateProject(file, options).length + (options.includeTitlePage === false ? 0 : 1);

export const suggestedExportFileName = (file: ProjectFile): string => {
  const base = (file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
  return `${base}.pdf`;
};

/** Exposed so the layout used by preview and export can be inspected/tested. */
export const printLayoutFor = layoutFor;
