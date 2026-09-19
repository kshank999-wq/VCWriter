import { CHAPTER_HEAD, summarise, type ImportedElement, type ImportedScript } from './importing.js';
import { scenesFrom, ImportError } from './import-fdx.js';
import { readLaidOutLines, type LaidOutLine } from './import-lines.js';
import { walkXml, type XmlTag } from './xml-walk.js';
import type { ProjectFormat } from './entities/project.js';
import { isProseFormat } from './formats.js';

/**
 * Reading a Word document (addendum 21).
 *
 * **The host unzips and the domain reads.** A `.docx` is a zip of XML parts;
 * the host hands over the parts it finds — the document, its styles, its
 * theme, its relationships and its pictures — and everything about what the
 * words *are* is decided here, where it can be tested with a string.
 *
 * What is read: every paragraph, with the words in it and the marks they
 * carry (bold, italic, underline written back as the editor's own marks),
 * its style, its outline level, how it is aligned and indented, the face
 * and size it was set in, whether a page break comes before it, and any
 * picture it holds. Nothing here decides what a paragraph *becomes*: a
 * script reads the paragraphs by their geometry exactly as a PDF is read,
 * and a book reads them by their headings.
 */

// -------------------------------------------------------------- the parts

export interface DocxPicture {
  dataUrl: string;
  /** From the drawing's extent, in CSS pixels; 0 where the document did not say. */
  width: number;
  height: number;
  name: string;
}

/** What the host hands over: the XML parts by their path in the zip, and the pictures as data URLs. */
export interface DocxParts {
  /** `word/document.xml`. The one part a Word document cannot be without. */
  document: string;
  /** `word/styles.xml`, where paragraph and character styles are defined. */
  styles?: string;
  /** `word/theme/theme1.xml`, which names the theme's fonts. */
  theme?: string;
  /** `word/_rels/document.xml.rels`: which picture an `r:embed` id names. */
  rels?: string;
  /** Pictures by their path in the zip (`word/media/image1.png`) as data URLs. */
  media?: ReadonlyMap<string, string>;
}

export interface DocxParagraph {
  /** The words, the marks written in. */
  text: string;
  /** The words with no marks, for deciding what the paragraph is. */
  plain: string;
  styleId: string;
  /** The style's own name, lower-cased: `heading 1`, `title`, `quote`. */
  styleName: string;
  /** 0 for a top-level heading, 1 under it, and so on; null for body text. */
  outline: number | null;
  align: 'left' | 'center' | 'right' | 'justify';
  /** Inches from the left margin. First-line is relative to the left. */
  indentLeft: number;
  firstLine: number;
  /** The face the paragraph is set in, where the document says. */
  face: string | null;
  /** In points, where the document says. */
  size: number | null;
  /** Set in capitals, by the style or by the words. */
  caps: boolean;
  pageBreakBefore: boolean;
  /** A numbered or bulleted item. */
  list: boolean;
  pictures: DocxPicture[];
}

export interface DocxDocument {
  paragraphs: DocxParagraph[];
  /** How many page breaks the document carried, for a script's page count. */
  pages: number;
}

// ------------------------------------------------------------- the styles

interface StyleProps {
  basedOn: string;
  name: string;
  outline: number | null;
  align: DocxParagraph['align'] | null;
  indentLeft: number | null;
  firstLine: number | null;
  face: string | null;
  size: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  caps: boolean | null;
  pageBreakBefore: boolean;
}

const emptyStyle = (): StyleProps => ({
  basedOn: '',
  name: '',
  outline: null,
  align: null,
  indentLeft: null,
  firstLine: null,
  face: null,
  size: null,
  bold: null,
  italic: null,
  underline: null,
  caps: null,
  pageBreakBefore: false,
});

const TWIPS_PER_INCH = 1440;
const EMU_PER_PX = 9525;

const alignOf = (value: string | undefined): DocxParagraph['align'] | null => {
  switch ((value ?? '').toLowerCase()) {
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'both':
    case 'distribute':
      return 'justify';
    case 'left':
    case 'start':
      return 'left';
    default:
      return null;
  }
};

/** A toggle property: absent is *unset*, `w:val="0"` or `false` is off, anything else on. */
const toggle = (tag: XmlTag): boolean => {
  const value = tag.attributes['w:val'];
  return value === undefined || !['0', 'false', 'off'].includes(value.toLowerCase());
};

