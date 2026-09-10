import { layoutFor, paginateProject, type ManuscriptOptions, type Page, type PageLine } from './pagination.js';
import { isProseFormat } from './editing.js';
import { titlePageOf } from './entities/title-page.js';
import type { TitlePage } from './entities/title-page.js';
import type { ContentsPage } from './markers.js';
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
  // A front page and a leaf between chapters are both pages of the document
  // rather than of the manuscript, and neither carries a page number.
  if (page.titlePage) return renderTitleSheet(page.titlePage);
  if (page.contents) return renderContentsPage(page.contents);
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
 * The contents page a season is bound with (addendum 02 §17).
 *
 * The work's title at the head, so the page stands as the front of the
 * document, then one line for each division: its label on the left, its name
 * beside it, and on the right what a reader of *that* document needs.
 *
 * **A book** gives the page each chapter opens on, which is what a table of
 * contents has always said. **A series** cannot: each episode numbers from
 * its own page one (§17), so a page number would name three pages at once.
 * Its lines carry how long each script runs and which **sheet** of the stack
 * it begins on — and those two are given a heading each, because a number
 * that is not a page number must not be read as one.
 */
const renderContentsPage = (contents: ContentsPage): string => {
  const stack = contents.kind === 'episodes';
  const head = stack
    ? '<div class="contents-row contents-head">' +
      '<span class="contents-label"></span><span class="contents-title"></span>' +
      '<span class="contents-pages">Length</span><span class="contents-sheet">Sheet</span>' +
      '</div>'
    : '';
  const rows = contents.entries
    .map((entry) => {
      const figures = stack
        ? `<span class="contents-pages">${entry.pages} ${entry.pages === 1 ? 'page' : 'pages'}</span>` +
          `<span class="contents-sheet">${entry.sheet}</span>`
        : `<span class="contents-sheet">${entry.page}</span>`;
      return (
        '<div class="contents-row">' +
        `<span class="contents-label">${escapeHtml(entry.label)}</span>` +
        `<span class="contents-title">${escapeHtml(entry.title)}</span>` +
        figures +
        '</div>'
      );
    })
    .join('');
  return (
    '<section class="page contents-page">' +
    `<h1 class="contents-series">${escapeHtml(contents.title || 'Untitled')}</h1>` +
    '<p class="contents-heading">Contents</p>' +
    `<div class="contents-list">${head}${rows}</div>` +
    '</section>'
  );
};

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

/**
 * The title page as the industry sets it (spec §6.1): the title a third of
 * the way down, the credit and the name under it, what it was written from
 * below that, and the foot carrying the contact on the left and the draft on
 * the right — the way a page handed to a reader carries them.
 *
 * A logotype, where the writer has given one, prints **in place of** the
 * title: it is the title, and setting it in Courier underneath would be
 * saying the same thing twice.
 *
 * Only what has been filled in is drawn. A first draft with a title and a
 * name on it is a proper title page, and an empty line printed for a contact
 * nobody entered is worse than no line.
 */
const renderTitlePage = (file: ProjectFile): string =>
  renderTitleSheet(titlePageOf(file.project, file.settings));

/**
 * The title page, on its own, so a document that is not a script can open
 * with one (addendum 05 §8): a board is handed over with the same front page
 * a screenplay is, because it is the same piece of work.
 */
export const renderTitleSheet = (page: TitlePage): string => {
  const lines = (text: string): string =>
    escapeHtml(text)
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .join('<br />');

  const heading = page.titleImage
    ? `<img class="title-art" src="${escapeHtml(page.titleImage)}" alt="${escapeHtml(page.title || 'Title')}" />`
    : `<h1>${escapeHtml(page.title || 'Untitled')}</h1>`;

  // The foot as the industry sets it: who to reach on the left, the date on
  // the right, and the draft's own note centred under both.
  const centred = [page.revision, page.notes].filter((part) => part.length > 0);
  const hasFoot = page.contact.length > 0 || page.draftDate.length > 0 || centred.length > 0;

  /*
    Joined without the whitespace a formatted template would leave between
    the elements: a stray text node inside a block makes an anonymous line
    box, and two of them pushed the byline a third of an inch below the
    halfway mark it is supposed to sit on.
  */
  const block = [heading, page.episode.length > 0 ? `<p class="episode">${lines(page.episode)}</p>` : ''].filter(
    Boolean,
  );

  const credit = [
    page.author.length > 0
      ? `<p class="byline">Written</p><p class="by">by</p><p class="author">${escapeHtml(page.author)}</p>`
      : '',
    page.source.length > 0 ? `<p class="based-on">${lines(page.source)}</p>` : '',
    page.sourceAuthor.length > 0
      ? `<p class="by">by</p><p class="source-author">${escapeHtml(page.sourceAuthor)}</p>`
      : '',
  ].filter(Boolean);

  const foot = hasFoot
    ? '<div class="title-foot">' +
      `<div class="title-foot-row"><p class="contact">${lines(page.contact)}</p>` +
      `<p class="draft">${lines(page.draftDate)}</p></div>` +
      (centred.length > 0 ? `<p class="title-note">${centred.map((part) => lines(part)).join('<br />')}</p>` : '') +
      '</div>'
    : '';

  return (
    '<section class="page title-page">' +
    `<div class="title-block">${block.join('')}</div>` +
    `<div class="title-credit">${credit.join('')}</div>` +
    foot +
    '</section>'
  );
};

