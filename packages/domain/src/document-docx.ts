import { writeZip } from './zip-write.js';
import { pageSize } from './document.js';
import { headingNumbers } from './document-outline.js';
import { BAND_SLOTS, printedDate } from './document-pages.js';
import type { DocMark, DocNode, DocumentBand, WpDocument } from './entities/document.js';

/**
 * **A document as a Word file** (addendum 42 §4, spec §4.1 and §7.2).
 *
 * The editor's tree written as WordprocessingML, by hand, for the same reason
 * `docx-export.ts` is: the format is XML in a zip, and a library would be
 * the larger thing to ship and to trust. What Word cannot be told is left
 * out rather than faked. What it can be told is told in Word's own terms:
 * headings are Heading 1–6, quotes are Quote, a bulleted list is a real Word
 * list that goes on numbering when someone adds to it, and a table is a
 * table.
 *
 * Not carried: a merged cell's rows (`rowspan`) are written as separate
 * cells, and fonts are named but not embedded. Both are listed in the
 * addendum's limits.
 */

const TWIPS_PER_INCH = 1440;
const EMU_PER_INCH = 914400;
const EMU_PER_PX = EMU_PER_INCH / 96;

const xml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Characters XML 1.0 forbids outright. Word refuses a file that has one.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

// --------------------------------------------------------------- the parts

interface Picture {
  rid: string;
  path: string;
  data: Uint8Array;
  extension: string;
  widthPx: number;
  heightPx: number;
}

interface Link {
  rid: string;
  href: string;
}

/** What the walk gathers beside the XML: pictures, links and list instances. */
interface Context {
  pictures: Picture[];
  links: Link[];
  /** One Word list instance per list in the document, so each numbers from 1. */
  lists: { numId: number; abstract: ListKind; start: number }[];
  contentWidthIn: number;
  /** Each heading's number under the document's scheme, by heading id (addendum 42 §14). */
  headingNumbers: ReadonlyMap<string, string>;
}

type ListKind = 'bullet' | 'decimal' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman';

const LIST_ABSTRACT: Record<ListKind, number> = {
  bullet: 1,
  decimal: 2,
  lowerLetter: 3,
  upperLetter: 4,
  lowerRoman: 5,
  upperRoman: 6,
};

/** An ordered list's `type`, as HTML spells it, to Word's number format. */
const orderedKind = (type: unknown): ListKind => {
  switch (type) {
    case 'a':
      return 'lowerLetter';
    case 'A':
      return 'upperLetter';
    case 'i':
      return 'lowerRoman';
    case 'I':
      return 'upperRoman';
    default:
      return 'decimal';
  }
};

// ----------------------------------------------------------------- inline

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** A CSS colour to Word's six hex digits, or null for anything else. */
export const wordColour = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const hex = HEX.exec(value.trim());
  if (hex) {
    const digits = hex[1] as string;
    return (digits.length === 3 ? digits.replace(/./g, (c) => c + c) : digits).toUpperCase();
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value.trim());
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return null;
};

/** A CSS size (`12pt`, `16px`) to Word's half-points, or null. */
export const halfPoints = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = /^([\d.]+)\s*(pt|px)?$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const points = (match[2] ?? 'pt').toLowerCase() === 'px' ? (amount * 72) / 96 : amount;
  return Math.round(points * 2);
};

const firstFamily = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return (value.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '') || null;
};