/** The theme's two faces, so `w:asciiTheme="minorHAnsi"` can be resolved to a name. */
const themeFaces = (theme: string | undefined): { major: string; minor: string } => {
  const faces = { major: '', minor: '' };
  if (!theme) return faces;
  let which: 'major' | 'minor' | null = null;
  walkXml(theme, {
    open(tag) {
      if (tag.name === 'a:majorfont') which = 'major';
      else if (tag.name === 'a:minorfont') which = 'minor';
      else if (tag.name === 'a:latin' && which && !faces[which]) faces[which] = tag.attributes['typeface'] ?? '';
    },
    close(name) {
      if (name === 'a:majorfont' || name === 'a:minorfont') which = null;
    },
  });
  return faces;
};

/**
 * Read the run and paragraph properties inside a `w:rPr` / `w:pPr`, into
 * whatever record is being filled. Shared by the styles and the document,
 * because Word writes the same tags in both places.
 */
const readProps = (
  tag: XmlTag,
  into: StyleProps,
  theme: { major: string; minor: string },
): void => {
  switch (tag.name) {
    case 'w:basedon':
      into.basedOn = tag.attributes['w:val'] ?? '';
      break;
    case 'w:name':
      into.name = (tag.attributes['w:val'] ?? '').toLowerCase();
      break;
    case 'w:outlinelvl': {
      const level = Number.parseInt(tag.attributes['w:val'] ?? '', 10);
      if (Number.isFinite(level) && level < 9) into.outline = level;
      break;
    }
    case 'w:jc':
      into.align = alignOf(tag.attributes['w:val']);
      break;
    case 'w:ind': {
      const left = tag.attributes['w:left'] ?? tag.attributes['w:start'];
      if (left !== undefined) into.indentLeft = Number.parseInt(left, 10) / TWIPS_PER_INCH;
      const first = tag.attributes['w:firstline'];
      const hanging = tag.attributes['w:hanging'];
      if (first !== undefined) into.firstLine = Number.parseInt(first, 10) / TWIPS_PER_INCH;
      else if (hanging !== undefined) into.firstLine = -Number.parseInt(hanging, 10) / TWIPS_PER_INCH;
      break;
    }
    case 'w:rfonts': {
      const ascii = tag.attributes['w:ascii'] ?? tag.attributes['w:hansi'];
      const themed = tag.attributes['w:asciitheme'] ?? tag.attributes['w:hansitheme'];
      if (ascii) into.face = ascii;
      else if (themed) into.face = themed.toLowerCase().startsWith('major') ? theme.major || null : theme.minor || null;
      break;
    }
    case 'w:sz': {
      const half = Number.parseInt(tag.attributes['w:val'] ?? '', 10);
      if (Number.isFinite(half) && half > 0) into.size = half / 2;
      break;
    }
    case 'w:b':
      into.bold = toggle(tag);
      break;
    case 'w:i':
      into.italic = toggle(tag);
      break;
    case 'w:u': {
      // <w:u w:val="none"/> is how Word turns an inherited underline off.
      const value = (tag.attributes['w:val'] ?? 'single').toLowerCase();
      into.underline = value !== 'none' && value !== '0' && value !== 'false';
      break;
    }
    case 'w:caps':
      into.caps = toggle(tag);
      break;
    case 'w:pagebreakbefore':
      into.pageBreakBefore = toggle(tag);
      break;
    default:
      break;
  }
};

interface Styles {
  byId: Map<string, StyleProps>;
  defaults: StyleProps;
  /** The paragraph style Word applies when none is named. */
  normalId: string;
}

const readStyles = (xml: string | undefined, theme: { major: string; minor: string }): Styles => {
  const byId = new Map<string, StyleProps>();
  const defaults = emptyStyle();
  let normalId = 'Normal';
  if (!xml) return { byId, defaults, normalId };

  let current: StyleProps | null = null;
  let currentId = '';
  let inDefaults = false;
  let isParagraphStyle = false;
  walkXml(xml, {
    open(tag) {
      if (tag.name === 'w:docdefaults') inDefaults = true;
      else if (tag.name === 'w:style') {
        current = emptyStyle();
        currentId = tag.attributes['w:styleid'] ?? '';
        isParagraphStyle = (tag.attributes['w:type'] ?? 'paragraph') === 'paragraph';
        if (isParagraphStyle && tag.attributes['w:default'] === '1') normalId = currentId;
      } else if (current) readProps(tag, current, theme);
      else if (inDefaults) readProps(tag, defaults, theme);
    },
    close(name) {
      if (name === 'w:docdefaults') inDefaults = false;
      else if (name === 'w:style' && current) {
        if (currentId) byId.set(currentId, current);
        current = null;
      }
    },
  });
  return { byId, defaults, normalId };
};

