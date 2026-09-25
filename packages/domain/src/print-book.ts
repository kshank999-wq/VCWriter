import type { BookFont, BookSettings } from './entities/book.js';
import type { InlineSpan } from './entities/inline.js';
import {
  chapterPageStyleSchema,
  chapterStyleAttr,
  chapterStyleWith,
  lineStyleVars,
  type ChapterPageStyle,
  isFullPageArt,
} from './chapter-style.js';
import {
  LAYOUT_OF_TEMPLATE,
  chapterLayout,
  firstLineCut,
  type ChapterLayout,
  type ChapterSlot,
} from './chapter-layouts.js';
import type { ChapterPageContent } from './markers.js';
import { FACE_STACKS, faceStackOf, fontFaceCss, type BookGeometry } from './book-layout.js';
import { partStyleAttr } from './part-style.js';
import { headSideClass, runningHeadStyleOf, runningStyleVars } from './running-heads.js';
import type { BookBlock, FigureFree, FigureInset } from './book-plan.js';
import type { BookContentsRow, BookPage } from './book-pages.js';
import { runsText, type BookIndex } from './book-index.js';
import type { TitlePage } from './entities/title-page.js';

/**
 * Drawing the book (addendum 20 §4, §5): a block, a page, the document.
 *
 * One string builder for three readers. The screen **measures** a block by
 * setting this markup in a hidden box the width of the text block and
 * reading back how tall it came; it **draws** a page by clipping each block
 * to the lines the laying gave that page; and the export **prints** the
 * same pages at the trim. Three readers of one markup is what lets the page
 * on the screen be the page in the PDF — a second drawing would be a second
 * answer about where a line breaks.
 *
 * Everything is in CSS pixels at 96 to the inch, so a measurement made on
 * the screen holds in the print, and the page is drawn at its real size and
 * scaled to the window rather than drawn smaller.
 */

const PX_PER_IN = 96;
const PX_PER_PT = PX_PER_IN / 72;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderSpans = (spans: InlineSpan[], text: string): string => {
  if (spans.length === 0) return escapeHtml(text);
  return spans
    .map((span) => {
      const inner = escapeHtml(span.text);
      if (!span.bold && !span.italic && !span.underline) return inner;
      const open = `${span.bold ? '<b>' : ''}${span.italic ? '<i>' : ''}${span.underline ? '<u>' : ''}`;
      const close = `${span.underline ? '</u>' : ''}${span.italic ? '</i>' : ''}${span.bold ? '</b>' : ''}`;
      return `${open}${inner}${close}`;
    })
    .join('');
};

/** A picture the book may draw, by asset id. */
export interface BookPicture {
  data: string;
  altText: string;
  width: number;
  height: number;
}

/** Everything the drawing needs beyond the block itself. */
export interface BookRenderContext {
  settings: BookSettings;
  geometry: BookGeometry;
  chapterStyle: ChapterPageStyle;
  /** Indented or blocked paragraphs: the book setting the manuscript already has (spec §6.4). */
  paragraphStyle: 'indented' | 'blocked';
  pictures: ReadonlyMap<string, BookPicture>;
  names: { title: string; author: string; imprint: string };
  titlePage: TitlePage;
  /** The contents page's rows, once the book is laid; empty while measuring. */
  contents: readonly BookContentsRow[];
  /** The index, once the book is laid; null while measuring or where there is none. */
  index: BookIndex | null;
}

/** The leading and size in CSS pixels, and the width of the text block. */
export const bookMetrics = (geometry: BookGeometry) => ({
  leadPx: geometry.leading * PX_PER_PT,
  sizePx: geometry.size * PX_PER_PT,
  measurePx: geometry.text.width * PX_PER_IN,
  pageWidthPx: geometry.trim.width * PX_PER_IN,
  pageHeightPx: geometry.trim.height * PX_PER_IN,
});

/** How far the room may scale a spread by hand, either way (§9e). */
export const PAGE_ZOOM = { min: 0.25, max: 1.2 } as const;

/** The air around the drawn spread: the stage's padding and the box's own inset. */
export const SPREAD_INSET_PX = 12;
const SPREAD_BOX_PX = 24;

/**
 * How big a spread has to be drawn to **fit the space there is** (§9e).
 *
 * The room opened at a stored 0.55 whatever it was opened in, which is a fixed
 * number where a measurement belongs: on a wide screen the book was drawn at a
 * third of the room it had, and on a laptop the same number overflowed and had
 * to be scrolled sideways. It is the timeline's *Whole story means the whole
 * story fits* (addendum 15 §2) said of a page.
 *
 * Two things about it are decisions rather than arithmetic. It is a
 * **reading** — worked out from the trim and the window every time, stored
 * nowhere — so widening the rail, resizing the window or changing the trim
 * re-fits with nothing run. And it is measured on a **full spread whatever
 * this sheet carries**, because a half title stands alone: fitting that one
 * page would draw it at twice the size of the pages after it, and a book that
 * changes size as you turn the page is worse than one drawn small.
 */
export const spreadFit = (
  geometry: BookGeometry,
  viewport: { width: number; height: number },
): number => {
  const { pageWidthPx, pageHeightPx } = bookMetrics(geometry);
  const air = SPREAD_INSET_PX * 2 + SPREAD_BOX_PX;
  const wide = (viewport.width - air) / (pageWidthPx * 2);
  const tall = (viewport.height - air) / pageHeightPx;
  // Down to the hundredth rather than to the nearest, so a rounding can never
  // put the spread a pixel wider than the space it was fitted to.
  const fitted = Math.floor(Math.min(wide, tall) * 100) / 100;
  return Math.min(PAGE_ZOOM.max, Math.max(PAGE_ZOOM.min, fitted));
};

/** The custom properties every page and the measuring box declare. */
export const bookVars = (context: BookRenderContext): Record<string, string> => {
  const { leadPx, sizePx, measurePx } = bookMetrics(context.geometry);
  const { margins } = context.geometry;
  return {
    '--bk-face': faceStackOf(context.settings.face, context.settings.fonts),
    '--bk-size': `${sizePx.toFixed(3)}px`,
    '--bk-lead': `${leadPx.toFixed(3)}px`,
    '--bk-measure': `${measurePx.toFixed(2)}px`,
    '--bk-inside': `${(margins.inside * PX_PER_IN).toFixed(2)}px`,
    '--bk-outside': `${(margins.outside * PX_PER_IN).toFixed(2)}px`,
    '--bk-top': `${(margins.top * PX_PER_IN).toFixed(2)}px`,
    '--bk-bottom': `${(margins.bottom * PX_PER_IN).toFixed(2)}px`,
    '--bk-head': `${(context.geometry.headFromTop * PX_PER_IN).toFixed(2)}px`,
    '--bk-foot': `${(context.geometry.footFromBottom * PX_PER_IN).toFixed(2)}px`,
    '--bk-align': context.settings.justify ? 'justify' : 'left',
    '--bk-hyphens': context.settings.hyphenate ? 'auto' : 'manual',
    '--bk-indent': context.settings.size > 0 ? '1.5em' : '0',
    // The furniture: how the running heads and the folios are set (§7a).
    ...runningStyleVars(runningHeadStyleOf(context.settings), context.settings.face, context.settings.fonts),
  };
};