const runProperties = (marks: readonly DocMark[]): string => {
  const parts: string[] = [];
  const has = (type: string) => marks.some((mark) => mark.type === type);
  const style = marks.find((mark) => mark.type === 'textStyle')?.attrs ?? {};
  const family = firstFamily(style['fontFamily']);
  if (family) parts.push(`<w:rFonts w:ascii="${xml(family)}" w:hAnsi="${xml(family)}" w:cs="${xml(family)}"/>`);
  if (has('bold')) parts.push('<w:b/>');
  if (has('italic')) parts.push('<w:i/>');
  if (has('strike')) parts.push('<w:strike/>');
  if (has('code')) parts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  const colour = wordColour(style['color']);
  if (colour) parts.push(`<w:color w:val="${colour}"/>`);
  const size = halfPoints(style['fontSize']);
  if (size) parts.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
  if (has('underline') || has('link')) parts.push('<w:u w:val="single"/>');
  const highlight = marks.find((mark) => mark.type === 'highlight');
  if (highlight) {
    const fill = wordColour(highlight.attrs?.['color']) ?? 'FFFF00';
    parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`);
  }
  if (has('superscript')) parts.push('<w:vertAlign w:val="superscript"/>');
  else if (has('subscript')) parts.push('<w:vertAlign w:val="subscript"/>');
  return parts.length ? `<w:rPr>${parts.join('')}</w:rPr>` : '';
};

const textRun = (text: string, marks: readonly DocMark[]): string =>
  `<w:r>${runProperties(marks)}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;

/** Reads the pixel size a PNG, GIF or JPEG declares, so a picture keeps its shape. */
export const pictureSize = (bytes: Uint8Array): { width: number; height: number } | null => {
  const at = (index: number) => bytes[index] ?? 0;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    const width = (at(16) << 24) | (at(17) << 16) | (at(18) << 8) | at(19);
    const height = (at(20) << 24) | (at(21) << 16) | (at(22) << 8) | at(23);
    return { width, height };
  }
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) {
    return { width: at(6) | (at(7) << 8), height: at(8) | (at(9) << 8) };
  }
  if (at(0) === 0xff && at(1) === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (at(offset) !== 0xff) return null;
      const marker = at(offset + 1);
      const length = (at(offset + 2) << 8) | at(offset + 3);
      // Start-of-frame markers carry the size; DHT, JPG and DAC do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (at(offset + 5) << 8) | at(offset + 6), width: (at(offset + 7) << 8) | at(offset + 8) };
      }
      offset += 2 + length;
    }
  }
  return null;
};

const decodeDataUrl = (src: string): { bytes: Uint8Array; extension: string } | null => {
  const match = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(src);
  if (!match) return null;
  const binary = atob(match[2] as string);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const kind = (match[1] as string).toLowerCase();
  return { bytes, extension: kind === 'jpg' ? 'jpeg' : kind };
};

const pictureRun = (node: DocNode, context: Context): string => {
  const src = String(node.attrs?.['src'] ?? '');
  const decoded = decodeDataUrl(src);
  // A picture only linked from the web is not in the document to be written.
  // Its alt text stands in so the reader still knows something was there.
  if (!decoded) {
    const alt = String(node.attrs?.['alt'] ?? '');
    return alt ? textRun(`[${alt}]`, []) : '';
  }
  const index = context.pictures.length + 1;
  const natural = pictureSize(decoded.bytes) ?? { width: 600, height: 400 };
  const askedWidth = Number(node.attrs?.['width']);
  let widthPx = Number.isFinite(askedWidth) && askedWidth > 0 ? askedWidth : natural.width;
  let heightPx = (natural.height / Math.max(1, natural.width)) * widthPx;
  const maxPx = context.contentWidthIn * 96;
  if (widthPx > maxPx) {
    heightPx = (heightPx * maxPx) / widthPx;
    widthPx = maxPx;
  }
  const picture: Picture = {
    rid: `rIdPic${index}`,
    path: `media/image${index}.${decoded.extension}`,
    data: decoded.bytes,
    extension: decoded.extension,
    widthPx,
    heightPx,
  };
  context.pictures.push(picture);
  const cx = Math.round(widthPx * EMU_PER_PX);
  const cy = Math.round(heightPx * EMU_PER_PX);
  const name = xml(String(node.attrs?.['alt'] ?? `Picture ${index}`));
  return (
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${index}" name="${name}" descr="${name}"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${index}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${picture.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  );
};

/** The runs of a paragraph or heading, links grouped into Word hyperlinks. */
const inlineXml = (nodes: readonly DocNode[], context: Context): string => {
  let out = '';
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index] as DocNode;
    const link = node.marks?.find((mark) => mark.type === 'link');
    if (node.type === 'text' && link) {
      const href = String(link.attrs?.['href'] ?? '');
      let runs = '';
      while (index < nodes.length) {
        const next = nodes[index] as DocNode;
        const nextLink = next.marks?.find((mark) => mark.type === 'link');
        if (next.type !== 'text' || String(nextLink?.attrs?.['href'] ?? '') !== href || !nextLink) break;
        runs += textRun(next.text ?? '', next.marks ?? []);
        index += 1;
      }
      const rid = `rIdLink${context.links.length + 1}`;
      context.links.push({ rid, href });
      out += `<w:hyperlink r:id="${rid}">${runs}</w:hyperlink>`;
      continue;
    }
    if (node.type === 'text') out += textRun(node.text ?? '', node.marks ?? []);
    else if (node.type === 'hardBreak') out += '<w:r><w:br/></w:r>';
    else if (node.type === 'image') out += pictureRun(node, context);
    index += 1;
  }
  return out;
};

