import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import { noteHtml, type DocumentCitations } from '@vcwriter/domain';

/**
 * **The page view, set into pages, with each page's notes at its foot**
 * (addendum 43 §25).
 *
 * The editor is one long sheet with a rule where each page would end, and
 * the words used to run across the rules: the pages were only set when the
 * document printed. Here they are set on the screen as well. Each page's
 * words are measured line by line and the page ends where they and the notes
 * cited in them fill it; at that point a **gap** is put into the editor — a
 * widget, not part of the document — as tall as the rest of the page, the
 * margins and the top of the next. Each gap carries its page's notes at the
 * foot, where the print sets them (§23), so the writer sees them while
 * writing. The gaps hold no words: they are never saved, typed into or
 * printed, and are worked out again as the words change.
 *
 * As the print's: a page ends between lines; a table, a picture or a rule
 * goes over whole; a heading is not left at a page's foot; a page break the
 * writer put in ends the page. Unlike the print, a note is not broken over
 * the page here: a page's notes take at most three fifths of it and the rest
 * is cut off at the screen's foot, the print setting it in full.
 */

export const pageViewKey = new PluginKey<DecorationSet>('wpPageView');

/** The gaps, as decorations, kept through edits until they are worked out again. */
export const PageView = Extension.create({
  name: 'pageView',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pageViewKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            const next = tr.getMeta(pageViewKey) as DecorationSet | undefined;
            return next ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => pageViewKey.getState(state) },
      }),
    ];
  },
});

const PX_PER_INCH = 96;
/** The most of a page its notes may take on the screen. */
const NOTES_AT_MOST = 0.6;

/** One line, or one block that goes over whole, in the editor's words. */
interface Row {
  /** Top and bottom, in pixels from the top of the words, unzoomed. */
  top: number;
  bottom: number;
  /** Where a page beginning with this row is cut: the position the gap goes at. */
  pos: number;
  /** The citations in it, by key. */
  keys: string[];
  /** A page break the writer put in, which ends the page. */
  pageBreak?: boolean;
  /** The last line of a heading, which is not left at a page's foot. */
  headingEnd?: boolean;
  /** The first row of the block it is in. */
  blockStart?: boolean;
}

/** Blocks that go over the page whole. */
const WHOLE = new Set(['table', 'image', 'horizontalRule', 'bibliography']);

const linesOfBlock = (dom: HTMLElement): { top: number; bottom: number }[] => {
  const range = dom.ownerDocument.createRange();
  range.selectNodeContents(dom);
  const rects = [...range.getClientRects()].filter((rect) => rect.height > 0 && rect.width > 0).sort((a, b) => a.top - b.top);
  const lines: { mid: number; top: number; bottom: number; half: number }[] = [];
  for (const rect of rects) {
    const mid = (rect.top + rect.bottom) / 2;
    const line = lines[lines.length - 1];
    if (line && mid - line.mid < Math.min(line.half, rect.height / 2)) {
      line.top = Math.min(line.top, rect.top);
      line.bottom = Math.max(line.bottom, rect.bottom);
      continue;
    }
    lines.push({ mid, top: rect.top, bottom: rect.bottom, half: rect.height / 2 });
  }
  // Each line runs to where the next begins, so the rows tile the block.
  return lines.map((line, at) => ({ top: at === 0 ? line.top : (lines[at - 1] as { bottom: number }).bottom, bottom: line.bottom }));
};