export const bookVarsAttr = (context: BookRenderContext): string =>
  Object.entries(bookVars(context))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/** Whole lines, never a fraction: the page is a grid and every block sits on it. */
const wholeLines = (px: number, leadPx: number): number => Math.max(1, Math.ceil(px / leadPx - 0.001));

/** How many lines a picture takes at a width, from its own shape; a third of a page where the shape is unknown. */
export const pictureLines = (
  picture: BookPicture | undefined,
  widthPx: number,
  leadPx: number,
  linesPerPage: number,
): number => {
  if (!picture || picture.width <= 0 || picture.height <= 0) return Math.max(1, Math.round(linesPerPage / 3));
  return wholeLines((widthPx * picture.height) / picture.width, leadPx);
};

/** The half title, the title page, the copyright, a dedication: pages of a few words. */
/** A page that is a picture and nothing else, drawn to the trim: an art page, or a title page brought in whole. */
const fullPageArt = (picture: BookPicture, alt: string): string =>
  `<div class="bk-display bk-plate bk-plate-art"><img class="bk-plate-image" alt="${escapeHtml(picture.altText || alt)}" src="${escapeHtml(picture.data)}" /></div>`;

const displayInner = (block: BookBlock, context: BookRenderContext): string => {
  const { names, titlePage } = context;
  // A designed page (addendum 20 §9) carries its style as custom properties
  // on the page's box, and a spacer whose height is the drop — a share of
  // the page rather than of its width, which is what a percentage padding
  // would have measured.
  const styled = block.partStyle ? ` style="${partStyleAttr(block.partStyle, context.settings.face, context.settings.fonts)}"` : '';
  const drop = '<div class="bk-drop"></div>';
  switch (block.kind) {
    case 'half_title': {
      // The page as a piece of art, edge to edge (§8, from Ken): the title
      // is in the art, so nothing is set over it.
      const whole = block.assetId ? context.pictures.get(block.assetId) : undefined;
      if (whole) return fullPageArt(whole, titlePage.title || names.title);
      return `<div class="bk-display bk-half"${styled}>${drop}<p class="bk-book-title">${escapeHtml(titlePage.title || names.title)}</p></div>`;
    }
    case 'title_page': {
      const whole = block.assetId ? context.pictures.get(block.assetId) : undefined;
      if (whole) return fullPageArt(whole, titlePage.title || names.title);
      const art = titlePage.titleImage
        ? `<img class="bk-title-art" alt="${escapeHtml(titlePage.title || names.title)}" src="${escapeHtml(titlePage.titleImage)}" />`
        : `<p class="bk-book-title">${escapeHtml(titlePage.title || names.title)}</p>`;
      // The line under the title (a subtitle, *A novel*): the title page's
      // own field, which a series fills with its episode.
      const subtitle = (titlePage.episode ?? '').trim().length > 0 ? `<p class="bk-subtitle">${escapeHtml(titlePage.episode)}</p>` : '';
      const imprint = names.imprint.trim().length > 0 ? `<p class="bk-imprint">${escapeHtml(names.imprint)}</p>` : '';
      return `<div class="bk-display bk-title"${styled}>${drop}${art}${subtitle}<p class="bk-author">${escapeHtml(titlePage.author || names.author)}</p>${imprint}</div>`;
    }
    case 'copyright': {
      // The fields where the writer has used them (§9k): a paragraph per
      // thing said, so a long disclaimer sets as a paragraph and the notice
      // above it stays a line. Everything here is `copyrightLines`' answer —
      // the printer decides nothing about what the page says.
      const lines = block.copyright ?? [];
      const body =
        lines.length > 0
          ? lines
              .map((line, at) =>
                line.apart || at === 0
                  ? `<p class="bk-small">${escapeHtml(line.text).replace(/\n/g, '<br />')}</p>`
                  : `<p class="bk-small bk-copy-run">${escapeHtml(line.text)}</p>`,
              )
              .join('')
          : `<p class="bk-small">${escapeHtml(
              block.text.trim().length > 0 ? block.text : `Copyright © ${names.author}`.trim(),
            ).replace(/\n/g, '<br />')}</p>`;
      // The barcode (§9k, from Ken: *in case there is no jacket on the actual
      // book — for example, if the book is made of leather*). Bottom right,
      // at the width the writer set, and absent rather than boxed where there
      // is no picture: an empty rectangle would print on the finished book.
      const code = block.assetId ? context.pictures.get(block.assetId) : undefined;
      const barcode = code
        ? `<div class="bk-barcode" style="width:${(block.barcodeInches ?? 2).toFixed(2)}in"><img alt="${escapeHtml(
            code.altText || 'Barcode',
          )}" src="${escapeHtml(code.data)}" /></div>`
        : '';
      // Where the block sits (§15). It hung at the foot and nowhere else,
      // which was right about the default and wrong to be the only answer;
      // the class is the position, so `foot` prints exactly as it did.
      const sits = block.copyrightPosition ?? 'bottom';
      return `<div class="bk-display bk-copyright bk-copy-${sits}"${styled}>${body}${barcode}</div>`;
    }
    // A leaf left deliberately blank (§9i): it holds the page and prints
    // nothing at all — no words, no running head, no number.
    case 'blank':
      return '<div class="bk-display bk-blank"></div>';
    case 'plate': {
      // An art page (§8, from Ken): the picture is the page, edge to edge past
      // the margins to the trim, and nothing is set over it — a title page or
      // an index made as a piece of art carries its own words. The caption
      // is the picture's description for a reader who cannot see it, and
      // prints nowhere.
      const picture = block.assetId ? context.pictures.get(block.assetId) : undefined;
      const image = picture
        ? `<img class="bk-plate-image" alt="${escapeHtml(picture.altText || block.caption || '')}" src="${escapeHtml(picture.data)}" />`
        : '<div class="bk-plate-missing">Picture goes here</div>';
      return `<div class="bk-display bk-plate${picture ? ' bk-plate-art' : ''}">${image}</div>`;
    }
    default: {
      // A dedication or an epigraph. The page may be a piece of art like any
      // other designed page (§7a), the words being in the picture.
      const whole = block.assetId ? context.pictures.get(block.assetId) : undefined;
      if (whole) return fullPageArt(whole, block.text.split(/\n/)[0] ?? '');
      // The words, a third of the way down: the **first line** carries the
      // title's style and the rest the lines-under-it style, which is the
      // title page's own rule — an epigraph's attribution and a dedication's
      // second line are what those lines are.
      return `<div class="bk-display bk-words"${styled}>${drop}${block.text
        .split(/\n/)
        .map((line, index) => `<p${index === 0 ? '' : ' class="bk-words-under"'}>${escapeHtml(line)}</p>`)
        .join('')}</div>`;
    }
  }
};

