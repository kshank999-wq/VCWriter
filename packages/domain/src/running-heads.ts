import { z } from 'zod';
import { lineStyleSchema, lineStyleVars, type LineStyle } from './chapter-style.js';
import { PART_FACES } from './part-style.js';
import { faceStackOf } from './book-layout.js';
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
