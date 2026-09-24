import type { BookSettings } from './entities/book.js';
import type { BookGeometry } from './book-layout.js';
import type { BookBlock } from './book-plan.js';
import { bookIndex, type BookIndex } from './book-index.js';
import { toRoman } from './markers.js';
import { headTextFor, showsFolio, type RunningNames } from './running-heads.js';
import type { ProjectFile } from './project-file.js';

/**
 * Laying the pages (addendum 20 §4): where the pages fall, given how many
 * lines each block made.
 *
 * The renderer measures — it sets each block in the chosen face at the
 * chosen measure and reads back how many lines it took — and **everything
 * else is decided here**: which page a block opens on, that a chapter opens
 * on a recto with a blank verso before it if need be, that the front matter
 * is numbered in roman and the story from 1, what the running heads say,
 * that a paragraph's last line may not stand alone at the head of a page nor
 * its first alone at the foot, that a heading keeps the lines after it, and
 * that a spread's two pages are cut to the same depth. Tested with counts
 * made up in a test, because that is all a measurement is to this file.
 */

/** How many lines each block made, by block id. A block not measured is taken as one line. */
export type Measured = ReadonlyMap<string, number>;

/** Lines `from` up to `to` of a block, on one page. */
export interface PagePiece {
  blockId: string;
  from: number;
  to: number;
}

export interface BookPage {
  /** 1-based, counting every leaf from the first. Odd sheets are rectos. */
  sheet: number;
  side: 'verso' | 'recto';
  numbering: 'roman' | 'arabic' | 'none';
  /** The page's place in its numbering; 0 where it has none. */
  number: number;
  /** What prints as the page number, or nothing. */
  folio: string;
  /** Which page this is, printed or not (§9l): a picture page still counts. */
  counted: string;
  runningHead: string;
  /** The chapter in force, for the recto head and the inspector. */
  chapterTitle: string;
  display: boolean;
  blank: boolean;
  /**
   * A chapter or a part opens on this page, above its first lines. Such a
   * page carries no running head — the heading is the head — and shows its
   * number at the foot whatever the book does elsewhere.
   */
  opens: boolean;
  pieces: PagePiece[];
  /** Lines used, and the depth the page was cut to. */
  depth: number;
  target: number;
}

export interface LaidBook {
  pages: BookPage[];
  /** Where each block landed: its page's numbering and number. */
  where: Map<string, { numbering: 'roman' | 'arabic'; number: number }>;
  /** How many pages carry each numbering. */
  roman: number;
  arabic: number;
}

/**
 * The names the running heads may carry (§7). Declared where the heads are
 * decided and re-exported here, so there is one of it — everything that has
 * always imported it from this module still can.
 */
export type { RunningNames } from './running-heads.js';

/** Fewest lines of a paragraph that may stand alone at the foot or the head of a page. */
const KEEP = 2;

interface Cursor {
  index: number;
  offset: number;
}

interface Filled {
  pieces: PagePiece[];
  depth: number;
  cursor: Cursor;
  display: boolean;
  blank: boolean;
  /** Whether the page shows its number. */
  folio: boolean;
  chapterTitle: string;
  numbering: 'roman' | 'arabic' | null;
  /** The flow ran on past this page: the next block continues on the next. */
  continued: boolean;
}

const linesOf = (measured: Measured, block: BookBlock): number => Math.max(1, measured.get(block.id) ?? 1);

const isFlow = (block: BookBlock): boolean => !block.display;

/**
 * Fill one page from the cursor to at most `target` lines, and say where
 * the cursor stands afterwards. The rules of §4 are all here.
 */