/**
 * The chapter-page style's custom properties, with one reading over them:
 * *manuscript* as the face means *the face the text is in*, and in the book
 * the text is in the book's face — so a chapter page that never chose a face
 * is set in the body's rather than in Courier.
 */
const chapterStyleFor = (context: BookRenderContext, block?: BookBlock): string =>
  // The book's own face, handed to the one function that decides what the
  // properties mean (§7a). It used to be patched on afterwards, here, which
  // let the word on the screen and the type on the page disagree.
  //
  // The **placement** is the page's where the page has said (§9c): the type
  // is the book's for every chapter, and where the picture sits, how far down
  // the heading falls and how much air stands over the first paragraph are
  // this page's. A block with no placement draws exactly as it always did.
  chapterStyleAttr(
    chapterStyleWith(context.chapterStyle, block?.chapter?.placement),
    faceStackOf(context.settings.face, context.settings.fonts),
    context.settings.fonts,
  );

/**
 * A chapter opening, drawn from its layout's **slot list** (§14).
 *
 * The three-way template branch this replaces could draw three arrangements
 * and no fourth, so Ken's flush-left opening, bleeding header and numeral-only
 * page had nowhere to be expressed. A layout is a list of pieces in the order
 * they are met down the page, and this walks the list — which is the handoff's
 * *adding a layout needs only a new entry*, kept by construction: there is no
 * `if (layout === …)` here or anywhere else.
 */
const slotMarkup = (
  slot: ChapterSlot,
  layout: ChapterLayout,
  chapter: ChapterPageContent | undefined,
  headBlock: string,
): string => {
  switch (slot) {
    case 'graphic': {
      if (!chapter?.image) return '';
      const alt = escapeHtml(chapter.image.name);
      const src = escapeHtml(chapter.image.dataUrl);
      if (layout.graphic === 'page') return `<img class="bk-chapter-art" alt="${alt}" src="${src}" />`;
      if (layout.graphic === 'bleed') return `<div class="bk-chapter-bleed"><img alt="${alt}" src="${src}" /></div>`;
      const wide = `width:${Math.round(chapter.image.width)}%`;
      return `<img class="bk-chapter-device" alt="${alt}" style="${wide}" src="${src}" />`;
    }
    // The number, the rule and the title are **one piece**: they sit inside
    // `.bk-chapter-head`, which is what carries the book's optional rule
    // under the whole heading. The walk emits that block where it meets the
    // first of the three and skips the rest, so the four older layouts emit
    // byte for byte the markup they always did.
    case 'number':
      return headBlock;
    case 'rule':
    case 'title':
      return '';
    case 'epigraph':
      if (!chapter || !chapter.epigraph.trim()) return '';
      return `<p class="bk-chapter-epigraph${layout.epigraphApart ? ' bk-epigraph-apart' : ''}">${escapeHtml(chapter.epigraph)}</p>`;
    case 'summary':
      return chapter && chapter.summary.trim() ? `<p class="bk-chapter-summary">${escapeHtml(chapter.summary)}</p>` : '';
    // The sink is the leaf's own padding and the body is the manuscript that
    // follows this block; both are slots so a layout can say where they fall
    // relative to a graphic, and neither draws anything here.
    case 'sink':
    case 'body':
    default:
      return '';
  }
};

/**
 * A chapter's first paragraph, set as the book asks (§14).
 *
 * **It cuts at a character rather than re-marking the text**: a drop cap takes
 * the first letter and a lead-in the first few words, and everything after the
 * cut goes through `renderSpans` unchanged — so a chapter that opens on an
 * italic phrase keeps it. Where the opening is already marked up (a span
 * starting at nought), the plain text is used for the part taken, which is
 * what a drop cap is: one letter, set large, in the body's own ink.
 */
const firstLineMarkup = (block: BookBlock, first: 'drop_cap' | 'lead_in'): string => {
  const text = block.text;
  if (text.trim().length === 0) return renderSpans(block.spans, block.text);
  // The same cut the preview sheet takes, so a writer choosing a drop cap
  // sees the letter the book will set (§14).
  const cut = firstLineCut(text, first);
  if (cut <= 0 || cut >= text.length) return renderSpans(block.spans, block.text);
  const taken = escapeHtml(text.slice(0, cut));
  const rest = renderSpans(spansAfter(block.spans, cut), text.slice(cut));
  return first === 'drop_cap'
    ? `<span class="bk-drop-cap">${taken}</span>${rest}`
    : `<span class="bk-lead-in">${taken}</span>${rest}`;
};

/**
 * The spans of a text that has had its first `at` characters taken off it.
 *
 * A span carries its own words rather than offsets, so this walks the list
 * and trims the span the cut lands inside — which is what keeps an opening
 * marked up in italic italic from the cut onwards.
 */
const spansAfter = (spans: InlineSpan[], at: number): InlineSpan[] => {
  if (spans.length === 0) return spans;
  const out: InlineSpan[] = [];
  let seen = 0;
  for (const span of spans) {
    const ends = seen + span.text.length;
    if (ends <= at) {
      seen = ends;
      continue;
    }
    out.push(seen >= at ? span : { ...span, text: span.text.slice(at - seen) });
    seen = ends;
  }
  return out;
};

const openingMarkup = (block: BookBlock, context: BookRenderContext): string => {
  const chapter = block.chapter;
  const style = chapterStyleFor(context, block);
  // The layout in force. Absent on a block read alone, where the template is
  // still the answer — so nothing that has not been given a layout moves.
  const layout = chapterLayout(chapter?.layout ?? (chapter ? LAYOUT_OF_TEMPLATE[chapter.template] : 'mid'));
  const head: string[] = [];
  if (chapter) {
    if (chapter.label.length > 0) head.push(`<p class="bk-chapter-label">${escapeHtml(chapter.label)}</p>`);
    if (layout.rule && chapter.label.length > 0) head.push('<div class="bk-chapter-slot-rule"></div>');
    if (!layout.hideTitle && chapter.title.length > 0) head.push(`<p class="bk-chapter-title">${escapeHtml(chapter.title)}</p>`);
  } else if (block.title) {
    head.push(`<p class="bk-chapter-title">${escapeHtml(block.title)}</p>`);
  }
  const heading = head.length > 0 ? `<div class="bk-chapter-head">${head.join('')}</div>` : '';
  if (block.leaf && chapter && isFullPageArt(chapter) && chapter.image) {
    // Full-page art (addendum 19 §7): the picture is the page, past the
    // margins to the trim, and nothing is set over it.
    return `<div class="bk-display bk-leaf bk-leaf-art"><img class="bk-chapter-art" alt="${escapeHtml(chapter.image.name)}" src="${escapeHtml(chapter.image.dataUrl)}" /></div>`;
  }
  if (block.leaf && chapter) {
    // A page of art drawn by the layout rather than by the older template.
    if (layout.graphic === 'page' && chapter.image) {
      return `<div class="bk-display bk-leaf bk-leaf-art">${slotMarkup('graphic', layout, chapter, heading)}</div>`;
    }
    const parts = layout.slots.map((slot) => slotMarkup(slot, layout, chapter, heading));
    const classes = ['bk-display', 'bk-leaf', `bk-layout-${layout.id}`].join(' ');
    const align = layout.align === 'left' ? 'left' : chapter.align;
    return `<div class="${classes}" style="text-align:${align};${style}">${parts.filter(Boolean).join('')}</div>`;
  }
  // The opening above the first paragraph: dropped a third of the way down.
  // A prose part's heading carries the page's own style over the book's
  // chapter opening (§7a) — the same `--chapter-*` names rather than a second
  // set, so there is one answer to how the heading is set and the part is
  // simply the nearer one. Its resolved values are what the dialog shows.
  const align = chapter?.align ?? block.partStyle?.align ?? 'center';
  const own = block.partStyle
    ? Object.entries({
        '--chapter-face': faceStackOf(
          block.partStyle.face === 'book' ? context.settings.face : block.partStyle.face,
          context.settings.fonts,
        ),
        ...lineStyleVars('--chapter-title', block.partStyle.title),
        '--chapter-rule': block.partStyle.rule ? '1px solid currentColor' : 'none',
      })
        .filter(([, value]) => value !== '')
        .map(([name, value]) => `${name}:${value}`)
        .join(';')
    : '';
  // The same slot walk above the first paragraph (§14), so a chapter that
  // opens on the page rather than on a leaf of its own gets its layout too —
  // a bleeding header, a large number at the left margin, a numeral alone.
  // A part's heading has no chapter and so no layout, and draws as it did.
  const parts = chapter
    ? layout.slots.map((slot) => slotMarkup(slot, layout, chapter, heading)).filter(Boolean).join('')
    : heading;
  const wide = layout.graphic === 'bleed' ? ' bk-opening-bleed' : '';
  return `<div class="bk-opening bk-layout-${layout.id}${wide}" style="text-align:${layout.align === 'left' ? 'left' : align};${style}${own ? `;${own}` : ''}">${parts}</div>`;
};

