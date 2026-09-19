/**
 * A small XML reader, shared by the Final Draft and the Word importers.
 *
 * Written here rather than pulled in, for the reason `import-fdx.ts` gave:
 * `DOMParser` is a browser global the main process does not have, an XML
 * library is a dependency in the path of opening a file, and both formats
 * are small, regular documents — paragraphs holding runs of text. A reader
 * for exactly that shape cannot be surprised by an unrelated CVE.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export const unescapeXml = (text: string): string =>
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

export interface XmlTag {
  /** Lower-cased, namespace prefix and all: `w:p`, `paragraph`. */
  name: string;
  /** Lower-cased keys, values unescaped. */
  attributes: Record<string, string>;
  /** `<Text/>` — opens and closes at once. */
  selfClosing: boolean;
  closing: boolean;
}

const ATTRIBUTE = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"/g;

export const readXmlTag = (raw: string): XmlTag => {
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

export interface XmlHandlers {
  /** An opening or self-closing tag. */
  open?(tag: XmlTag): void;
  /** A closing tag, or the close half of a self-closing one. */
  close?(name: string, tag: XmlTag): void;
  /** Character data between tags, unescaped; CDATA arrives here too. */
  text?(chunk: string): void;
}

/**
 * Walk a document, calling back for each tag and each stretch of text.
 * Comments, processing instructions and doctypes are skipped whole. A
 * self-closing tag is reported as an open and then a close, so a handler
 * that tracks depth needs no special case for it.
 */
export const walkXml = (xml: string, handlers: XmlHandlers): void => {
  let index = 0;
  while (index < xml.length) {
    const open = xml.indexOf('<', index);
    if (open === -1) {
      if (index < xml.length) handlers.text?.(unescapeXml(xml.slice(index)));
      break;
    }
    if (open > index) handlers.text?.(unescapeXml(xml.slice(index, open)));

    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open);
      index = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', open)) {
      const end = xml.indexOf(']]>', open);
      handlers.text?.(xml.slice(open + 9, end === -1 ? xml.length : end));
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
    const tag = readXmlTag(xml.slice(open + 1, close));
    index = close + 1;
    if (tag.closing) {
      handlers.close?.(tag.name, tag);
      continue;
    }
    handlers.open?.(tag);
    if (tag.selfClosing) handlers.close?.(tag.name, tag);
  }
};
