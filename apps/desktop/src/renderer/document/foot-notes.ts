import {
  citeDocumentHtml,
  contentsDocumentHtml,
  fillContentsPages,
  hasContents,
  headingPagesIn,
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

/**
 * The ways a block of text can be cut between its lines, most lines kept
 * first: its first lines, and the rest to go on. Measured with the block in
 * `into`, where it is set; it is taken out again, untouched.
 */
export const lineCuts = (doc: Document, node: Element, into: Element, fewest = 1): { head: Element; tail: Element }[] => {
  into.appendChild(node);
  const lines = linesOf(doc, node);
  const points = textPoints(doc, node);
  // A line begins with the first character set below the middle of the gap above it.
  const starts = lines.slice(1).map((mid, at) => firstBelow(doc, points, (mid + (lines[at] as number)) / 2));
  into.removeChild(node);
  const cuts: { head: Element; tail: Element }[] = [];
  for (let keep = lines.length - 1; keep >= fewest; keep -= 1) {
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
    cuts.push({ head, tail });
  }
  return cuts;
};

/** A note may break over the page only when it is long: more than a third of the page. */
export const LONG_NOTE = 1 / 3;
/** And it keeps at least this many lines on the page its marker is on, as a book's does. */
export const NOTE_LINES_KEPT = 2;

/**
 * Set the document's words into pages with room for their notes. `body` is
 * the editor's HTML with its citations set and no notes at the end; the
 * frame is the measuring page, already holding `documentMeasureHtml`.
 *
 * **A long note carries on** (addendum 43 §24), as a book's does (§12): where
 * the note cited last on a page is more than a third of a page and will not
 * stand whole beside its marker, its first lines (two at the least) are set
 * there and the rest first at the foot of the next page, under a rule the
 * width of the page. A note shorter than that never breaks: its marker's
 * line goes over to the page it fits on with it.
 */
export const setPages = (doc: Document, document: WpDocument, cites: DocumentCitations, body: string): DocumentPage[] => {
  const flow = doc.getElementById('wp-flow') as HTMLElement;
  const page = doc.getElementById('wp-page') as HTMLElement;
  const notesBox = doc.getElementById('wp-notes') as HTMLElement;
  flow.innerHTML = body;
  const room = documentPageBox(document).height * PX_PER_INCH - SLACK_PX;

  /** What is carried onto the page being set from the one before, as HTML. */
  let carried: string | null = null;
  /** The page's last note, cut, when `fits` had to cut it. */
  let cut: { head: string; tail: string } | null = null;

  /** The notes at a page's foot into the measuring box: what is carried, then these, the last one as given. */
  const drawNotes = (numbers: number[], lastAs?: string) => {
    notesBox.className = `wp-page-notes${carried ? ' continues' : ''}`;
    notesBox.innerHTML =
      (carried ?? '') + numbers.map((n, at) => (lastAs !== undefined && at === numbers.length - 1 ? lastAs : noteHtml(cites, n))).join('');
  };
  /** The height of the notes at a page's foot: what is carried, then these, the last one as given. */
  const heights = new Map<string, number>();
  const notesHeight = (numbers: number[], lastAs?: string): number => {
    if (numbers.length === 0 && !carried) return 0;
    const key = lastAs === undefined ? `${carried ?? ''}|${numbers.join(',')}` : null;
    const known = key === null ? undefined : heights.get(key);
    if (known !== undefined) return known;
    drawNotes(numbers, lastAs);
    const height = notesBox.getBoundingClientRect().height;
    if (key !== null) heights.set(key, height);
    return height;
  };
  const wholeNote = new Map<number, number>();
  const noteAlone = (n: number): number => {
    const known = wholeNote.get(n);
    if (known !== undefined) return known;
    notesBox.className = 'wp-page-notes';
    notesBox.innerHTML = noteHtml(cites, n);
    const height = (notesBox.lastElementChild as HTMLElement).getBoundingClientRect().height;
    wholeNote.set(n, height);
    return height;
  };

  const fits = (): boolean => {
    cut = null;
    const bodyHeight = page.getBoundingClientRect().height;
    const numbers = notesIn(page);
    if (bodyHeight + notesHeight(numbers) <= room) return true;
    // The last note cited may be cut where the page ends, if it is a long one.
    const last = numbers[numbers.length - 1];
    if (last === undefined || noteAlone(last) <= room * LONG_NOTE) return false;
    drawNotes(numbers);
    const note = notesBox.lastElementChild as Element;
    const holder = notesBox;
    holder.removeChild(note);
    for (const option of lineCuts(doc, note, holder, NOTE_LINES_KEPT)) {
      if (bodyHeight + notesHeight(numbers, option.head.outerHTML) <= room) {
        cut = { head: option.head.outerHTML, tail: option.tail.outerHTML };
        return true;
      }
    }
    return false;
  };

  /**
   * Put as much of `node` as fits into `into` (on the page being set). Null
   * where nothing of it fits, and nothing was put; otherwise what is left
   * over to go on over the page, null where it all went in.
   */
  const split = (node: Element, into: Element): { rest: Element | null } | null => {
    if (TEXT_BLOCKS.has(node.tagName) && !HEADINGS.has(node.tagName)) {
      // Try the most lines first, down to one; the rest go on over the page.
      for (const option of lineCuts(doc, node, into)) {
        into.appendChild(option.head);
        if (fits()) return { rest: option.tail };
        into.removeChild(option.head);
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
  /** What goes on past this page's carry, where that is itself too long for one page. */
  let carriedOn: string | null = null;
  /**
   * A new page, with what is carried onto it. A carried note longer than two
   * thirds of a page is set as far as that and the rest carried on again, so
   * the page still has room for its own words.
   */
  const startPage = () => {
    carriedOn = null;
    if (!carried || notesHeight([]) <= room * (1 - LONG_NOTE)) return;
    const whole: string = carried;
    notesBox.className = 'wp-page-notes continues';
    notesBox.innerHTML = whole;
    const note = notesBox.lastElementChild as Element;
    notesBox.removeChild(note);
    for (const option of lineCuts(doc, note, notesBox, NOTE_LINES_KEPT)) {
      carried = option.head.outerHTML;
      if (notesHeight([]) <= room * (1 - LONG_NOTE)) {
        carriedOn = option.tail.outerHTML;
        return;
      }
    }
    carried = whole;
  };
  const close = () => {
    // A heading is never the last thing on a page: it goes over with what it heads.
    const headings: Element[] = [];
    while (page.lastElementChild && HEADINGS.has(page.lastElementChild.tagName) && page.children.length > 1) {
      headings.unshift(page.lastElementChild);
      page.removeChild(page.lastElementChild);
    }
    if (page.children.length > 0 || carried) {
      // A page holding nothing but a carried note still prints: it is part of the note.
      // Measured once more as it stands, so `cut` answers for this page and no other.
      fits();
      const numbers = notesIn(page);
      pages.push({ body: page.innerHTML, notes: numbers, ...(carried ? { carried } : {}), ...(cut ? { cut: cut.head } : {}) });
      carried = [carriedOn, cut?.tail].filter(Boolean).join('') || null;
      cut = null;
    }
    page.innerHTML = '';
    startPage();
    return headings;
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
  // A note carried past the last words stands on a page of its own.
  while (carried || carriedOn) close();
  return pages.length > 0 ? pages : [{ body: '', notes: [] }];
};

/**
 * **The print of a document with its notes at the foot of each page**, or
 * null where there are none to place (no notes, or a style that cites in
 * parentheses), so the plain print stands.
 */
export const footNotedPrintHtml = async (document: WpDocument, cites: DocumentCitations, editorHtml: string): Promise<string | null> => {
  // Notes at the foot: a footnote style's citations, or the writer's own
  // footnotes (addendum 42 §18); or a table of contents, which needs the pages
  // to know its page numbers (§19).
  const contents = hasContents(document.content);
  if (cites.notes.length === 0 && !contents) return null;
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
    const body = contentsDocumentHtml(document, numberHeadingsHtml(document, citeDocumentHtml(cites, editorHtml, false)));
    const pages = setPages(doc, document, cites, body);
    const paged = documentPagedHtml(document, pages, cites);
    return contents ? fillContentsPages(paged, headingPagesIn(pages)) : paged;
  } finally {
    frame.remove();
  }
};