/**
 * A chapter opening on its own, for a preview sheet (§14).
 *
 * **The same function the printed page goes through.** Every screen that shows
 * a writer what a chapter page will look like — the chapter-page dialog, the
 * marker dialog, the layout dialog's live preview — draws this, so none of
 * them can hold a second idea of where the picture sits. The renderer used to
 * keep a React copy of the arrangement in `ChapterLeaf`, and it had already
 * drifted: it knew three templates and could not draw a fourth.
 *
 * It takes only what the opening needs, so a caller with no book (a
 * screenplay's marker preview) needs no `BookRenderContext`.
 */
export const renderChapterOpening = (
  chapter: ChapterPageContent,
  style: ChapterPageStyle,
  face?: string,
  fonts: readonly BookFont[] = [],
): string =>
  openingMarkup({ id: 'leaf', kind: 'chapter_opening', leaf: true, chapter, text: '', spans: [] } as unknown as BookBlock, {
    chapterStyle: style,
    settings: { face: face ?? 'manuscript', fonts },
  } as unknown as BookRenderContext);

/**
 * One block's markup. Set in the measuring box to find its height; set in a
 * page, clipped to the lines the page holds. Contents and index rows are
 * drawn from the context, which is empty while the book is being measured
 * — the row count is what is measured, and the numbers fill in after.
 */
/**
 * How a text block was set in the document it came from, as an inline style
 * (addendum 21 §3). The face and the size are honoured only under the *As
 * imported* face — under any other the book is set in one face, which is
 * what choosing one means — and a size is snapped to whole lines of the
 * book's leading so the page keeps its grid. Alignment is always kept: a
 * centred paragraph is centred whatever it is set in.
 */
export const blockStyle = (block: BookBlock, context: BookRenderContext): string => {
  const rules: string[] = [];
  if (context.settings.face === 'imported') {
    if (block.face) rules.push(`font-family:'${block.face.replace(/'/g, '')}',${faceStackOf('imported')}`);
    if (block.size) {
      rules.push(`font-size:${(block.size * PX_PER_PT).toFixed(3)}px`);
      const lines = Math.max(1, Math.ceil(block.size / context.geometry.size - 0.001));
      if (lines > 1) rules.push(`line-height:calc(var(--bk-lead) * ${lines})`);
    }
  }
  // A paragraph of a designed prose part (§7a): set from the page's own line
  // style, as concrete declarations on that paragraph alone. The body rule is
  // left exactly as it is, so a page of the story cannot be reached from here.
  if (block.partStyle && block.kind === 'paragraph') {
    const one = block.partStyle.line;
    const face = faceStackOf(block.partStyle.face === 'book' ? context.settings.face : block.partStyle.face, context.settings.fonts);
    if (face) rules.push(`font-family:${face}`);
    rules.push(
      `font-size:${(one.size * PX_PER_PT).toFixed(3)}px`,
      `text-transform:${one.case === 'capitals' ? 'uppercase' : 'none'}`,
      `font-variant-caps:${one.case === 'small_caps' ? 'small-caps' : 'normal'}`,
      `font-weight:${one.bold ? 700 : 400}`,
      `font-style:${one.italic ? 'italic' : 'normal'}`,
      `letter-spacing:${one.tracking / 100}em`,
    );
  }
  if (block.align) rules.push(`text-align:${block.align}`, 'text-indent:0');
  return rules.length > 0 ? ` style="${rules.join(';')}"` : '';
};

/**
 * A graphic set over the page (§8c, from Ken: *add a vector graphic …
 * anywhere on the page … but it has a transparent background*).
 *
 * It is positioned against the **page**, which is the only positioned box
 * between here and the sheet, so the fractions mean what they say — a
 * tenth down is a tenth down the paper rather than a tenth down whatever
 * paragraph happens to carry it. It takes no room in the flow, draws no
 * background of its own and prints no caption: a flourish is not a figure,
 * and whatever transparency the file carries is what shows.
 */
const freeMarkup = (free: FigureFree, context: BookRenderContext): string => {
  const picture = free.assetId ? context.pictures.get(free.assetId) : undefined;
  const at = `left:${(free.x * 100).toFixed(3)}%;top:${(free.y * 100).toFixed(3)}%;width:${(free.span * 100).toFixed(3)}%`;
  const alt = free.decorative ? '' : escapeHtml(picture?.altText || free.caption || '');
  const inner = picture
    ? `<img class="bk-free-image" alt="${alt}" src="${escapeHtml(picture.data)}" />`
    : '<span class="bk-free-missing">Graphic goes here</span>';
  return `<span class="bk-free" data-figure="${escapeHtml(free.figureId)}" style="${at}">${inner}</span>`;
};

/**
 * A block's markup, with whatever is set over the page it falls on before
 * it. The free graphics are emitted **outside** the switch because they
 * belong to no kind: a flourish sits over a paragraph, a heading or an
 * opening alike, and asks nothing of what it rides.
 */
export const renderBookBlock = (block: BookBlock, context: BookRenderContext): string => {
  const over = (block.free ?? []).map((one) => freeMarkup(one, context)).join('');
  return over + blockInner(block, context);
};