// ----------------------------------------------------------------- blocks

interface ParagraphOptions {
  style?: string;
  list?: { numId: number; level: number };
  /** Extra left indent in inches, for a list item's second paragraph. */
  hanging?: number;
  /** Text set before the words, then a tab: a heading's number. */
  prefix?: string;
}

const ALIGN: Record<string, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };

const paragraphProperties = (node: DocNode, options: ParagraphOptions): string => {
  const parts: string[] = [];
  const attrs = node.attrs ?? {};
  const docStyle = attrs['docStyle'];
  const style =
    options.style ?? (docStyle === 'title' ? 'Title' : docStyle === 'subtitle' ? 'Subtitle' : undefined);
  if (style) parts.push(`<w:pStyle w:val="${style}"/>`);
  if (options.list) {
    parts.push(`<w:numPr><w:ilvl w:val="${options.list.level}"/><w:numId w:val="${options.list.numId}"/></w:numPr>`);
  }
  const before = Number(attrs['spaceBefore']);
  const after = Number(attrs['spaceAfter']);
  const line = Number(attrs['lineHeight']);
  const spacing: string[] = [];
  if (Number.isFinite(before) && attrs['spaceBefore'] != null) spacing.push(`w:before="${Math.round(before * 20)}"`);
  if (Number.isFinite(after) && attrs['spaceAfter'] != null) spacing.push(`w:after="${Math.round(after * 20)}"`);
  if (Number.isFinite(line) && attrs['lineHeight'] != null && line > 0) {
    spacing.push(`w:line="${Math.round(line * 240)}" w:lineRule="auto"`);
  }
  if (spacing.length) parts.push(`<w:spacing ${spacing.join(' ')}/>`);
  const indent = Number(attrs['indent']);
  const left = (Number.isFinite(indent) && indent > 0 ? indent * 0.5 : 0) + (options.hanging ?? 0);
  if (left > 0) parts.push(`<w:ind w:left="${Math.round(left * TWIPS_PER_INCH)}"/>`);
  const align = ALIGN[String(attrs['textAlign'] ?? '')];
  if (align && align !== 'left') parts.push(`<w:jc w:val="${align}"/>`);
  return parts.length ? `<w:pPr>${parts.join('')}</w:pPr>` : '';
};

const paragraphXml = (node: DocNode, context: Context, options: ParagraphOptions = {}): string =>
  `<w:p>${paragraphProperties(node, options)}` +
  (options.prefix ? `${textRun(options.prefix, [])}<w:r><w:tab/></w:r>` : '') +
  `${inlineXml(node.content ?? [], context)}</w:p>`;