/** The rows of the document as the editor has laid it out, top to bottom. */
const rowsOf = (editor: Editor, scale: number, origin: number): Row[] => {
  const { view } = editor;
  const rows: Row[] = [];
  const y = (client: number) => (client - origin) / scale;
  const keysIn = (dom: Element, top: number, bottom: number): string[] =>
    [...dom.querySelectorAll('sup[data-cite]')]
      .filter((sup) => {
        const rect = sup.getBoundingClientRect();
        const mid = y((rect.top + rect.bottom) / 2);
        return mid >= top - 1 && mid <= bottom + 1;
      })
      .map((sup) => sup.getAttribute('data-cite') ?? '')
      .filter(Boolean);
  view.state.doc.descendants((node: PmNode, pos: number) => {
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (!dom || !(dom instanceof HTMLElement)) return node.isBlock && !node.isTextblock;
    if (node.type.name === 'pageBreak') {
      const rect = dom.getBoundingClientRect();
      rows.push({ top: y(rect.top), bottom: y(rect.bottom), pos, keys: [], pageBreak: true, blockStart: true });
      return false;
    }
    if (WHOLE.has(node.type.name)) {
      const rect = dom.getBoundingClientRect();
      rows.push({ top: y(rect.top), bottom: y(rect.bottom), pos, keys: keysIn(dom, y(rect.top), y(rect.bottom)), blockStart: true });
      return false;
    }
    if (!node.isTextblock) return true;
    const lines = linesOfBlock(dom);
    const heading = node.type.name === 'heading';
    if (lines.length === 0) {
      const rect = dom.getBoundingClientRect();
      rows.push({ top: y(rect.top), bottom: y(rect.bottom), pos: pos + 1, keys: [], blockStart: true, headingEnd: heading });
      return false;
    }
    const left = dom.getBoundingClientRect().left + 1;
    lines.forEach((line, at) => {
      const top = y(line.top);
      const bottom = y(line.bottom);
      // Where the line begins: the first position on it.
      const found = at === 0 ? null : view.posAtCoords({ left, top: line.top + (line.bottom - line.top) / 2 + 1 });
      rows.push({
        top,
        bottom,
        pos: at === 0 ? pos + 1 : Math.max(pos + 1, Math.min(pos + node.nodeSize - 1, found?.pos ?? pos + 1)),
        keys: keysIn(dom, top, bottom),
        blockStart: at === 0,
        headingEnd: heading && at === lines.length - 1,
      });
    });
    return false;
  });
  return rows;
};

/** The element the words scroll in, whose place is kept while the gaps are measured without. */
const scrollerOf = (from: HTMLElement): HTMLElement | null => {
  for (let at = from.parentElement; at; at = at.parentElement) {
    const overflow = getComputedStyle(at).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && at.scrollHeight > at.clientHeight) return at;
  }
  return null;
};

export interface PageViewLayout {
  pages: number;
}

/**
 * Work out the pages and put the gaps in. `notesBox` is an element at the
 * width of the page's words, in the editor's stylesheet, used to measure the
 * notes; `pageHeight` and the margins are in inches.
 */
