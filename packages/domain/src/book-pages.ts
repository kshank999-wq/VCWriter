import type { BookSettings } from './entities/book.js';
import type { BookGeometry } from './book-layout.js';
import type { BookBlock } from './book-plan.js';
import { bookIndex, type BookIndex } from './book-index.js';
import { toRoman } from './markers.js';
import { footTextFor, headTextFor, sectionLayoutOf, showsFolio, type RunningNames } from './running-heads.js';
import type { SectionLayout } from './entities/book.js';
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

/**
 * **Footnotes, for the cutter** (addendum 43 §8). Both halves are
 * measurements, made where the type is set:
 *
 * - `anchors`: by block, the line each citation's marker fell on, and its key
 * - `heights`: by key, how tall its note sets, in lines of the body's leading
 *   (a fraction: a note is set smaller and closer than the text)
 * - `line`: one line of a note, in the same units — what a note is broken by
 *
 * A note goes on the page its marker is on. A short one goes whole, so a line
 * whose note will not fit under it goes over with it. **A long one breaks**
 * (§12): where it cannot stand whole with its marker's line, at least two of
 * its lines stay under the text there and the rest carries on at the foot of
 * the next page, above that page's own notes, under a rule the width of the
 * measure — as Word does it and as Chicago allows (14.47).
 */
export interface NotePlacements {
  anchors: ReadonlyMap<string, readonly { key: string; line: number }[]>;
  heights: ReadonlyMap<string, number>;
  line?: number;
}

/** Lines `from` up to `to` of a note that is `lines` long, on one page (§12). */
export interface NotePart {
  key: string;
  from: number;
  to: number;
  lines: number;
}

const NO_NOTES: NotePlacements = { anchors: new Map(), heights: new Map() };

/** The rule over the notes and the space around it, in lines. */
const NOTE_RULE = 0.6;

/** One line of a note, in lines of the body. */
const noteLineOf = (notes: NotePlacements): number => (notes.line && notes.line > 0 ? notes.line : 1);

/** How many lines a note sets in. */
export const linesOfNote = (notes: NotePlacements, key: string): number =>
  Math.max(1, Math.round((notes.heights.get(key) ?? noteLineOf(notes)) / noteLineOf(notes)));

const wholeNote = (notes: NotePlacements, key: string): NotePart => {
  const lines = linesOfNote(notes, key);
  return { key, from: 0, to: lines, lines };
};

/** The whole lines of the body a page's notes take, rule and all: nothing where it has none. */
export const notePartsCost = (notes: NotePlacements, parts: readonly NotePart[]): number => {
  if (parts.length === 0) return 0;
  const tall = parts.reduce((sum, part) => sum + (part.to - part.from) * noteLineOf(notes), NOTE_RULE);
  // A hair of slack, as the measuring itself allows, so 2.0001 is two.
  return Math.ceil(tall - 0.02);
};

/** The lines a set of whole notes takes. */
export const noteLines = (notes: NotePlacements, keys: readonly string[]): number =>
  notePartsCost(notes, keys.map((key) => wholeNote(notes, key)));

/** The keys of the citations written in some words: a page of words is not measured line by line (§13). */
const tokenKeys = (text: string): string[] => [...text.matchAll(/\[\^([0-9a-f]{6})\]/g)].map((match) => match[1] as string);

