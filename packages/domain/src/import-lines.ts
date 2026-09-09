import { TRANSITION_WORDS } from './editing.js';
import { summarise, type ImportedElement, type ImportedScript } from './importing.js';
import { scenesFrom } from './import-fdx.js';
import type { ManuscriptElementType } from './entities/manuscript.js';

/**
 * Reading a script out of a PDF (addendum 02 §18).
 *
 * A PDF does not say what a line is. It says where the line sits on the
 * page — and in a screenplay that is very nearly the same thing, because
 * the format *is* the indentation: a cue is 3.7in from the left edge, a
 * speech 2.5in, a parenthetical 3in, action and sluglines at the margin.
 * So the reader works from the left edge of each line, not from guesses
 * about the words.
 *
 * It measures rather than assumes. Every script is typed at a slightly
 * different margin, and a scanned one may be shifted or scaled; so the
 * **margin is taken to be the commonest left edge on the page** — action
 * and sluglines are the bulk of any screenplay — and every other indent is
 * read relative to that. A script printed at a 1.2in margin reads exactly
 * as one printed at 1.5in.
 *
 * Where the geometry is ambiguous the words are asked as a second opinion,
 * and anything decided that way is marked `guessed`, so the writer can be
 * shown what to check rather than discovering it in the middle of a draft.
 */

export interface LaidOutLine {
  text: string;
  /**
   * Distance from the page's left edge, in the PDF's own points (72 to the
   * inch). Anything consistent works: only the differences are read.
   */
  x: number;
  /** Distance down the page, used to tell a new line from a continued one. */
  y: number;
  page: number;
}

/** Twelve-point Courier: one character is 7.2pt wide, six lines to the inch. */
const CHAR = 7.2;

