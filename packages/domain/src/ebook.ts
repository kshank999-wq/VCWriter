import { bookBlocks, partsOf, partTitle, type BookBlock } from './book-plan.js';
import { bookSettingsOf, trimOf } from './book-layout.js';
import { parseInline, type InlineSpan } from './entities/inline.js';
import { titlePageOf } from './entities/title-page.js';
import { nowIso } from './entities/common.js';
import { ebookRulesFor, type EbookRules } from './ebook-presets.js';
import { writeZip } from './zip-write.js';
import type { ProjectFile } from './project-file.js';
import type { BookPart, EbookSettings } from './entities/book.js';
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
 * the preflight against `ebook-presets.ts`, never built twice here.
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
    title: (titlePage.title || file.project.title).trim() || 'Untitled',
    authors: splitAuthors(titlePage.author || file.project.author),
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
}

export interface EbookImage {
  id: string;
  href: string;
  mediaType: string;
  data: Uint8Array;
  alt: string;
  width: number;
  height: number;
  name: string;
  /** Whether a writer gave it a description; the preflight asks. */
  described: boolean;
}

export interface EbookCover extends EbookImage {
  /** `cover.jpg` — what the file beside the package is called. */
  fileName: string;
}

export interface EbookPackage {
  metadata: EbookMetadata;
  rules: EbookRules;
  entries: EpubEntry[];
  sections: EbookSection[];
  images: EbookImage[];
  cover: EbookCover | null;
  /** What was done to the book on the way, one sentence each. */
  log: string[];
  /** `The Lighthouse.epub` */
  fileName: string;
  /** Bytes before compression, for the size checks. */
  size: number;
}

const escapeXml = (value: string): string =>
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
export const safeName = (text: string, fallback = 'book'): string => {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug.length > 0 ? slug : fallback;
};

