import { partsOf, partTitle, type BookBlock } from './book-plan.js';
import { bookSettingsOf } from './book-layout.js';
import { BOOK_STYLES, bookMetrics, bookVars, renderBookPage, type BookRenderContext } from './print-book.js';
import type { BookPage } from './book-pages.js';
import { ebookRulesFor } from './ebook-presets.js';
import {
  coverOf,
  ebookMetadataOf,
  escapeXml,
  finishPackage,
  imageBank,
  safeName,
  xhtmlDocument,
  type EbookNavItem,
  type EbookPackage,
  type EbookSection,
  type EpubEntry,
} from './ebook.js';
import type { ProjectFile } from './project-file.js';
import type { Asset } from './entities/asset.js';

/**
 * The fixed-layout eBook (addendum 23 §10): every page as the Layout room
 * laid it, one XHTML document per page at the trim, which the reader shows
 * whole and scales rather than reflows.
 *
 * Where the reflowable book reads the *blocks*, this reads the *pages* —
 * the same `renderBookPage` markup the screen draws and the PDF prints, so
 * the page on the device is the page in the room. The two exporters share
 * everything below the content (`ebook.ts`), and differ in one honest
 * limitation this one carries: the faces are not embedded, so a reader
 * without the book's face sets each page in its own, and the lines may
 * fall differently *within* the page. The log says so, and the preflight
 * warns when a book of text has been asked for it, since Ken's spec is
 * clear that fixed layout is for a picture book and never for a novel
 * merely because it has a trim.
 */

export interface LaidForEbook {
  pages: readonly BookPage[];
  blocks: readonly BookBlock[];
  context: BookRenderContext;
}

const PICTURED = /bk-figure-image|bk-plate-image|bk-inset-image|bk-title-art|bk-chapter-image|<img\b/;

/**
 * The page's markup with every picture moved into the package. The page
 * draws its pictures as data URLs (the screen needs no files); an EPUB
 * carries them as files, so each `img` is rewritten to the package's copy,
 * and the alt text the page already gave is kept.
 */
const rewritePictures = (
  html: string,
  bank: ReturnType<typeof imageBank>,
  assetsByData: ReadonlyMap<string, Asset>,
  pageIndex: number,
): string =>
  html.replace(/<img\b([^>]*?)\s*\/?>/g, (tag, attributes: string) => {
    const src = /\ssrc="([^"]*)"/.exec(attributes)?.[1] ?? '';
    const alt = /\salt="([^"]*)"/.exec(attributes)?.[1] ?? '';
    const cls = /\sclass="([^"]*)"/.exec(attributes)?.[1] ?? '';
    const raw = src.replace(/&amp;/g, '&');
    if (!raw.startsWith('data:')) return tag;
    const asset = assetsByData.get(raw);
    const described = asset ? asset.altText.trim().length > 0 : alt.trim().length > 0;
    const image = bank.take(
      asset ? `asset:${asset.id as string}` : `page:${pageIndex}:${raw.slice(0, 64)}:${raw.length}`,
      raw,
      alt,
      asset?.name || 'picture',
      asset?.width ?? 0,
      asset?.height ?? 0,
      described,
    );
    if (!image) return '';
    return `<img class="${escapeXml(cls)}" alt="${alt}" src="../${image.href}"/>`;
  });

/** The stylesheet the pages share: the room's own, plus the page as the whole viewport. */
export const fixedPageCss = (context: BookRenderContext): string => {
  const { pageWidthPx, pageHeightPx } = bookMetrics(context.geometry);
  const vars = Object.entries({ ...bookVars(context), '--bk-page-width': `${pageWidthPx}px`, '--bk-page-height': `${pageHeightPx}px` })
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  return `/* VC Writer fixed-layout eBook: each page as laid, at the trim in CSS pixels. */
html, body { margin: 0; padding: 0; width: ${Math.round(pageWidthPx)}px; height: ${Math.round(pageHeightPx)}px; overflow: hidden; background: #fff; }
body { ${vars} }
${BOOK_STYLES}
.bk-page { margin: 0; box-shadow: none; }
body.bk-cover-page { display: flex; align-items: center; justify-content: center; }
body.bk-cover-page img { max-width: 100%; max-height: 100%; }
`;
};

/**
 * What the contents lists on a fixed-layout book: the first page of each
 * part, and the page each chapter opens on — read off the pages, so a
 * chapter that moved lists where it now is.
 */
const navOf = (pages: readonly BookPage[], blocks: ReadonlyMap<string, BookBlock>, parts: ReadonlyMap<string, string>, href: (index: number) => string): EbookNavItem[] => {
  const items: EbookNavItem[] = [];
  const seenParts = new Set<string>();
  pages.forEach((page, index) => {
    // One entry per page: a contents that lists a page twice is refused by
    // the EPUB 2 reader, and a part and the chapter that opens under it on
    // the same page are one place to turn to.
    let named = false;
    const name = (title: string) => {
      if (named || !title) return;
      named = true;
      items.push({ href: href(index), title });
    };
    for (const piece of page.pieces) {
      const block = blocks.get(piece.blockId);
      if (!block) continue;
      if (block.partId && !seenParts.has(block.partId)) {
        seenParts.add(block.partId);
        name(parts.get(block.partId) ?? '');
      }
      if (block.kind === 'chapter_opening') name(block.chapter?.title || block.title || block.chapter?.label || page.chapterTitle);
    }
  });
  return items;
};