const fillPage = (
  blocks: readonly BookBlock[],
  measured: Measured,
  start: Cursor,
  target: number,
  side: 'verso' | 'recto',
  chapterInForce: string,
): Filled | null => {
  const first = blocks[start.index];
  if (!first) return null;
  const empty: Filled = {
    pieces: [],
    depth: 0,
    cursor: start,
    display: false,
    blank: true,
    folio: false,
    chapterTitle: chapterInForce,
    numbering: null,
    continued: false,
  };

  // A block that must open on the other side leaves this one blank.
  if (start.offset === 0 && first.starts === 'recto' && side === 'verso') return empty;
  if (start.offset === 0 && first.starts === 'verso' && side === 'recto') return empty;

  // A display page: a leaf to itself, whatever it measured.
  if (start.offset === 0 && first.display) {
    return {
      pieces: [{ blockId: first.id, from: 0, to: linesOf(measured, first) }],
      depth: target,
      cursor: { index: start.index + 1, offset: 0 },
      display: true,
      blank: false,
      folio: first.folio,
      chapterTitle: first.chapterTitle || chapterInForce,
      numbering: first.numbering,
      continued: false,
    };
  }

  const pieces: PagePiece[] = [];
  let depth = 0;
  let cursor = { ...start };
  let chapterTitle = chapterInForce;
  let numbering: 'roman' | 'arabic' | null = null;

  while (cursor.index < blocks.length) {
    const block = blocks[cursor.index] as BookBlock;
    if (!isFlow(block)) break;
    if (cursor.offset === 0 && block.starts !== 'none' && pieces.length > 0) break;
    const total = linesOf(measured, block);
    const remaining = total - cursor.offset;
    const available = target - depth;
    if (available <= 0) break;

    numbering ??= block.numbering;
    if (block.chapterTitle) chapterTitle = block.chapterTitle;

    const next = blocks[cursor.index + 1];
    const keepsNext = block.keepWithNext && next !== undefined && isFlow(next) && next.starts === 'none';

    if (block.unbreakable) {
      if (remaining <= available) {
        // Whole, and with room under it where it keeps the next.
        if (keepsNext && available - remaining < KEEP && pieces.length > 0) break;
        pieces.push({ blockId: block.id, from: cursor.offset, to: total });
        depth += remaining;
        cursor = { index: cursor.index + 1, offset: 0 };
        continue;
      }
      // Taller than a page: nothing else to do but run it over.
      if (pieces.length === 0 && remaining > target) {
        pieces.push({ blockId: block.id, from: cursor.offset, to: cursor.offset + available });
        depth += available;
        cursor = { index: cursor.index, offset: cursor.offset + available };
        continue;
      }
      break;
    }

    if (remaining <= available) {
      if (keepsNext && available - remaining < KEEP && pieces.length > 0) break;
      pieces.push({ blockId: block.id, from: cursor.offset, to: total });
      depth += remaining;
      cursor = { index: cursor.index + 1, offset: 0 };
      continue;
    }

    // It splits. Neither a single line left over for the next page (a
    // widow) nor a single line left here (an orphan).
    let take = available;
    if (remaining - take === 1) take -= 1;
    if (cursor.offset === 0 && take < KEEP) {
      if (pieces.length === 0) take = Math.max(1, available);
      else break;
    }
    if (take <= 0) break;
    pieces.push({ blockId: block.id, from: cursor.offset, to: cursor.offset + take });
    depth += take;
    cursor = { index: cursor.index, offset: cursor.offset + take };
    break;
  }

  if (pieces.length === 0) return empty;
  const after = blocks[cursor.index];
  const continued =
    after !== undefined && isFlow(after) && (cursor.offset > 0 || after.starts === 'none');
  return {
    pieces,
    depth,
    cursor,
    display: false,
    blank: false,
    folio: true,
    chapterTitle,
    numbering,
    continued,
  };
};


/**
 * Lay the whole book. The first leaf is a recto, as in every book; after it
 * the pages come in spreads, and a spread whose two pages both run on is
 * cut to one depth (§4's balancing), by laying the pair again to the
 * shallower of the two where they came out uneven.
 */