/** The notes whose markers fall on lines `from` up to `to` of a block. */
const notesIn = (notes: NotePlacements, blockId: string, from: number, to: number, total: number): string[] =>
  (notes.anchors.get(blockId) ?? [])
    .filter((anchor) => {
      // A marker read below the block's last line is on its last line.
      const line = Math.min(Math.max(0, anchor.line), Math.max(0, total - 1));
      return line >= from && line < to;
    })
    .map((anchor) => anchor.key);

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
  /** The running foot, fields for the page itself still to fill (addendum 43 §10). */
  runningFoot: string;
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
  /** The citations whose notes this page carries at its foot, in order (addendum 43 §8). */
  notes: string[];
  /** Which lines of each it carries: a part where a note breaks across pages (§12). */
  noteParts: NotePart[];
  /** Lines used, notes included, and the depth the page was cut to. */
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
  /** The rest of a note broken at the foot of the last page, to carry on at this one's (§12). */
  carry?: { key: string; from: number; lines: number };
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
  /** The citations whose notes stand at this page's foot, in order (addendum 43 §8). */
  notes: string[];
  /** Which lines of each, where a note breaks across pages (§12). */
  noteParts: NotePart[];
}

const linesOf = (measured: Measured, block: BookBlock): number => Math.max(1, measured.get(block.id) ?? 1);

const isFlow = (block: BookBlock): boolean => !block.display;

/**
 * **The division a block opens, by its record** (addendum 43 §10): a
 * chapter's marker, a part, or the unit of a heading that opens a page. The
 * same ids the contents page keys its rows by, so a division's own layout is
 * found again however often the book is laid.
 */
export const sectionIdOf = (block: BookBlock): string | null => {
  if (block.kind === 'chapter_opening') return block.id;
  // A page set among others opens nothing: the division it stands in goes on (addendum 43 §21).
  if (block.kind === 'part_opening') return block.anchored ? null : (block.partId ?? block.id);
  if (block.kind === 'heading' && block.starts !== 'none') return block.unitId ?? block.id;
  return null;
};

/**
 * **The division in force on a page** (§9y, from Ken: *at the top right-hand
 * pages, it's supposed to be story title, and it says contents*).
 *
 * Measured on his own collection: the recto top is set to *The story’s title*
 * and the contents page prints **Contents**, because `partOwnBlocks` put the
 * part's own name in the slot the division's title is read from — one field
 * carrying two facts, so a side asked for the story's title was answered with
 * the page's name. The story's pages were right throughout, which is why it
 * showed on one page and read as the setting not working.
 *
 * **A part's page is not in a division**, so it carries no division title: a
 * side set to it prints nothing there rather than something else under its
 * name, which is `describeHeadTops`' own refusal to invent a title where there
 * is no division to read. It also stops the leak the other way — without it a
 * part's name, or the last story's, is the title in force on everything after
 * it, which is how *Contents* could reach a page of the story at all.
 *
 * `bookPageRows` has read `partId` for exactly this since §9h (*a part page
 * is credited to no marker and no unit*); this is that one rule said of the
 * running head.
 *
 * The cost is named rather than hidden: the second page of a foreword and the
 * pages of an index no longer carry their own name along the top. That was
 * never asked for — it was the default recto content finding the part's name
 * in the division's slot — and a book that prints it is a book whose control
 * says one thing and does another.
 */
