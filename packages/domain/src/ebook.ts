import { isFullPageArt } from './chapter-style.js';
import { bookBlocks, partsOf, partTitle, type BookBlock } from './book-plan.js';
import { bookNames, bookSettingsOf, trimOf } from './book-layout.js';
import { parseInline, type InlineSpan } from './entities/inline.js';
import { titlePageOf } from './entities/title-page.js';
import { nowIso } from './entities/common.js';
import { ebookRulesFor, type EbookRules } from './ebook-presets.js';
import { writeZip } from './zip-write.js';
import type { ProjectFile } from './project-file.js';
import type { BookPart, BookSettings, EbookSettings } from './entities/book.js';
import type { Asset } from './entities/asset.js';

/**
 * The eBook (addendum 23).
 *
 * **The book's blocks are the eBook's model.** `bookBlocks` already reads
 * the project into the semantic sequence the Layout room sets — front
 * matter, chapter openings with their leaves, paragraphs with their marks,
 * headings, quotations, scene breaks, figures, plates, back matter — and
 * that is exactly what the spec's *intermediate representation* asks for.
 * So this module is a second reader of the same blocks: where the Layout
 * room measures them into pages at a trim, this writes them as XHTML that
 * the reader's device will flow however it likes. Nothing about a page
 * survives the journey — no folio, no running head, no blank verso, no
 * trim — and the log says so.
 *
 * One package for every store. What differs between stores is checked by
 * the preflight against `ebook-presets.ts`, never built twice here. And
 * the fixed-layout book (`ebook-fixed.ts`, §10) is a third reader — of the
 * *pages* rather than the blocks — that shares everything below the
 * content: the image bank, the cover, the accessibility reading and
 * `finishPackage`, which writes the navigation, the package document, the
 * container and the mimetype for either.
 */

// --------------------------------------------------------------- metadata

export interface EbookMetadata {
  title: string;
  authors: string[];
  language: string;
  identifier: { scheme: 'isbn' | 'uuid'; value: string; urn: string };
  publisher: string;
  published: string;
  description: string;
  rights: string;
  series: { name: string; number: string } | null;
  /** UTC, to the second, as EPUB wants it. */
  modified: string;
}

export type EbookLayout = 'reflowable' | 'fixed';

const splitAuthors = (author: string): string[] =>
  author
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((one) => one.trim())
    .filter((one) => one.length > 0);

const isoSeconds = (iso: string): string => `${iso.slice(0, 19)}Z`;

export const ebookMetadataOf = (file: ProjectFile, options: { modified?: string } = {}): EbookMetadata => {
  const settings = bookSettingsOf(file);
  const own: EbookSettings = settings.ebook;
  const titlePage = titlePageOf(file.project, file.settings);
  const isbn = own.isbn.replace(/[^0-9Xx]/g, '');
  return {
    title: bookNames(file).title.trim() || 'Untitled',
    authors: splitAuthors(bookNames(file).author),
    language: own.language.trim() || 'en-US',
    identifier: isbn.length > 0
      ? { scheme: 'isbn', value: isbn, urn: `urn:isbn:${isbn}` }
      : { scheme: 'uuid', value: file.project.id, urn: `urn:uuid:${file.project.id}` },
    publisher: (own.publisher || settings.imprint).trim(),
    published: own.published.trim(),
    description: (own.description || file.project.synopsis || file.project.logline).trim(),
    rights: own.rights.trim(),
    series: own.seriesName.trim().length > 0 ? { name: own.seriesName.trim(), number: own.seriesNumber.trim() } : null,
    modified: isoSeconds(options.modified ?? nowIso()),
  };
};

// ----------------------------------------------------------------- pieces

export interface EpubEntry {
  /** Inside the archive: `OEBPS/text/003-chapter.xhtml`. */
  path: string;
  mediaType: string;
  data: string | Uint8Array;
  /** Written uncompressed; the mimetype must be. */
  stored?: boolean;
  /** Its manifest id; absent for the three files outside the manifest. */
  id?: string;
  properties?: string;
}

export interface EbookSection {
  id: string;
  /** Relative to OEBPS: `text/003-chapter.xhtml`. */
  href: string;
  title: string;
  kind: 'cover' | 'front' | 'body' | 'chapter' | 'back';
  /** On a fixed-layout page: which side of the spread it is (§10). */
  spread?: 'left' | 'right' | 'center';
}

