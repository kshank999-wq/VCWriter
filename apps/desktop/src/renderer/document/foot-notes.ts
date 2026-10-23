import {
  citeDocumentHtml,
  documentMeasureHtml,
  documentPageBox,
  documentPagedHtml,
  noteHtml,
  numberHeadingsHtml,
  type DocumentCitations,
  type DocumentPage,
  type WpDocument,
} from '@vcwriter/domain';

/**
 * **A document's notes at the foot of each page** (addendum 43 §23).
 *
 * The browser sets a printed document into pages by itself and cannot put a
 * note at the foot of the page its marker falls on: Chromium has no
 * `float: footnote`. So the pages are set here, before printing, in a hidden
 * frame with the print's own stylesheet at the width of the page's words:
 *
 * - blocks go onto a page while they and the notes cited in them fit;
 * - a paragraph that does not fit is broken between its lines, the rest
 *   going on over the page; a list, a quotation, a table or the bibliography
 *   between its items, rows or entries, a numbered list keeping its count;
 * - a heading is never left at the foot of a page, and a page break the
 *   writer put in starts a new page;
 * - a block that will not fit even on a page of its own stands alone and is
 *   cut at the foot rather than pushing everything after it astray.
 *
 * The pages come back as `DocumentPage`s and `documentPagedHtml` draws them,
 * each the height of the page, its notes at the bottom. Headers, footers and
 * page numbers stay in the page's margin boxes, as before.
 */

const PX_PER_INCH = 96;
/** Room kept spare on every page, for the printer's rounding of what the screen measured. */
const SLACK_PX = 6;

const TEXT_BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE']);
const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const CONTAINERS = new Set(['UL', 'OL', 'BLOCKQUOTE', 'SECTION', 'TABLE', 'TBODY', 'LI', 'DIV']);

/** The notes cited inside a piece of the page, by number from 1. */
const notesIn = (node: Element): number[] =>
  [...node.querySelectorAll('sup.wp-cite a[id^="wp-ref-"]')].map((link) => Number(link.id.slice('wp-ref-'.length))).filter((n) => n > 0);

/**
 * The lines a block of text is set in, top to bottom, each by its middle.
 * A glyph's box is taller than the line it sits on, so boxes on neighbouring
 * lines overlap: they are told apart by their middles, not their edges.
 */
const linesOf = (doc: Document, node: Element): number[] => {
  const range = doc.createRange();
  range.selectNodeContents(node);
  const rects = [...range.getClientRects()].filter((rect) => rect.height > 0 && rect.width > 0).sort((a, b) => a.top - b.top);
  const lines: { mid: number; half: number }[] = [];
  for (const rect of rects) {
    const mid = (rect.top + rect.bottom) / 2;
    const line = lines[lines.length - 1];
    if (line && mid - line.mid < Math.min(line.half, rect.height / 2)) continue;
    lines.push({ mid, half: rect.height / 2 });
  }
  return lines.map((line) => line.mid);
};

/** Every character's place in a block, so a line's first one can be found. */
const textPoints = (doc: Document, node: Element): { text: Text; offset: number }[] => {
  const points: { text: Text; offset: number }[] = [];
  const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode() as Text | null; text; text = walker.nextNode() as Text | null) {
    for (let offset = 0; offset < text.data.length; offset += 1) points.push({ text, offset });
  }
  return points;
};

/** The first character set below `below`: where the line under it begins. */
const firstBelow = (doc: Document, points: { text: Text; offset: number }[], below: number): { text: Text; offset: number } | null => {
  const range = doc.createRange();
  const middle = (at: number): number => {
    const point = points[at] as { text: Text; offset: number };
    range.setStart(point.text, point.offset);
    range.setEnd(point.text, point.offset + 1);
    const rect = range.getBoundingClientRect();
    return (rect.top + rect.bottom) / 2;
  };
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (middle(mid) > below) high = mid;
    else low = mid + 1;
  }
  return low < points.length ? (points[low] as { text: Text; offset: number }) : null;
};

export interface SetPages {
  pages: DocumentPage[];
}

/**
 * Set the document's words into pages with room for their notes. `body` is
 * the editor's HTML with its citations set and no notes at the end; the
 * frame is the measuring page, already holding `documentMeasureHtml`.
 */