/**
 * A style with everything it inherits filled in, walking `basedOn` up to the
 * root. A paragraph style starts from the document's defaults; a character
 * style (*Emphasis*, *Strong*) starts from nothing, since it says only what
 * it changes and the paragraph underneath says the rest.
 */
const resolvedStyle = (styles: Styles, styleId: string, base: StyleProps = styles.defaults): StyleProps => {
  const chain: StyleProps[] = [];
  const seen = new Set<string>();
  let id = styleId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const style = styles.byId.get(id);
    if (!style) break;
    chain.unshift(style);
    id = style.basedOn;
  }
  const out = { ...base, name: '', basedOn: '', pageBreakBefore: false };
  for (const style of chain) {
    out.name = style.name || out.name;
    if (style.outline !== null) out.outline = style.outline;
    if (style.align !== null) out.align = style.align;
    if (style.indentLeft !== null) out.indentLeft = style.indentLeft;
    if (style.firstLine !== null) out.firstLine = style.firstLine;
    if (style.face !== null) out.face = style.face;
    if (style.size !== null) out.size = style.size;
    if (style.bold !== null) out.bold = style.bold;
    if (style.italic !== null) out.italic = style.italic;
    if (style.underline !== null) out.underline = style.underline;
    if (style.caps !== null) out.caps = style.caps;
    if (style.pageBreakBefore) out.pageBreakBefore = true;
  }
  // A heading style that says nothing about its level is still a heading:
  // Word's built-in ones are named for it.
  const named = /^heading (\d)$/.exec(out.name);
  if (out.outline === null && named) out.outline = Number.parseInt(named[1] as string, 10) - 1;
  if (out.outline === null && out.name === 'title') out.outline = 0;
  return out;
};

// ----------------------------------------------------------- the pictures

const relsOf = (xml: string | undefined): Map<string, string> => {
  const rels = new Map<string, string>();
  if (!xml) return rels;
  walkXml(xml, {
    open(tag) {
      if (tag.name !== 'relationship') return;
      const id = tag.attributes['id'];
      const target = tag.attributes['target'];
      if (id && target) rels.set(id, target);
    },
  });
  return rels;
};

const mediaPath = (target: string): string => {
  const clean = target.replace(/^\/+/, '');
  return clean.startsWith('word/') ? clean : `word/${clean}`;
};

// ----------------------------------------------------------- the document

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/** Runs written back with the editor's marks (§7.2), neighbours alike joined first. */
const markedText = (runs: readonly Run[]): string => {
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged
    .map((run) => {
      // The marks go around the words, never around the spaces beside them,
      // or the editor reads `** word**` as a stray asterisk.
      const lead = run.text.match(/^\s*/)?.[0] ?? '';
      const trail = run.text.match(/\s*$/)?.[0] ?? '';
      const core = run.text.slice(lead.length, run.text.length - trail.length);
      if (core.length === 0) return run.text;
      let out = core;
      if (run.bold && run.italic) out = `***${out}***`;
      else if (run.bold) out = `**${out}**`;
      else if (run.italic) out = `*${out}*`;
      if (run.underline) out = `_${out}_`;
      return `${lead}${out}${trail}`;
    })
    .join('');
};

/**
 * Read the document into paragraphs. Throws where the part is not a Word
 * document at all — a zip with no `w:body` in it.
 */