const listXml = (node: DocNode, context: Context, level: number, inherited?: number): string => {
  const kind: ListKind = node.type === 'bulletList' ? 'bullet' : orderedKind(node.attrs?.['type']);
  // A nested list keeps its parent's instance, so the levels belong to one
  // Word list and number as Word numbers them. A top-level list is its own.
  let numId = inherited;
  if (numId === undefined || level === 0) {
    numId = context.lists.length + 1;
    const start = Number(node.attrs?.['start'] ?? 1);
    context.lists.push({ numId, abstract: kind, start: Number.isFinite(start) && start > 0 ? start : 1 });
  }
  return (node.content ?? [])
    .map((item) =>
      (item.content ?? [])
        .map((child, index) => {
          if (child.type === 'bulletList' || child.type === 'orderedList') {
            return listXml(child, context, Math.min(8, level + 1), numId);
          }
          if (child.type === 'paragraph' || child.type === 'heading') {
            return index === 0
              ? paragraphXml(child, context, { list: { numId: numId as number, level } })
              : paragraphXml(child, context, { hanging: 0.5 * (level + 1) });
          }
          return blockXml(child, context);
        })
        .join(''),
    )
    .join('');
};

const tableXml = (node: DocNode, context: Context): string => {
  const rows = node.content ?? [];
  const columns = Math.max(
    1,
    ...rows.map((row) =>
      (row.content ?? []).reduce((sum, cell) => sum + Math.max(1, Number(cell.attrs?.['colspan'] ?? 1)), 0),
    ),
  );
  const totalTwips = Math.round(context.contentWidthIn * TWIPS_PER_INCH);
  const columnTwips = Math.floor(totalTwips / columns);
  const grid = Array.from({ length: columns }, () => `<w:gridCol w:w="${columnTwips}"/>`).join('');
  const rowsXml = rows
    .map((row) => {
      const cells = (row.content ?? [])
        .map((cell) => {
          const span = Math.max(1, Number(cell.attrs?.['colspan'] ?? 1));
          const header = cell.type === 'tableHeader';
          const properties =
            `<w:tcPr><w:tcW w:w="${columnTwips * span}" w:type="dxa"/>` +
            (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
            (header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '') +
            '</w:tcPr>';
          const body = (cell.content ?? []).map((child) => blockXml(child, context)).join('');
          // Word refuses a cell with no paragraph in it.
          return `<w:tc>${properties}${body || '<w:p/>'}</w:tc>`;
        })
        .join('');
      return `<w:tr>${cells}</w:tr>`;
    })
    .join('');
  return (
    '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>' +
    `<w:tblGrid>${grid}</w:tblGrid>${rowsXml}</w:tbl>`
  );
};

const blockXml = (node: DocNode, context: Context): string => {
  switch (node.type) {
    case 'paragraph':
      return paragraphXml(node, context);
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.['level'] ?? 1)));
      // The number as the page shows it, typed in front: Word's own multilevel
      // lists number by style level, not by nesting, and would disagree.
      const number = context.headingNumbers.get(String(node.attrs?.['headingId'] ?? ''));
      return paragraphXml(node, context, { style: `Heading${level}`, ...(number ? { prefix: number } : {}) });
    }
    case 'blockquote':
      return (node.content ?? [])
        .map((child) => (child.type === 'paragraph' ? paragraphXml(child, context, { style: 'Quote' }) : blockXml(child, context)))
        .join('');
    case 'bulletList':
    case 'orderedList':
      return listXml(node, context, 0);
    case 'codeBlock':
      return (inlineText(node).split('\n') || [''])
        .map((line) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${textRun(line, [])}</w:p>`)
        .join('');
    case 'horizontalRule':
      return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
    case 'pageBreak':
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    case 'table':
      return tableXml(node, context);
    case 'image':
      return `<w:p>${pictureRun(node, context)}</w:p>`;
    default:
      // A node this writer does not know still has words in it, and they go.
      return node.content ? (node.content.some((child) => child.type === 'text') ? paragraphXml(node, context) : node.content.map((child) => blockXml(child, context)).join('')) : '';
  }
};

const inlineText = (node: DocNode): string =>
  node.type === 'text' ? (node.text ?? '') : (node.content ?? []).map(inlineText).join('');

// ------------------------------------------------------------- the package

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

/** Whether a band has anything in it, and so gets a part of its own in the Word file. */
const bandUsed = (band: DocumentBand): boolean => BAND_SLOTS.some((slot) => band[slot].trim().length > 0);

const sectionXml = (document: WpDocument): string => {
  const { width, height } = pageSize(document.pageSetup);
  const margins = document.pageSetup.margins;
  const twips = (inches: number) => Math.round(inches * TWIPS_PER_INCH);
  const orient = document.pageSetup.orientation === 'landscape' ? ' w:orient="landscape"' : '';
  const { header, footer, firstPage } = document.headerFooter;
  const banded = bandUsed(header) || bandUsed(footer);
  return (
    '<w:sectPr>' +
    (bandUsed(header) ? '<w:headerReference w:type="default" r:id="rIdHeader1"/>' : '') +
    (bandUsed(footer) ? '<w:footerReference w:type="default" r:id="rIdFooter1"/>' : '') +
    `<w:pgSz w:w="${twips(width)}" w:h="${twips(height)}"${orient}/>` +
    `<w:pgMar w:top="${twips(margins.top)}" w:right="${twips(margins.right)}" w:bottom="${twips(margins.bottom)}" ` +
    `w:left="${twips(margins.left)}" w:header="720" w:footer="720" w:gutter="0"/>` +
    // Word's *Different first page*: with no first-page header given, the first page has none.
    (banded && !firstPage ? '<w:titlePg/>' : '') +
    '</w:sectPr>'
  );
};

/**
 * A header or footer part (addendum 42 §15): one paragraph with Word's own
 * centre and right tab stops, so left, centre and right sit where Word's
 * default header puts them. Page fields are Word fields, so they count.
 */
export const bandXml = (document: WpDocument, kind: 'header' | 'footer'): string => {
  const { width } = pageSize(document.pageSetup);
  const inner = Math.max(1, width - document.pageSetup.margins.left - document.pageSetup.margins.right);
  const twips = (inches: number) => Math.round(inches * TWIPS_PER_INCH);
  const look = '<w:rPr><w:color w:val="404040"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
  const field = (instruction: string) =>
    `<w:fldSimple w:instr=" ${instruction} "><w:r>${look}<w:t>1</w:t></w:r></w:fldSimple>`;
  const runs = (text: string): string =>
    text
      .replace(/\{title\}/g, document.title || '')
      .replace(/\{date\}/g, printedDate())
      .split(/(\{page\}|\{pages\})/)
      .map((piece) =>
        piece === '{page}'
          ? field('PAGE')
          : piece === '{pages}'
            ? field('NUMPAGES')
            : piece
              ? `<w:r>${look}<w:t xml:space="preserve">${xml(piece)}</w:t></w:r>`
              : '',
      )
      .join('');
  const band = document.headerFooter[kind];
  const tag = kind === 'header' ? 'hdr' : 'ftr';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:${tag} ${NS}><w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="${twips(inner / 2)}"/>` +
    `<w:tab w:val="right" w:pos="${twips(inner)}"/></w:tabs><w:spacing w:after="0"/></w:pPr>` +
    `${runs(band.left)}<w:r><w:tab/></w:r>${runs(band.center)}<w:r><w:tab/></w:r>${runs(band.right)}</w:p></w:${tag}>`
  );
};

