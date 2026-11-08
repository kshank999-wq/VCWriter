import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import { noteHtml, pageNotesHtml as notesHtmlOf, type DocumentCitations } from '@vcwriter/domain';
import { LONG_NOTE, NOTE_LINES_KEPT, lineCuts } from './foot-notes';

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
 * writer put in ends the page; and a long note breaks over the page, the rest
 * of it carried first to the next page's foot (addendum 43 §26). The notes
 * are drawn in the print's own markup, so the screen and the paper agree.
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
    // A citation, or the writer's own footnote (addendum 42 §18), by the key its note is filed under.
    [...dom.querySelectorAll('sup[data-cite], sup[data-footnote][data-kind="foot"]')]
      .filter((sup) => {
        const rect = sup.getBoundingClientRect();
        const mid = y((rect.top + rect.bottom) / 2);
        return mid >= top - 1 && mid <= bottom + 1;
      })
      .map((sup) => sup.getAttribute('data-cite') ?? (sup.getAttribute('data-footnote') ? `fn:${sup.getAttribute('data-footnote')}` : ''))
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
  /** The page each heading stands on, from 1, by its id: what a table of contents shows (addendum 42 §19). */
  headingPages: Map<string, number>;
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
  // Notes at the foot: a footnote style's citations, or the writer's own footnotes (addendum 42 §18).
  const raised = cites.notes.length > 0;
  /** What is carried onto the page being set, and what goes on past it again. */
  let carried: string | null = null;
  let carriedOn: string | null = null;
  /** The notes at a page's foot into the measuring box: what is carried, then these, the last as given. */
  const drawNotes = (numbers: number[], lastAs?: string) => {
    notesBox.className = `wp-page-notes${carried ? ' continues' : ''}`;
    notesBox.innerHTML =
      (carried ?? '') + numbers.map((n, at) => (lastAs !== undefined && at === numbers.length - 1 ? lastAs : noteHtml(cites, n))).join('');
  };
  const heights = new Map<string, number>();
  const notesHeight = (numbers: number[], lastAs?: string): number => {
    if (!raised || (numbers.length === 0 && !carried)) return 0;
    const key = lastAs === undefined ? `${carried ?? ''}|${numbers.join(',')}` : null;
    const known = key === null ? undefined : heights.get(key);
    if (known !== undefined) return known;
    drawNotes(numbers, lastAs);
    const height = notesBox.getBoundingClientRect().height / scale;
    if (key !== null) heights.set(key, height);
    return height;
  };
  const wholeNote = new Map<number, number>();
  const noteAlone = (n: number): number => {
    const known = wholeNote.get(n);
    if (known !== undefined) return known;
    notesBox.className = 'wp-page-notes';
    notesBox.innerHTML = noteHtml(cites, n);
    const height = (notesBox.lastElementChild as HTMLElement).getBoundingClientRect().height / scale;
    wholeNote.set(n, height);
    return height;
  };
  /**
   * **A long note breaks over the page** (addendum 43 §26), as the print's
   * does (§24): the last note cited on a page, where it will not stand whole
   * and is longer than a third of a page, keeps as many lines as fit (two at
   * the least) and the rest is carried to the next page's foot. The cut, or
   * null where the note is short or not even two lines fit.
   */
  const cutLast = (numbers: number[], space: number): { head: string; tail: string } | null => {
    const last = numbers[numbers.length - 1];
    if (!raised || last === undefined || noteAlone(last) <= room * LONG_NOTE) return null;
    drawNotes(numbers);
    const note = notesBox.lastElementChild as Element;
    notesBox.removeChild(note);
    for (const option of lineCuts(view.dom.ownerDocument, note, notesBox, NOTE_LINES_KEPT)) {
      if (notesHeight(numbers, option.head.outerHTML) <= space) return { head: option.head.outerHTML, tail: option.tail.outerHTML };
    }
    return null;
  };
  /** A page starting with a carry longer than two thirds of a page sets that much, and carries the rest on. */
  const startPage = () => {
    carriedOn = null;
    if (!carried || notesHeight([]) <= room * (1 - LONG_NOTE)) return;
    const whole: string = carried;
    notesBox.className = 'wp-page-notes continues';
    notesBox.innerHTML = whole;
    const note = notesBox.lastElementChild as Element;
    notesBox.removeChild(note);
    for (const option of lineCuts(view.dom.ownerDocument, note, notesBox, NOTE_LINES_KEPT)) {
      carried = option.head.outerHTML;
      if (notesHeight([]) <= room * (1 - LONG_NOTE)) {
        carriedOn = option.tail.outerHTML;
        return;
      }
    }
    carried = whole;
  };
  const notesOf = (from: number, to: number): number[] =>
    [...new Set(rows.slice(from, to).flatMap((row) => row.keys))]
      .map((key) => numberOf.get(key))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);

  // The pages: where each begins, as a row, and the notes at its foot.
  const pages: PageFoot[] = [];
  let from = 0;
  while (from < rows.length) {
    startPage();
    const pageTop = from === 0 ? 0 : (rows[from] as Row).top;
    let to = from + 1;
    let cut: { head: string; tail: string } | null = null;
    if (!(rows[from] as Row).pageBreak) {
      while (to < rows.length) {
        const row = rows[to] as Row;
        if (row.pageBreak) break;
        const used = row.bottom - pageTop;
        const numbers = notesOf(from, to + 1);
        if (used + notesHeight(numbers) <= room) {
          to += 1;
          continue;
        }
        // The note cited last may break, where it is long; the page then ends there.
        cut = row.keys.length > 0 ? cutLast(numbers, room - used) : null;
        if (cut) to += 1;
        break;
      }
    }
    // A heading is not left at the foot: it goes over with what it heads.
    if (to < rows.length && !cut) {
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
    const numbers = notesOf(from, to);
    pages.push({ from, notes: numbers, carried, cut: cut?.head ?? null, height: notesHeight(numbers, cut?.head) });
    carried = [carriedOn, cut?.tail].filter(Boolean).join('') || null;
    from = next;
  }
  if (pages.length === 0) pages.push({ from: 0, notes: [], carried: null, cut: null, height: 0 });
  // A note still being carried after the last words finishes on pages of its own.
  const after: PageFoot[] = [];
  while (carried) {
    startPage();
    after.push({ from: rows.length, notes: [], carried, cut: null, height: notesHeight([]) });
    carried = carriedOn;
  }

  // The gaps: each brings the next page's first row to the top of its page.
  const decorations: Decoration[] = [];
  let shift = 0;
  let index = 0;
  const foot = (page: number) => (page + 1) * H - top - setup.bottom * PX_PER_INCH;
  pages.forEach((page, at) => {
    const following = pages[at + 1];
    const end = following ? (rows[following.from] as Row) : null;
    // Where this page's words end, on the sheet, below its top margin.
    const wordsEnd = end ? end.top + shift : (rows[rows.length - 1]?.bottom ?? 0) + shift;
    if (!end) {
      // The last page: its notes at its foot after the last words, and the
      // pages of a note carried past them after that.
      if (page.height > 0 || after.length > 0) {
        // After the last block, under its own space, and leaving the words'
        // padding under it; inside the paragraph the editor would add a line.
        const doc = view.state.doc;
        const lastDom = doc.lastChild ? (view.nodeDOM(doc.content.size - doc.lastChild.nodeSize) as HTMLElement | null) : null;
        const under = lastDom instanceof HTMLElement ? parseFloat(getComputedStyle(lastDom).marginBottom) || 0 : 0;
        const padding = parseFloat(getComputedStyle(words).paddingBottom) || 0;
        const start = wordsEnd + under;
        const feet: { at: number; html: string }[] = [];
        if (page.height > 0) feet.push({ at: Math.max(0, foot(index) - start - page.height), html: pageNotesHtml(page, cites) });
        after.forEach((more, n) => feet.push({ at: Math.max(0, foot(index + 1 + n) - start - more.height), html: pageNotesHtml(more, cites) }));
        const last = index + after.length;
        const gap = Math.max(page.height, foot(last) - start - padding);
        decorations.push(gapWidget(doc.content.size, gap, feet, `end-${index}`));
        index = last;
      }
      return;
    }
    // A row that ran past its page (a table taller than a page) pushes the next page on.
    let nextIndex = index + 1;
    while (nextIndex * H < wordsEnd + top) nextIndex += 1;
    const gap = nextIndex * H - (wordsEnd + top);
    const feet = page.height > 0 ? [{ at: Math.max(0, foot(index) - wordsEnd - page.height), html: pageNotesHtml(page, cites) }] : [];
    decorations.push(gapWidget(end.pos, gap, feet, `p-${index}-${Math.round(gap)}`));
    shift += gap;
    index = nextIndex;
  });

  view.dispatch(view.state.tr.setMeta(pageViewKey, DecorationSet.create(view.state.doc, decorations)).setMeta('addToHistory', false));
  if (scroller) scroller.scrollTop = scrolled;
  // Each heading's page, read off the page now the gaps are in.
  const headingPages = new Map<string, number>();
  const wordsTop = words.getBoundingClientRect().top;
  for (const element of words.querySelectorAll('[data-heading-id]')) {
    const id = element.getAttribute('data-heading-id');
    if (!id || headingPages.has(id)) continue;
    const at = (element.getBoundingClientRect().top - wordsTop) / scale;
    headingPages.set(id, Math.max(1, Math.floor((at + top) / H) + 1));
  }
  return { pages: index + 1, headingPages };
};