export const readDocx = (parts: DocxParts): DocxDocument => {
  if (!/<w:body[\s>]/i.test(parts.document)) {
    throw new ImportError('That is not a Word document — no document body in it.');
  }
  const theme = themeFaces(parts.theme);
  const styles = readStyles(parts.styles, theme);
  const rels = relsOf(parts.rels);
  const media = parts.media ?? new Map<string, string>();

  const paragraphs: DocxParagraph[] = [];
  let pages = 1;

  // The paragraph being read, and the run inside it.
  let para: {
    styleId: string;
    own: StyleProps;
    runs: Run[];
    pictures: DocxPicture[];
    pageBreakBefore: boolean;
    list: boolean;
    inProps: boolean;
  } | null = null;
  let run: { props: StyleProps; styleId: string; text: string; inProps: boolean } | null = null;
  let inText = false;
  let drawing: { width: number; height: number; rId: string } | null = null;
  let depthInBody = 0;

  const finishParagraph = () => {
    if (!para) return;
    const style = resolvedStyle(styles, para.styleId || styles.normalId);
    const p = para;
    // The paragraph's own properties win over its style's.
    const own = p.own;
    const face = p.runs.length > 0 ? (firstRunFace ?? own.face ?? style.face) : own.face ?? style.face;
    const size = p.runs.length > 0 ? (firstRunSize ?? own.size ?? style.size) : own.size ?? style.size;
    const plain = p.runs.map((one) => one.text).join('').replace(/\s+/g, ' ').trim();
    const text = markedText(p.runs).trim();
    const caps = own.caps ?? style.caps ?? false;
    if (plain.length > 0 || p.pictures.length > 0) {
      paragraphs.push({
        text: caps ? text.toUpperCase() : text,
        plain: caps ? plain.toUpperCase() : plain,
        styleId: p.styleId,
        styleName: style.name,
        outline: own.outline ?? style.outline,
        align: own.align ?? style.align ?? 'left',
        indentLeft: own.indentLeft ?? style.indentLeft ?? 0,
        firstLine: own.firstLine ?? style.firstLine ?? 0,
        face: face ?? null,
        size: size ?? null,
        caps: caps || (plain.length > 2 && plain === plain.toUpperCase() && /[A-Z]/.test(plain)),
        pageBreakBefore: p.pageBreakBefore || own.pageBreakBefore || style.pageBreakBefore,
        list: p.list,
        pictures: p.pictures,
      });
    }
    para = null;
    firstRunFace = null;
    firstRunSize = null;
  };
  let firstRunFace: string | null = null;
  let firstRunSize: number | null = null;

  walkXml(parts.document, {
    open(tag) {
      if (tag.name === 'w:body') depthInBody += 1;
      if (depthInBody === 0) return;
      switch (tag.name) {
        case 'w:p':
          finishParagraph();
          para = { styleId: '', own: emptyStyle(), runs: [], pictures: [], pageBreakBefore: false, list: false, inProps: false };
          break;
        case 'w:ppr':
          if (para) para.inProps = true;
          break;
        case 'w:pstyle':
          if (para?.inProps) para.styleId = tag.attributes['w:val'] ?? '';
          break;
        case 'w:numpr':
          if (para?.inProps) para.list = true;
          break;
        case 'w:r':
          run = { props: emptyStyle(), styleId: '', text: '', inProps: false };
          break;
        case 'w:rstyle':
          if (run?.inProps) run.styleId = tag.attributes['w:val'] ?? '';
          break;
        case 'w:rpr':
          if (run) run.inProps = true;
          else if (para?.inProps) {
            // A paragraph mark's own run properties: what a paragraph with no
            // runs (a blank line with a size) would be set in.
          }
          break;
        case 'w:t':
          if (run) inText = true;
          break;
        case 'w:tab':
          if (run) run.text += '     ';
          break;
        case 'w:br':
          if ((tag.attributes['w:type'] ?? '').toLowerCase() === 'page') {
            pages += 1;
            if (para && para.runs.length === 0 && !run?.text) para.pageBreakBefore = true;
          } else if (run) run.text += '\n';
          break;
        case 'w:drawing':
        case 'w:pict':
          drawing = { width: 0, height: 0, rId: '' };
          break;
        case 'wp:extent':
          if (drawing) {
            drawing.width = Math.round(Number.parseInt(tag.attributes['cx'] ?? '0', 10) / EMU_PER_PX);
            drawing.height = Math.round(Number.parseInt(tag.attributes['cy'] ?? '0', 10) / EMU_PER_PX);
          }
          break;
        case 'a:blip':
          if (drawing) drawing.rId = tag.attributes['r:embed'] ?? tag.attributes['r:link'] ?? '';
          break;
        case 'v:imagedata':
          if (drawing) drawing.rId = tag.attributes['r:id'] ?? '';
          break;
        default:
          if (run?.inProps) readProps(tag, run.props, theme);
          else if (para?.inProps && !run) readProps(tag, para.own, theme);
          break;
      }
    },
    close(name) {
      if (depthInBody === 0) return;
      switch (name) {
        case 'w:body':
          finishParagraph();
          depthInBody -= 1;
          break;
        case 'w:p':
          finishParagraph();
          break;
        case 'w:ppr':
          if (para) para.inProps = false;
          break;
        case 'w:rpr':
          if (run) run.inProps = false;
          break;
        case 'w:t':
          inText = false;
          break;
        case 'w:r':
          if (run && para) {
            const style = resolvedStyle(styles, para.styleId || styles.normalId);
            // The run's own marks, then its character style's, then the
            // paragraph's, then the paragraph style's.
            const own = run.styleId ? resolvedStyle(styles, run.styleId, emptyStyle()) : emptyStyle();
            const bold = run.props.bold ?? own.bold ?? para.own.bold ?? style.bold ?? false;
            const italic = run.props.italic ?? own.italic ?? para.own.italic ?? style.italic ?? false;
            const underline = run.props.underline ?? own.underline ?? para.own.underline ?? style.underline ?? false;
            if (run.text.length > 0) {
              para.runs.push({ text: run.text, bold, italic, underline });
              const face = run.props.face ?? own.face ?? para.own.face;
              const size = run.props.size ?? own.size ?? para.own.size;
              if (firstRunFace === null && face) firstRunFace = face;
              if (firstRunSize === null && size) firstRunSize = size;
            }
          }
          run = null;
          break;
        case 'w:drawing':
        case 'w:pict':
          if (drawing && para) {
            const target = rels.get(drawing.rId);
            const dataUrl = target ? media.get(mediaPath(target)) : undefined;
            if (dataUrl) {
              para.pictures.push({
                dataUrl,
                width: drawing.width,
                height: drawing.height,
                name: target ? (target.split('/').pop() ?? 'picture') : 'picture',
              });
            }
          }
          drawing = null;
          break;
        default:
          break;
      }
    },
    text(chunk) {
      if (inText && run) run.text += chunk;
    },
  });
  finishParagraph();
  return { paragraphs, pages };
};