const headingStyle = (level: number, size: number): string =>
  `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/>` +
  '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${level - 1}"/></w:pPr>` +
  `<w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;

export const DOCUMENT_STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
  '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:rPr><w:color w:val="595959"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>' +
  [32, 26, 24, 22, 22, 22].map((size, index) => headingStyle(index + 1, size)).join('') +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
  '<w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>' +
  '<w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
    .join('') +
  '</w:tblBorders><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
  '</w:styles>';

const LEVEL_TEXT: Record<Exclude<ListKind, 'bullet'>, string> = {
  decimal: 'decimal',
  lowerLetter: 'lowerLetter',
  upperLetter: 'upperLetter',
  lowerRoman: 'lowerRoman',
  upperRoman: 'upperRoman',
};

const BULLETS = ['•', 'o', '▪'];

const abstractXml = (kind: ListKind): string => {
  const levels = Array.from({ length: 9 }, (_, level) => {
    const indent = 720 * (level + 1);
    const format = kind === 'bullet' ? 'bullet' : LEVEL_TEXT[kind];
    const text = kind === 'bullet' ? BULLETS[level % BULLETS.length] : `%${level + 1}.`;
    return (
      `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/>` +
      `<w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${indent}" w:hanging="360"/></w:pPr></w:lvl>`
    );
  }).join('');
  return `<w:abstractNum w:abstractNumId="${LIST_ABSTRACT[kind]}"><w:multiLevelType w:val="hybridMultilevel"/>${levels}</w:abstractNum>`;
};