/**
 * The front page's own rules, shared by every document that opens with one
 * — the script, and the AV sheet and board beside it (addendum 05 §8).
 */
export const TITLE_PAGE_STYLES = `
  .title-page { display: flex; flex-direction: column; align-items: center; text-align: center; }
  /*
     The page in two halves. The title sits in the top one — centred in it, so
     a logotype falls halfway between the top of the page and the middle — and
     everything else begins at the halfway mark and runs down from there.
     The page is 11in with an inch of padding at the top, so the top half is
     4.5in of the 9in between the margins.
  */
  .title-page .title-block {
    height: 4.5in;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .title-page .title-credit { width: 100%; }
  .title-page .based-on { margin-top: 0.5in; }
  .title-page .episode { margin-top: 0.25in; }
  /* "by" sits on a line of its own between the credit and the name. */
  .title-page .by { margin: 0; }
  .title-page .byline, .title-page .author, .title-page .source-author { margin: 0; }
  /* The logotype prints in place of the title, kept inside the margins. */
  .title-art { display: block; max-width: 5in; max-height: 3in; margin: 0 auto; }
  /* The foot of the page: which draft on the left, who to call on the right. */
  .title-foot { margin-top: auto; width: 100%; }
  .title-foot-row { display: flex; justify-content: space-between; align-items: flex-end; }
  .title-foot .contact { text-align: left; }
  .title-foot .draft { text-align: right; }
  .title-note { margin: 0.35in 0 0; text-align: center; }
  .title-foot p { margin: 0; }
  /* Four times the manuscript's 12pt, and bold. */
  .title-block h1 { font-size: 48pt; font-weight: bold; text-transform: uppercase; margin: 0; line-height: 1.1; }
  .byline { margin: 0; }
  .author { margin: 0; }
`;

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
  /* The list at the front of the stack (§17): the series' name, the word
     Contents under it, then one line for each script. The label and the
     length are set at the two edges with the name between, so the eye runs
     down the numbers on the left and the lengths on the right. */
  .contents-page { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .contents-series {
    font-size: 24pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 1in 0 0;
    line-height: 1.1;
  }
  .contents-heading { text-transform: uppercase; letter-spacing: 0.2em; margin: 0.5in 0 0.5in; }
  .contents-list { width: 100%; text-align: left; }
  .contents-row { display: flex; align-items: baseline; gap: 1em; padding: 0.5em 0; }
  .contents-label { width: 12ch; flex: none; }
  .contents-title { flex: 1; }
  .contents-pages { width: 10ch; flex: none; text-align: right; }
  .contents-sheet { width: 6ch; flex: none; text-align: right; }
  /* The two figures need saying: the sheet is not the page the script
     prints, because every episode numbers from its own page one. */
  .contents-head { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.15em; padding-bottom: 0; }
  ${TITLE_PAGE_STYLES}
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
    opensWithItsOwn(pages, options) ? '' : renderTitlePage(file),
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

/**
 * Whether the document already opens with a front page of its own.
 *
 * A series whose first episode starts at the first scene prints that
 * episode's title page first, and the project's would sit in front of it
 * saying very nearly the same thing — the episode's page carries the series'
 * title and credit already (addendum 02 §17). Where there is material ahead
 * of the first episode, the project's page still opens the document.
 */
const opensWithItsOwn = (pages: Page[], options: PrintOptions): boolean =>
  options.includeTitlePage === false ||
  pages[0]?.titlePage !== undefined ||
  // A contents page carries the series' title at its head, so it stands as
  // the front of the document with nothing needed in front of it (§17).
  pages[0]?.contents !== undefined;

/** Page count for the export, every front page in it included. */
export const printedPageCount = (file: ProjectFile, options: PrintOptions = {}): number => {
  const pages = paginateProject(file, options);
  return pages.length + (opensWithItsOwn(pages, options) ? 0 : 1);
};

export const suggestedExportFileName = (file: ProjectFile): string => {
  const base = (file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
  return `${base}.pdf`;
};

/** Exposed so the layout used by preview and export can be inspected/tested. */
export const printLayoutFor = layoutFor;