export interface EbookImage {
  id: string;
  href: string;
  mediaType: string;
  data: Uint8Array;
  /** As it came, for the preview, which shows the file without unzipping it. */
  dataUrl: string;
  /** The library picture it is, where it is one; the screen edits its description there. */
  assetId: string | null;
  alt: string;
  width: number;
  height: number;
  name: string;
  /** Whether a writer gave it a description. */
  described: boolean;
  /**
   * Whether the book still owes it one (§11): undescribed, and used
   * somewhere the writer did not mark decorative. The preflight asks this
   * rather than `described`, because an ornament needs no words.
   */
  needsDescription: boolean;
}

export interface EbookCover extends EbookImage {
  /** `cover.jpg` — what the file beside the package is called. */
  fileName: string;
}

export interface EbookNavItem {
  href: string;
  title: string;
}

export interface EbookPackage {
  metadata: EbookMetadata;
  rules: EbookRules;
  layout: EbookLayout;
  entries: EpubEntry[];
  sections: EbookSection[];
  images: EbookImage[];
  cover: EbookCover | null;
  /** The contents, as the navigation document lists them. */
  nav: EbookNavItem[];
  /** What was done to the book on the way, one sentence each. */
  log: string[];
  /** `The Lighthouse.epub` */
  fileName: string;
  /** Bytes before compression, for the size checks. */
  size: number;
  /** On a fixed-layout book: how many pages, and how many carry a picture. */
  pages: { count: number; pictured: number; width: number; height: number } | null;
}

export const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderSpans = (spans: InlineSpan[], text: string): string => {
  if (spans.length === 0) return escapeXml(text);
  return spans
    .map((span) => {
      const inner = escapeXml(span.text);
      if (!span.bold && !span.italic && !span.underline) return inner;
      const open = `${span.bold ? '<strong>' : ''}${span.italic ? '<em>' : ''}${span.underline ? '<span class="u">' : ''}`;
      const close = `${span.underline ? '</span>' : ''}${span.italic ? '</em>' : ''}${span.bold ? '</strong>' : ''}`;
      return `${open}${inner}${close}`;
    })
    .join('');
};