export const setPages = (doc: Document, document: WpDocument, cites: DocumentCitations, body: string): DocumentPage[] => {
  const flow = doc.getElementById('wp-flow') as HTMLElement;
  const page = doc.getElementById('wp-page') as HTMLElement;
  const notesBox = doc.getElementById('wp-notes') as HTMLElement;
  flow.innerHTML = body;
  const room = documentPageBox(document).height * PX_PER_INCH - SLACK_PX;

  const noteHeights = new Map<string, number>();
  const notesHeight = (numbers: number[]): number => {
    if (numbers.length === 0) return 0;
    const key = numbers.join(',');
    const known = noteHeights.get(key);
    if (known !== undefined) return known;
    notesBox.innerHTML = numbers.map((n) => noteHtml(cites, n)).join('');
    const height = notesBox.getBoundingClientRect().height;
    noteHeights.set(key, height);
    return height;
  };
  const fits = (): boolean => page.getBoundingClientRect().height + notesHeight(notesIn(page)) <= room;

  /**
   * Put as much of `node` as fits into `into` (on the page being set). Null
   * where nothing of it fits, and nothing was put; otherwise what is left
   * over to go on over the page, null where it all went in.
   */
  const split = (node: Element, into: Element): { rest: Element | null } | null => {
    if (TEXT_BLOCKS.has(node.tagName) && !HEADINGS.has(node.tagName)) {
      // Where each line after the first begins, measured with the block in place.
      into.appendChild(node);
      const lines = linesOf(doc, node);
      const points = textPoints(doc, node);
      // A line begins with the first character set below the middle of the gap above it.
      const starts = lines.slice(1).map((mid, at) => firstBelow(doc, points, (mid + (lines[at] as number)) / 2));
      into.removeChild(node);
      // Try the most lines first, down to one; the rest go on over the page.
      for (let keep = lines.length - 1; keep >= 1; keep -= 1) {
        const at = starts[keep - 1];
        if (!at) continue;
        const head = node.cloneNode(false) as Element;
        const tail = node.cloneNode(false) as Element;
        const before = doc.createRange();
        before.setStart(node, 0);
        before.setEnd(at.text, at.offset);
        const after = doc.createRange();
        after.setStart(at.text, at.offset);
        after.setEnd(node, node.childNodes.length);
        head.appendChild(before.cloneContents());
        tail.appendChild(after.cloneContents());
        head.classList.add('wp-split');
        tail.classList.add('wp-cont');
        tail.removeAttribute('id');
        into.appendChild(head);
        if (fits()) return { rest: tail };
        into.removeChild(head);
      }
      return null;
    }
    if (CONTAINERS.has(node.tagName) && node.children.length > 0) {
      const head = node.cloneNode(false) as Element;
      const tail = node.cloneNode(false) as Element;
      head.classList.add('wp-split');
      tail.classList.add('wp-cont');
      tail.removeAttribute('id');
      into.appendChild(head);
      const children = [...node.children];
      // A table's column widths and head row go with both halves.
      const fixed = (child: Element) => child.tagName === 'COLGROUP' || child.tagName === 'THEAD' || child.tagName === 'CAPTION';
      let at = 0;
      let wholeItems = 0;
      for (; at < children.length; at += 1) {
        const child = children[at] as Element;
        if (fixed(child)) {
          head.appendChild(child.cloneNode(true));
          tail.appendChild(child.cloneNode(true));
          continue;
        }
        head.appendChild(child);
        if (fits()) {
          if (child.tagName === 'LI') wholeItems += 1;
          continue;
        }
        head.removeChild(child);
        const part = split(child, head);
        tail.appendChild(part ? (part.rest ?? doc.createElement('span')) : child);
        at += 1;
        break;
      }
      for (; at < children.length; at += 1) {
        const child = children[at] as Element;
        if (!fixed(child)) tail.appendChild(child);
      }
      // What went in whole, and what is left: an empty span is a part that all went in.
      for (const empty of [...tail.querySelectorAll(':scope > span:empty')]) empty.remove();
      if (![...head.children].some((child) => !fixed(child))) {
        // Nothing went in: the block is put back as it was, every child in it.
        into.removeChild(head);
        node.replaceChildren(...children);
        return null;
      }
      // A numbered list goes on counting where it broke.
      if (node.tagName === 'OL') tail.setAttribute('start', String(Number(node.getAttribute('start') ?? '1') + wholeItems));
      return { rest: [...tail.children].some((child) => !fixed(child)) ? tail : null };
    }
    return null;
  };

  const pages: DocumentPage[] = [];
  const close = () => {
    // A heading is never the last thing on a page: it goes over with what it heads.
    const carried: Element[] = [];
    while (page.lastElementChild && HEADINGS.has(page.lastElementChild.tagName) && page.children.length > 1) {
      carried.unshift(page.lastElementChild);
      page.removeChild(page.lastElementChild);
    }
    if (page.children.length > 0) pages.push({ body: page.innerHTML, notes: notesIn(page) });
    page.innerHTML = '';
    return carried;
  };

  const queue: Element[] = [...flow.children];
  flow.innerHTML = '';
  while (queue.length > 0) {
    const node = queue.shift() as Element;
    if (node.classList.contains('wp-page-break')) {
      queue.unshift(...close());
      continue;
    }
    page.appendChild(node);
    if (fits()) continue;
    page.removeChild(node);
    const part = split(node, page);
    if (part) {
      queue.unshift(...close(), ...(part.rest ? [part.rest] : []));
      continue;
    }
    if (page.children.length === 0) {
      // Taller than a page on its own: it stands alone, cut at the foot.
      page.appendChild(node);
      close();
      continue;
    }
    queue.unshift(...close(), node);
  }
  close();
  return pages.length > 0 ? pages : [{ body: '', notes: [] }];
};

/**
 * **The print of a document with its notes at the foot of each page**, or
 * null where there are none to place (no notes, or a style that cites in
 * parentheses), so the plain print stands.
 */
export const footNotedPrintHtml = async (document: WpDocument, cites: DocumentCitations, editorHtml: string): Promise<string | null> => {
  if (!cites.raised || cites.notes.length === 0) return null;
  const frame = window.document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  // Off the screen but laid out: a hidden frame would not be measured.
  frame.style.cssText = 'position: fixed; left: -20000px; top: 0; width: 1600px; height: 4000px; border: 0; opacity: 0; pointer-events: none;';
  window.document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument as Document;
    doc.open();
    doc.write(documentMeasureHtml(document));
    doc.close();
    await doc.fonts?.ready;
    const body = numberHeadingsHtml(document, citeDocumentHtml(cites, editorHtml, false));
    return documentPagedHtml(document, setPages(doc, document, cites, body), cites);
  } finally {
    frame.remove();
  }
};