const numberingXml = (lists: Context['lists']): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  (Object.keys(LIST_ABSTRACT) as ListKind[]).map(abstractXml).join('') +
  lists
    .map(
      (list) =>
        `<w:num w:numId="${list.numId}"><w:abstractNumId w:val="${LIST_ABSTRACT[list.abstract]}"/>` +
        (list.start !== 1
          ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${list.start}"/></w:lvlOverride>`
          : '') +
        '</w:num>',
    )
    .join('') +
  '</w:numbering>';

/** The `word/document.xml` of a document, with what the package must carry beside it. */
export const documentBodyXml = (document: WpDocument): { xml: string; context: Context } => {
  const { width } = pageSize(document.pageSetup);
  const context: Context = {
    pictures: [],
    links: [],
    lists: [],
    contentWidthIn: Math.max(1, width - document.pageSetup.margins.left - document.pageSetup.margins.right),
    headingNumbers: headingNumbers(document.content, document.headingNumbering),
  };
  const body = (document.content.content ?? []).map((block) => blockXml(block, context)).join('');
  return {
    xml:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document ${NS}><w:body>${body}${sectionXml(document)}</w:body></w:document>`,
    context,
  };
};

const MEDIA_TYPES: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif' };

/** The whole `.docx`, as bytes (spec §7.2: *a conventional editable word-processing file*). */
export const buildDocumentDocx = async (document: WpDocument, options: { author?: string } = {}): Promise<Uint8Array> => {
  const { xml: body, context } = documentBodyXml(document);
  const extensions = [...new Set(context.pictures.map((picture) => picture.extension))];
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    extensions.map((ext) => `<Default Extension="${ext}" ContentType="${MEDIA_TYPES[ext]}"/>`).join('') +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    (bandUsed(document.headerFooter.header)
      ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      : '') +
    (bandUsed(document.headerFooter.footer)
      ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      : '') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>';
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '</Relationships>';
  const documentRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
    (bandUsed(document.headerFooter.header)
      ? '<Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
      : '') +
    (bandUsed(document.headerFooter.footer)
      ? '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
      : '') +
    context.pictures
      .map(
        (picture) =>
          `<Relationship Id="${picture.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${picture.path}"/>`,
      )
      .join('') +
    context.links
      .map(
        (link) =>
          `<Relationship Id="${link.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(link.href)}" TargetMode="External"/>`,
      )
      .join('') +
    '</Relationships>';
  const core =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<dc:title>${xml(document.title || 'Untitled')}</dc:title>` +
    `<dc:creator>${xml(options.author ?? '')}</dc:creator>` +
    '</cp:coreProperties>';
  return writeZip([
    { path: '[Content_Types].xml', data: utf8(contentTypes) },
    { path: '_rels/.rels', data: utf8(rootRels) },
    { path: 'word/_rels/document.xml.rels', data: utf8(documentRels) },
    { path: 'word/document.xml', data: utf8(body) },
    { path: 'word/styles.xml', data: utf8(DOCUMENT_STYLES_XML) },
    { path: 'word/numbering.xml', data: utf8(numberingXml(context.lists)) },
    ...(bandUsed(document.headerFooter.header) ? [{ path: 'word/header1.xml', data: utf8(bandXml(document, 'header')) }] : []),
    ...(bandUsed(document.headerFooter.footer) ? [{ path: 'word/footer1.xml', data: utf8(bandXml(document, 'footer')) }] : []),
    ...context.pictures.map((picture) => ({ path: `word/${picture.path}`, data: picture.data })),
    { path: 'docProps/core.xml', data: utf8(core) },
  ]);
};