// ------------------------------------------------------- what they become

const INCH = 72;

/**
 * A script typed in Word, read as the laid-out lines a PDF gives (addendum
 * 02 §18): the indent of each paragraph is where its line starts, so the
 * PDF reader's geometry — cues in the cue band, speeches in the speech band,
 * sluglines at the margin — classifies a Word screenplay the same way. A
 * centred paragraph stands in the cue band, a right-aligned one where a
 * transition sits.
 *
 * **A Word paragraph is a paragraph, never a wrapped line**, so each is set
 * far enough from the last that the reader does not rejoin two of them.
 */
export const docxToLines = (doc: DocxDocument): LaidOutLine[] => {
  const lines: LaidOutLine[] = [];
  let page = 1;
  doc.paragraphs.forEach((paragraph, index) => {
    if (paragraph.pageBreakBefore && index > 0) page += 1;
    if (paragraph.plain.length === 0) return;
    let x = INCH + (paragraph.indentLeft + Math.max(0, paragraph.firstLine)) * INCH;
    if (paragraph.align === 'center') x = INCH + 2.2 * INCH;
    if (paragraph.align === 'right') x = INCH + 3.5 * INCH;
    // Written across several lines inside one paragraph — a speech typed with
    // soft returns — is still one paragraph.
    lines.push({ text: paragraph.text.replace(/\n+/g, ' '), x, y: index * 24, page });
  });
  return lines;
};

/** A Word document read as a script: the geometry decides, as with a PDF. */
export const docxToScript = (doc: DocxDocument, options: { title?: string } = {}): ImportedScript => {
  const read = readLaidOutLines(docxToLines(doc), options);
  return {
    ...read,
    source: 'docx',
    warnings: read.warnings.map((warning) => warning.replace(/that PDF|the PDF/g, 'that Word document')),
  };
};