const lines = (text: string): string =>
  text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeXml(line)}</p>`)
    .join('');

/** A file name a filesystem and a zip both take: letters, digits, dashes. */
const LIGATURES: Record<string, string> = { æ: 'ae', Æ: 'AE', ø: 'o', Ø: 'O', œ: 'oe', Œ: 'OE', ß: 'ss', ð: 'd', Ð: 'D', þ: 'th', Þ: 'Th', ł: 'l', Ł: 'L', đ: 'd', Đ: 'D' };

export const safeName = (text: string, fallback = 'book'): string => {
  const slug = text
    // The letters a decomposition leaves alone, spelt out rather than dropped.
    .replace(/[æÆøØœŒßðÐþÞłŁđĐ]/g, (letter) => LIGATURES[letter] ?? letter)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug.length > 0 ? slug : fallback;
};

export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** A data URL's bytes and type; null where it is not one this can read. */
export const decodeDataUrl = (url: string): { mediaType: string; bytes: Uint8Array } | null => {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(url.trim());
  if (!match) return null;
  const mediaType = (match[1] as string).toLowerCase();
  if (!(mediaType in IMAGE_EXTENSIONS)) return null;
  try {
    const binary = atob((match[2] as string).replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { mediaType, bytes };
  } catch {
    return null;
  }
};

const EPUB_TYPES: Record<string, string> = {
  half_title: 'halftitlepage',
  title_page: 'titlepage',
  copyright: 'copyright-page',
  dedication: 'dedication',
  epigraph: 'epigraph',
  foreword: 'foreword',
  preface: 'preface',
  introduction: 'introduction',
  prologue: 'prologue',
  epilogue: 'epilogue',
  afterword: 'afterword',
  acknowledgements: 'acknowledgments',
  glossary: 'glossary',
  about_the_author: 'backmatter',
  also_by: 'backmatter',
};

// ------------------------------------------------------------ the pictures

export interface ImageBank {
  images: EbookImage[];
  /**
   * A picture by a key of the caller's, named in the order first used.
   * `meaningful` false is a decorative use, which asks for no description.
   */
  take(key: string, dataUrl: string, alt: string, name: string, width: number, height: number, described: boolean, meaningful?: boolean): EbookImage | null;
  /** A picture from the library, by asset id; the fallback is the alt where the asset has none. */
  asset(assetId: string | null | undefined, fallbackAlt: string, decorative?: boolean): EbookImage | null;
}

export const imageBank = (assets: ReadonlyMap<string, Asset>, log: string[]): ImageBank => {
  const images: EbookImage[] = [];
  const byKey = new Map<string, EbookImage>();
  const take: ImageBank['take'] = (key, dataUrl, alt, name, width, height, described, meaningful = true) => {
    const known = byKey.get(key);
    if (known) {
      if (meaningful && !known.described) known.needsDescription = true;
      return known;
    }
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) {
      log.push(`The picture "${name}" is in a form an eBook cannot carry and was left out.`);
      return null;
    }
    const index = images.length + 1;
    const image: EbookImage = {
      id: `img-${String(index).padStart(3, '0')}`,
      href: `images/img-${String(index).padStart(3, '0')}.${IMAGE_EXTENSIONS[decoded.mediaType]}`,
      mediaType: decoded.mediaType,
      data: decoded.bytes,
      dataUrl,
      assetId: key.startsWith('asset:') ? key.slice('asset:'.length) : null,
      alt,
      width,
      height,
      name,
      described,
      needsDescription: !described && meaningful,
    };
    images.push(image);
    byKey.set(key, image);
    return image;
  };
  const asset: ImageBank['asset'] = (assetId, fallbackAlt, decorative = false) => {
    if (!assetId) return null;
    const one = assets.get(assetId);
    if (!one || one.kind !== 'image' || one.data.length === 0) {
      log.push('A figure named a picture the library no longer holds and was left out.');
      return null;
    }
    const described = one.altText.trim().length > 0;
    return take(`asset:${assetId}`, one.data, described ? one.altText.trim() : fallbackAlt, one.name || 'picture', one.width, one.height, described, !decorative);
  };
  return { images, take, asset };
};

/** The cover: the chosen picture, or the project's key art, or none. */
export const coverOf = (
  file: ProjectFile,
  settings: BookSettings,
  assets: ReadonlyMap<string, Asset>,
  metadata: EbookMetadata,
  log: string[],
): EbookCover | null => {
  const coverAssetId = settings.ebook.coverAssetId ?? file.project.posterAssetId ?? null;
  if (!coverAssetId) return null;
  const asset = assets.get(coverAssetId as string);
  const decoded = asset && asset.kind === 'image' ? decodeDataUrl(asset.data) : null;
  if (!asset || !decoded) {
    log.push('The chosen cover is not a picture an eBook can carry and was left out.');
    return null;
  }
  const extension = IMAGE_EXTENSIONS[decoded.mediaType] as string;
  if (!settings.ebook.coverAssetId) log.push("The project's key art stands as the cover, no cover having been chosen.");
  return {
    id: 'cover-image',
    href: `images/cover.${extension}`,
    mediaType: decoded.mediaType,
    data: decoded.bytes,
    dataUrl: asset.data,
    assetId: asset.id as string,
    alt: `Cover of ${metadata.title}`,
    width: asset.width,
    height: asset.height,
    name: asset.name,
    described: true,
    needsDescription: false,
    fileName: `${safeName(metadata.title)}-cover.${extension}`,
  };
};

// ------------------------------------------------------- the document shell

/** An XHTML content document: escaped, closed, namespaced, the stylesheet linked. */
export const xhtmlDocument = (input: { lang: string; title: string; css: string; body: string; head?: string }): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(input.lang)}" lang="${escapeXml(input.lang)}">\n<head>\n<meta charset="utf-8"/>\n<title>${escapeXml(input.title)}</title>\n${input.head ?? ''}<link rel="stylesheet" type="text/css" href="${input.css}"/>\n</head>\n<body>\n${input.body}\n</body>\n</html>\n`;

/**
 * What the package may truthfully say about its own accessibility (§11).
 * Every claim is read off the package: the modes from whether there are
 * pictures, `alternativeText` only when no picture still owes a
 * description, `displayTransformability` only on a book the reader may
 * reflow, and the summary in words. No conformance claim is made — EPUB
 * Accessibility conformance is a certification of the whole book, which no
 * program that has not read it can give.
 */
export const accessibilityMeta = (images: readonly EbookImage[], cover: EbookCover | null, layout: EbookLayout): string => {
  const pictures = images.length > 0 || cover !== null;
  const allDescribed = images.every((image) => !image.needsDescription);
  const summary =
    layout === 'fixed'
      ? `Fixed layout: every page as laid, which the reader scales rather than reflows. ${pictures ? (allDescribed ? 'Every picture is described.' : 'Some pictures are not described.') : 'No pictures.'}`
      : `Reflowable text with a table of contents and real headings${
          !pictures ? '; no pictures.' : allDescribed ? '; every picture is described.' : '; some pictures are not described.'
        }`;
  return [
    `<meta property="schema:accessMode">textual</meta>`,
    pictures ? `<meta property="schema:accessMode">visual</meta>` : '',
    allDescribed ? `<meta property="schema:accessModeSufficient">textual</meta>` : '',
    `<meta property="schema:accessibilityFeature">tableOfContents</meta>`,
    `<meta property="schema:accessibilityFeature">readingOrder</meta>`,
    `<meta property="schema:accessibilityFeature">structuralNavigation</meta>`,
    layout === 'reflowable' ? `<meta property="schema:accessibilityFeature">displayTransformability</meta>` : '',
    pictures && allDescribed ? `<meta property="schema:accessibilityFeature">alternativeText</meta>` : '',
    `<meta property="schema:accessibilityHazard">none</meta>`,
    `<meta property="schema:accessibilitySummary">${escapeXml(summary)}</meta>`,
  ]
    .filter(Boolean)
    .join('\n');
};

