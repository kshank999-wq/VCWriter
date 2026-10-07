import { z } from 'zod';
import { lineStyleSchema, lineStyleVars, type LineStyle } from './chapter-style.js';
import { PART_FACES } from './part-style.js';
import { faceStackOf } from './book-layout.js';
import { nounsFor } from './formats.js';
import type { ProjectFormat } from './entities/project.js';
import type { BookFont } from './entities/book.js';
import type { BookFace, BookSettings, FolioPlace, HeadContent, HeadPlace } from './entities/book.js';

/**
 * The running heads and the folios, and how they are set (addendum 20 §7a,
 * from Ken: *the running headers and footers need to be adjustable*).
 *
 * He was right and the gap was wider than the word suggests. There were four
 * dropdowns — what each side carries, where the page number sits, whether an
 * opening shows one — and **nothing at all about how any of it looks**, with a
 * sentence under them saying so out loud: *the words in the running heads are
 * read from the book and its chapters; nothing about them is typed here.* The
 * size, the case, the tracking and the face were hard-coded in the print
 * stylesheet, and the verso and the recto were hard-coded **differently**: one
 * in capitals, the other in italic, neither sayable and neither changeable. A
 * writer who set the whole book in a sans face still got a serif running head.
 *
 * The audit paid a **fourteenth** time: a running head is **a line of type**,
 * and `LineStyle` is already the record for that — size, case, weight, slope
 * and tracking — built for the chapter page and read again by the front
 * matter's pages. So there is no new vocabulary here, and `lineStyleVars` is
 * the one place that decides what a line's fields mean (it was two private
 * copies before this and would have been three).
 *
 * Three decisions carry it.
 *
 * **Three lines rather than one.** The verso, the recto and the folio are set
 * separately, because the hard-coded difference between the verso and the
 * recto was a real convention rather than an accident — the author's name in
 * capitals against the chapter's in italic. Collapsing them into one style
 * would have made every existing book change on the next open. So the defaults
 * are exactly what the stylesheet printed, and what was hidden is now the
 * writer's to see and to change.
 *
 * **One list of contents for both sides.** There were two enums: the verso
 * could carry the author or the title, the recto the chapter or the title.
 * Neither side could state why it was refused the other's, so both now offer
 * the same five, `custom` among them — the writer's own words, which nothing
 * else could say, a series name or a part's.
 *
 * **A size in points, not a share of the body.** The stylesheet set the head
 * at `0.8em`, so it grew when the body grew. A running head is its own size:
 * it is furniture rather than text, and a book set a point larger does not
 * want a larger running head. This is the one thing about an existing book
 * that reads differently, and only where the body is not 11 pt.
 */

// ------------------------------------------------------------------- style

export const runningHeadStyleSchema = z.object({
  /** The book's own face, or one chosen for the furniture alone. */
  face: z.enum(PART_FACES).default('book'),
  /** Left-hand pages: capitals, tracked open — what the stylesheet printed. */
  verso: lineStyleSchema.default({ size: 9, case: 'capitals', tracking: 12 }),
  /** Right-hand pages: italic, barely tracked — likewise. */
  recto: lineStyleSchema.default({ size: 9, italic: true, tracking: 2 }),
  /** The page number. */
  folio: lineStyleSchema.default({ size: 9 }),
});
export type RunningHeadStyle = z.infer<typeof runningHeadStyleSchema>;

/** The style as it stands, an older book reading as the defaults. */
export const runningHeadStyleOf = (settings: BookSettings): RunningHeadStyle =>
  runningHeadStyleSchema.parse(settings.runningHeadStyle ?? {});

/**
 * The style as CSS custom properties — the one place that decides what they
 * mean, read by the print, the spread and the eBook's fixed pages alike
 * (`chapterStyleVars`' rule). *Book* as the face means the book's body face.
 */
export const runningStyleVars = (
  style: RunningHeadStyle,
  bookFace: string,
  fonts: readonly BookFont[] = [],
): Record<string, string> => ({
  '--bk-run-face': faceStackOf(style.face === 'book' ? bookFace : style.face, fonts),
  ...lineStyleVars('--bk-run-verso', style.verso),
  ...lineStyleVars('--bk-run-recto', style.recto),
  ...lineStyleVars('--bk-run-folio', style.folio),
});

// ------------------------------------------------------------------- words

/** The names the book can put in a running head, for the reading below. */
export interface RunningNames {
  title: string;
  author: string;
}

/**
 * What one side's running head says on a page. **The one place the question is
 * answered**, so the laying, a preview and anything later cannot disagree —
 * and where a side carries `custom`, the writer's words are used exactly as
 * typed, trimmed and never cased here (the case is the style's).
 */
export const headTextFor = (
  side: 'verso' | 'recto',
  settings: BookSettings,
  names: RunningNames,
  chapterTitle: string,
): string => {
  const heads = settings.runningHeads;
  const what: HeadContent = side === 'verso' ? heads.verso : heads.recto;
  const typed = (side === 'verso' ? heads.versoText : heads.rectoText).trim();
  if (what === 'author') return names.author;
  if (what === 'title') return names.title;
  if (what === 'chapter') return chapterTitle;
  if (what === 'custom') return typed;
  return '';
};

// ------------------------------------------------------------------ places

/** Which side of the page a head hangs on, given where it sits and which side. */
export const headSideClass = (place: HeadPlace, side: 'verso' | 'recto'): string => {
  if (place === 'centre') return 'centre';
  // The outside of a verso is its left edge; of a recto, its right.
  const outer = side === 'verso' ? 'left' : 'right';
  const inner = side === 'verso' ? 'right' : 'left';
  return place === 'outside' ? outer : inner;
};

/** Whether the book prints a page number at all. */
export const showsFolio = (place: FolioPlace): boolean => place !== 'none';

