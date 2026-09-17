import { layoutFor, paginateProject, type ManuscriptOptions, type Page, type PageLine } from './pagination.js';
import { isProseFormat } from './editing.js';
import { titlePageOf } from './entities/title-page.js';
import type { TitlePage } from './entities/title-page.js';
import type { ContentsPage } from './markers.js';
import { runsText, type IndexHeading, type IndexPage } from './book-index.js';
import {
  chapterPageStyleOf,
  chapterPageStyleSchema,
  chapterStyleAttr,
  type ChapterPageStyle,
} from './chapter-style.js';
import type { PageStamp } from './attribution.js';
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
  /**
   * How the chapter pages are set (addendum 02 §12a). Filled in from the
   * project when the document is rendered, so a caller never has to.
   */
  chapterStyle?: ChapterPageStyle;
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
  /**
   * Whose draft this is (addendum 07 §6.1), in the top-left corner of every
   * page including the first.
   *
   * Absent on the master and on every script printed outside a room, which is
   * the whole rule: **the master is clean and a contribution is signed**
   * (§6.3). Attribution belongs to the room, not to the script that leaves it
   * — but a writer's own draft circulating *inside* the room is supposed to
   * say whose it is.
   */
  stamp?: PageStamp;
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

const renderPage = (
  page: Page,
  isProse: boolean,
  options: PrintOptions,
  /** The pictures the document carries, so a figure can print as one. */
  pictures: ReadonlyMap<string, { data: string; altText: string }> = new Map(),
): string => {
  // A front page and a leaf between chapters are both pages of the document
  // rather than of the manuscript, and neither carries a page number.
  if (page.titlePage) return renderTitleSheet(page.titlePage);
  if (page.contents) return renderContentsPage(page.contents);
  if (page.index) return renderIndexPage(page.index);
  if (page.chapter) return renderChapterPage(page, isProse, options);
  const lines = page.lines
    .map((line) => {
      /**
       * A figure's picture, set into the blank lines the paginator reserved
       * for it (addendum 16 §9).
       *
       * Its height is given in lines rather than in inches, so it is whatever
       * a line is on this page — and the picture printed is exactly as tall as
       * the room the paginator counted. The alt text goes on the image, which
       * is where a PDF reader looks for it.
       */
      if (line.figure) {
        const picture = pictures.get(line.figure.assetId);
        const height = `height:${line.figure.lines}lh`;
        if (!picture) {
          // The picture has gone. A labelled gap, because a silent one reads
          // as a mistake in the typesetting rather than a missing file.
          return `<div class="line figure missing" style="${height}">[figure missing]</div>`;
        }
        return (
          `<div class="line figure" style="${height}">` +
          `<img src="${escapeHtml(picture.data)}" alt="${escapeHtml(picture.altText)}" ` +
          `style="max-width:100%;${height};object-fit:contain" /></div>`
        );
      }
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
  return `<section class="page${isProse ? ' prose' : ''}">${stampOf(page, options)}${pageNumber(page, options)}${printedAt(options)}\n${lines}\n</section>`;
};

/**
 * Whose draft this is, top left (addendum 07 §6.1).
 *
 * On **every** page including the first, because the page it is most needed on
 * is the one somebody is handed. The name is spelled out on page one, where
 * there is room to learn it, and the initials carry it after that — three
 * writers' drafts of one scene are indistinguishable without them.
 *
 * Top left because the page number is already top right from page two, and two
 * things in one corner is a choice between them.
 */
const stampOf = (page: Page, options: PrintOptions): string => {
  const stamp = options.stamp;
  if (!stamp) return '';
  const said = page.number <= 1 && stamp.name.trim().length > 0
    ? `${escapeHtml(stamp.initials)} <span class="stamp-name">${escapeHtml(stamp.name)}</span>`
    : escapeHtml(stamp.initials);
  return `<div class="page-stamp" style="color:${escapeHtml(stamp.colour)}">${said}</div>`;
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
      // The sections under a chapter, indented (addendum 19 §6): the number
      // is the one the page carries, so the list and the page agree.
      const sections = entry.sections
        .map(
          (section) =>
            '<div class="contents-row contents-section">' +
            `<span class="contents-label">${escapeHtml(section.number)}</span>` +
            `<span class="contents-title">${escapeHtml(section.title)}</span>` +
            `<span class="contents-sheet">${section.page}</span>` +
            '</div>',
        )
        .join('');
      return (
        '<div class="contents-row">' +
        `<span class="contents-label">${escapeHtml(entry.label)}</span>` +
        `<span class="contents-title">${escapeHtml(entry.title)}</span>` +
        figures +
        '</div>' +
        sections
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
 * A page of the back-of-book index (addendum 10).
 *
 * **Page runs are printed as runs** — `14–17` — and a principal discussion is
 * set bold, which is the only thing on the line distinguishing *where this is
 * discussed* from *where it is mentioned*. A *see* sits where the page numbers
 * would be, because a redirect has none; a *see also* follows them.
 *
 * A letter carried over from the page before says so, rather than starting
 * again as if it were new.
 */
const renderIndexHeading = (heading: IndexHeading, level: 'term' | 'sub'): string => {
  const runs = heading.runs
    .map(
      (run) =>
        `<span class="${run.principal ? 'index-run principal' : 'index-run'}">${escapeHtml(
          runsText([run]),
        )}</span>`,
    )
    .join('<span class="index-sep">, </span>');

  const see = heading.see.length > 0 ? `<em class="index-see">see ${escapeHtml(heading.see.join('; '))}</em>` : '';
  const also =
    heading.seeAlso.length > 0
      ? `<em class="index-see-also">see also ${escapeHtml(heading.seeAlso.join('; '))}</em>`
      : '';

  return (
    `<div class="index-entry index-${level}">` +
    `<span class="index-term">${escapeHtml(heading.term)}</span>` +
    (see ? `<span class="index-pages">${see}</span>` : `<span class="index-pages">${runs}${also ? ` ${also}` : ''}</span>`) +
    '</div>'
  );
};

const renderIndexPage = (index: IndexPage): string => {
  const letters = index.letters
    .map((group) => {
      const continued =
        index.continuing === group.letter && index.letters[0] === group ? ' <span class="index-continued">(continued)</span>' : '';
      const entries = group.headings
        .map((heading) => {
          const own = renderIndexHeading(heading, 'term');
          const subs = heading.subEntries
            .map((sub) =>
              renderIndexHeading(
                { term: sub.subTerm, runs: sub.runs, subEntries: [], see: [], seeAlso: sub.seeAlso, orphans: 0 },
                'sub',
              ),
            )
            .join('');
          return own + subs;
        })
        .join('');
      return `<div class="index-letter">${escapeHtml(group.letter)}${continued}</div>${entries}`;
    })
    .join('');

  return (
    '<section class="page index-page">' +
    `<p class="index-heading">${escapeHtml(index.title)}</p>` +
    `<div class="index-list">${letters}</div>` +
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
  // How it is set is the book's (addendum 02 §12a), carried in on the options
  // and turned into custom properties by the one function the preview reads
  // too — so the stylesheet below declares no sizes of its own.
  const style = chapterStyleAttr(options.chapterStyle ?? chapterPageStyleSchema.parse({}));
  const parts: string[] = [];
  const head: string[] = [];
  if (chapter.label.length > 0) head.push(`<h2 class="chapter-label">${escapeHtml(chapter.label)}</h2>`);
  if (chapter.title.length > 0) head.push(`<p class="chapter-title">${escapeHtml(chapter.title)}</p>`);
  // The number and the name are one block, so a rule under the heading sits
  // under both of them rather than between them.
  if (head.length > 0) parts.push(`<div class="chapter-head">${head.join('\n')}</div>`);
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
  return `<section class="page chapter-page${isProse ? ' prose' : ''}" style="text-align:${chapter.align};${style}">${stampOf(page, options)}${pageNumber(page, options)}
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
  /* Whose draft this is (addendum 07 §6.1). Top left, because the page number
     is already top right — and in the seat's own colour, which is the fastest
     fact on the page and the whole reason it is here. */
  .page-stamp { position: absolute; top: 0.5in; left: 1.5in; font-weight: bold; letter-spacing: 0.06em; }
  .page-stamp .stamp-name { font-weight: normal; letter-spacing: 0; }
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
  .contents-section { padding: 0.15em 0 0.15em 3ch; font-size: 0.92em; }
  /* The two figures need saying: the sheet is not the page the script
     prints, because every episode numbers from its own page one. */
  .contents-head { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.15em; padding-bottom: 0; }

  /* The back-of-book index (addendum 10). Set as a book sets one: a hanging
     indent so a heading that wraps does not look like two headings, the
     sub-heading indented under it, and the page numbers at the end of the
     line rather than ranged right — an index is read along the line, not
     down a column. */
  .index-page { text-align: left; }
  .index-heading { text-transform: uppercase; letter-spacing: 0.2em; margin: 0.5in 0 0.4in; text-align: center; }
  .index-letter {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 1.4em 0 0.4em;
  }
  .index-letter:first-child { margin-top: 0; }
  .index-continued { text-transform: none; letter-spacing: 0; font-size: 9pt; }
  .index-entry { padding-left: 2em; text-indent: -2em; }
  .index-entry.index-sub { padding-left: 4em; text-indent: -2em; }
  /* *lamp, the, 2, 3* and *lens, see Fresnel lens* — the comma after the
     heading is how an index reads in both cases. */
  .index-term::after { content: ', '; }
  .index-run.principal { font-weight: 700; }
  .index-see, .index-see-also { font-style: italic; }
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
  /* Nothing here names a size, a face or a case: they are the book's, and
     chapterStyleVars in the domain is the one place that decides what these
     custom properties mean. The on-screen preview reads the same ones. */
  .chapter-page { display: flex; align-items: flex-start; justify-content: center; font-family: var(--chapter-face); }
  .chapter-block { width: 100%; padding-top: var(--chapter-drop); }
  .chapter-head { display: inline-block; border-bottom: var(--chapter-rule); padding-bottom: 0.35em; }
  .chapter-label {
    margin: 0;
    font-size: var(--chapter-number-size);
    font-weight: var(--chapter-number-weight);
    font-style: var(--chapter-number-style);
    text-transform: var(--chapter-number-case);
    font-variant-caps: var(--chapter-number-variant);
    letter-spacing: var(--chapter-number-tracking);
  }
  .chapter-title {
    margin: 1.5em 0 0;
    font-size: var(--chapter-title-size);
    font-weight: var(--chapter-title-weight);
    font-style: var(--chapter-title-style);
    text-transform: var(--chapter-title-case);
    font-variant-caps: var(--chapter-title-variant);
    letter-spacing: var(--chapter-title-tracking);
  }
  .chapter-device { display: block; margin: 2em auto 0; max-width: 100%; }
  .chapter-epigraph {
    margin: 2.5em 0 0;
    white-space: pre-wrap;
    font-size: var(--chapter-epigraph-size);
    font-weight: var(--chapter-epigraph-weight);
    font-style: var(--chapter-epigraph-style);
    text-transform: var(--chapter-epigraph-case);
    font-variant-caps: var(--chapter-epigraph-variant);
    letter-spacing: var(--chapter-epigraph-tracking);
  }
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
  // The book's own chapter-page typography, unless a caller has said otherwise.
  const withStyle: PrintOptions = { chapterStyle: chapterPageStyleOf(file), ...options };
  const isProse = isProseFormat(file.project.format);
  // The pictures, by id, so a figure line can print the one it names.
  const pictures = new Map(
    (file.assets ?? []).map((asset) => [asset.id as string, { data: asset.data, altText: asset.altText }]),
  );
  const body = [
    opensWithItsOwn(pages, options) ? '' : renderTitlePage(file),
    ...pages.map((page) => renderPage(page, isProse, withStyle, pictures)),
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
