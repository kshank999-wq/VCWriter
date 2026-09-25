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

/**
 * How far a cut-in picture reaches, in lines, by the block it is on (§8b).
 *
 * It is **not** the same as the block's measured lines: the paragraph the
 * picture cuts into is usually shorter than the picture, and the rest of
 * the picture stands beside the paragraphs after it. The cutter needs the
 * reach to keep a picture and the text that runs round it on one page; the
 * browser is what knows it, since only the browser knows how tall the
 * picture sets at this measure.
 */
export type Wraps = ReadonlyMap<string, number>;

const NO_WRAPS: Wraps = new Map();

/** Lines `from` up to `to` of a block, on one page. */
export interface PagePiece {
  blockId: string;
  from: number;
  to: number;
  /**
   * The block is **split** — this piece is part of it (§8b). Only a split
   * piece is clipped, because clipping is what a split is for: a whole
   * block drawn in a clipped box cannot let a cut-in picture reach the
   * paragraphs after it, which is the gap the wrap fix is about.
   */
  cut?: boolean;
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
  /**
   * Plates set aside for the leaves after this page (§9q), in the order they
   * fall. A page reached with room still on it does not end at a plate: the
   * plate waits here while the text goes on filling, so the paragraph runs to
   * the foot and **continues after the picture**, which is what an
   * illustrated book does and what a reader expects.
   */
  held?: readonly number[];
}

/**
 * **A plate may wait; nothing else may.** A chapter opening, a part's page
 * and a blank the cutter itself left are all placed rather than flowed — a
 * chapter that floated would open in the middle of the page before it. Only a
 * picture given a page of its own inside the story can stand a leaf later
 * than the block it was written beside.
 */
const floats = (block: BookBlock): boolean => block.display && block.kind === 'figure';

/** The blank that is a plate's own back (§9i) goes with it, or it is stranded. */
const backOf = (blocks: readonly BookBlock[], at: number): number[] => {
  const run = [at];
  let next = at + 1;
  while (blocks[next]?.display && blocks[next]?.kind === 'blank') {
    run.push(next);
    next += 1;
  }
  return run;
};

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
  wraps: Wraps,
): Filled | null => {
  const first = blocks[start.index];
  const waiting = start.held ?? [];
  if (!first && waiting.length === 0) return null;
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

  /**
   * A plate that waited (§9q) takes this leaf before the text goes on. It
   * keeps the side it asked for, so a picture that wants a recto still gets
   * one and the verso before it is blank — the rule it had when it stood in
   * the flow, said in the one place it is now placed from.
   */
  if (waiting.length > 0) {
    const held = blocks[waiting[0] as number] as BookBlock;
    if (held.starts === 'recto' && side === 'verso') return empty;
    if (held.starts === 'verso' && side === 'recto') return empty;
    return {
      pieces: [{ blockId: held.id, from: 0, to: linesOf(measured, held) }],
      depth: target,
      cursor: { index: start.index, offset: start.offset, held: waiting.slice(1) },
      display: true,
      blank: false,
      folio: held.folio,
      chapterTitle: held.chapterTitle || chapterInForce,
      numbering: held.numbering,
      continued: false,
    };
  }
  if (!first) return null;

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

  const held: number[] = [];
  while (cursor.index < blocks.length) {
    const block = blocks[cursor.index] as BookBlock;
    if (!isFlow(block)) {
      /**
       * **A plate does not cut the page short** (§9q, from Ken: *it cut the
       * text in the first page… it should fill that entire page to a
       * sentence, then move the rest to the appropriate page*).
       *
       * Where there is room left and something already stands here, the plate
       * is set aside for the next leaf and the text goes on filling this one.
       * The paragraph it interrupts runs to the foot and resumes after the
       * picture, so the reader turns from a full page of prose to the plate
       * and back into the same sentence — which is what an illustrated book
       * does, and is the only arrangement that leaves no hole.
       *
       * Only with something already on the page: a plate reached on an empty
       * one is simply this page, which is the branch above.
       */
      if (cursor.offset === 0 && floats(block) && pieces.length > 0) {
        const run = backOf(blocks, cursor.index);
        held.push(...run);
        cursor = { index: (run[run.length - 1] as number) + 1, offset: 0 };
        continue;
      }
      break;
    }
    if (cursor.offset === 0 && block.starts !== 'none' && pieces.length > 0) break;
    const total = linesOf(measured, block);
    const remaining = total - cursor.offset;
    const available = target - depth;
    if (available <= 0) break;

    numbering ??= block.numbering;
    if (block.chapterTitle) chapterTitle = block.chapterTitle;

    const next = blocks[cursor.index + 1];
    const keepsNext = block.keepWithNext && next !== undefined && isFlow(next) && next.starts === 'none';

    /**
     * A cut-in picture reaches **past its own paragraph** (§8b), so it needs
     * that much room on this page or it is clipped at the foot and the text
     * on the next page runs full measure where it was measured narrowed. The
     * reach is a measurement — the browser knows how tall the picture sets —
     * so it arrives with the line counts rather than being worked out here.
     *
     * Only where something already stands on the page: a picture taller than
     * a whole page cannot be helped by turning to an empty one.
     */
    const reach = block.inset ? Math.max(remaining, wraps.get(block.id) ?? 0) : remaining;
    if (block.inset && reach > available && pieces.length > 0) break;

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
        pieces.push({ blockId: block.id, from: cursor.offset, to: cursor.offset + available, cut: true });
        depth += available;
        cursor = { index: cursor.index, offset: cursor.offset + available };
        continue;
      }
      break;
    }

    if (remaining <= available) {
      if (keepsNext && available - remaining < KEEP && pieces.length > 0) break;
      pieces.push({ blockId: block.id, from: cursor.offset, to: total, cut: cursor.offset > 0 });
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
    pieces.push({ blockId: block.id, from: cursor.offset, to: cursor.offset + take, cut: true });
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
    // The plates this page set aside travel with the cursor (§9q), so the
    // leaves after it draw them before the text goes on.
    cursor: held.length > 0 ? { ...cursor, held } : cursor,
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
  wraps: Wraps = NO_WRAPS,
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
  const opening = fillPage(blocks, measured, cursor, target, 'recto', chapterTitle, wraps);
  if (!opening) return { pages, where, roman, arabic };
  pages.push(record(opening, 1, 'recto', target));
  cursor = opening.cursor;

  let sheet = 2;
  while (cursor.index < blocks.length || (cursor.held?.length ?? 0) > 0) {
    const before = cursor;
    const titleBefore = chapterTitle;
    let verso = fillPage(blocks, measured, cursor, target, 'verso', chapterTitle, wraps);
    if (!verso) break;
    let recto = fillPage(blocks, measured, verso.cursor, target, 'recto', verso.chapterTitle, wraps);
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
      verso = fillPage(blocks, measured, before, cut, 'verso', titleBefore, wraps) ?? verso;
      recto = fillPage(blocks, measured, verso.cursor, cut, 'recto', verso.chapterTitle, wraps);
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