// ------------------------------------------------------- the two tops at once

/**
 * **What stands along the top of each page, as one named arrangement** (§7b,
 * from Ken: *in the book settings, when you want to add the book title, there
 * needs to be another category called chapter or story title… right now, if
 * you add a book title, it adds it to both sides of the page for some reason.
 * There's no way to determine the title on one side or the other*).
 *
 * The audit paid first and it paid most of the ask: §7a built **one list for
 * both sides** with five values among them `chapter`, which the room already
 * names in the format's own noun — on a collection the select literally reads
 * *The story's title*. So the category he asks for exists under exactly the
 * name he asks for, and both sides have been set separately since §7a.
 *
 * What is wrong is **where that pair stands and what it is called**. Measured
 * in the real room, Book settings is 2,662px of dialog in a 760px window: the
 * book's title is at the top, the sentence under it says the title goes *on
 * the running heads*, and the pair that decides which top is at **y≈1,409** —
 * two screens down, behind a scroll, under a printer's word for the thing a
 * writer calls *the top of the page*. That is §15c's fault in a smaller box
 * and §9u's from the other end: the control exists and the writer who was
 * told it exists cannot reach it.
 *
 * So the pair is said **once more, where the titles are typed**, as one row
 * naming **both tops at once** — a second control onto one field (§16d) and
 * never a second answer, since it writes the same `verso` and `recto` the
 * furniture fold writes. **Which arrangement is in force is read back, never
 * stored** (`bookPresetOf`'s rule, this room's fifth time), so setting the two
 * sides by hand to a pair that is not on the list reads as *set on their own*
 * rather than as the nearest one.
 */
export interface HeadArrangement {
  id: string;
  verso: HeadContent;
  recto: HeadContent;
}

/**
 * The arrangements a book actually uses. Few on purpose: the fine control is
 * the pair in the furniture fold, and a list long enough to need reading is
 * not the *simple way* that was asked for.
 */
export const HEAD_ARRANGEMENTS: readonly HeadArrangement[] = [
  { id: 'author_division', verso: 'author', recto: 'chapter' },
  { id: 'title_division', verso: 'title', recto: 'chapter' },
  { id: 'division_both', verso: 'chapter', recto: 'chapter' },
  { id: 'title_both', verso: 'title', recto: 'title' },
  { id: 'none', verso: 'none', recto: 'none' },
];

/** Which of them the book is set to, or null — *set on their own*. */
export const headArrangementOf = (settings: BookSettings): HeadArrangement | null =>
  HEAD_ARRANGEMENTS.find((one) => one.verso === settings.runningHeads.verso && one.recto === settings.runningHeads.recto) ?? null;

/** One side of an arrangement in words, in the format's own noun. */
const sideWords = (what: HeadContent, noun: string): string => {
  if (what === 'author') return 'the author';
  if (what === 'title') return 'the book’s title';
  if (what === 'chapter') return `the ${noun.toLowerCase()}’s title`;
  if (what === 'custom') return 'words of your own';
  return 'nothing';
};

/** An arrangement named for what it puts on each top. */
export const sayArrangement = (one: HeadArrangement, format: ProjectFormat): string => {
  const noun = nounsFor(format).division;
  if (one.verso === 'none' && one.recto === 'none') return 'Nothing along the top';
  const left = sideWords(one.verso, noun);
  const right = sideWords(one.recto, noun);
  if (left === right) return `${left[0]!.toUpperCase()}${left.slice(1)} on both`;
  return `${left[0]!.toUpperCase()}${left.slice(1)} on the left, ${right} on the right`;
};

/**
 * **What the two tops will actually say, in the book's own words.** This is
 * the half that answers *for some reason*: on a collection of one story,
 * imported from a file, the book's name and the story's name are the same
 * string — so both tops print the same words and nothing on the screen says
 * which of them is the story's. Naming the category alone cannot show that;
 * the words can.
 *
 * Where a side carries the division's title and the book has no division to
 * read yet, the phrase names the category rather than inventing a title.
 */
export const describeHeadTops = (
  settings: BookSettings,
  names: RunningNames,
  divisionTitle: string,
  format: ProjectFormat,
): string => {
  const noun = nounsFor(format).division.toLowerCase();
  const phrase = (side: 'verso' | 'recto'): string => {
    const what: HeadContent = side === 'verso' ? settings.runningHeads.verso : settings.runningHeads.recto;
    if (what === 'chapter' && !divisionTitle.trim()) return `each ${noun}’s own title`;
    const words = headTextFor(side, settings, names, divisionTitle).trim();
    return words ? `“${words}”` : 'nothing';
  };
  const left = phrase('verso');
  const right = phrase('recto');
  if (left === 'nothing' && right === 'nothing') return 'Nothing is printed along the top of either page.';
  const said = `${left[0]!.toUpperCase()}${left.slice(1)} on the left, ${right} on the right.`;
  // The two being the same words is a fact about the book rather than a fault,
  // and saying so is what stops it reading as one.
  return left === right ? `${said} Both tops read the same words.` : said;
};

export const HEAD_CONTENT_WORDS: Record<HeadContent, string> = {
  author: 'The author',
  title: 'The book’s title',
  chapter: 'The division’s title',
  custom: 'Words of your own',
  none: 'Nothing',
};

export const HEAD_PLACE_WORDS: Record<HeadPlace, string> = {
  centre: 'Centred',
  outside: 'At the outer edge',
  inside: 'At the inner edge',
};

export const FOLIO_PLACE_WORDS: Record<FolioPlace, string> = {
  foot_outside: 'At the outer foot',
  foot_centre: 'Centred at the foot',
  head_outside: 'At the outer head',
  none: 'No page numbers',
};