const SCENE_PREFIX = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)[\s.]/i;
const PAGE_NUMBER = /^\s*\d{1,3}\.?\s*$/;
const MORE = /^\s*\(\s*MORE\s*\)\s*$/i;
const CONTINUED = /^\s*\(?\s*CONT(INUED)?[’']?D?\s*\.?\s*\)?\s*$/i;

const isShout = (text: string): boolean => text.length > 0 && text === text.toUpperCase() && /[A-Z]/.test(text);

const looksLikeTransition = (text: string): boolean => {
  const upper = text.trim().toUpperCase();
  if (upper.length > 30) return false;
  return TRANSITION_WORDS.some((word) => upper === word) || /\bTO:$/.test(upper);
};

/**
 * Where a line really starts.
 *
 * Two ways a PDF can indent, and scripts in the wild use both: move the pen
 * before drawing (the `x` of the text run), or draw spaces at the margin.
 * A file that pads with spaces has the same `x` on every line, and reading
 * `x` alone would make every line an action line — no cues, so no cast, and
 * no speeches, so no dialogue. They are additive, so both are counted.
 */
const startOf = (line: LaidOutLine): number => {
  const padding = line.text.length - line.text.replace(/^\s+/, '').length;
  return line.x + padding * CHAR;
};

/**
 * The margin: the **leftmost edge the page actually uses**, not the commonest.
 *
 * Commonest was wrong, and wrong in the way that matters. In a talky script
 * the speech indent is the commonest edge — dialogue outnumbers action on
 * page after page — so the margin came out an inch too far right, every cue
 * fell short of the cue band, and the whole script imported as action with no
 * cast at all. Action and sluglines are always *present* at the true margin
 * even when they are outnumbered, so the leftmost edge with real use behind
 * it is the margin, and how popular it is does not come into it.
 *
 * "Real use" keeps a stray line — a header, a revision mark in the gutter —
 * from dragging the margin left: an edge has to carry a twentieth of the
 * page's lines, or three of them, whichever is more forgiving.
 */
export const marginOf = (lines: readonly LaidOutLine[]): number => {
  // Round to a quarter-character so two lines typed at the same margin count
  // together despite the sub-point wobble a PDF carries.
  const edge = (line: LaidOutLine): number => Math.round((startOf(line) / CHAR) * 4) / 4;

  const counts = new Map<number, number>();
  const sluglines = new Map<number, number>();
  let total = 0;
  for (const line of lines) {
    const text = line.text.trim();
    if (text.length === 0) continue;
    const key = edge(line);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    // A slugline is at the margin by definition — that is what a margin is.
    // It is the one line whose position the format guarantees, so where the
    // page has them they settle the question outright.
    if (SCENE_PREFIX.test(text)) sluglines.set(key, (sluglines.get(key) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return 0;

  if (sluglines.size > 0) {
    let best = 0;
    let mostSeen = -1;
    for (const [key, seen] of sluglines) {
      if (seen > mostSeen || (seen === mostSeen && key < best)) {
        best = key;
        mostSeen = seen;
      }
    }
    return best * CHAR;
  }

  // No sluglines — an extract, or a script that writes them some other way.
  // Then it is the leftmost edge with real use behind it, which keeps a stray
  // header or a revision mark in the gutter from dragging the margin left.
  const enough = Math.max(2, Math.ceil(total * 0.05));
  let best: number | null = null;
  for (const [key, seen] of counts) {
    if (seen < enough) continue;
    if (best === null || key < best) best = key;
  }
  return (best ?? Math.min(...counts.keys())) * CHAR;
};

/** Indent in characters from the margin, which is what the format is written in. */
const indentOf = (line: LaidOutLine, margin: number): number => Math.max(0, Math.round((startOf(line) - margin) / CHAR));

/**
 * What a line is, from where it sits and — only where that is not enough —
 * what it says. The indents are the standard ones measured from the margin:
 * dialogue at 10, parentheticals at 13, cues at 22, transitions far right.
 */
const classify = (
  line: LaidOutLine,
  margin: number,
  previous: ImportedElement | null,
): { type: ManuscriptElementType; guessed: boolean } => {
  const text = line.text.trim();
  const indent = indentOf(line, margin);

  if (SCENE_PREFIX.test(text)) return { type: 'scene_heading', guessed: false };

  // Far right and shouting: a transition. The words confirm it.
  if (indent >= 30 || (indent >= 24 && looksLikeTransition(text))) {
    return { type: 'transition', guessed: !looksLikeTransition(text) };
  }

  if (/^\(.*\)$/.test(text)) return { type: 'parenthetical', guessed: false };

  // The cue band. A cue is short, shouts, and is followed by a speech.
  if (indent >= 18) {
    if (isShout(text) && text.length <= 40) return { type: 'character', guessed: false };
    // Shouting is what a cue does; something else up there is a guess.
    return { type: 'character', guessed: true };
  }

  // The dialogue band, which parentheticals also start in.
  if (indent >= 7) {
    if (/^\(/.test(text)) return { type: 'parenthetical', guessed: false };
    return { type: 'dialogue', guessed: false };
  }

  // At the margin. A shout on its own here is usually a slug the script
  // wrote without INT./EXT. — "LATER", "MONTAGE" — which is a scene heading.
  if (isShout(text) && text.length <= 40 && previous?.type !== 'dialogue') {
    return { type: 'scene_heading', guessed: true };
  }
  return { type: 'action', guessed: false };
};

/**
 * The title page, and the script after it.
 *
 * A screenplay's title page is page one, and it is unmistakable once you say
 * what it is: a handful of centred lines with no slugline among them. Left in,
 * every one of those lines lands in the cue band — they are centred, and a cue
 * is the only thing that far in — so the title and the author's name would
 * come in as characters who speak once. So it is taken off the front, and the
 * title and the by-line are read from it, which is the only place they are.
 */
const splitTitlePage = (
  lines: readonly LaidOutLine[],
): { titlePage: { title: string; author: string }; rest: LaidOutLine[] } => {
  const none = { titlePage: { title: '', author: '' }, rest: [...lines] };
  const first = lines.filter((line) => line.page === (lines[0]?.page ?? 1));
  if (first.length === 0 || first.length > 14) return none;
  if (first.some((line) => SCENE_PREFIX.test(line.text.trim()))) return none;
  // A page that is only a few lines and has no scene on it is a title page —
  // unless it is the whole document, which would leave nothing to import.
  if (first.length === lines.length) return none;

  const texts = first.map((line) => line.text.trim()).filter((text) => text.length > 0);
  const byIndex = texts.findIndex((text) => /^(written\s+)?by$/i.test(text) || /^(written\s+)?by\s+\S/i.test(text));
  const author =
    byIndex === -1
      ? ''
      : /^(written\s+)?by\s+\S/i.test(texts[byIndex] as string)
        ? (texts[byIndex] as string).replace(/^(written\s+)?by\s+/i, '').trim()
        : (texts[byIndex + 1] ?? '').trim();

  return {
    titlePage: { title: texts[0] ?? '', author },
    rest: lines.filter((line) => line.page !== (lines[0]?.page ?? 1)),
  };
};

/** Lines a screenplay prints but nobody wrote: page numbers, (MORE), CONTINUED. */
const isFurniture = (text: string): boolean =>
  text.length === 0 || PAGE_NUMBER.test(text) || MORE.test(text) || CONTINUED.test(text);

/**
 * Read the laid-out lines of a script.
 *
 * Lines that belong to one paragraph are rejoined: a PDF breaks text at the
 * column width, and a speech that arrived as four lines is one speech. Two
 * lines join when they are the same kind, at the same indent, and follow one
 * another down the page without a blank between them.
 */
export const readLaidOutLines = (lines: readonly LaidOutLine[], options: { title?: string } = {}): ImportedScript => {
  const withoutFurniture = lines.filter((line) => !isFurniture(line.text.trim()));
  const { titlePage, rest } = splitTitlePage(withoutFurniture);
  const usable = rest;
  const margin = marginOf(usable);
  const warnings: string[] = [];

  const elements: ImportedElement[] = [];
  let previousLine: LaidOutLine | null = null;
  let guessedCount = 0;

  for (const line of usable) {
    const text = line.text.trim();
    const previous = elements[elements.length - 1] ?? null;
    const { type, guessed } = classify(line, margin, previous);
    if (guessed) guessedCount += 1;

    const sameIndent = previousLine !== null && Math.abs(startOf(previousLine) - startOf(line)) < CHAR;
    // A gap of much more than one line means a paragraph ended. Line spacing
    // is 12pt at 12 point, so anything past about 1.6 lines is a break.
    const gap = previousLine !== null && previousLine.page === line.page ? Math.abs(line.y - previousLine.y) : Infinity;
    const runsOn =
      previous !== null &&
      previous.type === type &&
      sameIndent &&
      gap < 20 &&
      // A cue and a slugline are one line each by definition; two of them in
      // a row are two of them, never one wrapped.
      type !== 'character' &&
      type !== 'scene_heading' &&
      type !== 'transition';

    if (runsOn && previous) {
      // Hyphenated across the break, or simply wrapped.
      previous.text = /-$/.test(previous.text) ? previous.text.slice(0, -1) + text : `${previous.text} ${text}`;
    } else {
      elements.push({ type, text: type === 'character' ? text.toUpperCase() : text, ...(guessed ? { guessed } : {}) });
    }
    previousLine = line;
  }

  if (elements.length === 0) {
    warnings.push('No text could be read out of that PDF. If it is a scan, it has no text layer to read.');
  }
  if (guessedCount > 0) {
    warnings.push(
      `${guessedCount} ${guessedCount === 1 ? 'line was' : 'lines were'} worked out from their shape rather than read outright. They are marked, and worth a look.`,
    );
  }
  const pages = new Set(usable.map((line) => line.page)).size;
  if (pages > 0 && elements.length / pages < 8) {
    warnings.push('Very little text per page — the PDF may be a scan, or laid out in a way this could not follow.');
  }

  return summarise({
    title: titlePage.title || options.title || '',
    author: titlePage.author,
    scenes: scenesFrom(elements),
    warnings,
    source: 'pdf',
  });
};