const blockInner = (block: BookBlock, context: BookRenderContext): string => {
  const opens = block.opensChapter && context.settings.opening !== 'none';
  const style = blockStyle(block, context);
  switch (block.kind) {
    case 'paragraph': {
      // What happens to a chapter's **first** line (§14). `opensChapter` has
      // been on the block since the book was first laid out — the fifteenth
      // time the mechanism was already there — so a drop cap is a rendering
      // of a paragraph the plan already marks, and nothing new is stored.
      const first = block.opensChapter ? context.chapterStyle.firstLine : 'plain';
      const cls = ['bk-p', opens ? `bk-opens bk-${context.settings.opening}` : '', block.inset ? 'bk-has-inset' : '', first === 'plain' ? '' : `bk-first-${first}`]
        .filter(Boolean)
        .join(' ');
      const words = first === 'plain' ? renderSpans(block.spans, block.text) : firstLineMarkup(block, first);
      return `<p class="${cls}"${style}>${block.inset ? insetMarkup(block.inset, context) : ''}${words}</p>`;
    }
    case 'heading':
      // A heading that opens a page is a chapter inside a story (addendum 22
      // §6), so it opens **the way any chapter opens**: the same markup, the
      // same drop down the page, and the number in the type the book sets
      // for a chapter number. One answer to *how does a chapter begin*
      // rather than a second style beside it that drifts. A heading that
      // runs on in the prose is left as it was.
      if (block.starts !== 'none') {
        return (
          `<div class="bk-opening" style="text-align:center;${chapterStyleFor(context)}">` +
          `<div class="bk-chapter-head"><p class="bk-chapter-label">${renderSpans(block.spans, block.text)}</p></div>` +
          '</div>'
        );
      }
      return `<p class="bk-heading"${style}>${renderSpans(block.spans, block.text)}</p>`;
    case 'blockquote':
      return `<p class="bk-quote"${style}>${renderSpans(block.spans, block.text)}</p>`;
    case 'scene_break': {
      const ornament = context.settings.ornament.trim();
      return `<p class="bk-break">${ornament ? escapeHtml(ornament) : '&nbsp;'}</p>`;
    }
    case 'figure': {
      const picture = block.assetId ? context.pictures.get(block.assetId) : undefined;
      // An illustrated page inside the story (§8a): the picture is the page,
      // edge to edge past the margins, the same rule an art page follows.
      if (block.display) {
        if (picture) return `<div class="bk-display bk-plate bk-plate-art" data-figure="${escapeHtml(block.id)}"><img class="bk-plate-image" alt="${escapeHtml(picture.altText || block.caption || '')}" src="${escapeHtml(picture.data)}" /></div>`;
        return `<div class="bk-display bk-plate" data-figure="${escapeHtml(block.id)}"><div class="bk-plate-missing">Picture goes here</div></div>`;
      }
      const image = picture
        ? `<img class="bk-figure-image" alt="${escapeHtml(picture.altText || block.caption || '')}" src="${escapeHtml(picture.data)}" />`
        : '<div class="bk-figure-missing">Picture goes here</div>';
      const caption = (block.caption ?? '').trim() ? `<p class="bk-caption">${escapeHtml(block.caption ?? '')}</p>` : '';
      return `<div class="bk-figure" data-figure="${escapeHtml(block.id)}">${image}${caption}</div>`;
    }
    case 'chapter_opening':
    case 'part_opening':
      if (block.kind === 'part_opening' && block.display) return displayInner(block, context);
      return openingMarkup(block, context);
    case 'contents': {
      // A designed page like the other five (§7a), but one that **flows**:
      // the heading and the entries are set by the writer, while the template
      // and the drop are absent, there being no single block on a page to
      // place — the list runs to as many pages as it needs.
      const styled = block.partStyle ? ` style="${partStyleAttr(block.partStyle, context.settings.face, context.settings.fonts)}"` : '';
      const rows = context.contents
        .map(
          (row) =>
            `<div class="bk-contents-row${row.depth ? ' bk-contents-under' : ''}"><span class="bk-contents-label">${escapeHtml(row.label)}</span>` +
            `<span class="bk-contents-title">${escapeHtml(row.title)}</span>` +
            `<span class="bk-contents-page">${row.page > 0 ? row.page : ''}</span></div>`,
        )
        .join('');
      return `<div class="bk-contents"${styled}><p class="bk-part-title">${escapeHtml(block.title ?? 'Contents')}</p>${rows}</div>`;
    }
    case 'index': {
      const index = context.index;
      const styled = block.partStyle ? ` style="${partStyleAttr(block.partStyle, context.settings.face, context.settings.fonts)}"` : '';
      const letters = index
        ? index.letters
            .map(
              (group) =>
                `<p class="bk-index-letter">${escapeHtml(group.letter)}</p>` +
                group.headings
                  .map(
                    (heading) =>
                      `<p class="bk-index-entry">${escapeHtml(heading.term)}, ${escapeHtml(runsText(heading.runs))}</p>` +
                      heading.subEntries
                        .map((sub) => `<p class="bk-index-entry bk-index-sub">${escapeHtml(sub.subTerm)}, ${escapeHtml(runsText(sub.runs))}</p>`)
                        .join(''),
                  )
                  .join(''),
            )
            .join('')
        : '';
      return `<div class="bk-index"${styled}><p class="bk-part-title">${escapeHtml(block.title ?? 'Index')}</p>${letters}</div>`;
    }
    default:
      return displayInner(block, context);
  }
};

/**
 * A figure cut into a paragraph (§8): a float at one side, a fraction of the
 * measure wide. The picture's own proportions are declared so the box is the
 * right height before the picture has decoded — the paragraph is measured
 * the moment it is set, and a float of no height would be measured as none.
 */
const insetMarkup = (inset: FigureInset, context: BookRenderContext): string => {
  const picture = inset.assetId ? context.pictures.get(inset.assetId) : undefined;
  const ratio = picture && picture.width > 0 && picture.height > 0 ? `aspect-ratio:${picture.width} / ${picture.height};` : '';
  const image = picture
    ? `<img class="bk-inset-image" alt="${escapeHtml(picture.altText || inset.caption || '')}" style="${ratio}" src="${escapeHtml(picture.data)}" />`
    : '<span class="bk-figure-missing">Picture goes here</span>';
  const caption = inset.caption.trim() ? `<span class="bk-inset-caption">${escapeHtml(inset.caption)}</span>` : '';
  // The border the text keeps around it (§8a, from Ken: *gives a little bit
  // of a border*): the writer's, in ems of the body size, so it holds at any
  // trim and any type size.
  const gap = `--bk-standoff:${inset.standoff.toFixed(2)}em`;
  return `<span class="bk-inset bk-inset-${inset.place}" data-figure="${escapeHtml(inset.figureId)}" style="width:${Math.round(inset.span * 100)}%;${gap}">${image}${caption}</span>`;
};

/** The text block's class, and the measuring box's: the paragraph style rides on it. */
export const textClass = (context: BookRenderContext): string =>
  context.paragraphStyle === 'blocked' ? 'bk-text bk-blocked' : 'bk-text';