const EXTENSIONS: Record<string, string> = {
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
  if (!(mediaType in EXTENSIONS)) return null;
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
  plate: 'bodymatter',
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

  // ---- pictures, named in the order they are first used
  const images: EbookImage[] = [];
  const imageByKey = new Map<string, EbookImage>();
  const takeImage = (key: string, dataUrl: string, alt: string, name: string, width: number, height: number, described: boolean): EbookImage | null => {
    const known = imageByKey.get(key);
    if (known) return known;
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) {
      log.push(`The picture "${name}" is in a form an eBook cannot carry and was left out.`);
      return null;
    }
    const index = images.length + 1;
    const image: EbookImage = {
      id: `img-${String(index).padStart(3, '0')}`,
      href: `images/img-${String(index).padStart(3, '0')}.${EXTENSIONS[decoded.mediaType]}`,
      mediaType: decoded.mediaType,
      data: decoded.bytes,
      alt,
      width,
      height,
      name,
      described,
    };
    images.push(image);
    imageByKey.set(key, image);
    return image;
  };
  const assetImage = (assetId: string | null | undefined, fallbackAlt: string): EbookImage | null => {
    if (!assetId) return null;
    const asset = assets.get(assetId);
    if (!asset || asset.kind !== 'image' || asset.data.length === 0) {
      log.push('A figure named a picture the library no longer holds and was left out.');
      return null;
    }
    const described = asset.altText.trim().length > 0;
    return takeImage(`asset:${assetId}`, asset.data, described ? asset.altText.trim() : fallbackAlt, asset.name || 'picture', asset.width, asset.height, described);
  };
  const figure = (image: EbookImage | null, caption: string, cls: string): string => {
    if (!image) return '';
    const cap = caption.trim().length > 0 ? `<figcaption>${escapeXml(caption.trim())}</figcaption>` : '';
    return `<figure class="${cls}"><img src="../${image.href}" alt="${escapeXml(image.alt)}"/>${cap}</figure>`;
  };

  // ---- the cover
  let cover: EbookCover | null = null;
  const coverAssetId = settings.ebook.coverAssetId ?? file.project.posterAssetId ?? null;
  if (coverAssetId) {
    const asset = assets.get(coverAssetId as string);
    const decoded = asset && asset.kind === 'image' ? decodeDataUrl(asset.data) : null;
    if (asset && decoded) {
      const extension = EXTENSIONS[decoded.mediaType] as string;
      cover = {
        id: 'cover-image',
        href: `images/cover.${extension}`,
        mediaType: decoded.mediaType,
        data: decoded.bytes,
        alt: `Cover of ${metadata.title}`,
        width: asset.width,
        height: asset.height,
        name: asset.name,
        described: true,
        fileName: `${safeName(metadata.title)}-cover.${extension}`,
      };
      if (!settings.ebook.coverAssetId) log.push("The project's key art stands as the cover, no cover having been chosen.");
    } else {
      log.push('The chosen cover is not a picture an eBook can carry and was left out.');
    }
  }

  // ---- the sections, from the blocks
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let chapters = 0;
  let opening: string | null = null;
  const openingClass = settings.opening === 'small_caps' ? ' opens-small-caps' : settings.opening === 'drop_cap' ? ' opens-drop' : '';
  const ornament = settings.ornament.trim() || '* * *';
  const begin = (draft: Omit<Draft, 'html'>) => {
    current = { ...draft, html: [] };
    drafts.push(current);
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
        kind: part.kind === 'plate' ? 'body' : front ? 'front' : 'back',
        epubType: EPUB_TYPES[part.kind] ?? (front ? 'frontmatter' : 'backmatter'),
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
        current?.html.push(`<h1 class="book-title">${escapeXml(titlePage.title || metadata.title)}</h1>`);
        break;
      case 'title_page': {
        const art = titlePage.titleImage
          ? figure(takeImage('title-art', titlePage.titleImage, titlePage.title || metadata.title, 'title art', 0, 0, true), '', 'title-art')
          : `<h1 class="book-title">${escapeXml(titlePage.title || metadata.title)}</h1>`;
        const author = metadata.authors.length > 0 ? `<p class="author">${escapeXml(metadata.authors.join(', '))}</p>` : '';
        const imprint = metadata.publisher ? `<p class="imprint">${escapeXml(metadata.publisher)}</p>` : '';
        current?.html.push(`${art}${author}${imprint}`);
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
        current?.html.push(figure(assetImage(block.assetId, block.caption ?? ''), block.caption ?? '', 'plate'));
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
        draft.html.push(head);
        if (leaf?.image) {
          const device = takeImage(`device:${draft.id}`, leaf.image.dataUrl, leaf.image.name || 'chapter device', leaf.image.name || 'device', 0, 0, false);
          if (device) draft.html.push(`<p class="device"><img src="../${device.href}" alt="${escapeXml(device.alt)}"/></p>`);
        }
        if (leaf?.epigraph.trim()) draft.html.push(`<blockquote class="epigraph">${lines(leaf.epigraph)}</blockquote>`);
        if (leaf?.summary.trim()) draft.html.push(`<p class="summary">${escapeXml(leaf.summary.trim())}</p>`);
        opening = openingClass;
        break;
      }
      case 'paragraph': {
        if (!current) {
          current = begin({ id: 'body', slug: 'body', title: metadata.title, kind: 'body', epubType: 'bodymatter' });
          opening = openingClass;
        }
        const first = opening !== null ? ` first${opening}` : '';
        opening = null;
        const align = block.align ? ` ${block.align}` : '';
        current.html.push(`<p class="p${first}${align}">${renderSpans(block.spans, block.text)}</p>`);
        break;
      }
      case 'heading':
        if (!current) current = begin({ id: 'body', slug: 'body', title: metadata.title, kind: 'body', epubType: 'bodymatter' });
        current.html.push(`<h2 class="heading">${renderSpans(block.spans, block.text)}</h2>`);
        break;
      case 'blockquote':
        if (!current) current = begin({ id: 'body', slug: 'body', title: metadata.title, kind: 'body', epubType: 'bodymatter' });
        current.html.push(`<blockquote><p>${renderSpans(block.spans, block.text)}</p></blockquote>`);
        break;
      case 'scene_break':
        // A separator that reads as one, never an empty paragraph or three.
        current?.html.push(`<p class="break" role="separator" aria-label="Scene break">${escapeXml(ornament)}</p>`);
        opening = null;
        break;
      case 'figure':
        if (!current) current = begin({ id: 'body', slug: 'body', title: metadata.title, kind: 'body', epubType: 'bodymatter' });
        current.html.push(figure(assetImage(block.assetId, block.caption ?? 'figure'), block.caption ?? '', 'figure'));
        break;
      case 'contents':
      case 'index':
        break;
      default:
        break;
    }
  }

  const kept = drafts.filter((draft) => draft.html.join('').trim().length > 0);
  const lang = escapeXml(metadata.language);
  const xhtml = (title: string, body: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">\n<head>\n<meta charset="utf-8"/>\n<title>${escapeXml(title)}</title>\n<link rel="stylesheet" type="text/css" href="../css/book.css"/>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

  const sections: EbookSection[] = [];
  const entries: EpubEntry[] = [];

  if (cover) {
    sections.push({ id: 'cover', href: 'text/000-cover.xhtml', title: 'Cover', kind: 'cover' });
    entries.push({
      path: 'OEBPS/text/000-cover.xhtml',
      mediaType: 'application/xhtml+xml',
      id: 'cover',
      data: xhtml('Cover', `<section epub:type="cover" id="cover"><img class="cover" src="../${cover.href}" alt="${escapeXml(cover.alt)}"/></section>`),
    });
  }
  kept.forEach((draft, index) => {
    const href = `text/${String(index + 1).padStart(3, '0')}-${draft.slug}.xhtml`;
    sections.push({ id: draft.id, href, title: draft.title, kind: draft.kind });
    entries.push({
      path: `OEBPS/${href}`,
      mediaType: 'application/xhtml+xml',
      id: draft.id,
      data: xhtml(draft.title, `<section epub:type="${draft.epubType}" id="${draft.id}">\n${draft.html.join('\n')}\n</section>`),
    });
  });

  // The navigation document stands in the reading order after the front
  // matter, as the visible contents page: a landmark may only point at a
  // page a reader can turn to.
  const lastFront = sections.reduce((found, section, index) => (section.kind === 'front' ? index : found), -1);
  const navSection: EbookSection = { id: 'nav', href: 'toc.xhtml', title: 'Contents', kind: 'front' };
  sections.splice(lastFront + 1, 0, navSection);

  // ---- navigation
  const listed = sections.filter((section) => section.kind !== 'cover' && section.id !== 'nav');
  const firstBody = sections.find((section) => section.kind === 'chapter' || section.kind === 'body');
  const landmarks = [
    cover ? `<li><a epub:type="cover" href="text/000-cover.xhtml">Cover</a></li>` : '',
    `<li><a epub:type="toc" href="toc.xhtml">Contents</a></li>`,
    firstBody ? `<li><a epub:type="bodymatter" href="${firstBody.href}">${escapeXml(firstBody.title)}</a></li>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const nav =
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">\n<head>\n<meta charset="utf-8"/>\n<title>Contents</title>\n<link rel="stylesheet" type="text/css" href="css/book.css"/>\n</head>\n<body>\n` +
    `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${listed.map((section) => `<li><a href="${section.href}">${escapeXml(section.title)}</a></li>`).join('\n')}\n</ol>\n</nav>\n` +
    `<nav epub:type="landmarks" hidden="hidden">\n<h1>Landmarks</h1>\n<ol>\n${landmarks}\n</ol>\n</nav>\n</body>\n</html>\n`;
  entries.push({ path: 'OEBPS/toc.xhtml', mediaType: 'application/xhtml+xml', id: 'nav', properties: 'nav', data: nav });

  if (rules.includeNcx) {
    const points = listed
      .map(
        (section, index) =>
          `<navPoint id="np-${index + 1}" playOrder="${index + 1}"><navLabel><text>${escapeXml(section.title)}</text></navLabel><content src="${section.href}"/></navPoint>`,
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

  // ---- stylesheet: small, relative, the reader's face left alone
  entries.push({ path: 'OEBPS/css/book.css', mediaType: 'text/css', id: 'css', data: EBOOK_CSS });

  // ---- pictures
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
  ]
    .filter(Boolean)
    .join('\n');
  const everyImageDescribed = images.every((image) => image.described);
  const access = [
    `<meta property="schema:accessMode">textual</meta>`,
    images.length > 0 || cover ? `<meta property="schema:accessMode">visual</meta>` : '',
    `<meta property="schema:accessModeSufficient">textual</meta>`,
    `<meta property="schema:accessibilityFeature">tableOfContents</meta>`,
    `<meta property="schema:accessibilityFeature">readingOrder</meta>`,
    images.length > 0 && everyImageDescribed ? `<meta property="schema:accessibilityFeature">alternativeText</meta>` : '',
    `<meta property="schema:accessibilityHazard">none</meta>`,
    `<meta property="schema:accessibilitySummary">${escapeXml(
      images.length === 0
        ? 'Text with a table of contents; no images.'
        : everyImageDescribed
          ? 'Text with a table of contents; every image is described.'
          : 'Text with a table of contents; some images are not described.',
    )}</meta>`,
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
  const spine = sections.map((section) => `<itemref idref="${section.id}"/>`).join('\n');
  const opf =
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${lang}">\n` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n<dc:identifier id="pub-id">${escapeXml(metadata.identifier.urn)}</dc:identifier>\n<dc:title id="title">${escapeXml(metadata.title)}</dc:title>\n${creators}\n<dc:language>${lang}</dc:language>\n<meta property="dcterms:modified">${escapeXml(metadata.modified)}</meta>\n${optional}\n${access}\n</metadata>\n` +
    `<manifest>\n${manifest}\n</manifest>\n<spine${rules.includeNcx ? ' toc="ncx"' : ''}>\n${spine}\n</spine>\n</package>\n`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n<rootfiles>\n<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n</rootfiles>\n</container>\n`;

  const all: EpubEntry[] = [
    { path: 'mimetype', mediaType: 'application/epub+zip', data: 'application/epub+zip', stored: true },
    { path: 'META-INF/container.xml', mediaType: 'application/xml', data: container },
    { path: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml', data: opf },
    ...entries,
  ];

  log.unshift(
    'Page numbers, running heads and blank versos were left out: a reflowable book has no pages.',
    `The trim (${trimOf(settings, file.project.format).width} × ${trimOf(settings, file.project.format).height} in) and margins were ignored; the reader sets the page.`,
    'The face and size are the reader’s; no font was embedded.',
  );

  const encoder = new TextEncoder();
  const size = all.reduce((total, entry) => total + (typeof entry.data === 'string' ? encoder.encode(entry.data).length : entry.data.length), 0);

  return {
    metadata,
    rules,
    entries: all,
    sections,
    images,
    cover,
    log,
    fileName: `${safeName(metadata.title)}.epub`,
    size,
  };
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
figure img { max-width: 100%; height: auto; }
figcaption { font-size: 0.85em; margin-top: 0.5em; }
img.cover { max-width: 100%; max-height: 100%; margin: 0 auto; display: block; }
.words p { text-align: center; text-indent: 0; margin: 0.3em 0; }
.words { margin-top: 30%; }
.copyright p { font-size: 0.85em; text-indent: 0; margin: 0.2em 0; }
.u { text-decoration: underline; }
`;
