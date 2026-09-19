import type { BookSettings } from './entities/book.js';
import type { InlineSpan } from './entities/inline.js';
import { chapterPageStyleSchema, chapterStyleAttr, type ChapterPageStyle } from './chapter-style.js';
import { faceStackOf, type BookGeometry } from './book-layout.js';
import type { BookBlock, FigureInset } from './book-plan.js';
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

/** The custom properties every page and the measuring box declare. */
export const bookVars = (context: BookRenderContext): Record<string, string> => {
  const { leadPx, sizePx, measurePx } = bookMetrics(context.geometry);
  const { margins } = context.geometry;
  return {
    '--bk-face': faceStackOf(context.settings.face),
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
const displayInner = (block: BookBlock, context: BookRenderContext): string => {
  const { names, titlePage } = context;
  switch (block.kind) {
    case 'half_title':
      return `<div class="bk-display bk-half"><p class="bk-book-title">${escapeHtml(titlePage.title || names.title)}</p></div>`;
    case 'title_page': {
      const art = titlePage.titleImage
        ? `<img class="bk-title-art" alt="${escapeHtml(titlePage.title || names.title)}" src="${escapeHtml(titlePage.titleImage)}" />`
        : `<p class="bk-book-title">${escapeHtml(titlePage.title || names.title)}</p>`;
      const imprint = names.imprint.trim().length > 0 ? `<p class="bk-imprint">${escapeHtml(names.imprint)}</p>` : '';
      return `<div class="bk-display bk-title">${art}<p class="bk-author">${escapeHtml(titlePage.author || names.author)}</p>${imprint}</div>`;
    }
    case 'copyright': {
      const text = block.text.trim().length > 0 ? block.text : `Copyright © ${names.author}`.trim();
      return `<div class="bk-display bk-copyright"><p class="bk-small">${escapeHtml(text).replace(/\n/g, '<br />')}</p></div>`;
    }
    case 'plate': {
      const picture = block.assetId ? context.pictures.get(block.assetId) : undefined;
      const image = picture
        ? `<img class="bk-plate-image" alt="${escapeHtml(picture.altText || block.caption || '')}" src="${escapeHtml(picture.data)}" />`
        : '<div class="bk-plate-missing">No picture chosen</div>';
      const caption = (block.caption ?? '').trim().length > 0 ? `<p class="bk-caption">${escapeHtml(block.caption ?? '')}</p>` : '';
      return `<div class="bk-display bk-plate">${image}${caption}</div>`;
    }
    default:
      // A dedication or an epigraph: the words alone, a third of the way down.
      return `<div class="bk-display bk-words">${block.text
        .split(/\n/)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')}</div>`;
  }
};

/**
 * The chapter-page style's custom properties, with one reading over them:
 * *manuscript* as the face means *the face the text is in*, and in the book
 * the text is in the book's face — so a chapter page that never chose a face
 * is set in the body's rather than in Courier.
 */
const chapterStyleFor = (context: BookRenderContext): string => {
  const style = chapterStyleAttr(context.chapterStyle);
  return context.chapterStyle.face === 'manuscript'
    ? `${style};--chapter-face:${faceStackOf(context.settings.face)}`
    : style;
};

const openingMarkup = (block: BookBlock, context: BookRenderContext): string => {
  const chapter = block.chapter;
  const style = chapterStyleFor(context);
  const head: string[] = [];
  if (chapter) {
    if (chapter.label.length > 0) head.push(`<p class="bk-chapter-label">${escapeHtml(chapter.label)}</p>`);
    if (chapter.title.length > 0) head.push(`<p class="bk-chapter-title">${escapeHtml(chapter.title)}</p>`);
  } else if (block.title) {
    head.push(`<p class="bk-chapter-title">${escapeHtml(block.title)}</p>`);
  }
  const heading = head.length > 0 ? `<div class="bk-chapter-head">${head.join('')}</div>` : '';
  if (block.leaf && chapter) {
    // The leaf as the chapter-page dialog designed it: number, name, device, epigraph, summary.
    const graphic = chapter.image
      ? `<img class="bk-chapter-device" alt="${escapeHtml(chapter.image.name)}" style="width:${Math.round(chapter.image.width)}%" src="${escapeHtml(chapter.image.dataUrl)}" />`
      : '';
    const epigraph = chapter.epigraph.trim() ? `<p class="bk-chapter-epigraph">${escapeHtml(chapter.epigraph)}</p>` : '';
    const summary = chapter.summary.trim() ? `<p class="bk-chapter-summary">${escapeHtml(chapter.summary)}</p>` : '';
    const parts =
      chapter.template === 'graphic_top'
        ? [graphic, heading, epigraph, summary]
        : chapter.template === 'graphic_bottom'
          ? [heading, epigraph, summary, graphic]
          : [heading, graphic, epigraph, summary];
    return `<div class="bk-display bk-leaf" style="text-align:${chapter.align};${style}">${parts.filter(Boolean).join('')}</div>`;
  }
  // The opening above the first paragraph: dropped a third of the way down.
  const align = chapter?.align ?? 'center';
  return `<div class="bk-opening" style="text-align:${align};${style}">${heading}</div>`;
};

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
  if (block.align) rules.push(`text-align:${block.align}`, 'text-indent:0');
  return rules.length > 0 ? ` style="${rules.join(';')}"` : '';
};

export const renderBookBlock = (block: BookBlock, context: BookRenderContext): string => {
  const opens = block.opensChapter && context.settings.opening !== 'none';
  const style = blockStyle(block, context);
  switch (block.kind) {
    case 'paragraph': {
      const cls = ['bk-p', opens ? `bk-opens bk-${context.settings.opening}` : '', block.inset ? 'bk-has-inset' : ''].filter(Boolean).join(' ');
      return `<p class="${cls}"${style}>${block.inset ? insetMarkup(block.inset, context) : ''}${renderSpans(block.spans, block.text)}</p>`;
    }
    case 'heading':
      return `<p class="bk-heading"${style}>${renderSpans(block.spans, block.text)}</p>`;
    case 'blockquote':
      return `<p class="bk-quote"${style}>${renderSpans(block.spans, block.text)}</p>`;
    case 'scene_break': {
      const ornament = context.settings.ornament.trim();
      return `<p class="bk-break">${ornament ? escapeHtml(ornament) : '&nbsp;'}</p>`;
    }
    case 'figure': {
      const picture = block.assetId ? context.pictures.get(block.assetId) : undefined;
      const image = picture
        ? `<img class="bk-figure-image" alt="${escapeHtml(picture.altText || block.caption || '')}" src="${escapeHtml(picture.data)}" />`
        : '<div class="bk-figure-missing">Picture missing</div>';
      const caption = (block.caption ?? '').trim() ? `<p class="bk-caption">${escapeHtml(block.caption ?? '')}</p>` : '';
      return `<div class="bk-figure" data-figure="${escapeHtml(block.id)}">${image}${caption}</div>`;
    }
    case 'chapter_opening':
    case 'part_opening':
      if (block.kind === 'part_opening' && block.display) return displayInner(block, context);
      return openingMarkup(block, context);
    case 'contents': {
      const rows = context.contents
        .map(
          (row) =>
            `<div class="bk-contents-row"><span class="bk-contents-label">${escapeHtml(row.label)}</span>` +
            `<span class="bk-contents-title">${escapeHtml(row.title)}</span>` +
            `<span class="bk-contents-page">${row.page > 0 ? row.page : ''}</span></div>`,
        )
        .join('');
      return `<div class="bk-contents"><p class="bk-part-title">${escapeHtml(block.title ?? 'Contents')}</p>${rows}</div>`;
    }
    case 'index': {
      const index = context.index;
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
      return `<div class="bk-index"><p class="bk-part-title">${escapeHtml(block.title ?? 'Index')}</p>${letters}</div>`;
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
    : '<span class="bk-figure-missing">Picture missing</span>';
  const caption = inset.caption.trim() ? `<span class="bk-inset-caption">${escapeHtml(inset.caption)}</span>` : '';
  return `<span class="bk-inset bk-inset-${inset.place}" data-figure="${escapeHtml(inset.figureId)}" style="width:${Math.round(inset.span * 100)}%">${image}${caption}</span>`;
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
      return `<div class="bk-piece" style="height:${height.toFixed(3)}px"><div class="bk-clip" style="margin-top:-${shift.toFixed(3)}px">${inner}</div></div>`;
    })
    .join('');
  const head = page.runningHead ? `<div class="bk-running ${page.side}">${escapeHtml(page.runningHead)}</div>` : '';
  const folio = page.folio ? `<div class="${folioClass(page, context.settings)}">${escapeHtml(page.folio)}</div>` : '';
  const classes = ['bk-page', page.side, page.blank ? 'blank' : '', page.display ? 'display' : ''].filter(Boolean).join(' ');
  return `<section class="${classes}" data-sheet="${page.sheet}">${head}<div class="${textClass(context)}">${pieces}</div>${folio}</section>`;
};

/** The stylesheet the pages read; the custom properties come from `bookVars`. */
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
  .bk-piece { overflow: hidden; }
  .bk-piece.bk-whole { height: 100%; }
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
  .bk-p.bk-has-inset { display: flow-root; }
  .bk-inset { float: left; margin: 0.15em 1em 0.2em 0; }
  .bk-inset.bk-inset-right { float: right; margin: 0.15em 0 0.2em 1em; }
  .bk-inset-image { display: block; width: 100%; height: auto; }
  .bk-inset-caption { display: block; font-size: 0.8em; line-height: 1.25; text-align: center; margin-top: 0.3em; }
  .bk-inset .bk-figure-missing { display: flex; height: calc(var(--bk-lead) * 5); }
  .bk-figure-image, .bk-plate-image { display: block; width: 100%; height: auto; }
  .bk-figure-missing, .bk-plate-missing { height: calc(var(--bk-lead) * 8); border: 1px dashed #999; color: #777; display: flex; align-items: center; justify-content: center; font-size: 0.85em; }
  .bk-caption { margin: 0; padding-top: calc(var(--bk-lead) * 0.5); font-size: 0.85em; text-align: center; font-style: italic; }
  .bk-opening { padding-top: calc(var(--bk-lead) * 8); padding-bottom: calc(var(--bk-lead) * 2); font-family: var(--chapter-face, var(--bk-face)); }
  .bk-chapter-head { display: inline-block; border-bottom: var(--chapter-rule, none); padding-bottom: 0.35em; }
  .bk-chapter-label { margin: 0; font-size: var(--chapter-number-size); font-weight: var(--chapter-number-weight); font-style: var(--chapter-number-style); text-transform: var(--chapter-number-case); font-variant-caps: var(--chapter-number-variant); letter-spacing: var(--chapter-number-tracking); line-height: 1.3; }
  .bk-chapter-title { margin: 0.6em 0 0; font-size: var(--chapter-title-size); font-weight: var(--chapter-title-weight); font-style: var(--chapter-title-style); text-transform: var(--chapter-title-case); font-variant-caps: var(--chapter-title-variant); letter-spacing: var(--chapter-title-tracking); line-height: 1.25; }
  .bk-leaf { padding-top: var(--chapter-drop, 2.5in); height: 100%; font-family: var(--chapter-face, var(--bk-face)); }
  .bk-chapter-device { display: block; margin: 1.5em auto 0; max-width: 100%; }
  .bk-chapter-epigraph { margin: 2em 0 0; white-space: pre-wrap; font-size: var(--chapter-epigraph-size); font-style: var(--chapter-epigraph-style); }
  .bk-chapter-summary { margin: 2em auto 0; max-width: 34em; white-space: pre-wrap; text-align: left; font-family: var(--bk-face); font-size: var(--chapter-summary-size); line-height: 1.5; }
  .bk-display { height: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .bk-display.bk-half, .bk-display.bk-title, .bk-display.bk-words { padding-top: 30%; }
  .bk-display.bk-copyright { justify-content: flex-end; align-items: flex-start; text-align: left; }
  .bk-display.bk-plate { justify-content: center; }
  .bk-book-title { margin: 0; font-size: 2.2em; line-height: 1.15; letter-spacing: 0.02em; }
  .bk-author { margin: 2em 0 0; font-size: 1.1em; letter-spacing: 0.12em; text-transform: uppercase; }
  .bk-imprint { margin-top: auto; padding-bottom: 1em; font-size: 0.85em; letter-spacing: 0.15em; text-transform: uppercase; }
  .bk-title-art { max-width: 80%; max-height: 40%; }
  .bk-small { font-size: 0.8em; line-height: 1.4; margin: 0; }
  .bk-words p { margin: 0; font-style: italic; }
  .bk-part-title { margin: 0; padding: calc(var(--bk-lead) * 4) 0 calc(var(--bk-lead) * 2); text-align: center; font-size: 1.3em; letter-spacing: 0.12em; text-transform: uppercase; line-height: var(--bk-lead); }
  .bk-contents-row { display: flex; gap: 1em; align-items: baseline; }
  .bk-contents-label { flex: none; min-width: 6em; }
  .bk-contents-title { flex: 1; }
  .bk-contents-page { flex: none; min-width: 2.5em; text-align: right; }
  .bk-index-letter { margin: 0; padding-top: var(--bk-lead); font-weight: 700; }
  .bk-index-entry { margin: 0; padding-left: 1.5em; text-indent: -1.5em; }
  .bk-index-sub { padding-left: 3em; }
  .bk-running { position: absolute; top: var(--bk-head); left: 0; right: 0; text-align: center; font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1; }
  .bk-running.recto { font-style: italic; text-transform: none; letter-spacing: 0.02em; }
  .bk-folio { position: absolute; font-size: 0.85em; line-height: 1; }
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