/** Where the folio sits on this page, as classes the stylesheet reads. */
const folioClass = (page: BookPage, settings: BookSettings): string => {
  const place = settings.folio;
  const outside = page.side === 'recto' ? 'right' : 'left';
  // A chapter opening shows its number at the foot whatever the book does:
  // a number in the head of a page whose text begins a third of the way down
  // is a number standing on nothing.
  if (page.display || page.opens) return `bk-folio foot ${outside}`;
  if (place === 'foot_centre') return 'bk-folio foot centre';
  if (place === 'head_outside') return `bk-folio head ${outside}`;
  return `bk-folio foot ${outside}`;
};

/**
 * One page: the pieces of its blocks, each clipped to the lines the laying
 * gave it, with the running head and the folio in the margins.
 */
export const renderBookPage = (
  page: BookPage,
  blocks: ReadonlyMap<string, BookBlock>,
  context: BookRenderContext,
): string => {
  const { leadPx } = bookMetrics(context.geometry);
  const pieces = page.pieces
    .map((piece) => {
      const block = blocks.get(piece.blockId);
      if (!block) return '';
      const inner = renderBookBlock(block, context);
      if (block.display) return `<div class="bk-piece bk-whole">${inner}</div>`;
      const height = (piece.to - piece.from) * leadPx;
      const shift = piece.from * leadPx;
      // **Only a split piece is clipped** (§8b). Clipping is what a split is
      // for, and `overflow: hidden` makes a box a formatting context of its
      // own — so a whole block drawn in one could neither let a cut-in
      // picture reach past its paragraph nor let the paragraphs after it
      // run round the picture, which together are the gap.
      const cls = piece.cut ? 'bk-piece bk-cut' : 'bk-piece';
      return `<div class="${cls}" style="height:${height.toFixed(3)}px"><div class="bk-clip" style="margin-top:-${shift.toFixed(3)}px">${inner}</div></div>`;
    })
    .join('');
  const head = page.runningHead
    ? `<div class="bk-running ${page.side} ${headSideClass(context.settings.runningHeads.place, page.side)}">${escapeHtml(page.runningHead)}</div>`
    : '';
  const folio = page.folio ? `<div class="${folioClass(page, context.settings)}">${escapeHtml(page.folio)}</div>` : '';
  const classes = ['bk-page', page.side, page.blank ? 'blank' : '', page.display ? 'display' : ''].filter(Boolean).join(' ');
  return `<section class="${classes}" data-sheet="${page.sheet}">${head}<div class="${textClass(context)}">${pieces}</div>${folio}</section>`;
};

/** The stylesheet the pages read; the custom properties come from `bookVars`. */
/**
 * How a chapter opening is set, as CSS (addendum 20 §14).
 *
 * Split out of `BOOK_STYLES` so the **preview sheets can carry the same
 * rules** — the chapter-page dialog, the marker dialog and the layout dialog
 * all draw `renderChapterOpening`'s markup, and a second stylesheet for them
 * would be a second answer to *what will this look like*, which is the fault
 * `chapterStyleVars` was written to stop. `BOOK_STYLES` interpolates it, so
 * there is one copy and the printed page cannot drift from the screen.
 */
export const CHAPTER_STYLES = `
  .bk-opening { padding-top: calc(var(--bk-lead) * var(--chapter-opening-lines, 8)); padding-bottom: calc(var(--bk-lead) * 2); font-family: var(--chapter-face, var(--bk-face)); }
  .bk-chapter-head { display: inline-block; border-bottom: var(--chapter-rule, none); padding-bottom: 0.35em; }
  .bk-chapter-label { margin: 0; font-size: var(--chapter-number-size); font-weight: var(--chapter-number-weight); font-style: var(--chapter-number-style); text-transform: var(--chapter-number-case); font-variant-caps: var(--chapter-number-variant); letter-spacing: var(--chapter-number-tracking); line-height: 1.3; }
  .bk-chapter-title { margin: 0.6em 0 0; font-size: var(--chapter-title-size); font-weight: var(--chapter-title-weight); font-style: var(--chapter-title-style); text-transform: var(--chapter-title-case); font-variant-caps: var(--chapter-title-variant); letter-spacing: var(--chapter-title-tracking); line-height: 1.25; }
  .bk-leaf { padding-top: var(--chapter-drop, 2.5in); height: 100%; font-family: var(--chapter-face, var(--bk-face)); }
  .bk-chapter-device { display: block; margin: 1.5em auto 0; max-width: 100%; }
  .bk-leaf-art { position: absolute; inset: 0; padding: 0; height: auto; overflow: hidden; }
  .bk-chapter-art { display: block; width: 100%; height: 100%; object-fit: cover; }
  .bk-chapter-epigraph { margin: 2em 0 0; white-space: pre-wrap; font-size: var(--chapter-epigraph-size); font-style: var(--chapter-epigraph-style); }
  .bk-chapter-summary { margin: 2em auto 0; max-width: 34em; white-space: pre-wrap; text-align: left; font-family: var(--bk-face); font-size: var(--chapter-summary-size); line-height: 1.5; }
  /* The layouts (addendum 20 §14). Each is the slot list drawn; nothing here
     knows what a layout means, only how the pieces sit. */
  .bk-layout-left { align-items: flex-start; }
  .bk-layout-left .bk-chapter-head { border-bottom: none; }
  .bk-layout-left .bk-chapter-label { font-size: calc(var(--chapter-number-size) * 1.6); line-height: 1; }
  .bk-layout-bignum .bk-chapter-label { font-size: calc(var(--chapter-number-size) * 2.7); line-height: 1; }
  .bk-chapter-slot-rule { width: 4em; height: 1px; margin: 0.5em 0 0.45em; background: currentColor; }
  .bk-chapter-bleed { margin: 0 calc(-1 * var(--bk-outside)) 1.6em; }
  .bk-chapter-bleed img { display: block; width: 100%; height: 33vh; max-height: 3in; object-fit: cover; }
  .bk-opening-bleed { padding-top: 0; }
  .bk-epigraph-apart { max-width: 22em; margin: 2.2em auto 0; text-align: center; }
  /* A chapter's first line (§14). The cap is floated, so the lines beside it
     run round; the lead-in is font-variant-caps, which is a real setting
     rather than a change to the letters (addendum 02 §12a's rule). */
  .bk-drop-cap { float: left; font-size: calc(var(--bk-lead) * 3); line-height: calc(var(--bk-lead) * 2.55); padding: 0.02em 0.08em 0 0; font-family: var(--chapter-face, var(--bk-face)); }
  .bk-lead-in { font-variant-caps: small-caps; letter-spacing: 0.04em; }
  .bk-first-drop_cap::after, .bk-first-lead_in::after { content: ''; display: block; clear: none; }
`;