/** A page's notes as the page view sets them: the same as the print's (`pageNotesHtml`). */
interface PageFoot {
  from: number;
  notes: number[];
  carried: string | null;
  cut: string | null;
  /** How tall the notes stand, in unzoomed pixels. */
  height: number;
}

const pageNotesHtml = (page: PageFoot, cites: DocumentCitations): string =>
  notesHtmlOf({ body: '', notes: page.notes, ...(page.carried ? { carried: page.carried } : {}), ...(page.cut ? { cut: page.cut } : {}) }, cites);

/** A short fingerprint of what a gap shows, so a gap is drawn again when its notes' words change. */
const fingerprint = (text: string): string => {
  let hash = 0;
  for (let at = 0; at < text.length; at += 1) hash = (hash * 31 + text.charCodeAt(at)) | 0;
  return (hash >>> 0).toString(36);
};

/** The gap at a page's end, with the notes of the pages it spans standing `at` pixels down it. */
const gapWidget = (pos: number, height: number, feet: { at: number; html: string }[], key: string): Decoration =>
  Decoration.widget(
    pos,
    () => {
      const gap = document.createElement('span');
      gap.className = 'wp-page-gap';
      gap.contentEditable = 'false';
      gap.setAttribute('aria-hidden', 'true');
      gap.style.height = `${height}px`;
      for (const one of feet) {
        const holder = document.createElement('div');
        holder.className = 'wp-page-foot';
        holder.style.top = `${one.at}px`;
        holder.innerHTML = one.html;
        gap.appendChild(holder);
      }
      return gap;
    },
    { side: -1, key: `${key}-${feet.map((one) => `${Math.round(one.at)}:${fingerprint(one.html)}`).join(',')}`, ignoreSelection: true },
  );