export interface PackageDraft {
  metadata: EbookMetadata;
  rules: EbookRules;
  layout: EbookLayout;
  /** The reading order, without the navigation document (added here where it belongs in it). */
  sections: EbookSection[];
  /** The content documents, in the reading order, with their ids. */
  content: EpubEntry[];
  images: EbookImage[];
  cover: EbookCover | null;
  /** What the navigation document lists. */
  nav: EbookNavItem[];
  /** Where the body starts, for the landmarks. */
  firstBody: EbookSection | null;
  /** The navigation document stands in the reading order after the front matter, as a visible contents page. */
  navInSpine: boolean;
  /** The stylesheet: its path under OEBPS and its text. */
  css: { href: string; text: string };
  /** Package-level `rendition:` and other `meta` lines beyond the standard set. */
  extraMeta?: string[];
  log: string[];
  fileName: string;
  pages: EbookPackage['pages'];
}

/**
 * From the content to the package: the navigation document (and the EPUB 2
 * one where the store wants it), the stylesheet, the pictures, the package
 * document, the container and the mimetype, and the size.
 */
export const finishPackage = (draft: PackageDraft): EbookPackage => {
  const { metadata, rules, layout, images, cover, log } = draft;
  const lang = escapeXml(metadata.language);
  const sections = draft.sections.slice();
  const entries: EpubEntry[] = draft.content.slice();

  const navSection: EbookSection = { id: 'nav', href: 'toc.xhtml', title: 'Contents', kind: 'front' };
  if (draft.navInSpine) {
    const lastFront = sections.reduce((found, section, index) => (section.kind === 'front' ? index : found), -1);
    sections.splice(lastFront + 1, 0, navSection);
  }

  // ---- navigation
  const landmarks = [
    cover ? `<li><a epub:type="cover" href="text/000-cover.xhtml">Cover</a></li>` : '',
    draft.navInSpine ? `<li><a epub:type="toc" href="toc.xhtml">Contents</a></li>` : '',
    draft.firstBody ? `<li><a epub:type="bodymatter" href="${draft.firstBody.href}">${escapeXml(draft.firstBody.title)}</a></li>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const nav =
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">\n<head>\n<meta charset="utf-8"/>\n<title>Contents</title>\n<link rel="stylesheet" type="text/css" href="${draft.css.href}"/>\n</head>\n<body>\n` +
    `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${draft.nav.map((item) => `<li><a href="${item.href}">${escapeXml(item.title)}</a></li>`).join('\n')}\n</ol>\n</nav>\n` +
    `<nav epub:type="landmarks" hidden="hidden">\n<h1>Landmarks</h1>\n<ol>\n${landmarks}\n</ol>\n</nav>\n</body>\n</html>\n`;
  entries.push({ path: 'OEBPS/toc.xhtml', mediaType: 'application/xhtml+xml', id: 'nav', properties: 'nav', data: nav });

  if (rules.includeNcx) {
    const points = draft.nav
      .map(
        (item, index) =>
          `<navPoint id="np-${index + 1}" playOrder="${index + 1}"><navLabel><text>${escapeXml(item.title)}</text></navLabel><content src="${item.href}"/></navPoint>`,
      )
      .join('\n');
    entries.push({
      path: 'OEBPS/toc.ncx',
      mediaType: 'application/x-dtbncx+xml',
      id: 'ncx',
      data:
        `<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n<head>\n<meta name="dtb:uid" content="${escapeXml(metadata.identifier.urn)}"/>\n<meta name="dtb:depth" content="1"/>\n<meta name="dtb:totalPageCount" content="0"/>\n<meta name="dtb:maxPageNumber" content="0"/>\n</head>\n` +
        `<docTitle><text>${escapeXml(metadata.title)}</text></docTitle>\n<navMap>\n${points}\n</navMap>\n</ncx>\n`,
    });
  }

  // ---- stylesheet and pictures
  entries.push({ path: `OEBPS/${draft.css.href}`, mediaType: 'text/css', id: 'css', data: draft.css.text });
  for (const image of images) entries.push({ path: `OEBPS/${image.href}`, mediaType: image.mediaType, id: image.id, data: image.data });
  if (cover) entries.push({ path: `OEBPS/${cover.href}`, mediaType: cover.mediaType, id: cover.id, properties: 'cover-image', data: cover.data });

  // ---- the package document
  const creators = metadata.authors
    .map((author, index) => `<dc:creator id="creator-${index + 1}">${escapeXml(author)}</dc:creator>\n<meta refines="#creator-${index + 1}" property="role" scheme="marc:relators">aut</meta>`)
    .join('\n');
  const optional = [
    metadata.publisher ? `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>` : '',
    metadata.published ? `<dc:date>${escapeXml(metadata.published)}</dc:date>` : '',
    metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : '',
    metadata.rights ? `<dc:rights>${escapeXml(metadata.rights)}</dc:rights>` : '',
    metadata.series
      ? `<meta property="belongs-to-collection" id="series">${escapeXml(metadata.series.name)}</meta>\n<meta refines="#series" property="collection-type">series</meta>${
          metadata.series.number ? `\n<meta refines="#series" property="group-position">${escapeXml(metadata.series.number)}</meta>` : ''
        }`
      : '',
    cover ? `<meta name="cover" content="cover-image"/>` : '',
    ...(draft.extraMeta ?? []),
  ]
    .filter(Boolean)
    .join('\n');
  const manifest = entries
    .filter((entry) => entry.id)
    .map(
      (entry) =>
        `<item id="${entry.id}" href="${escapeXml(entry.path.replace(/^OEBPS\//, ''))}" media-type="${entry.mediaType}"${entry.properties ? ` properties="${entry.properties}"` : ''}/>`,
    )
    .join('\n');
  const spine = sections
    .map((section) => `<itemref idref="${section.id}"${section.spread ? ` properties="rendition:page-spread-${section.spread}"` : ''}/>`)
    .join('\n');
  const prefix = layout === 'fixed' ? ' prefix="rendition: http://www.idpf.org/vocab/rendition/#"' : '';
  const opf =
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${lang}"${prefix}>\n` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n<dc:identifier id="pub-id">${escapeXml(metadata.identifier.urn)}</dc:identifier>\n<dc:title id="title">${escapeXml(metadata.title)}</dc:title>\n${creators}\n<dc:language>${lang}</dc:language>\n<meta property="dcterms:modified">${escapeXml(metadata.modified)}</meta>\n${optional}\n${accessibilityMeta(images, cover, layout)}\n</metadata>\n` +
    `<manifest>\n${manifest}\n</manifest>\n<spine${rules.includeNcx ? ' toc="ncx"' : ''}>\n${spine}\n</spine>\n</package>\n`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n<rootfiles>\n<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n</rootfiles>\n</container>\n`;

  const all: EpubEntry[] = [
    { path: 'mimetype', mediaType: 'application/epub+zip', data: 'application/epub+zip', stored: true },
    { path: 'META-INF/container.xml', mediaType: 'application/xml', data: container },
    { path: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml', data: opf },
    ...entries,
  ];

  const encoder = new TextEncoder();
  const size = all.reduce((total, entry) => total + (typeof entry.data === 'string' ? encoder.encode(entry.data).length : entry.data.length), 0);

  return { metadata, rules, layout, entries: all, sections, images, cover, nav: draft.nav, log, fileName: draft.fileName, size, pages: draft.pages };
};

// ---------------------------------------------------------------- building

interface Draft {
  id: string;
  slug: string;
  title: string;
  kind: EbookSection['kind'];
  epubType: string;
  html: string[];
}

/**
 * Build the package: the blocks read into sections, the pictures pulled out
 * of their data URLs, the navigation, the package document and the
 * stylesheet. Deterministic but for `modified`: the same book gives the same
 * files with the same names, so a second export replaces the first cleanly.
 */
export const ebookOf = (file: ProjectFile, options: { modified?: string; target?: string } = {}): EbookPackage => {
  const settings = bookSettingsOf(file);
  const rules = ebookRulesFor(options.target ?? settings.ebook.target);
  const metadata = ebookMetadataOf(file, options);
  const titlePage = titlePageOf(file.project, file.settings);
  const log: string[] = [];
  const parts = new Map<string, BookPart>(partsOf(file).map((part) => [part.id, part]));
  const assets = new Map<string, Asset>(file.assets.map((asset) => [asset.id as string, asset]));
  const bank = imageBank(assets, log);
  const figure = (image: EbookImage | null, caption: string, cls: string, decorative = false): string => {
    if (!image) return '';
    const cap = caption.trim().length > 0 ? `<figcaption>${escapeXml(caption.trim())}</figcaption>` : '';
    const img = decorative
      ? `<img src="../${image.href}" alt="" role="presentation"/>`
      : `<img src="../${image.href}" alt="${escapeXml(image.alt)}"/>`;
    return `<figure class="${cls}">${img}${cap}</figure>`;
  };

  const cover = coverOf(file, settings, assets, metadata, log);

  // ---- the sections, from the blocks
  const drafts: Draft[] = [];
  let current = null as Draft | null;
  let chapters = 0;
  let opening: string | null = null;
  const openingClass = settings.opening === 'small_caps' ? ' opens-small-caps' : settings.opening === 'drop_cap' ? ' opens-drop' : '';
  const ornament = settings.ornament.trim() || '* * *';
  const begin = (draft: Omit<Draft, 'html'>) => {
    current = { ...draft, html: [] };
    drafts.push(current);
    return current;
  };
  const body = () => {
    if (!current) {
      current = begin({ id: 'body', slug: 'body', title: metadata.title, kind: 'body', epubType: 'bodymatter' });
      opening = openingClass;
    }
    return current;
  };

  const partOf = (block: BookBlock): BookPart | undefined => (block.partId ? parts.get(block.partId) : undefined);

  // An id must be an XML name: the default parts are named `default:kind`,
  // and a colon is not a character an id may carry.
  const partKey = (part: BookPart): string => `part-${safeName(part.id)}`;

  for (const block of bookBlocks(file)) {
    const part = partOf(block);
    if (part && (!current || current.id !== partKey(part))) {
      if (part.kind === 'contents') {
        log.push('The contents page is the navigation document, which readers also show as their own table of contents.');
        current = null;
        continue;
      }
      if (part.kind === 'index') {
        log.push('The index was left out: it is a list of page numbers, and a reflowable book has no pages.');
        current = null;
        continue;
      }
      const front = block.numbering === 'roman';
      begin({
        id: partKey(part),
        slug: safeName(part.kind.replace(/_/g, '-')),
        title: partTitle(part),
        // An art page is wherever it stands: facing a chapter it is body
        // matter, otherwise the half the writer put it in.
        kind: part.kind === 'plate' && part.beforeMarkerId ? 'body' : front ? 'front' : 'back',
        epubType:
          part.kind === 'plate' ? (part.beforeMarkerId ? 'bodymatter' : front ? 'frontmatter' : 'backmatter') : (EPUB_TYPES[part.kind] ?? (front ? 'frontmatter' : 'backmatter')),
      });
    } else if (part && current && current.id === partKey(part) && (part.kind === 'contents' || part.kind === 'index')) {
      continue;
    }
    if (!part && current && (current.kind === 'front' || current.kind === 'back') && block.kind !== 'chapter_opening') {
      // A body block after front matter, in a book with no chapter markers.
      current = null;
    }

    switch (block.kind) {
      case 'half_title':
        if (block.assetId && bank.asset(block.assetId, titlePage.title || metadata.title)) {
          current?.html.push(figure(bank.asset(block.assetId, titlePage.title || metadata.title), '', 'title-art'));
          break;
        }
        current?.html.push(`<h1 class="book-title">${escapeXml(titlePage.title || metadata.title)}</h1>`);
        break;
      case 'title_page': {
        // A title page brought in whole as art (addendum 20 §8) is the
        // picture alone; the words are in it.
        if (block.assetId && bank.asset(block.assetId, titlePage.title || metadata.title)) {
          current?.html.push(figure(bank.asset(block.assetId, titlePage.title || metadata.title), '', 'title-art'));
          break;
        }
        const art = titlePage.titleImage
          ? figure(bank.take('title-art', titlePage.titleImage, titlePage.title || metadata.title, 'title art', 0, 0, true), '', 'title-art')
          : `<h1 class="book-title">${escapeXml(titlePage.title || metadata.title)}</h1>`;
        const subtitle = (titlePage.episode ?? '').trim().length > 0 ? `<p class="subtitle">${escapeXml(titlePage.episode)}</p>` : '';
        const author = metadata.authors.length > 0 ? `<p class="author">${escapeXml(metadata.authors.join(', '))}</p>` : '';
        const imprint = metadata.publisher ? `<p class="imprint">${escapeXml(metadata.publisher)}</p>` : '';
        current?.html.push(`${art}${subtitle}${author}${imprint}`);
        break;
      }
      case 'copyright': {
        const text = block.text.trim().length > 0 ? block.text : metadata.rights || `Copyright © ${metadata.authors.join(', ')}`.trim();
        current?.html.push(`<div class="copyright">${lines(text)}</div>`);
        break;
      }
      case 'part_opening':
        if (block.display) current?.html.push(`<div class="words">${lines(block.text)}</div>`);
        else current?.html.push(`<h1 class="part-title">${escapeXml(block.title ?? current.title)}</h1>`);
        break;
      case 'plate':
        current?.html.push(figure(bank.asset(block.assetId, block.caption ?? ''), block.caption ?? '', 'plate'));
        break;
      case 'chapter_opening': {
        chapters += 1;
        const leaf = block.chapter;
        const label = leaf?.label ?? '';
        const name = leaf?.title ?? block.title ?? '';
        const title = name || label || `Chapter ${chapters}`;
        const draft = begin({
          id: `chapter-${String(chapters).padStart(3, '0')}`,
          slug: 'chapter',
          title,
          kind: 'chapter',
          epubType: 'chapter',
        });
        const head =
          label && name
            ? `<h1 class="chapter-title"><span class="chapter-label">${escapeXml(label)}</span><br/><span class="chapter-name">${escapeXml(name)}</span></h1>`
            : `<h1 class="chapter-title">${escapeXml(title)}</h1>`;
        // Full-page art (addendum 19 §7) goes before the heading, at the
        // width of the screen: a reflowable book has no page to fill, so the
        // art leads and the heading follows it for the reader who cannot see.
        const art = leaf && isFullPageArt(leaf) && leaf.image
          ? bank.take(`device:${draft.id}`, leaf.image.dataUrl, leaf.image.name || 'chapter art', leaf.image.name || 'art', 0, 0, false, false)
          : null;
        if (art) draft.html.push(`<p class="device full-art"><img src="../${art.href}" alt="" role="presentation"/></p>`);
        draft.html.push(head);
        if (leaf?.image && !art) {
          // A chapter device is an ornament: it asks for no description.
          const device = bank.take(`device:${draft.id}`, leaf.image.dataUrl, leaf.image.name || 'chapter device', leaf.image.name || 'device', 0, 0, false, false);
          if (device) draft.html.push(`<p class="device"><img src="../${device.href}" alt="" role="presentation"/></p>`);
        }
        if (leaf?.epigraph.trim()) draft.html.push(`<blockquote class="epigraph">${lines(leaf.epigraph)}</blockquote>`);
        if (leaf?.summary.trim()) draft.html.push(`<p class="summary">${escapeXml(leaf.summary.trim())}</p>`);
        opening = openingClass;
        break;
      }
      case 'paragraph': {
        const draft = body();
        const first = opening !== null ? ` first${opening}` : '';
        opening = null;
        const align = block.align ? ` ${block.align}` : '';
        let inset = '';
        if (block.inset) {
          const image = bank.asset(block.inset.assetId, block.inset.caption || 'figure', block.inset.decorative);
          if (image) {
            const cap = block.inset.caption.trim() ? `<span class="cap">${escapeXml(block.inset.caption.trim())}</span>` : '';
            const img = block.inset.decorative ? `<img src="../${image.href}" alt="" role="presentation"/>` : `<img src="../${image.href}" alt="${escapeXml(image.alt)}"/>`;
            inset = `<span class="inset inset-${block.inset.place}" style="width:${Math.round(block.inset.span * 100)}%">${img}${cap}</span>`;
          }
        }
        draft.html.push(`<p class="p${first}${align}">${inset}${renderSpans(block.spans, block.text)}</p>`);
        break;
      }
      case 'heading':
        body().html.push(`<h2 class="heading">${renderSpans(block.spans, block.text)}</h2>`);
        break;
      case 'blockquote':
        body().html.push(`<blockquote><p>${renderSpans(block.spans, block.text)}</p></blockquote>`);
        break;
      case 'scene_break':
        // A separator that reads as one, never an empty paragraph or three.
        current?.html.push(`<p class="break" role="separator" aria-label="Scene break">${escapeXml(ornament)}</p>`);
        opening = null;
        break;
      case 'figure':
        body().html.push(figure(bank.asset(block.assetId, block.caption ?? 'figure', block.decorative), block.caption ?? '', 'figure', block.decorative));
        break;
      case 'contents':
      case 'index':
        break;
      default:
        break;
    }
  }

  const kept = drafts.filter((draft) => draft.html.join('').trim().length > 0);
  const sections: EbookSection[] = [];
  const content: EpubEntry[] = [];

  if (cover) {
    sections.push({ id: 'cover', href: 'text/000-cover.xhtml', title: 'Cover', kind: 'cover' });
    content.push({
      path: 'OEBPS/text/000-cover.xhtml',
      mediaType: 'application/xhtml+xml',
      id: 'cover',
      data: xhtmlDocument({
        lang: metadata.language,
        title: 'Cover',
        css: '../css/book.css',
        body: `<section epub:type="cover" id="cover"><img class="cover" src="../${cover.href}" alt="${escapeXml(cover.alt)}"/></section>`,
      }),
    });
  }
  kept.forEach((draft, index) => {
    const href = `text/${String(index + 1).padStart(3, '0')}-${draft.slug}.xhtml`;
    sections.push({ id: draft.id, href, title: draft.title, kind: draft.kind });
    content.push({
      path: `OEBPS/${href}`,
      mediaType: 'application/xhtml+xml',
      id: draft.id,
      data: xhtmlDocument({
        lang: metadata.language,
        title: draft.title,
        css: '../css/book.css',
        body: `<section epub:type="${draft.epubType}" id="${draft.id}">\n${draft.html.join('\n')}\n</section>`,
      }),
    });
  });

  log.unshift(
    'Page numbers, running heads and blank versos were left out: a reflowable book has no pages.',
    `The trim (${trimOf(settings, file.project.format).width} × ${trimOf(settings, file.project.format).height} in) and margins were ignored; the reader sets the page.`,
    'The face and size are the reader’s; no font was embedded.',
  );

  const listed = sections.filter((section) => section.kind !== 'cover');
  return finishPackage({
    metadata,
    rules,
    layout: 'reflowable',
    sections,
    content,
    images: bank.images,
    cover,
    nav: listed.map((section) => ({ href: section.href, title: section.title })),
    firstBody: sections.find((section) => section.kind === 'chapter' || section.kind === 'body') ?? null,
    navInSpine: true,
    css: { href: 'css/book.css', text: EBOOK_CSS },
    log,
    fileName: `${safeName(metadata.title)}.epub`,
    pages: null,
  });
};

/** The package as bytes: the mimetype first and stored, the rest deflated. */
export const epubBytes = async (pkg: EbookPackage): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const at = new Date(pkg.metadata.modified);
  return writeZip(
    pkg.entries.map((entry) => ({
      path: entry.path,
      data: typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data,
      ...(entry.stored ? { stored: true } : {}),
    })),
    Number.isNaN(at.getTime()) ? new Date(0) : at,
  );
};

export const EBOOK_CSS = `/* VC Writer eBook stylesheet: small, relative, the reader's own face and size left alone. */
body { margin: 0; padding: 0 3%; }
h1, h2 { text-align: center; font-weight: normal; page-break-after: avoid; }
h1.book-title { font-size: 2em; margin: 3em 0 1em; }
p.author { text-align: center; font-size: 1.2em; margin: 1em 0; }
p.imprint { text-align: center; font-size: 0.9em; margin-top: 4em; }
h1.chapter-title, h1.part-title { font-size: 1.6em; margin: 3em 0 1.5em; }
.chapter-label { display: block; font-size: 0.7em; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 0.6em; }
.chapter-name { display: block; }
p.device { text-align: center; margin: 1em 0; }
p.device img { max-width: 40%; height: auto; }
blockquote.epigraph { margin: 1em 15% 2em; font-style: italic; font-size: 0.95em; }
p.summary { margin: 0 8% 2em; font-style: italic; }
p.p { margin: 0; text-indent: 1.3em; text-align: justify; }
p.p.first { text-indent: 0; }
p.p.opens-small-caps::first-line { font-variant: small-caps; }
p.p.opens-drop::first-letter { font-size: 3em; float: left; line-height: 0.8; margin: 0.05em 0.1em 0 0; }
p.p.center { text-align: center; text-indent: 0; }
p.p.right { text-align: right; text-indent: 0; }
h2.heading { font-size: 1.2em; margin: 2em 0 1em; }
blockquote { margin: 1em 8%; }
blockquote p { text-indent: 0; }
p.break { text-align: center; margin: 1.5em 0; text-indent: 0; }
figure { margin: 1.5em 0; text-align: center; page-break-inside: avoid; }
.inset { float: left; margin: 0.2em 1em 0.3em 0; }
.inset-right { float: right; margin: 0.2em 0 0.3em 1em; }
.inset img { display: block; width: 100%; height: auto; }
.inset .cap { display: block; font-size: 0.8em; text-align: center; margin-top: 0.3em; }
figure img { max-width: 100%; height: auto; }
figcaption { font-size: 0.85em; margin-top: 0.5em; }
img.cover { max-width: 100%; max-height: 100%; margin: 0 auto; display: block; }
.words p { text-align: center; text-indent: 0; margin: 0.3em 0; }
.words { margin-top: 30%; }
.copyright p { font-size: 0.85em; text-indent: 0; margin: 0.2em 0; }
.u { text-decoration: underline; }
`;