const divisionOf = (block: BookBlock, inForce: string): string =>
  block.partId !== undefined ? '' : block.chapterTitle || inForce;

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
  notes: NotePlacements = NO_NOTES,
): Filled | null => {
  const first = blocks[start.index];
  const waiting = start.held ?? [];
  if (!first && waiting.length === 0 && !start.carry) return null;
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
    notes: [],
    noteParts: [],
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
      // A note still carrying on waits for a page of text.
      cursor: { index: start.index, offset: start.offset, held: waiting.slice(1), ...(start.carry ? { carry: start.carry } : {}) },
      display: true,
      blank: false,
      folio: held.folio,
      chapterTitle: divisionOf(held, chapterInForce),
      numbering: held.numbering,
      continued: false,
      notes: [],
      noteParts: [],
    };
  }

  // A block that must open on the other side leaves this one blank — but for
  // the rest of a note, which carries on there rather than waiting a leaf.
  const otherSide =
    first !== undefined && start.offset === 0 && ((first.starts === 'recto' && side === 'verso') || (first.starts === 'verso' && side === 'recto'));
  if (otherSide && !start.carry) return empty;

  // A display page: a leaf to itself, whatever it measured.
  const displayNotes = first?.display && first.kind === 'part_opening' ? tokenKeys(first.text).filter((key) => notes.heights.has(key)) : [];
  if (first && !otherSide && start.offset === 0 && first.display) {
    return {
      pieces: [{ blockId: first.id, from: 0, to: linesOf(measured, first) }],
      depth: target,
      cursor: { index: start.index + 1, offset: 0, ...(start.carry ? { carry: start.carry } : {}) },
      display: true,
      blank: false,
      folio: first.folio,
      chapterTitle: divisionOf(first, chapterInForce),
      numbering: first.numbering,
      continued: false,
      // A page of words — an epigraph, a dedication — sets its own notes at
      // its foot, whole: such a page is a few lines a third of the way down,
      // and the rest of it is room (addendum 43 §13).
      notes: displayNotes,
      noteParts: displayNotes.map((key) => wholeNote(notes, key)),
    };
  }

  const pieces: PagePiece[] = [];
  let depth = 0;
  let cursor: Cursor = { index: start.index, offset: start.offset };
  /**
   * The notes this page carries so far (addendum 43 §8). `depth` counts the
   * text's lines only; what is left for text is the target less the text
   * and less the lines the notes take, rule and all.
   */
  const parts: NotePart[] = [];
  /** The rest of a note broken on this page, for the next. */
  let carryOut: Cursor['carry'];
  /** No new note may follow one that is still carrying on: notes keep their order. */
  let closed = false;
  /**
   * **The rest of a note broken on the page before** (§12) takes the head of
   * this page's notes, as much as fits while leaving the text two lines; a
   * note longer than that carries on again.
   */
  if (start.carry) {
    const carried = start.carry;
    const textAfter = !otherSide && start.index < blocks.length;
    const room = Math.max(1, target - (textAfter ? KEEP : 0));
    let take = carried.lines - carried.from;
    while (take > 1 && notePartsCost(notes, [{ key: carried.key, from: carried.from, to: carried.from + take, lines: carried.lines }]) > room) take -= 1;
    parts.push({ key: carried.key, from: carried.from, to: carried.from + take, lines: carried.lines });
    if (carried.from + take < carried.lines) {
      carryOut = { key: carried.key, from: carried.from + take, lines: carried.lines };
      closed = true;
    }
  }
  const noted = (): number => notePartsCost(notes, parts);
  /** The extra lines the notes of lines `from` to `to` would cost this page, each whole. */
  const costOf = (blockId: string, from: number, to: number, total: number): { parts: NotePart[]; extra: number } => {
    const more = notesIn(notes, blockId, from, to, total).map((key) => wholeNote(notes, key));
    if (more.length === 0) return { parts: more, extra: 0 };
    if (closed) return { parts: more, extra: Number.POSITIVE_INFINITY };
    return { parts: more, extra: notePartsCost(notes, [...parts, ...more]) - noted() };
  };
  let chapterTitle = chapterInForce;
  let numbering: 'roman' | 'arabic' | null = null;

  const held: number[] = [];
  while (!otherSide && cursor.index < blocks.length) {
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
    const available = target - depth - noted();
    if (available <= 0) break;

    numbering ??= block.numbering;
    chapterTitle = divisionOf(block, chapterTitle);

    const next = blocks[cursor.index + 1];
    const keepsNext = block.keepWithNext && next !== undefined && isFlow(next) && next.starts === 'none';
    // What the rest of the block would cost with its notes.
    const whole = costOf(block.id, cursor.offset, total, total);

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
    if (block.inset && reach + whole.extra > available && pieces.length > 0) break;

    if (block.unbreakable) {
      // Whole, and with room under it where it keeps the next. A block that
      // would fit an empty page but for its notes goes on one anyway, or the
      // page would come back empty and the cutter would never move on.
      if (remaining + whole.extra <= available || (pieces.length === 0 && parts.length === 0 && remaining <= target)) {
        if (keepsNext && available - remaining - whole.extra < KEEP && pieces.length > 0) break;
        pieces.push({ blockId: block.id, from: cursor.offset, to: total });
        parts.push(...whole.parts);
        depth += remaining;
        cursor = { index: cursor.index + 1, offset: 0 };
        continue;
      }
      // Taller than a page: nothing else to do but run it over.
      if (pieces.length === 0 && parts.length === 0 && remaining > target) {
        const run = costOf(block.id, cursor.offset, cursor.offset + available, total);
        pieces.push({ blockId: block.id, from: cursor.offset, to: cursor.offset + available, cut: true });
        if (Number.isFinite(run.extra)) parts.push(...run.parts);
        depth += available;
        cursor = { index: cursor.index, offset: cursor.offset + available };
        continue;
      }
      break;
    }

    if (remaining + whole.extra <= available) {
      if (keepsNext && available - remaining - whole.extra < KEEP && pieces.length > 0) break;
      pieces.push({ blockId: block.id, from: cursor.offset, to: total, cut: cursor.offset > 0 });
      parts.push(...whole.parts);
      depth += remaining;
      cursor = { index: cursor.index + 1, offset: 0 };
      continue;
    }

    // It splits. As many lines as fit with their notes; then neither a single
    // line left over for the next page (a widow) nor a single line left here
    // (an orphan).
    let take = Math.min(available, remaining);
    while (take > 0 && take + costOf(block.id, cursor.offset, cursor.offset + take, total).extra > available) take -= 1;

    /**
     * **Or the last note breaks** (§12). Where its marker's line would have
     * to go over for the note to stand whole, more of the text stays here and
     * the note breaks under it: at least two of its lines on this page, the
     * rest carried to the next. A note of a line or two never breaks — its
     * line goes over with it, which is the better page.
     */
    let broke = false;
    if (!closed) {
      const room = target - depth;
      // The notes whose lines stand here whole already: none of those breaks.
      const standing = new Set(notesIn(notes, block.id, cursor.offset, cursor.offset + take, total));
      for (let lines = Math.min(available, remaining); lines > take; lines -= 1) {
        const more = notesIn(notes, block.id, cursor.offset, cursor.offset + lines, total);
        if (more.length === 0) continue;
        const last = more[more.length - 1] as string;
        if (standing.has(last)) continue;
        const length = linesOfNote(notes, last);
        const before = more.slice(0, -1).map((key) => wholeNote(notes, key));
        let kept = 0;
        for (let here = length - 1; here >= Math.min(2, length); here -= 1) {
          if (lines + notePartsCost(notes, [...parts, ...before, { key: last, from: 0, to: here, lines: length }]) <= room) {
            kept = here;
            break;
          }
        }
        if (kept < 2) continue;
        const to = cursor.offset + lines;
        pieces.push({ blockId: block.id, from: cursor.offset, to, cut: cursor.offset > 0 || to < total });
        parts.push(...before, { key: last, from: 0, to: kept, lines: length });
        depth += lines;
        cursor = to >= total ? { index: cursor.index + 1, offset: 0 } : { index: cursor.index, offset: to };
        carryOut = { key: last, from: kept, lines: length };
        closed = true;
        broke = true;
        break;
      }
    }
    if (broke) break;

    if (remaining - take === 1) take -= 1;
    // A page whose notes are the rest of one from before has already moved
    // the book on, so it need not force a line of text onto itself.
    const forced = pieces.length === 0 && parts.length === 0;
    if (cursor.offset === 0 && take < KEEP) {
      if (forced) take = Math.max(1, take);
      else break;
    }
    // An empty page always takes something: a note taller than the page is
    // set and clipped rather than turning pages for ever.
    if (forced) take = Math.max(1, take);
    if (take <= 0) break;
    const split = costOf(block.id, cursor.offset, cursor.offset + take, total);
    pieces.push({ blockId: block.id, from: cursor.offset, to: cursor.offset + take, cut: true });
    if (Number.isFinite(split.extra)) parts.push(...split.parts);
    depth += take;
    cursor = { index: cursor.index, offset: cursor.offset + take };
    break;
  }

  // A page holding only the rest of a note is still a page (§12).
  if (pieces.length === 0 && parts.length === 0) return empty;
  const after = blocks[cursor.index];
  const continued =
    after !== undefined && isFlow(after) && (cursor.offset > 0 || after.starts === 'none');
  return {
    pieces,
    // The notes' lines are the page's as much as the text's: a spread is
    // balanced on what each page holds, notes and all.
    depth: depth + noted(),
    // The plates this page set aside travel with the cursor (§9q), so the
    // leaves after it draw them before the text goes on.
    cursor: { ...cursor, ...(held.length > 0 ? { held } : {}), ...(carryOut ? { carry: carryOut } : {}) },
    display: false,
    blank: false,
    folio: true,
    chapterTitle,
    numbering,
    continued,
    notes: [...new Set(parts.map((part) => part.key))],
    noteParts: parts,
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
  notes: NotePlacements = NO_NOTES,
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
  /** The division in force, and the numbering it asked for (addendum 43 §10). */
  let section: SectionLayout | null = null;
  let sectionNumbering: 'roman' | 'arabic' | null = null;
  /** Where each numbering stands: a division that restarts sets its own back to nought. */
  let romanAt = 0;
  let arabicAt = 0;

  const record = (filled: Filled, sheet: number, side: 'verso' | 'recto', cut: number): BookPage => {
    if (filled.numbering === 'arabic' && numbering === 'roman' && !filled.blank) numbering = 'arabic';
    // A division opening on this page brings its own layout with it, or the
    // book's back again.
    const head = filled.pieces[0];
    const opener = head && head.from === 0 ? byId.get(head.blockId) : undefined;
    const opensSection = opener ? sectionIdOf(opener) : null;
    if (opensSection !== null && !filled.blank) {
      section = sectionLayoutOf(settings, opensSection);
      sectionNumbering = section?.numbering ?? null;
      if (section?.restart) {
        if ((sectionNumbering ?? numbering) === 'roman') romanAt = 0;
        else arabicAt = 0;
      }
    }
    const scheme = sectionNumbering ?? numbering;
    let number = 0;
    // `roman` and `arabic` count the pages each numbering carries, for the
    // contents' reading of the book; the numbers printed are where each
    // numbering stands, which a restart can set back.
    if (scheme === 'roman') {
      roman += 1;
      number = ++romanAt;
    } else {
      arabic += 1;
      number = ++arabicAt;
    }
    // A book set to carry no page numbers still counts its pages — the
    // contents and the index are read off the count — it just prints none.
    const shows = !filled.blank && filled.folio && showsFolio(settings.folio);
    // What this page's number **is**, printed or not (§9l, from Ken: *it
    // should say page two, page three, page four, page five*). A picture page
    // and a blank leaf are counted like every other and merely print nothing,
    // so `folio` answers *what appears on the paper* and this answers *which
    // page is this* — the rail needs the second and had only the first.
    const counted = scheme === 'roman' ? toRoman(number).toLowerCase() : String(number);
    const folio = shows ? counted : '';
    for (const piece of filled.pieces) {
      if (!where.has(piece.blockId)) where.set(piece.blockId, { numbering: scheme, number });
    }
    chapterTitle = filled.chapterTitle;
    const first = filled.pieces[0] ? byId.get(filled.pieces[0].blockId) : undefined;
    const opens =
      !filled.display &&
      filled.pieces[0]?.from === 0 &&
      (first?.kind === 'chapter_opening' || first?.kind === 'part_opening');
    // An opening page stands clear of the heads and the foot unless its
    // division asks for them (spec §6's *first-page-different*).
    const clear = filled.blank || filled.display || (opens && !section?.headsOnOpening);
    return {
      sheet,
      side,
      numbering: filled.blank ? 'none' : scheme,
      number,
      folio,
      counted,
      runningHead: clear ? '' : headTextFor(side, settings, names, filled.chapterTitle, section),
      runningFoot: clear ? '' : footTextFor(settings, names, filled.chapterTitle, section),
      chapterTitle: filled.chapterTitle,
      display: filled.display,
      blank: filled.blank,
      opens,
      pieces: filled.pieces,
      notes: filled.notes,
      noteParts: filled.noteParts,
      depth: filled.depth,
      target: cut,
    };
  };

  // The first leaf, alone.
  const opening = fillPage(blocks, measured, cursor, target, 'recto', chapterTitle, wraps, notes);
  if (!opening) return { pages, where, roman, arabic };
  pages.push(record(opening, 1, 'recto', target));
  cursor = opening.cursor;

  let sheet = 2;
  while (cursor.index < blocks.length || (cursor.held?.length ?? 0) > 0 || cursor.carry !== undefined) {
    const before = cursor;
    const titleBefore = chapterTitle;
    let verso = fillPage(blocks, measured, cursor, target, 'verso', chapterTitle, wraps, notes);
    if (!verso) break;
    let recto = fillPage(blocks, measured, verso.cursor, target, 'recto', verso.chapterTitle, wraps, notes);
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
      verso = fillPage(blocks, measured, before, cut, 'verso', titleBefore, wraps, notes) ?? verso;
      recto = fillPage(blocks, measured, verso.cursor, cut, 'recto', verso.chapterTitle, wraps, notes);
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
  /**
   * The record the entry stands for (§9v): a division's marker, a section's
   * unit, or a part. What a tick is kept against, and what the screen names
   * a row by — never the page, a page not being a record.
   */
  id: string;
  label: string;
  title: string;
  page: number;
  /** How far in it sits: a chapter inside a story is under it (addendum 22 §6). */
  depth: number;
  /**
   * Whether the page prints it (§9v). Every row comes back either way, so the
   * screen can draw what is left off and the writer can put it back; the
   * print skips the ones that are not listed.
   */
  listed: boolean;
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
export const bookContentsOf = (
  blocks: readonly BookBlock[],
  laid: LaidBook,
  /** The ids the writer has taken off the page (§9v). Everything is on by default. */
  out: ReadonlySet<string> = new Set(),
): BookContentsRow[] =>
  blocks
    .filter((block) => {
      if (block.kind === 'chapter_opening') return true;
      if (block.kind === 'part_opening') return (block.title ?? '').length > 0;
      return block.kind === 'heading' && block.starts !== 'none' && block.text.trim().length > 0;
    })
    .map((block) => {
      const at = laid.where.get(block.id);
      const page = at && at.numbering === 'arabic' ? at.number : 0;
      // **The record, never the block** (§9v). A tick has to survive the book
      // being re-laid, and a block is made afresh every time — so a division
      // is named by its marker, a section by its unit and a part by the part.
      // A chapter inside a story has no number — a collection numbers
      // nothing — so its heading goes where a title goes and the row is
      // indented under its story. Put in the label's column it would hang
      // outside the text block, which is where the first draft drew it.
      if (block.kind === 'heading') {
        const id = block.unitId ?? block.id;
        return { id, label: '', title: block.text.trim(), page, depth: 1, listed: !out.has(id) };
      }
      const id = block.kind === 'part_opening' ? (block.partId ?? block.id) : block.id;
      return {
        id,
        label: block.chapter?.label ?? '',
        title: block.chapter ? block.chapter.title : block.title ?? '',
        page,
        depth: 0,
        listed: !out.has(id),
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
