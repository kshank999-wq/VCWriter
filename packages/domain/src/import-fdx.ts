import { summarise, type ImportedElement, type ImportedScene, type ImportedScript } from './importing.js';
import type { ManuscriptElementType } from './entities/manuscript.js';

/**
 * Reading Final Draft (addendum 02 §18).
 *
 * An `.fdx` is XML, and — unlike a PDF — it *says* what every line is. So
 * nothing here is guessed: a paragraph typed as a scene heading in Final
 * Draft becomes a scene heading, and if a type is one we have no equivalent
 * for it is named in the warnings rather than silently turned into action.
 *
 * The parser is written here rather than pulled in. `DOMParser` is a browser
 * global the Electron main process and Node do not have, an XML library is a
 * dependency in the path of opening a file, and FDX is a small, regular
 * document: paragraphs holding runs of text. A reader for exactly that shape
 * is a hundred lines and cannot be surprised by an unrelated CVE.
 */

/** Final Draft's paragraph types, and what each is here. */
const TYPES: Record<string, ManuscriptElementType> = {
  'scene heading': 'scene_heading',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
  shot: 'shot',
  general: 'general',
  // Final Draft's act marks are a paragraph; ours are markers on the story
  // order, so they come in as text and the writer places the marker.
  'new act': 'general',
  'end of act': 'general',
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const unescapeXml = (text: string): string =>
  text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });

interface Tag {
  name: string;
  attributes: Record<string, string>;
  /** `<Text/>` — opens and closes at once. */
  selfClosing: boolean;
  closing: boolean;
}

const ATTRIBUTE = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"/g;

const readTag = (raw: string): Tag => {
  const closing = raw.startsWith('/');
  const body = closing ? raw.slice(1) : raw;
  const selfClosing = body.endsWith('/');
  const inner = selfClosing ? body.slice(0, -1) : body;
  const name = (/^\s*([^\s/>]+)/.exec(inner)?.[1] ?? '').toLowerCase();
  const attributes: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE.exec(inner)) !== null) {
    attributes[(match[1] as string).toLowerCase()] = unescapeXml(match[2] as string);
  }
  return { name, attributes, selfClosing, closing };
};

/** Final Draft's styles, written back as the marks the editor uses (§7.2). */
const withStyle = (text: string, style: string): string => {
  if (text.trim().length === 0) return text;
  const styles = style.toLowerCase();
  let out = text;
  if (styles.includes('italic') && styles.includes('bold')) out = `***${out}***`;
  else if (styles.includes('bold')) out = `**${out}**`;
  else if (styles.includes('italic')) out = `*${out}*`;
  if (styles.includes('underline')) out = `_${out}_`;
  return out;
};

interface Reading {
  elements: ImportedElement[];
  title: string;
  author: string;
  unknownTypes: Set<string>;
}