export const BOOK_STYLES = `
  .bk-page {
    position: relative;
    width: var(--bk-page-width);
    height: var(--bk-page-height);
    background: #fff;
    color: #111;
    font-family: var(--bk-face);
    font-size: var(--bk-size);
    line-height: var(--bk-lead);
    overflow: hidden;
    box-sizing: border-box;
  }
  .bk-page.recto { padding: var(--bk-top) var(--bk-outside) var(--bk-bottom) var(--bk-inside); }
  .bk-page.verso { padding: var(--bk-top) var(--bk-inside) var(--bk-bottom) var(--bk-outside); }
  .bk-text { width: var(--bk-measure); }
  .bk-measure { position: absolute; left: -100000px; top: 0; visibility: hidden; width: var(--bk-measure); font-family: var(--bk-face); font-size: var(--bk-size); line-height: var(--bk-lead); color: #111; }
  .bk-piece.bk-cut { overflow: hidden; }
  .bk-piece.bk-whole { height: 100%; overflow: hidden; }
  .bk-p { margin: 0; text-align: var(--bk-align); hyphens: var(--bk-hyphens); -webkit-hyphens: var(--bk-hyphens); text-indent: var(--bk-indent); }
  .bk-p.bk-opens, .bk-heading + .bk-p, .bk-break + .bk-p, .bk-figure + .bk-p { text-indent: 0; }
  .bk-blocked .bk-p { text-indent: 0; padding-bottom: var(--bk-lead); }
  .bk-blocked .bk-p.bk-opens { padding-bottom: var(--bk-lead); }
  .bk-p.bk-small_caps::first-line { font-variant-caps: small-caps; letter-spacing: 0.04em; }
  .bk-p.bk-drop_cap::first-letter { float: left; font-size: calc(var(--bk-lead) * 3); line-height: calc(var(--bk-lead) * 3); padding-right: 0.08em; margin-top: -0.06em; }
  .bk-heading { margin: 0; padding-top: var(--bk-lead); font-weight: 700; text-align: left; }
  .bk-quote { margin: 0; padding: 0 2em; text-align: var(--bk-align); }
  .bk-break { margin: 0; height: calc(var(--bk-lead) * 3); line-height: calc(var(--bk-lead) * 3); text-align: center; letter-spacing: 0.5em; }
  .bk-figure { margin: 0; padding-bottom: var(--bk-lead); text-align: center; }
  /* The paragraph a picture cuts into is **not** a formatting context of its
     own (§8b). It was — display: flow-root — which contained the float, so
     a short paragraph grew to the picture's height and the text after it
     began below the picture: the gap. Now the picture reaches past its own
     paragraph and the ones after run round it, which is what cutting in
     means. A heading or a page of its own clears, having no business beside
     a picture. */
  .bk-inset { float: left; margin: 0.15em var(--bk-standoff, 1em) var(--bk-standoff, 1em) 0; }
  .bk-heading, .bk-break, .bk-figure, .bk-display, .bk-chapter-opening { clear: both; }
  .bk-inset.bk-inset-right { float: right; margin: 0.15em 0 var(--bk-standoff, 1em) var(--bk-standoff, 1em); }
  .bk-inset-image { display: block; width: 100%; height: auto; }
  .bk-inset-caption { display: block; font-size: 0.8em; line-height: 1.25; text-align: center; margin-top: 0.3em; }
  /* A free graphic (§8c): against the page, over the text, no background of
     its own — whatever the file carries is what shows. */
  .bk-free { position: absolute; z-index: 2; display: block; }
  .bk-free-image { display: block; width: 100%; height: auto; }
  .bk-free-missing { display: flex; align-items: center; justify-content: center; height: calc(var(--bk-lead) * 4); border: 1px dashed #999; color: #777; font-size: 0.8em; }
  .bk-inset .bk-figure-missing { display: flex; height: calc(var(--bk-lead) * 5); }
  .bk-figure-image { display: block; width: 100%; height: auto; }
  .bk-plate-art { position: absolute; inset: 0; padding: 0; height: auto; overflow: hidden; }
  .bk-plate-image { display: block; width: 100%; height: 100%; object-fit: cover; }
  .bk-figure-missing, .bk-plate-missing { height: calc(var(--bk-lead) * 8); border: 1px dashed #999; color: #777; display: flex; align-items: center; justify-content: center; font-size: 0.85em; }
  .bk-caption { margin: 0; padding-top: calc(var(--bk-lead) * 0.5); font-size: 0.85em; text-align: center; font-style: italic; }
${CHAPTER_STYLES}
  .bk-page.display .bk-text { height: 100%; }
  .bk-display { height: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .bk-display.bk-half, .bk-display.bk-title, .bk-display.bk-words { align-items: var(--pt-items, center); text-align: var(--pt-align, center); font-family: var(--pt-face, var(--bk-face)); }
  .bk-drop { flex: 0 0 var(--pt-drop, 30%); }
  .bk-display .bk-book-title { font-size: var(--pt-title-size, 2.2em); text-transform: var(--pt-title-case, none); font-variant-caps: var(--pt-title-variant, normal); font-weight: var(--pt-title-weight, 400); font-style: var(--pt-title-style, normal); letter-spacing: var(--pt-title-tracking, 0.02em); border-bottom: var(--pt-rule, none); padding-bottom: 0.15em; }
  .bk-display .bk-author, .bk-display .bk-subtitle, .bk-display .bk-imprint { font-size: var(--pt-line-size, 1.1em); text-transform: var(--pt-line-case, uppercase); font-variant-caps: var(--pt-line-variant, normal); font-weight: var(--pt-line-weight, 400); font-style: var(--pt-line-style, normal); letter-spacing: var(--pt-line-tracking, 0.12em); }
  .bk-subtitle { margin: 0.8em 0 0; }
  /* One selector, not two: bk-display and bk-words are on the same element,
     so the descendant form that stood here matched nothing and the page's own
     type was never honoured at all (§7a). The defaults are what the dead rule
     fell back to, so a page made before this draws as it did. */
  .bk-display.bk-words p { font-size: var(--pt-title-size, 1em); text-transform: var(--pt-title-case, none); font-variant-caps: var(--pt-title-variant, normal); font-weight: var(--pt-title-weight, 400); font-style: var(--pt-title-style, italic); letter-spacing: var(--pt-title-tracking, 0); }
  /* The lines under the words: an epigraph's attribution, a dedication's
     second line. They start as the words and are set apart from here. */
  .bk-display.bk-words p.bk-words-under { font-size: var(--pt-line-size, 1em); text-transform: var(--pt-line-case, none); font-variant-caps: var(--pt-line-variant, normal); font-weight: var(--pt-line-weight, 400); font-style: var(--pt-line-style, italic); letter-spacing: var(--pt-line-tracking, 0); }
  /* It hangs at the foot, which is what a copyright page is (§7a); everything
     else about it is the writer's, the same as the other designed pages. */
  .bk-display.bk-copy-top { justify-content: flex-start; }
  .bk-display.bk-copy-middle { justify-content: center; }
  .bk-display.bk-copyright { justify-content: flex-end; align-items: var(--pt-items, flex-start); text-align: var(--pt-align, left); font-family: var(--pt-face, var(--bk-face)); }
  .bk-display.bk-plate { justify-content: center; }
  .bk-book-title { margin: 0; font-size: 2.2em; line-height: 1.15; letter-spacing: 0.02em; }
  .bk-author { margin: 2em 0 0; font-size: 1.1em; letter-spacing: 0.12em; text-transform: uppercase; }
  .bk-imprint { margin-top: auto; padding-bottom: 1em; font-size: 0.85em; letter-spacing: 0.15em; text-transform: uppercase; }
  .bk-title-art { max-width: 80%; max-height: 40%; }
  .bk-small { font-size: 0.8em; line-height: 1.4; margin: 0; }
  .bk-display.bk-copyright .bk-small { font-size: var(--pt-title-size, 0.8em); text-transform: var(--pt-title-case, none); font-variant-caps: var(--pt-title-variant, normal); font-weight: var(--pt-title-weight, 400); font-style: var(--pt-title-style, normal); letter-spacing: var(--pt-title-tracking, 0); border-bottom: var(--pt-rule, none); padding-bottom: 0.15em; }
  /* A copyright page's lines (§9k): a paragraph each, with a little air
     between them, and a run-on line tucked under the one it belongs to. */
  .bk-display.bk-copyright .bk-small + .bk-small { margin-top: 0.5em; }
  .bk-display.bk-copyright .bk-copy-run { margin-top: 0 !important; }
  /* The barcode: bottom right, off the text block's corner, at the width the
     writer set. It is the last thing on the page and nothing wraps round it. */
  .bk-barcode { align-self: flex-end; margin-top: 0.6em; }
  .bk-barcode img { display: block; width: 100%; height: auto; }
  .bk-words p { margin: 0; font-style: italic; }
  /* The contents and the index are designed pages that **flow** (§7a): the
     style sits on the wrapper, so the entries take the line style by
     inheritance and a sub-entry's 0.92em stays a share of the entry rather
     than of the body. The heading takes the title style over the top. */
  .bk-contents, .bk-index { font-family: var(--pt-face, var(--bk-face)); font-size: var(--pt-line-size, 1em); text-transform: var(--pt-line-case, none); font-variant-caps: var(--pt-line-variant, normal); font-weight: var(--pt-line-weight, 400); font-style: var(--pt-line-style, normal); letter-spacing: var(--pt-line-tracking, 0); }
  .bk-part-title { margin: 0; padding: calc(var(--bk-lead) * 4) 0 calc(var(--bk-lead) * 2); text-align: var(--pt-align, center); font-size: var(--pt-title-size, 1.3em); letter-spacing: var(--pt-title-tracking, 0.12em); text-transform: var(--pt-title-case, uppercase); font-variant-caps: var(--pt-title-variant, normal); font-weight: var(--pt-title-weight, 400); font-style: var(--pt-title-style, normal); border-bottom: var(--pt-rule, none); line-height: var(--bk-lead); }
  .bk-contents-row { display: flex; gap: 1em; align-items: baseline; }
  .bk-contents-under { padding-left: 2em; font-size: 0.92em; }
  .bk-contents-label { flex: none; min-width: 6em; }
  .bk-contents-title { flex: 1; }
  .bk-contents-page { flex: none; min-width: 2.5em; text-align: right; }
  /* The letter dividers are a third kind of line on the page and not the
     entries under them (§7a), so they override every property the wrapper
     hands down rather than taking the entries' and differing only in weight.
     The fallbacks are what the rule said before: bold, at the reading size. */
  .bk-index-letter { margin: 0; padding-top: var(--bk-lead); font-size: var(--pt-divider-size, 1em); text-transform: var(--pt-divider-case, none); font-variant-caps: var(--pt-divider-variant, normal); font-weight: var(--pt-divider-weight, 700); font-style: var(--pt-divider-style, normal); letter-spacing: var(--pt-divider-tracking, 0); }
  .bk-index-entry { margin: 0; padding-left: 1.5em; text-indent: -1.5em; }
  .bk-index-sub { padding-left: 3em; }
  /* The furniture reads the book's own settings (§7a): what used to be
     hard-coded here — the size, the case, the tracking, and the verso's
     capitals against the recto's italic — is the writer's now. */
  .bk-running { position: absolute; top: var(--bk-head); left: var(--bk-outside); right: var(--bk-outside); line-height: 1; font-family: var(--bk-run-face, var(--bk-face)); }
  .bk-running.centre { text-align: center; }
  .bk-running.left { text-align: left; }
  .bk-running.right { text-align: right; }
  .bk-running.verso { font-size: var(--bk-run-verso-size); text-transform: var(--bk-run-verso-case); font-variant-caps: var(--bk-run-verso-variant); font-weight: var(--bk-run-verso-weight); font-style: var(--bk-run-verso-style); letter-spacing: var(--bk-run-verso-tracking); }
  .bk-running.recto { font-size: var(--bk-run-recto-size); text-transform: var(--bk-run-recto-case); font-variant-caps: var(--bk-run-recto-variant); font-weight: var(--bk-run-recto-weight); font-style: var(--bk-run-recto-style); letter-spacing: var(--bk-run-recto-tracking); }
  .bk-folio { position: absolute; line-height: 1; font-family: var(--bk-run-face, var(--bk-face)); font-size: var(--bk-run-folio-size); text-transform: var(--bk-run-folio-case); font-variant-caps: var(--bk-run-folio-variant); font-weight: var(--bk-run-folio-weight); font-style: var(--bk-run-folio-style); letter-spacing: var(--bk-run-folio-tracking); }
  .bk-folio.foot { bottom: var(--bk-foot); }
  .bk-folio.head { top: var(--bk-head); }
  .bk-folio.left { left: var(--bk-outside); }
  .bk-folio.right { right: var(--bk-outside); }
  .bk-page.verso .bk-folio.left { left: var(--bk-outside); }
  .bk-page.recto .bk-folio.right { right: var(--bk-outside); }
  .bk-folio.centre { left: 0; right: 0; text-align: center; }
`;

/** The whole book as a document: every page at the trim, for the PDF. */
export const renderBookHtml = (
  pages: readonly BookPage[],
  blocks: readonly BookBlock[],
  context: BookRenderContext,
  title: string,
): string => {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const { pageWidthPx, pageHeightPx } = bookMetrics(context.geometry);
  const vars =
    `${bookVarsAttr(context)};--bk-page-width:${pageWidthPx}px;--bk-page-height:${pageHeightPx}px`;
  const body = pages.map((page) => renderBookPage(page, byId, context)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || 'Untitled')}</title>
<style>
  ${fontFaceCss(context.settings.fonts)}
  @page { size: ${context.geometry.trim.width}in ${context.geometry.trim.height}in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9e9ec; ${vars}; }
  ${BOOK_STYLES}
  .bk-page { margin: 0 auto 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
  @media print {
    body { background: #fff; }
    .bk-page { margin: 0; box-shadow: none; break-after: page; }
    .bk-page:last-child { break-after: auto; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
};

export const suggestedBookFileName = (title: string): string => {
  const base = (title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
  return `${base} (book).pdf`;
};

/** Everything a caller needs to build a context from a file, in one place. */
export const emptyChapterStyle = (): ChapterPageStyle => chapterPageStyleSchema.parse({});