export const layPages = (
  blocks: readonly BookBlock[],
  measured: Measured,
  geometry: BookGeometry,
  settings: BookSettings,
  names: RunningNames,
): LaidBook => {
  const target = Math.max(1, geometry.linesPerPage);
  const pages: BookPage[] = [];
  const where = new Map<string, { numbering: 'roman' | 'arabic'; number: number }>();
  const byId = new Map(blocks.map((block) => [block.id, block]));
  let cursor: Cursor = { index: 0, offset: 0 };
  let chapterTitle = names.title;
  let roman = 0;
  let arabic = 0;
  let numbering: 'roman' | 'arabic' = 'roman';

  const record = (filled: Filled, sheet: number, side: 'verso' | 'recto', cut: number): BookPage => {
    if (filled.numbering === 'arabic' && numbering === 'roman' && !filled.blank) numbering = 'arabic';
    let number = 0;
    if (numbering === 'roman') number = ++roman;
    else number = ++arabic;
    // A book set to carry no page numbers still counts its pages — the
    // contents and the index are read off the count — it just prints none.
    const shows = !filled.blank && filled.folio && showsFolio(settings.folio);
    // What this page's number **is**, printed or not (§9l, from Ken: *it
    // should say page two, page three, page four, page five*). A picture page
    // and a blank leaf are counted like every other and merely print nothing,
    // so `folio` answers *what appears on the paper* and this answers *which
    // page is this* — the rail needs the second and had only the first.
    const counted = numbering === 'roman' ? toRoman(number).toLowerCase() : String(number);
    const folio = shows ? counted : '';
    for (const piece of filled.pieces) {
      if (!where.has(piece.blockId)) where.set(piece.blockId, { numbering, number });
    }
    chapterTitle = filled.chapterTitle;
    const first = filled.pieces[0] ? byId.get(filled.pieces[0].blockId) : undefined;
    const opens =
      !filled.display &&
      filled.pieces[0]?.from === 0 &&
      (first?.kind === 'chapter_opening' || first?.kind === 'part_opening');
    return {
      sheet,
      side,
      numbering: filled.blank ? 'none' : numbering,
      number,
      folio,
      counted,
      runningHead: filled.blank || filled.display || opens ? '' : headTextFor(side, settings, names, filled.chapterTitle),
      chapterTitle: filled.chapterTitle,
      display: filled.display,
      blank: filled.blank,
      opens,
      pieces: filled.pieces,
      depth: filled.depth,
      target: cut,
    };
  };

  // The first leaf, alone.
  const opening = fillPage(blocks, measured, cursor, target, 'recto', chapterTitle);
  if (!opening) return { pages, where, roman, arabic };
  pages.push(record(opening, 1, 'recto', target));
  cursor = opening.cursor;

  let sheet = 2;
  while (cursor.index < blocks.length) {
    const before = cursor;
    const titleBefore = chapterTitle;
    let verso = fillPage(blocks, measured, cursor, target, 'verso', chapterTitle);
    if (!verso) break;
    let recto = fillPage(blocks, measured, verso.cursor, target, 'recto', verso.chapterTitle);
    let cut = target;
    if (
      recto &&
      verso.continued &&
      recto.continued &&
      !verso.display &&
      !recto.display &&
      verso.depth !== recto.depth
    ) {
      cut = Math.min(verso.depth, recto.depth);
      verso = fillPage(blocks, measured, before, cut, 'verso', titleBefore) ?? verso;
      recto = fillPage(blocks, measured, verso.cursor, cut, 'recto', verso.chapterTitle);
    }
    pages.push(record(verso, sheet, 'verso', cut));
    cursor = verso.cursor;
    sheet += 1;
    if (!recto) break;
    pages.push(record(recto, sheet, 'recto', cut));
    cursor = recto.cursor;
    sheet += 1;
  }

  return { pages, where, roman, arabic };
};

/** The book's page count, blanks included: what a printer is quoted on. */
export const sheetCount = (laid: LaidBook): number => laid.pages.length;

/** The contents page's rows, read off the laid book: every chapter opening and its page. */
export interface BookContentsRow {
  label: string;
  title: string;
  page: number;
  /** How far in it sits: a chapter inside a story is under it (addendum 22 §6). */
  depth: number;
}

/**
 * The contents page, read off the blocks (§5) — and, on a collection, a
 * story's chapters under it (addendum 22 §6).
 *
 * Which heading is a chapter is not asked of the format here: it is asked of
 * the block, and **a heading that opens a page of its own is a division**.
 * That is true by construction — `bookBlocks` gives a heading a page only
 * where it opens a chapter inside a story — so a novel's running headings
 * stay out of the contents without this having to know what a novel is.
 */
export const bookContentsOf = (blocks: readonly BookBlock[], laid: LaidBook): BookContentsRow[] =>
  blocks
    .filter((block) => {
      if (block.kind === 'chapter_opening') return true;
      if (block.kind === 'part_opening') return (block.title ?? '').length > 0;
      return block.kind === 'heading' && block.starts !== 'none' && block.text.trim().length > 0;
    })
    .map((block) => {
      const at = laid.where.get(block.id);
      const page = at && at.numbering === 'arabic' ? at.number : 0;
      // A chapter inside a story has no number — a collection numbers
      // nothing — so its heading goes where a title goes and the row is
      // indented under its story. Put in the label's column it would hang
      // outside the text block, which is where the first draft drew it.
      if (block.kind === 'heading') return { label: '', title: block.text.trim(), page, depth: 1 };
      return {
        label: block.chapter?.label ?? '',
        title: block.chapter ? block.chapter.title : block.title ?? '',
        page,
        depth: 0,
      };
    });

/**
 * The index, read off the **book's** pages rather than the manuscript's:
 * the same reading `bookIndexOf` in pagination makes, given where the
 * blocks landed here. No page number is stored, still.
 */
export const bookIndexFor = (file: ProjectFile, laid: LaidBook): BookIndex =>
  bookIndex({
    marks: file.indexMarks ?? [],
    refs: file.indexRefs ?? [],
    pageOfElement: (elementId) => {
      const at = laid.where.get(elementId);
      return at && at.numbering === 'arabic' ? at.number : 0;
    },
  });