const readContent = (xml: string): Reading => {
  const reading: Reading = {
    elements: [],
    title: '',
    author: '',
    unknownTypes: new Set(),
  };

  // Final Draft wraps a dual pair in <DualDialogue>: the first cue inside it
  // is the left-hand speech and the second is the one printed alongside. Ours
  // marks only the second, because the mark means "beside the one above".
  let inDual = 0;
  let cuesInDual = 0;

  let index = 0;
  let inParagraph = false;
  let paragraphType: ManuscriptElementType = 'action';
  let paragraphDual = false;
  let paragraphText = '';
  let textStyle = '';
  let inText = false;
  // The title page's own paragraphs, which are not the script.
  let inTitlePage = false;
  const titleLines: string[] = [];

  while (index < xml.length) {
    const open = xml.indexOf('<', index);
    if (open === -1) break;

    // Text between tags belongs to whatever <Text> is open.
    if (open > index && inText) {
      const chunk = unescapeXml(xml.slice(index, open));
      paragraphText += withStyle(chunk, textStyle);
    }

    // Comments, doctypes and CDATA are skipped whole.
    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open);
      index = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', open)) {
      const end = xml.indexOf(']]>', open);
      const body = xml.slice(open + 9, end === -1 ? xml.length : end);
      if (inText) paragraphText += withStyle(body, textStyle);
      index = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<?', open) || xml.startsWith('<!', open)) {
      const end = xml.indexOf('>', open);
      index = end === -1 ? xml.length : end + 1;
      continue;
    }

    const close = xml.indexOf('>', open);
    if (close === -1) break;
    const tag = readTag(xml.slice(open + 1, close));
    index = close + 1;

    switch (tag.name) {
      case 'titlepage':
        inTitlePage = !tag.closing;
        break;

      case 'dualdialogue':
        if (tag.closing) inDual = Math.max(0, inDual - 1);
        else if (!tag.selfClosing) {
          inDual += 1;
          cuesInDual = 0;
        }
        break;

      case 'paragraph': {
        if (tag.closing) {
          if (inParagraph) {
            const text = paragraphText.replace(/\s+$/, '');
            if (inTitlePage) {
              if (text.trim().length > 0) titleLines.push(text.trim());
            } else if (text.trim().length > 0) {
              reading.elements.push({
                type: paragraphType,
                text: paragraphType === 'character' ? text.trim().toUpperCase() : text.trim(),
                ...(paragraphDual ? { dual: true } : {}),
              });
            }
          }
          inParagraph = false;
          paragraphText = '';
          break;
        }
        const declared = (tag.attributes['type'] ?? 'Action').toLowerCase();
        const known = TYPES[declared];
        if (!known) reading.unknownTypes.add(tag.attributes['type'] ?? declared);
        paragraphType = known ?? 'action';
        if (inDual > 0 && paragraphType === 'character') cuesInDual += 1;
        paragraphDual = inDual > 0 && paragraphType === 'character' && cuesInDual > 1;
        paragraphText = '';
        inParagraph = !tag.selfClosing;
        break;
      }

      case 'text':
        if (tag.closing) {
          inText = false;
          textStyle = '';
        } else if (!tag.selfClosing) {
          inText = true;
          textStyle = tag.attributes['style'] ?? '';
        }
        break;

      case 'dynamiclabel':
      case 'scenearabics':
        break;

      default:
        break;
    }
  }

  reading.title = titleLines[0] ?? '';
  const by = titleLines.find((line) => /^(written )?by\b/i.test(line));
  reading.author = by ? by.replace(/^(written )?by\s*/i, '').trim() : (titleLines[1] ?? '');
  return reading;
};

/** Split a flat run of elements at each scene heading. */
export const scenesFrom = (elements: readonly ImportedElement[]): ImportedScene[] => {
  const scenes: ImportedScene[] = [];
  let current: ImportedScene | null = null;
  for (const element of elements) {
    if (element.type === 'scene_heading') {
      current = { heading: element.text, elements: [] };
      scenes.push(current);
      continue;
    }
    if (!current) {
      current = { heading: '', elements: [] };
      scenes.push(current);
    }
    current.elements.push(element);
  }
  return scenes;
};

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** Read a Final Draft document. Throws only when the file is not one. */
export const readFinalDraft = (xml: string): ImportedScript => {
  if (!/<FinalDraft[\s>]/i.test(xml)) {
    throw new ImportError('That is not a Final Draft document — no <FinalDraft> element in it.');
  }

  const reading = readContent(xml);
  const warnings: string[] = [];
  if (reading.elements.length === 0) {
    warnings.push('The document has no paragraphs in it. Nothing was imported.');
  }
  for (const type of reading.unknownTypes) {
    warnings.push(`Final Draft paragraphs typed "${type}" came in as action; there is no equivalent here yet.`);
  }

  return summarise({
    title: reading.title,
    author: reading.author,
    scenes: scenesFrom(reading.elements),
    warnings,
    source: 'fdx',
  });
};
