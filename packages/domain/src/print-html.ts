import { layoutFor, paginateProject, type ManuscriptOptions, type Page } from './pagination.js';
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
  /** Diagonal marking for drafts sent out for notes. */
  watermark?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderPage = (page: Page, isProse: boolean): string => {
  const lines = page.lines
    .map((line) =>
      line.text.length === 0
        ? '<div class="line"> </div>'
        : `<div class="line ${line.type}" style="padding-left:${line.indent}ch">${escapeHtml(line.text)}</div>`,
    )
    .join('\n');
  // Page numbers sit top right from page two, as scripts and manuscripts do.
  const number = page.number > 1 ? `<div class="page-number">${page.number}.</div>` : '';
  return `<section class="page${isProse ? ' prose' : ''}">${number}\n${lines}\n</section>`;
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
  @page { size: letter; margin: 1in 1in 1in 1.5in; }
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
  @media print {
    body { background: #fff; }
    .page {
      width: auto;
      min-height: 0;
      margin: 0;
      padding: 0;
      box-shadow: none;
      break-after: page;
    }
    .page:last-child { break-after: auto; }
  }
`;

export const renderPrintDocumentHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const pages = paginateProject(file, options);
  const isProse = isProseFormat(file.project.format);
  const body = [
    options.includeTitlePage === false ? '' : renderTitlePage(file),
    ...pages.map((page) => renderPage(page, isProse)),
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