export const fixedEbookOf = (file: ProjectFile, laid: LaidForEbook, options: { modified?: string; target?: string } = {}): EbookPackage => {
  const settings = bookSettingsOf(file);
  const rules = ebookRulesFor(options.target ?? settings.ebook.target);
  const metadata = ebookMetadataOf(file, options);
  const log: string[] = [];
  const assets = new Map<string, Asset>(file.assets.map((asset) => [asset.id as string, asset]));
  const assetsByData = new Map<string, Asset>(file.assets.filter((asset) => asset.kind === 'image').map((asset) => [asset.data, asset]));
  const bank = imageBank(assets, log);
  const cover = coverOf(file, settings, assets, metadata, log);
  const blocks = new Map(laid.blocks.map((block) => [block.id, block]));
  const parts = new Map(partsOf(file).map((part) => [part.id, partTitle(part)]));
  const { pageWidthPx, pageHeightPx } = bookMetrics(laid.context.geometry);
  const width = Math.round(pageWidthPx);
  const height = Math.round(pageHeightPx);
  const viewport = `<meta name="viewport" content="width=${width}, height=${height}"/>\n`;
  const href = (index: number) => `text/${String(index + 1).padStart(3, '0')}-page.xhtml`;

  const sections: EbookSection[] = [];
  const content: EpubEntry[] = [];

  if (cover) {
    sections.push({ id: 'cover', href: 'text/000-cover.xhtml', title: 'Cover', kind: 'cover', spread: 'center' });
    content.push({
      path: 'OEBPS/text/000-cover.xhtml',
      mediaType: 'application/xhtml+xml',
      id: 'cover',
      data: xhtmlDocument({
        lang: metadata.language,
        title: 'Cover',
        css: '../css/page.css',
        head: viewport,
        body: `<section epub:type="cover" id="cover"><img src="../${cover.href}" alt="${escapeXml(cover.alt)}"/></section>`,
      }).replace('<body>', '<body class="bk-cover-page">'),
    });
  }

  let pictured = 0;
  let firstBody: EbookSection | null = null;
  laid.pages.forEach((page, index) => {
    const drawn = rewritePictures(renderBookPage(page, blocks, laid.context), bank, assetsByData, index)
      // The five XML entities are the only named ones an XHTML content
      // document may carry without a DTD; the page's non-breaking space
      // becomes its number.
      .replace(/&nbsp;/g, '&#160;');
    if (PICTURED.test(drawn)) pictured += 1;
    const opensChapter = page.pieces.some((piece) => blocks.get(piece.blockId)?.kind === 'chapter_opening');
    const id = `page-${String(index + 1).padStart(3, '0')}`;
    const section: EbookSection = {
      id,
      href: href(index),
      title: opensChapter ? page.chapterTitle || `Page ${index + 1}` : page.blank ? `Page ${index + 1} (blank)` : page.folio ? `Page ${page.folio}` : `Page ${index + 1}`,
      kind: page.numbering === 'roman' ? 'front' : opensChapter ? 'chapter' : 'body',
      spread: page.side === 'verso' ? 'left' : 'right',
    };
    if (!firstBody && page.numbering === 'arabic') firstBody = section;
    sections.push(section);
    content.push({
      path: `OEBPS/${section.href}`,
      mediaType: 'application/xhtml+xml',
      id,
      data: xhtmlDocument({ lang: metadata.language, title: section.title, css: '../css/page.css', head: viewport, body: drawn }),
    });
  });

  const trim = laid.context.geometry.trim;
  log.unshift(
    `Every page is kept as laid: ${laid.pages.length} pages at ${trim.width} × ${trim.height} in, page numbers and running heads included. The reader shows each page whole and scales it; nothing reflows.`,
    'The faces are not embedded. A reader without the book’s face sets each page in its own, and the lines may fall differently within the page.',
  );

  return finishPackage({
    metadata,
    rules,
    layout: 'fixed',
    sections,
    content,
    images: bank.images,
    cover,
    nav: navOf(laid.pages, blocks, parts, href),
    firstBody,
    // The navigation document is reflowable and stands outside a book of
    // fixed pages; readers show it as their own contents.
    navInSpine: false,
    css: { href: 'css/page.css', text: fixedPageCss(laid.context) },
    extraMeta: [
      '<meta property="rendition:layout">pre-paginated</meta>',
      '<meta property="rendition:orientation">auto</meta>',
      '<meta property="rendition:spread">auto</meta>',
    ],
    log,
    fileName: `${safeName(metadata.title)}.epub`,
    pages: { count: laid.pages.length, pictured, width, height },
  });
};