const BREAK_MARK = /^[\s*#~_\-—–•·.]{1,12}$/;

/** A section numbered and nothing else — *II*, *3.* — the way a short story divides. */
const BARE_NUMBER = /^([IVXLC]+|[0-9]+)\.?$/;

/** Whether a paragraph opens a chapter (§4): a top heading, *Chapter N*, a bare numeral set centred, or a page break with a short line after it. */
export const opensChapter = (paragraph: DocxParagraph): boolean => {
  if (paragraph.pictures.length > 0) return false;
  if (paragraph.outline === 0) return true;
  const short = paragraph.plain.length > 0 && paragraph.plain.length <= 60;
  if (short && CHAPTER_HEAD.test(paragraph.plain)) return true;
  if (paragraph.align === 'center' && BARE_NUMBER.test(paragraph.plain)) return true;
  if (paragraph.pageBreakBefore && short && (paragraph.caps || paragraph.align === 'center')) return true;
  return false;
};

/** The attributes an element keeps from the document (§3). */
const kept = (paragraph: DocxParagraph): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  if (paragraph.face) out['face'] = paragraph.face;
  if (paragraph.size) out['size'] = paragraph.size;
  if (paragraph.align !== 'left' && paragraph.align !== 'justify') out['align'] = paragraph.align;
  return out;
};

/**
 * A Word document read as prose (§4): chapters where the document's own
 * headings say they are, and each paragraph what its style made it — a
 * heading, a quotation, a break between scenes, a figure, or a paragraph.
 * Everything is kept: nothing in the document is dropped for being a kind
 * this could not place, it becomes a paragraph.
 */
export const docxToProse = (doc: DocxDocument, options: { title?: string } = {}): ImportedScript => {
  const elements: ImportedElement[] = [];
  const warnings: string[] = [];
  let title = options.title ?? '';
  let author = '';

  doc.paragraphs.forEach((paragraph, index) => {
    // A title at the very top is the book's, not a chapter.
    if (index === 0 && paragraph.styleName === 'title' && paragraph.pictures.length === 0) {
      title = paragraph.plain;
      return;
    }
    if (index <= 2 && /^(written\s+)?by\s+\S/i.test(paragraph.plain) && paragraph.plain.length < 60) {
      author = paragraph.plain.replace(/^(written\s+)?by\s+/i, '').trim();
      return;
    }
    const attributes = kept(paragraph);
    const carry = Object.keys(attributes).length > 0 ? { attributes } : {};

    if (opensChapter(paragraph)) {
      elements.push({ type: 'scene_heading', text: paragraph.plain, ...carry });
      return;
    }
    for (const picture of paragraph.pictures) {
      elements.push({ type: 'figure', text: '', picture, ...carry });
    }
    if (paragraph.plain.length === 0) return;
    if (BREAK_MARK.test(paragraph.plain) && (paragraph.align === 'center' || paragraph.plain.length <= 5)) {
      elements.push({ type: 'scene_break', text: '' });
      return;
    }
    if (paragraph.outline !== null) {
      elements.push({ type: 'heading', text: paragraph.text, ...carry });
      return;
    }
    const quoted = paragraph.styleName.includes('quote') || (paragraph.indentLeft >= 0.45 && paragraph.firstLine <= 0);
    const text = paragraph.list ? `• ${paragraph.text}` : paragraph.text;
    elements.push({ type: quoted ? 'blockquote' : 'paragraph', text, ...carry });
  });

  if (elements.length === 0) warnings.push('The document has no paragraphs in it. Nothing was imported.');
  const chapters = elements.filter((element) => element.type === 'scene_heading').length;
  if (chapters === 0 && elements.length > 0) {
    warnings.push('No chapter headings were found, so the whole document is one chapter. Split it in the Outliner.');
  }
  return {
    ...summarise({
      title,
      author,
      scenes: scenesFrom(elements),
      warnings,
      source: 'docx',
    }),
    // A chapter heading is not a place: the summary reads a scene's heading
    // as a slugline, and "Chapter One" is nowhere the story happens.
    locations: [],
  };
};

/** Read a Word document for the format it is going into: by geometry for a script, by headings for a book. */
export const docxToImport = (doc: DocxDocument, format: ProjectFormat, options: { title?: string } = {}): ImportedScript =>
  isProseFormat(format) ? docxToProse(doc, options) : docxToScript(doc, options);

/**
 * A Word document as markdown, for the note importer (§5): headings become
 * `#` lines, so the document splits where the author's own headings say,
 * and the marks are the editor's already.
 */
export const docxToMarkdown = (doc: DocxDocument): string =>
  doc.paragraphs
    .map((paragraph) => {
      if (paragraph.plain.length === 0) return '';
      if (paragraph.outline !== null) return `${'#'.repeat(Math.min(6, paragraph.outline + 1))} ${paragraph.plain}`;
      return paragraph.list ? `- ${paragraph.text}` : paragraph.text;
    })
    .filter((line) => line.length > 0)
    .join('\n\n');