export const layOutPageView = (
  editor: Editor,
  cites: DocumentCitations,
  setup: { pageHeight: number; top: number; bottom: number },
  notesBox: HTMLElement,
): PageViewLayout => {
  const { view } = editor;
  const words = view.dom as HTMLElement;
  const scroller = scrollerOf(words);
  const scrolled = scroller?.scrollTop ?? 0;
  // Measured without the gaps, in one go, so nothing is painted between.
  view.dispatch(view.state.tr.setMeta(pageViewKey, DecorationSet.empty).setMeta('addToHistory', false));
  const box = words.getBoundingClientRect();
  const scale = words.offsetHeight > 0 ? box.height / words.offsetHeight || 1 : 1;
  const rows = rowsOf(editor, scale, box.top);

  const H = setup.pageHeight * PX_PER_INCH;
  const top = setup.top * PX_PER_INCH;
  const room = H - top - setup.bottom * PX_PER_INCH;
  const numberOf = new Map(cites.notes.map((note, at) => [note.key, at + 1]));
  const raised = cites.raised && cites.notes.length > 0;
  const heights = new Map<string, number>();
  const notesHeight = (numbers: number[]): number => {
    if (!raised || numbers.length === 0) return 0;
    const key = numbers.join(',');
    const known = heights.get(key);
    if (known !== undefined) return known;
    notesBox.innerHTML = numbers.map((n) => noteHtml(cites, n)).join('');
    const height = Math.min(notesBox.getBoundingClientRect().height / scale, room * NOTES_AT_MOST);
    heights.set(key, height);
    return height;
  };
  const notesOf = (from: number, to: number): number[] =>
    [...new Set(rows.slice(from, to).flatMap((row) => row.keys))]
      .map((key) => numberOf.get(key))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);

  // The pages: where each begins, as a row, and the notes on it.
  const pages: { from: number; notes: number[] }[] = [];
  let from = 0;
  while (from < rows.length) {
    const pageTop = from === 0 ? 0 : (rows[from] as Row).top;
    let to = from + 1;
    if (!(rows[from] as Row).pageBreak) {
      while (to < rows.length) {
        const row = rows[to] as Row;
        if (row.pageBreak) break;
        if (row.bottom - pageTop + notesHeight(notesOf(from, to + 1)) > room) break;
        to += 1;
      }
    }
    // A heading is not left at the foot: it goes over with what it heads.
    if (to < rows.length) {
      let back = to;
      while (back - 1 > from && (rows[back - 1] as Row).headingEnd) {
        let start = back - 1;
        while (start > from && !(rows[start] as Row).blockStart) start -= 1;
        if (start <= from) break;
        back = start;
      }
      to = back;
    }
    // A page break the writer put in ends the page it is on, and starts nothing itself.
    const next = to < rows.length && (rows[to] as Row).pageBreak ? to + 1 : to;
    pages.push({ from, notes: notesOf(from, to) });
    from = next;
  }
  if (pages.length === 0) pages.push({ from: 0, notes: [] });

  // The gaps: each brings the next page's first row to the top of its page.
  const decorations: Decoration[] = [];
  let shift = 0;
  let index = 0;
  pages.forEach((page, at) => {
    const following = pages[at + 1];
    const end = following ? (rows[following.from] as Row) : null;
    // Where this page's words end, on the sheet, below its top margin.
    const wordsEnd = end ? end.top + shift : (rows[rows.length - 1]?.bottom ?? 0) + shift;
    const pageFoot = (index + 1) * H - top - setup.bottom * PX_PER_INCH;
    const notes = page.notes.length > 0 ? notesHeight(page.notes) : 0;
    if (!end) {
      // The last page: its notes at its foot, after the last words.
      if (notes > 0) {
        // After the last block, under its own space, and leaving the words'
        // padding under it; inside the paragraph the editor would add a line.
        const doc = view.state.doc;
        const lastDom = doc.lastChild ? (view.nodeDOM(doc.content.size - doc.lastChild.nodeSize) as HTMLElement | null) : null;
        const under = lastDom instanceof HTMLElement ? parseFloat(getComputedStyle(lastDom).marginBottom) || 0 : 0;
        const padding = parseFloat(getComputedStyle(words).paddingBottom) || 0;
        const gap = Math.max(notes, pageFoot - wordsEnd - under - padding);
        decorations.push(gapWidget(doc.content.size, gap, gap - notes, page.notes, cites, `end-${index}`));
      }
      return;
    }
    // A row that ran past its page (a table taller than a page) pushes the next page on.
    let nextIndex = index + 1;
    while (nextIndex * H < wordsEnd + top) nextIndex += 1;
    const gap = nextIndex * H - (wordsEnd + top);
    decorations.push(gapWidget(end.pos, gap, Math.max(0, pageFoot - wordsEnd - notes), page.notes, cites, `p-${index}-${Math.round(gap)}`));
    shift += gap;
    index = nextIndex;
  });

  view.dispatch(view.state.tr.setMeta(pageViewKey, DecorationSet.create(view.state.doc, decorations)).setMeta('addToHistory', false));
  if (scroller) scroller.scrollTop = scrolled;
  return { pages: index + 1 };
};

/** A short fingerprint of what a gap shows, so a gap is drawn again when its notes' words change. */
const fingerprint = (text: string): string => {
  let hash = 0;
  for (let at = 0; at < text.length; at += 1) hash = (hash * 31 + text.charCodeAt(at)) | 0;
  return (hash >>> 0).toString(36);
};

/** The gap at a page's end, with the page's notes standing `notesAt` pixels down it. */
const gapWidget = (pos: number, height: number, notesAt: number, notes: number[], cites: DocumentCitations, key: string): Decoration => {
  const html = notes.map((n) => noteHtml(cites, n)).join('');
  return Decoration.widget(
    pos,
    () => {
      const gap = document.createElement('span');
      gap.className = 'wp-page-gap';
      gap.contentEditable = 'false';
      gap.setAttribute('aria-hidden', 'true');
      gap.style.height = `${height}px`;
      if (html) {
        const foot = document.createElement('div');
        foot.className = 'wp-page-notes wp-page-foot';
        foot.style.top = `${notesAt}px`;
        foot.style.maxHeight = `${Math.max(0, height - notesAt)}px`;
        foot.innerHTML = html;
        gap.appendChild(foot);
      }
      return gap;
    },
    { side: -1, key: `${key}-${Math.round(notesAt)}-${fingerprint(html)}`, ignoreSelection: true },
  );
};
