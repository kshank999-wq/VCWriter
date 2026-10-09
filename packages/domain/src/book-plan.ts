import {
  MAX_BLANK_PAGES,
  PART_KINDS,
  bookPartSchema,
  partInsetSchema,
  type BookPart,
  type PartInset,
  type PartKind,
} from './entities/book.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import { parseInline, type InlineSpan } from './entities/inline.js';
import { chapterLeafContent, chapterPageStyleSchema, type LineStyle } from './chapter-style.js';
import { chapterPageSchema } from './entities/structure.js';
import { contentsDivisions, type ChapterPageContent, type PlacedMarker } from './markers.js';
import { bookNames, bookSettingsOf, setBookSettings } from './book-layout.js';
import { beatsInScript, unitsInStoryOrder } from './selectors.js';
import { newId } from './ids.js';
import { partHasStyle, partLogo, partPlacement, partStyleOf, proseStyleBase, type PartStyle, type PartStylePatch } from './part-style.js';
import { isCollection } from './formats.js';
import { placeFigure } from './instructional.js';
import { copyrightLines, copyrightOf, type CopyrightLine } from './copyright-page.js';
import { titlePageContent, titlePageFieldsOf, type TitlePageContent } from './title-page.js';
import { aboutAuthorOf, acknowledgementsOf, authorLinksShown, type AuthorPhotoShape } from './back-matter.js';
import { bibliographyEntries, glossaryEntries, glossaryLetter, glossaryOf, readerExtraOf } from './back-matter-pages.js';
import type { BookPage } from './book-pages.js';
import type { ProjectFile } from './project-file.js';

/**
 * The plan of the book (addendum 20 §5): the parts in front of the story and
 * behind it, and the whole book as a sequence of blocks.
 *
 * Two rules shape it. **The story is not a part** — it is the manuscript in
 * story order, and nothing here reorders it. And **a part with a reading
 * behind it stores only its place**: the contents page's rows, the index's
 * entries and the chapter pages all come from readings that already exist,
 * and a part record that held a copy of any of them would be a second answer.
 */

// ------------------------------------------------------------------- kinds

export type PartCarries = 'text' | 'reading' | 'plate';
export type PartHalf = 'front' | 'back' | 'either';

export interface PartKindInfo {
  kind: PartKind;
  name: string;
  carries: PartCarries;
  half: PartHalf;
  /** A book has one of these, or none. */
  once: boolean;
  /** Said on the list, so the writer knows what they are adding. */
  note: string;
}

const info = (
  kind: PartKind,
  name: string,
  carries: PartCarries,
  half: PartHalf,
  once: boolean,
  note: string,
): PartKindInfo => ({ kind, name, carries, half, once, note });

export const PART_INFO: Record<PartKind, PartKindInfo> = {
  half_title: info('half_title', 'Half title', 'reading', 'front', true, 'the title alone, on the first leaf'),
  title_page: info('title_page', 'Title page', 'reading', 'front', true, 'title, author and publisher'),
  copyright: info('copyright', 'Copyright', 'text', 'front', true, 'the notice, the ISBN, the edition'),
  dedication: info('dedication', 'Dedication', 'text', 'front', true, 'a few lines, on a page of their own'),
  epigraph: info('epigraph', 'Epigraph', 'text', 'front', true, 'a quotation before the story'),
  contents: info('contents', 'Contents', 'reading', 'front', true, 'the chapters and where they begin'),
  foreword: info('foreword', 'Foreword', 'text', 'front', false, 'by somebody other than the author'),
  preface: info('preface', 'Preface', 'text', 'front', false, 'the author, on the book'),
  introduction: info('introduction', 'Introduction', 'text', 'front', false, 'the author, on the subject'),
  prologue: info('prologue', 'Prologue', 'text', 'front', false, 'story before the story'),
  epilogue: info('epilogue', 'Epilogue', 'text', 'back', false, 'story after the story'),
  afterword: info('afterword', 'Afterword', 'text', 'back', false, 'the author, afterwards'),
  acknowledgements: info('acknowledgements', 'Acknowledgements', 'text', 'back', false, 'thanks to the people who helped make the book'),
  // The three the back matter's handoff added (§17). An appendix and a
  // reader extra may each appear several times; a bibliography is one list.
  appendix: info('appendix', 'Appendix', 'text', 'back', false, 'supporting material that would interrupt the story'),
  bibliography: info('bibliography', 'Bibliography', 'text', 'back', true, 'sources and references used for research'),
  reader_extra: info('reader_extra', 'Reader extras', 'text', 'back', false, 'calls to action and teasers'),
  glossary: info('glossary', 'Glossary', 'text', 'back', false, 'the terms, explained'),
  about_the_author: info('about_the_author', 'About the author', 'text', 'back', true, 'a short biography'),
  also_by: info('also_by', 'Also by', 'text', 'back', true, 'the author’s other books'),
  index: info('index', 'Index', 'reading', 'back', true, 'the marks the writer placed, with their pages'),
  plate: info('plate', 'Art page', 'plate', 'either', false, 'a picture that fills the page, edge to edge'),
};

export const partInfo = (kind: PartKind): PartKindInfo => PART_INFO[kind];

/** The kinds a writer may add, in the order the list offers them. */
export const ADDABLE_KINDS: readonly PartKind[] = PART_KINDS;

// ------------------------------------------------------------------- parts

/**
 * The parts nearly every book has (§5). Ids are fixed words rather than
 * fresh ids, so a book that has never touched its plan reads the same list
 * every time and a test can name them.
 */
export const defaultParts = (): BookPart[] =>
  (['half_title', 'title_page', 'copyright', 'contents', 'about_the_author'] as const).map((kind) =>
    bookPartSchema.parse({ id: `default:${kind}`, kind }),
  );

/** The plan as it stands: the writer's, or the default until they touch it. */
export const partsOf = (file: ProjectFile): BookPart[] => bookSettingsOf(file).parts ?? defaultParts();

/**
 * Which half a part stands in. A plate before a chapter is in the story; one
 * with no chapter to face is in the front matter if it says so, at the back
 * otherwise (§9).
 */
export const halfOf = (part: BookPart): 'front' | 'body' | 'back' => {
  const half = PART_INFO[part.kind].half;
  if (half !== 'either') return half;
  if (part.beforeMarkerId) return 'body';
  return part.inFront ? 'front' : 'back';
};

export const frontParts = (parts: readonly BookPart[]): BookPart[] => parts.filter((part) => halfOf(part) === 'front');
export const backParts = (parts: readonly BookPart[]): BookPart[] => parts.filter((part) => halfOf(part) === 'back');

const writeParts = (file: ProjectFile, parts: BookPart[]): ProjectFile => setBookSettings(file, { parts });

/** The heading a part prints, the kind's name where the writer gave none. */
export const partTitle = (part: BookPart): string => part.title.trim() || PART_INFO[part.kind].name;

/**
 * Add a part. A kind the book has one of already is refused — a second
 * contents page is a mistake and not a choice. A front-matter part goes at
 * the end of the front matter, a back-matter part at the end of the book.
 */
export const addPart = (
  file: ProjectFile,
  kind: PartKind,
  input: Partial<Omit<BookPart, 'id' | 'kind'>> = {},
  /**
   * **Where it goes in** (§9ab, from Ken: *I should be able to insert a page
   * at any point. That page can be anything*). The id of the part it stands
   * **in front of**, which is the blank leaf's own rule (`blankBefore`) said
   * of a page: one meaning for *insert here*, and the page in hand moves
   * down. Null appends to its half, which is what every caller did before and
   * what the menu still does where no page is in hand.
   */
  before: string | null = null,
): { file: ProjectFile; partId: string | null } => {
  const parts = partsOf(file);
  if (PART_INFO[kind].once && parts.some((part) => part.kind === kind)) return { file, partId: null };
  const part = bookPartSchema.parse({ ...input, id: newId() as string, kind });
  const half = halfOf(part);
  // Only within its own half: the story stands between them and nothing
  // crosses it, which is `movePart`'s rule and the reason a dedication
  // cannot be inserted in front of the index.
  const at = before === null ? -1 : parts.findIndex((one) => one.id === before && halfOf(one) === half);
  if (at !== -1) {
    return { file: writeParts(file, [...parts.slice(0, at), part, ...parts.slice(at)]), partId: part.id };
  }
  if (half === 'front') {
    const last = parts.map((one) => halfOf(one)).lastIndexOf('front');
    const put = last === -1 ? 0 : last + 1;
    return { file: writeParts(file, [...parts.slice(0, put), part, ...parts.slice(put)]), partId: part.id };
  }
  return { file: writeParts(file, [...parts, part]), partId: part.id };
};

export const removePart = (file: ProjectFile, partId: string): ProjectFile =>
  writeParts(
    file,
    partsOf(file).filter((part) => part.id !== partId),
  );

export const updatePart = (
  file: ProjectFile,
  partId: string,
  patch: Partial<Omit<BookPart, 'id' | 'kind'>>,
): ProjectFile =>
  writeParts(
    file,
    partsOf(file).map((part) => (part.id === partId ? bookPartSchema.parse({ ...part, ...patch }) : part)),
  );

/**
 * Move a part up or down among the parts of its own half. The story stands
 * between the halves and nothing crosses it: a dedication cannot be moved
 * behind the last chapter by pressing ↓ enough times.
 */
export const movePart = (file: ProjectFile, partId: string, direction: -1 | 1): ProjectFile => {
  const parts = partsOf(file);
  const at = parts.findIndex((part) => part.id === partId);
  if (at === -1) return file;
  const mine = halfOf(parts[at] as BookPart);
  let other = at + direction;
  while (other >= 0 && other < parts.length && halfOf(parts[other] as BookPart) !== mine) other += direction;
  if (other < 0 || other >= parts.length) return file;
  const next = parts.slice();
  const [moved] = next.splice(at, 1);
  next.splice(other, 0, moved as BookPart);
  return writeParts(file, next);
};

/**
 * Put a part before another, or at the end of its half. The halves hold:
 * a part dragged onto the other half is left where it was, since the story
 * stands between them and nothing crosses it.
 */
export const placePart = (file: ProjectFile, partId: string, beforePartId: string | null): ProjectFile => {
  if (partId === beforePartId) return file;
  const parts = partsOf(file);
  const moving = parts.find((part) => part.id === partId);
  if (!moving) return file;
  const half = halfOf(moving);
  const rest = parts.filter((part) => part.id !== partId);
  let at: number;
  if (beforePartId === null) {
    const last = rest.map((part) => halfOf(part)).lastIndexOf(half);
    at = last === -1 ? (half === 'front' ? 0 : rest.length) : last + 1;
  } else {
    const target = rest.find((part) => part.id === beforePartId);
    if (!target || halfOf(target) !== half) return file;
    at = rest.indexOf(target);
  }
  return writeParts(file, [...rest.slice(0, at), moving, ...rest.slice(at)]);
};

/**
 * Move a part into the front matter or the back (§9k, from Ken: *you can drag
 * things into it*). The two areas are drop targets, and this is what a drop on
 * one means.
 *
 * **Most parts have no choice and the refusal says so.** A copyright page is
 * front matter and an index is back matter because that is what those pages
 * are, not because of where they were dropped — so the act refuses in a
 * sentence rather than moving something a book would print wrongly. What
 * really moves is an **art page**, which is the one kind that belongs wherever
 * a writer wants it, and that is `inFront`'s whole reason for existing (§8).
 */
export const partToHalf = (
  file: ProjectFile,
  partId: string,
  half: 'front' | 'back',
): { file: ProjectFile; refusal: string | null } => {
  const part = partsOf(file).find((one) => one.id === partId);
  if (!part) return { file, refusal: null };
  if (halfOf(part) === half) return { file, refusal: null };
  const fixed = PART_INFO[part.kind].half;
  if (fixed !== 'either') {
    const where = fixed === 'front' ? 'the front matter' : 'the back matter';
    return { file, refusal: `${PART_INFO[part.kind].name} belongs in ${where}. That is what the page is, so it stays there.` };
  }
  // An art page facing a chapter comes out of the story to go to either half.
  const moved = updatePart(file, partId, { inFront: half === 'front', beforeMarkerId: null });
  return { file: placePart(moved, partId, null), refusal: null };
};

/** Whether a kind can still be added: once-only kinds the book already has cannot. */
export const mayAdd = (file: ProjectFile, kind: PartKind): boolean =>
  !PART_INFO[kind].once || !partsOf(file).some((part) => part.kind === kind);

// ------------------------------------------------------- pictures in a part

/**
 * Whether a kind's words run as paragraphs a picture can cut into (§8): the
 * prose parts do; a dedication, an epigraph and a copyright notice stand
 * alone on a page of their own, and a reading part has no words at all.
 */
export const partTakesInsets = (kind: PartKind): boolean =>
  PART_INFO[kind].carries === 'text' && kind !== 'dedication' && kind !== 'epigraph' && kind !== 'copyright';

/**
 * **Whether the words on this page are the writer's own** (§17e, from Ken:
 * *when I add a dedication page, it doesn't allow me to actually add any text
 * to it*).
 *
 * A half title and a title page print the **book's** title, read from one
 * place (§3a), and a copyright page prints its own fields (§15). A dedication
 * and an epigraph print `part.text` and nothing else, which nothing but the
 * part dialog could ever type — and the part dialog stopped being reachable
 * for them the day the designed-page screen took the double-click (§9n) and
 * the inspector that held the only other route was removed (§9u). So the
 * screen that replaced it asks this and carries the box.
 */
export const partCarriesOwnWords = (kind: PartKind): boolean =>
  partPlacement(kind) === 'block' && PART_INFO[kind].carries === 'text' && kind !== 'copyright';

const withInsets = (file: ProjectFile, partId: string, change: (insets: PartInset[]) => PartInset[]): ProjectFile =>
  writeParts(
    file,
    partsOf(file).map((part) => (part.id === partId ? bookPartSchema.parse({ ...part, insets: change(part.insets) }) : part)),
  );

const clampSpan = (span: number | undefined): number =>
  Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, span ?? INSET_SPAN.default));

/** Cut a picture into a part's text, beside the paragraph named (nought is the first). */
export const addPartInset = (
  file: ProjectFile,
  partId: string,
  input: Partial<Omit<PartInset, 'id'>> = {},
): { file: ProjectFile; insetId: string | null } => {
  const part = partsOf(file).find((one) => one.id === partId);
  if (!part || !partTakesInsets(part.kind)) return { file, insetId: null };
  const inset = partInsetSchema.parse({ ...input, span: clampSpan(input.span), id: newId() as string });
  return { file: withInsets(file, partId, (insets) => [...insets, inset]), insetId: inset.id };
};

export const updatePartInset = (file: ProjectFile, partId: string, insetId: string, patch: Partial<Omit<PartInset, 'id'>>): ProjectFile =>
  withInsets(file, partId, (insets) =>
    insets.map((inset) =>
      inset.id === insetId ? partInsetSchema.parse({ ...inset, ...patch, span: clampSpan(patch.span ?? inset.span) }) : inset,
    ),
  );

export const removePartInset = (file: ProjectFile, partId: string, insetId: string): ProjectFile =>
  withInsets(file, partId, (insets) => insets.filter((inset) => inset.id !== insetId));

/** The part a picture on the page belongs to, by the inset's id, for a press on the spread. */
export const partOfInset = (file: ProjectFile, insetId: string): BookPart | undefined =>
  partsOf(file).find((part) => part.insets.some((inset) => inset.id === insetId));

// ------------------------------------------------------------------ blocks

export type BlockKind =
  | 'half_title'
  | 'title_page'
  | 'copyright'
  | 'contents'
  | 'index'
  | 'part_opening'
  | 'chapter_opening'
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'scene_break'
  | 'figure'
  | 'plate'
  /**
   * A leaf left deliberately empty (§9i, from Ken: *when you enter an
   * illustration, you need an option for the back page to be blank, so the
   * illustration doesn't bleed through*). It is a block rather than the
   * cutter's own blank because it is the **writer's**: theirs to ask for,
   * theirs to take away, and named on the rail where the cutter's is not.
   */
  | 'blank';

/** Where a block begins on the page (§5's conventions). */
export type BlockStart = 'none' | 'page' | 'recto' | 'verso';

/**
 * One thing the book is made of, in order, with every rule about it that
 * the laying needs (§4). The renderer measures how many lines each makes;
 * the domain never guesses that.
 */
export interface BookBlock {
  /** The element's, the part's or the marker's id — what `where` is keyed by. */
  id: string;
  kind: BlockKind;
  /** Which numbering it falls under. */
  numbering: 'roman' | 'arabic';
  starts: BlockStart;
  /**
   * A display page: no running head, and a whole page to itself. A chapter
   * opening that is a leaf, a half title, a plate.
   */
  display: boolean;
  /** Whether a display page shows its page number. */
  folio: boolean;
  /** A heading keeps the lines after it; a picture never splits. */
  keepWithNext: boolean;
  unbreakable: boolean;
  /** The words, for a text block. */
  text: string;
  spans: InlineSpan[];
  /** The chapter's title in force from here on, for the recto running head. */
  chapterTitle: string;
  /** The leaf, on a chapter opening. */
  chapter?: ChapterPageContent;
  /**
   * A chapter opening that is a leaf of its own, with the text starting on
   * the next page — as against one that opens above its first paragraph.
   */
  leaf?: boolean;
  /** The heading of a text part, on its opening. */
  title?: string;
  /** The picture, on a figure or a plate. */
  assetId?: string | null;
  caption?: string;
  /**
   * A figure the writer marked decorative (addendum 23 §11): an ornament a
   * reader who cannot see it loses nothing by, so it needs no description
   * and the eBook says so. Read off the element; the printed book ignores it.
   */
  decorative?: boolean;
  /** The first paragraph after a chapter opening, which the style may set differently. */
  opensChapter?: boolean;
  /** The part this block belongs to, where it belongs to one. */
  partId?: string;
  /**
   * The unit this block **opens**, on the first block of each one.
   *
   * `partId`'s twin for the story half, and it exists for one reason: the
   * Layout rail lists a collection's chapters by their unit (addendum 22 §6),
   * so without it nothing on a laid page carried that id and the row could
   * neither show its page nor turn to it — a Roman numeral that sat there
   * doing nothing while every other row worked.
   */
  unitId?: string;
  /**
   * On a `blank` block the writer put in (§9i): the element it stands before,
   * so the page's own row can offer to take it away again. A blank leaf the
   * cutter left, and the one behind a picture, carry none — neither is the
   * writer's to remove there.
   */
  blankFor?: string;
  /**
   * **This blank block is the back of the leaf in front of it** (§9w): the
   * leaf a picture page or a chapter page was asked to leave empty.
   *
   * Said rather than inferred. The three reasons a page is blank used to be
   * worked out by looking at what stood on the page *before* — a picture
   * there was taken to mean *this is its back* — which is a guess, and it is
   * wrong exactly where a picture happens to open a division: the leaf after
   * it is then the recto gap the cutter left, and the screen told the writer
   * it was a back page nobody had asked for.
   */
  blankBack?: boolean;
  /**
   * **This block is not a manuscript element** (§9s): it stands in for a
   * section's missing heading (§9l), so its id names the *unit* rather than
   * anything a writer can point at.
   *
   * It matters because `pagePlace` answers a press with the element a page
   * opens with, and every act built on that answer — a blank leaf, a picture,
   * a vector graphic — looks the id up in the manuscript. A stand-in's id is
   * in no collection, so the act found nothing and **returned the document
   * unchanged**: the page read as one that could not be edited at all, which
   * is what Ken reported. Saying so here is how the reading skips it.
   */
  standsIn?: boolean;
  /**
   * The copyright page's lines, built from its fields (§9k). The printer
   * draws these where they are given and falls back to `text` where they are
   * not, which is what keeps a page nobody has set exactly as it was.
   */
  copyright?: CopyrightLine[];
  /** How wide the barcode prints on a copyright page, in inches (§9k). */
  barcodeInches?: number | null;
  /** Where the copyright block sits on its page (§15): top, middle or bottom. */
  copyrightPosition?: 'top' | 'middle' | 'bottom';
  /** How a designed page is set (addendum 20 §9), resolved from the part. */
  partStyle?: PartStyle;
  /**
   * A figure cut into this paragraph at the left or the right (§8), at a
   * fraction of the measure. The figure is the manuscript's; where it sits
   * in the book is read off its element and honoured here alone.
   */
  inset?: FigureInset;
  /**
   * How tall an **empty** box was drawn, as a share of the measure (§9z).
   * Read only where the figure has no picture; once there is one its own
   * proportions decide, which is §9m unchanged.
   */
  boxHeight?: number;
  /** A logotype in place of the title, on a designed page (§9n). */
  logo?: { assetId: string | null; data: string | null };
  /**
   * What a paragraph is on a **back-matter page** (§17), and nothing at all
   * on every other page — the copyright block's `copyrightPosition` is the
   * precedent: a field narrow enough to name the one page it serves is
   * honester than a general one nobody can read.
   *
   * A sign-off is set apart under the thanks; an author's link is one of the
   * three lines under the biography.
   */
  role?: 'sign_off' | 'author_link' | 'glossary' | 'source' | 'letter' | 'question' | 'also' | 'extra';
  /**
   * A run set apart at the head of its own paragraph (§17): a glossary term
   * before its definition, a question's number. It is its own field rather
   * than inline marks because a term may be set in **small capitals**, which
   * no inline mark spells — and because the definition after it is the
   * writer's prose and must keep its own italics.
   */
  lead?: { text: string; style: 'bold' | 'small_caps' | 'italic' | 'plain' };
  /**
   * The author photograph's shape (§17), on the block that carries it —
   * whether that is the picture's own figure or the paragraph it is cut
   * into, so one field serves both places it can stand.
   */
  photoShape?: AuthorPhotoShape;
  /**
   * What the title page prints (§16): the seven elements, already resolved —
   * switched off ones empty, the contributor's line already worded. The
   * printer draws what it is handed and decides nothing about what the page
   * says, which is the copyright page's rule on the page before it.
   */
  titlePage?: TitlePageContent & { imprintAssetId: string | null };
  /**
   * Graphics set over the page this paragraph falls on (§8c). Several may
   * ride one paragraph, and none of them takes a line: the cutter never
   * sees them, which is the whole of what *free* means.
   */
  free?: FigureFree[];
  /**
   * How the document this came from set it (addendum 21 §3): a face, a size
   * in points, an alignment. Read by the printer only under the *As imported*
   * face, except the alignment, which is a fact about the words.
   */
  face?: string;
  size?: number;
  align?: 'center' | 'right';
}

const block = (input: Partial<BookBlock> & Pick<BookBlock, 'id' | 'kind' | 'numbering'>): BookBlock => ({
  starts: 'none',
  display: false,
  folio: true,
  keepWithNext: false,
  unbreakable: false,
  text: '',
  spans: [],
  chapterTitle: '',
  ...input,
});

/** A text part's words as paragraphs: blank lines divide them. */
export const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

/**
 * Whether a chapter opens on a leaf of its own (§5). A page that carries a
 * device, a summary or an epigraph is a leaf — the chapter page as the writer
 * designed it — while one carrying only its number and its name opens above
 * the chapter's first paragraph, which is where most novels put it. A reading
 * rather than a switch, so the chapter-page dialog and the book agree without
 * either being told.
 */
export const opensOnLeaf = (leaf: ChapterPageContent): boolean =>
  leaf.image !== null || leaf.summary.trim().length > 0 || leaf.epigraph.trim().length > 0;

/** Two line styles saying the same thing, so nothing need be drawn for one. */
const sameLine = (a: LineStyle, b: LineStyle): boolean =>
  a.size === b.size && a.case === b.case && a.bold === b.bold && a.italic === b.italic && a.tracking === b.tracking;

/**
 * **Whether this page may leave its back blank** (§17d).
 *
 * Every page that is a leaf of its own may; a part that **flows** — a
 * contents page, an index — may not, because it runs to as many pages as it
 * needs and there is no single back to leave. `partPlacement`'s own
 * predicate, so there is no second list of kinds.
 */
export const partTakesBlankBack = (kind: PartKind): boolean => partPlacement(kind) !== 'flows';

/**
 * The part's own blocks, and then the leaf behind it where it asked for one.
 *
 * **The back of a leaf is its other side** (§9j, Ken's own correction): so a
 * page asked to leave its back blank takes a **recto**, and the blank that
 * follows really is behind it rather than being the next page along. The
 * blank is `display` so it takes a page, `folio: false` so it prints no
 * number, and **counted**, because counting is what the cutter does to
 * everything.
 */
const partBlocks = (
  part: BookPart,
  numbering: 'roman' | 'arabic',
  chapterTitle: string,
  prose: PartStylePatch = {},
  file?: ProjectFile,
  plan: readonly BookPart[] = [],
): BookBlock[] => {
  const own = partOwnBlocks(part, numbering, chapterTitle, prose, file, plan);
  if (own.length === 0) return own;
  const leaf = (suffix: string): BookBlock =>
    block({
      id: `${part.id}:${suffix}`,
      kind: 'blank',
      numbering,
      starts: 'page',
      display: true,
      folio: false,
      unbreakable: true,
      chapterTitle,
      partId: part.id,
      // Which page put it here, so the room can offer to take it away again
      // — the one place a leaf the writer asked for can be found (§9i).
      blankFor: suffix.startsWith('before') ? part.id : undefined,
      blankBack: suffix === 'back',
    });
  /**
   * **As many leaves in front of this page as the writer asked for** (§9ac),
   * each of them a **sheet** rather than a side (§9ad).
   */
  const front = blankPages(pagesBefore(part.blankBefore), (suffix) => leaf(suffix));
  if (!part.backBlank || !partTakesBlankBack(part.kind)) return [...front, ...own];
  const first = own[0] as BookBlock;
  return [...front, { ...first, starts: 'recto' }, ...own.slice(1), leaf('back')];
};

/**
 * **A blank page a writer asks for is a leaf, not a side** (§9ad, from Ken:
 * *when you enter a blank page, it's entering a blank half page… if you insert
 * a blank page, it's blank on front and back, like a separating page*).
 *
 * §9ac read the same sentence as a complaint about a press that sometimes cost
 * two pages, and spent its whole design making one leaf one page. It was a
 * **specification**: *it's adding a front and back page… it's not just adding
 * one side or the other* is what a blank page **should** be. A reader does not
 * hold a side, they hold a sheet — so a separating leaf is two pages, blank on
 * both, and what the writer then puts on it goes on its front.
 *
 * Two pages rather than one is also what makes the press predictable, which is
 * the half §9ac was reaching for and missed: **an even number of pages cannot
 * change which side anything else is on**, so every leaf is exactly two pages
 * and nothing after it moves from a right-hand page to a left-hand one. That
 * is why no rule here forces the first blank onto a recto — forcing it would
 * take the recto the page after it wanted and cost a third page on half the
 * parities, which is §9ac's own fault wearing the opposite sign.
 */
const blankPages = (pages: number, make: (suffix: string) => BookBlock): BookBlock[] => {
  const out: BookBlock[] = [];
  for (let at = 0; at < pages; at += 1) out.push(make(at === 0 ? 'before' : `before:${at + 1}`));
  return out;
};

const partOwnBlocks = (
  part: BookPart,
  numbering: 'roman' | 'arabic',
  chapterTitle: string,
  // What a prose part's heading and words look like before anybody sets them:
  // the book's chapter opening and its body (§7a).
  prose: PartStylePatch = {},
  // The copyright page reads the book to fill its own blanks (§9k); every
  // other part is built from itself alone.
  file?: ProjectFile,
  // The whole plan, for the title page: its publisher and its edition are the
  // **copyright page's** fields (§16), a book naming two publishers on two
  // pages being a mistake rather than a design.
  plan: readonly BookPart[] = [],
): BookBlock[] => {
  const title = partTitle(part);
  /**
   * **A page of art replaces the page, not the kind** (§9y, from Ken: *instead
   * of the table of contents, I want a contents page that is a full page piece
   * of artwork. But when I go to import it, it doesn't change*).
   *
   * It did not. *Import full page art…* is offered wherever a page prints type
   * of its own — `partHasStyle`, which is every kind but a plate — while only
   * the four whose placement is a `block` ever **read** `part.assetId`: the
   * half title, the title page, a dedication and an epigraph. On a contents
   * page, an index, a copyright page or a foreword the import was accepted,
   * the button changed its words to *Import other full page art…* and the page
   * went on printing its entries. §16a's lesson pointed the other way — *a
   * gate beside the reader goes on refusing what the reader has learned to
   * draw* — and this is a gate that **accepted what the printer never learned
   * to draw**, which is the worse half: a refusal says so and this said
   * nothing at all.
   *
   * The four that already work are **left exactly as they are**, each drawing
   * its own art inside its own block, so no existing book's markup moves. The
   * rest take the plate the book has drawn pictures as pages with since §8 —
   * one art markup, whatever the page was going to be — and the page **keeps
   * the side it would have taken**, a contents page being a recto and a
   * copyright page a verso whether it carries entries or a picture.
   *
   * It is a **mode and not a deletion**: `partModeOf` reads the asset back, so
   * the entries, the words and the type are all still there and *Set the words
   * instead* puts the page back.
   */
  if (part.assetId && partHasStyle(part.kind) && partPlacement(part.kind) !== 'block') {
    return [
      block({
        id: part.id,
        kind: 'plate',
        numbering,
        starts:
          part.kind === 'copyright'
            ? 'verso'
            : partPlacement(part.kind) === 'prose'
              ? (partStyleOf(part, prose).recto ? 'recto' : 'page')
              : 'recto',
        display: true,
        folio: false,
        unbreakable: true,
        partId: part.id,
        assetId: part.assetId,
        title,
        chapterTitle: title,
      }),
    ];
  }
  switch (part.kind) {
    // Either may be a piece of art brought in whole (§8, from Ken): the
    // asset on the part is the page, and the printer draws it edge to edge
    // in place of the typed title.
    // A logotype stands where the title would, on either page (§9n), and
    // `partLogo` is the one reading that says which picture is in force —
    // the part's own, or the title page's older data URI.
    case 'half_title':
      return [block({ id: part.id, kind: 'half_title', numbering, starts: 'recto', display: true, folio: false, partId: part.id, unbreakable: true, assetId: part.assetId, logo: partLogo(part, file?.settings.titlePage?.titleImage ?? '') ?? undefined, partStyle: partStyleOf(part) })];
    case 'title_page':
      return [
        block({
          id: part.id,
          kind: 'title_page',
          numbering,
          starts: 'recto',
          display: true,
          folio: false,
          partId: part.id,
          unbreakable: true,
          assetId: part.assetId,
          logo: partLogo(part, file?.settings.titlePage?.titleImage ?? '') ?? undefined,
          // The seven elements, resolved once (§16) — what each says and
          // whether it says it. Without a file there is nothing to read them
          // from, and the printer falls back to what it drew before.
          titlePage: file
            ? { ...titlePageContent(file, part, plan), imprintAssetId: titlePageFieldsOf(part).imprintAssetId }
            : undefined,
          partStyle: partStyleOf(part),
        }),
      ];
    case 'copyright': {
      // The page's own fields where the writer has used them (§9k), and the
      // free text where they have not — one reading, so the print, the spread
      // and the dialog's sheet cannot show three different pages.
      const lines = file ? copyrightLines(part, file) : [];
      const page = copyrightOf(part);
      return [
        block({
          id: part.id,
          kind: 'copyright',
          numbering,
          /**
           * **It takes the next page** (§17e, from Ken: *I added the title page
           * and said leave the back of it blank, but it left an additional page
           * blank*).
           *
           * This was `verso`, and the convention it was written for is not *a
           * left-hand page* but **the back of the title page** — which the
           * pagination gives it for nothing, a title page being a recto one
           * page long. So the force bought nothing where it was right and cost
           * a page where it was not: with the title page's back left blank
           * (§17d) the copyright page skipped the recto after it, and the
           * reader met **a wholly blank spread** in the front matter, a blank
           * right-hand page being the one thing a book does not do by accident.
           */
          starts: 'page',
          display: true,
          folio: false,
          partId: part.id,
          unbreakable: true,
          text: lines.length > 0 ? lines.map((line) => line.text).join('\n') : part.text,
          spans: parseInline(part.text),
          copyright: lines,
          assetId: page?.barcodeAssetId ?? null,
          barcodeInches: page?.barcodeInches ?? null,
          copyrightPosition: page?.position ?? 'bottom',
          // A designed page like the other four (§7a); it hangs at the foot
          // unless the writer has said otherwise (§15).
          partStyle: partStyleOf(part),
        }),
      ];
    }
    case 'contents':
      // A designed page (§7a): the heading and the entries are the writer's.
      return [block({ id: part.id, kind: 'contents', numbering, starts: 'recto', partId: part.id, title, chapterTitle: title, partStyle: partStyleOf(part) })];
    case 'index':
      return [block({ id: part.id, kind: 'index', numbering, starts: 'recto', partId: part.id, title, chapterTitle: title, partStyle: partStyleOf(part) })];
    case 'plate':
      return [
        block({
          id: part.id,
          kind: 'plate',
          numbering,
          starts: 'page',
          display: true,
          folio: false,
          unbreakable: true,
          partId: part.id,
          assetId: part.assetId,
          caption: part.caption,
          chapterTitle,
        }),
      ];
    case 'dedication':
    case 'epigraph':
      // A page of their own, the words alone on it, no number.
      return [
        block({
          id: part.id,
          kind: 'part_opening',
          numbering,
          starts: 'recto',
          display: true,
          folio: false,
          unbreakable: true,
          partId: part.id,
          title: '',
          text: part.text,
          spans: parseInline(part.text),
          // The page may be a piece of art like any other designed page (§7a).
          assetId: part.assetId,
          partStyle: partHasStyle(part.kind) ? partStyleOf(part) : undefined,
        }),
      ];
    default: {
      // Prose before or after the story: a heading at the head of a right-hand
      // page, and the paragraphs following on the same page.
      // A designed page like every other that prints type (§7a). The style
      // starts as the book's own, and **only what differs from it is drawn**:
      // a part that has been left alone carries no style at all, so the markup
      // of a book made before the control existed is byte for byte what it
      // was. The heading and the words are asked separately, because setting
      // one is no reason to write declarations over the other.
      const base = partStyleOf({ kind: part.kind, style: {} }, prose);
      const style = partStyleOf(part, prose);
      const headingOwn = sameLine(style.title, base.title) && style.face === base.face && style.align === base.align && style.rule === base.rule ? undefined : style;
      const wordsOwn = sameLine(style.line, base.line) && style.face === base.face ? undefined : style;
      // **Which page it opens on and whether it prints a number are the
      // page's own** (§17). The cutter has understood `starts` and `folio`
      // on every block since §4; until the back matter's screen there was
      // nowhere to ask for them, so every prose part took a recto whether it
      // wanted one or not.
      const opening = block({
        id: part.id,
        kind: 'part_opening',
        numbering,
        // `page` rather than `recto`: the page still begins a new leaf, it
        // simply does not insist on a right-hand one.
        starts: style.recto ? 'recto' : 'page',
        folio: style.folio,
        keepWithNext: true,
        unbreakable: true,
        partId: part.id,
        title,
        chapterTitle: title,
        // **The sink is always drawn** where the heading is, even on a page
        // that carries no other style of its own: it is *where the heading
        // is* rather than *what it looks like*, so `headingOwn`'s rule —
        // draw only what differs — would silently put every back-matter
        // heading back at the head of the page. A page nobody has touched
        // takes its kind's default, which is what it always printed.
        // The **sink** is where the heading is rather than what it looks
        // like, so `headingOwn`'s rule — draw only what differs from the
        // book — would put every sunk heading back at the head. A page at
        // the head carries nothing, which is what every prose part drew
        // before there was a control, byte for byte.
        partStyle: headingOwn ?? (style.drop > 0 ? style : undefined),
      });
      /**
       * **What a list page is made of** (§17). A glossary, a bibliography and
       * a reader extra hold **records** rather than prose, so their
       * paragraphs are read off those records — the page and the panel
       * cannot then disagree about what it says, which is this room's rule
       * everywhere else. A page with no records of its own is its words, as
       * every prose part has always been.
       */
      const listed: Array<{ text: string; role?: BookBlock['role']; lead?: BookBlock['lead'] }> = [];
      if (part.kind === 'glossary') {
        const own = glossaryOf(part);
        let letter = '';
        for (const entry of glossaryEntries(part)) {
          const at = glossaryLetter(entry.term);
          if (own.letterHeadings && own.sorted && at !== letter) {
            letter = at;
            listed.push({ text: at, role: 'letter' });
          }
          listed.push({
            text: own.layout === 'run_in' ? `— ${entry.definition}` : entry.definition,
            role: 'glossary',
            lead: { text: entry.term, style: own.termStyle },
          });
        }
      } else if (part.kind === 'bibliography') {
        for (const one of bibliographyEntries(part)) listed.push({ text: one.text, role: 'source' });
      } else if (part.kind === 'reader_extra') {
        const own = readerExtraOf(part);
        if (own.kind === 'newsletter') {
          if (own.message.trim()) for (const line of paragraphsOf(own.message)) listed.push({ text: line, role: 'extra' });
          if (own.link.trim()) listed.push({ text: own.link.trim(), role: 'extra' });
        } else if (own.kind === 'questions') {
          own.questions
            .filter((one) => one.text.trim().length > 0)
            .forEach((one, at) =>
              listed.push({
                text: one.text,
                role: 'question',
                lead: { text: own.numbering === 'numbers' ? `${at + 1}.` : '•', style: 'plain' },
              }),
            );
        } else if (own.kind === 'also_by') {
          for (const one of own.titles.filter((two) => two.title.trim().length > 0)) {
            listed.push({ text: one.series.trim() ? `${one.title} — ${one.series}` : one.title, role: 'also' });
          }
        } else if (own.leadIn.trim()) {
          listed.push({ text: own.leadIn.trim(), role: 'extra' });
        }
      }
      const words = listed.length > 0 ? listed : paragraphsOf(part.text).map((text) => ({ text }) as (typeof listed)[number]);
      const paragraphs = words.map((one, index) =>
        block({
          id: `${part.id}:${index}`,
          kind: 'paragraph',
          numbering,
          text: one.text,
          spans: parseInline(one.text),
          role: one.role,
          lead: one.lead,
          partId: part.id,
          chapterTitle: title,
          folio: style.folio,
          opensChapter: index === 0 && listed.length === 0,
          // The words take the page's own line style; the print sets each
          // paragraph from it rather than the body rule reading a variable,
          // so nothing about the story's paragraphs changes.
          partStyle: wordsOwn,
        }),
      );
      // **The author's photograph** (§17), which is a figure and an inset a
      // sixteenth time rather than a picture of its own kind: *above* is a
      // figure across the measure before the words, *beside* is exactly the
      // inset the book has cut pictures into paragraphs with since §8, and
      // *none* is no block at all. The shape rides on whichever block holds
      // it.
      const before: BookBlock[] = [];
      const after: BookBlock[] = [];
      if (part.kind === 'about_the_author') {
        const author = aboutAuthorOf(part);
        if (author.photoAssetId && author.place === 'above') {
          before.push(
            block({
              id: `${part.id}:photo`,
              kind: 'figure',
              numbering,
              partId: part.id,
              chapterTitle: title,
              folio: style.folio,
              assetId: author.photoAssetId,
              caption: '',
              photoShape: author.shape,
            }),
          );
        }
        if (author.photoAssetId && author.place === 'beside' && paragraphs[0]) {
          paragraphs[0].inset = {
            place: 'right',
            span: 0.34,
            side: 'either',
            standoff: 1,
            figureId: `${part.id}:photo`,
            assetId: author.photoAssetId,
            caption: '',
            decorative: false,
            // A part's picture is chosen rather than drawn, so there is no
            // box to keep the height of (§9z).
            boxHeight: 0,
          };
          paragraphs[0].unbreakable = true;
          paragraphs[0].photoShape = author.shape;
        }
        // The three lines a reader is given, each printed only where it has
        // words — an empty *Website:* line being something that would print.
        authorLinksShown(part).forEach((text, index) =>
          after.push(
            block({
              id: `${part.id}:link:${index}`,
              kind: 'paragraph',
              numbering,
              text,
              spans: parseInline(text),
              partId: part.id,
              chapterTitle: title,
              folio: style.folio,
              role: 'author_link',
              partStyle: wordsOwn,
            }),
          ),
        );
      }
      // **The sign-off**, a field of its own rather than a last paragraph
      // (§17): the page sets it apart, and a writer who typed it as a
      // paragraph would have no way to say so.
      if (part.kind === 'acknowledgements') {
        const own = acknowledgementsOf(part);
        const said = own.signOffText.trim();
        if (own.signOff && said.length > 0) {
          after.push(
            block({
              id: `${part.id}:sign-off`,
              kind: 'paragraph',
              numbering,
              text: said,
              spans: parseInline(said),
              partId: part.id,
              chapterTitle: title,
              folio: style.folio,
              role: 'sign_off',
              partStyle: wordsOwn,
            }),
          );
        }
      }
      // A picture cut into the text (§8) rides in the paragraph it names —
      // the last one where the text has grown shorter than the number, so a
      // cut paragraph never takes its picture with it. With no paragraph
      // there is nothing to cut into, and the picture waits.
      for (const inset of part.insets) {
        const target = paragraphs[Math.min(inset.paragraph, paragraphs.length - 1)];
        if (!target || target.inset) continue;
        target.inset = {
          place: inset.place,
          span: inset.span,
          side: 'either',
          standoff: inset.standoff,
          figureId: inset.id,
          assetId: inset.assetId,
          caption: inset.caption,
          decorative: false,
          boxHeight: 0,
        };
        target.unbreakable = true;
      }
      return [opening, ...before, ...paragraphs, ...after];
    }
  }
};

/** What an element kept of how its document set it, where it kept anything. */
const setting = (element: ManuscriptElement): Pick<BookBlock, 'face' | 'size' | 'align'> => {
  const out: Pick<BookBlock, 'face' | 'size' | 'align'> = {};
  const { face, size, align } = element.attributes;
  if (typeof face === 'string' && face.trim().length > 0) out.face = face.trim();
  if (typeof size === 'number' && size > 0) out.size = size;
  if (align === 'center' || align === 'right') out.align = align;
  return out;
};

/**
 * Where a figure sits in the book (§8): across the measure, cut into the
 * text at a side, or **the page itself** — an illustrated page inside the
 * story (§8a, from Ken), which is the same record standing where the
 * writer already put the figure rather than a second kind of thing.
 */
/**
 * Where a figure stands in the book (§8, §8a, §8c).
 *
 * `free` is the one that takes **no room in the flow** (§8c, from Ken:
 * *add a vector graphic … anywhere on the page, and then they can resize
 * that also*): a flourish or a spot drawing set over the page at a place
 * the writer picks, with nothing moving to make space for it. Everything
 * else is in the text's way and the cutter knows about it.
 */
export type FigurePlace = 'measure' | 'left' | 'right' | 'page' | 'free';

/** Which page an illustrated page falls on: the left, the right, or whichever comes. */
export type FigureSide = 'either' | 'verso' | 'recto';

export interface BookFigurePlacement {
  place: FigurePlace;
  /** The fraction of the measure an inset takes, 0.2 to 0.6. */
  span: number;
  /** For a page: which side of the spread it lands on. */
  side: FigureSide;
  /**
   * The white space the text keeps clear around an inset, in ems of the
   * body size (§8a, from Ken: *gives a little bit of a border*).
   */
  standoff: number;
  /**
   * Where a **free** graphic stands, as a fraction of the page from its
   * top-left corner (§8c). It is the *page* rather than the text block,
   * because *anywhere on the page* includes the margins — a flourish that
   * cannot reach the edge is not free.
   *
   * Nothing but a free graphic reads these.
   */
  x: number;
  y: number;
  /**
   * **How tall the box was drawn**, as a share of the measure, or 0 for none
   * (§9z, from Ken: *I was trying to fill the bottom of a last page of a
   * section with a picture*).
   *
   * §9m's rule is that **only the width is dragged and the height follows
   * from the picture's proportions** — true of a box that *has* a picture,
   * and the one case it says nothing about is the box drawn before there is
   * one. That box had no proportions to follow, so it was given eight lines
   * of leading whatever the drag said: a box drawn to fill the white under a
   * section's last words came back too tall to fit there, and the cutter
   * moved it to the next page, which from the writer's chair is the picture
   * refusing to go where it was put.
   *
   * It is read **only while the box is empty**. The moment a picture arrives
   * its proportions decide, which is §9m unchanged, and the number is kept
   * rather than cleared so redrawing the box is not the only way back.
   */
  boxHeight: number;
}

/**
 * `x` and `y` are **omitted** rather than inherited: an inset's place is
 * decided by the paragraph it cuts into, so a free position on one would be
 * two fields that can only disagree with where it actually sets.
 */
export interface FigureInset extends Omit<BookFigurePlacement, 'x' | 'y'> {
  place: 'left' | 'right';
  /** The figure element's id, for finding it on the page and in the rail. */
  figureId: string;
  assetId: string | null;
  caption: string;
  decorative: boolean;
}

/**
 * A graphic set over the page, taking no room in the flow (§8c).
 *
 * It rides on a paragraph for the same reason an inset does — **a page is
 * not a record**, so a graphic anchored to page nine would be on the wrong
 * page the moment a word is added. Riding the paragraph puts it wherever
 * that paragraph falls, which is what makes it survive the writing moving.
 */
export interface FigureFree {
  figureId: string;
  assetId: string | null;
  /** Fractions of the page: 0 is its top-left corner, 1 its bottom-right. */
  x: number;
  y: number;
  /** The width as a fraction of the page. The height follows the picture. */
  span: number;
  decorative: boolean;
  caption: string;
}

export const FREE_SPAN = { min: 0.05, max: 1, default: 0.25 } as const;

export const INSET_SPAN = { min: 0.2, max: 0.6, default: 0.4 } as const;
export const INSET_STANDOFF = { min: 0, max: 3, default: 1 } as const;

/**
 * A figure's placement, read off its element (§8). The manuscript prints
 * every figure across the measure and never looks at this; only the book
 * does. Absent means across the measure.
 */
/**
 * Whether the leaf behind a picture page is left blank (§9i). Like every other
 * `book…` attribute the manuscript carries it and never reads it: a figure
 * printed across the measure in the manuscript has no back page to leave.
 */
export const backBlank = (element: ManuscriptElement): boolean => element.attributes?.bookBackBlank === true;

/**
 * Whether a blank page stands **before** this element (§9i, from Ken: *you
 * should be able to select a page… and insert a blank page… and it will slide
 * what was on that page to the next page*).
 *
 * The same shape as `backBlank` and for the same reason: a page is not a
 * record, so a blank one is said of the writing it interrupts. The sliding
 * needs nothing — the leaf takes a page and everything after it moves down.
 */
export const blankBefore = (element: ManuscriptElement): boolean => pagesBefore(element.attributes?.bookBlankBefore) > 0;

/**
 * **How many blank pages stand there** (§9ac, from Ken: *you should be able
 * to just put as many pages in between as you want*).
 *
 * The flag was a switch, so there was one leaf per place and no second — a
 * writer who wanted a picture page *and* a blank between two stories could
 * ask for one of them and stop. It is a count now, and `true` is its **older
 * spelling**, read as one whole sheet: nothing is migrated and no book moves,
 * which is `template`/`layout`'s rule.
 *
 * **Pages rather than leaves** (§9ae): a sheet is two of these and a shift
 * across the spine is one, so the unit has to be the smaller of the two or
 * the shift has no number to be. `SHEET` is the only place that says how many
 * pages a sheet is, which is what keeps `blankSheets` and the shift from
 * disagreeing about it.
 *
 * Anything else — absent, false, a string somebody's older build wrote — is
 * none, and the ceiling is the schema's, so a document cannot lay a thousand
 * leaves by carrying a large number.
 */
export const SHEET = 2;

export const pagesBefore = (value: unknown): number => {
  if (value === true) return SHEET;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_BLANK_PAGES, Math.floor(value)));
};

/** How many blank pages stand before this element (§9ac). */
export const blanksBefore = (element: ManuscriptElement): number => pagesBefore(element.attributes?.bookBlankBefore);

/** Put blank pages in before this element, or take them away again (§9ac). */
export const setBlanksBefore = (file: ProjectFile, elementId: string, count: number): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) => ({
    ...beat,
    manuscript: {
      ...beat.manuscript,
      elements: beat.manuscript.elements.map((element) => {
        if ((element.id as string) !== elementId) return element;
        const attributes = { ...element.attributes };
        const want = pagesBefore(count);
        if (want > 0) attributes.bookBlankBefore = want;
        else delete attributes.bookBlankBefore;
        return { ...element, attributes };
      }),
    },
  })),
});

/**
 * Put a blank page in before this element, or take every one away again.
 * **One is a sheet** (§9ad, §9ae): `setBlankPage`'s own reason — the count is
 * in pages since the shift, so the act that speaks in whole pages says how
 * many that is.
 */
export const setBlankBefore = (file: ProjectFile, elementId: string, blank: boolean): ProjectFile =>
  setBlanksBefore(file, elementId, blank ? SHEET : 0);

/**
 * **Where a blank page asked for on this page goes** (§9r, from Ken: *you
 * should be able to enter a blank page wherever you want*, and *tried to put
 * a blank page on the chapter one page and it wouldn't allow me*).
 *
 * *Wherever* was the whole of the ask and the whole of the gap. The act hung
 * on a manuscript element, so it was offered on a page of the story and
 * **absent on every page of the front and back matter** — a writer could not
 * put a leaf between the title page and the copyright page, or before an
 * appendix, which is where a book most often wants one.
 *
 * So it is one act read where it lands, the way putting a picture in is
 * (§9a). Three places, in this order, and **the order is the point**: a page
 * a chapter opens on answers with the **chapter** rather than with the
 * element under it, because a blank hung on the chapter's first element lands
 * between the numeral and the words and splits the chapter in two — §9p's
 * fault exactly, which is how it was found again here.
 */
export const blankSpot = (place: PagePlace, page: Pick<BookPageRow, 'blankFor'>): string | null =>
  page.blankFor ?? place.opensMarkerId ?? place.elementId ?? place.partId ?? null;

/**
 * **Why a page is blank** (§9w, from Ken: *it says this page in front of one
 * is already blank. Page says why. I don't know what this means*).
 *
 * There are three reasons and only one of them is the writer's, which §9i
 * settled and the **page's own help text then kept a copy of**: three branches
 * in a component, which is the fault this project removes everywhere else — a
 * screen holding its own answer to a question the domain can be asked. It had
 * already cost something, because `blankOffer`'s refusal could not reach them
 * and said *its own page says why* instead: a sentence that sends a writer to
 * another page to be told what this one could have told them, which is what
 * Ken could not parse and was right not to.
 *
 * It is a **reading over the rows**, so the reason for any page is answerable
 * from any screen without threading neighbours through it.
 */
export type BlankReason = 'writer' | 'back' | 'page_back' | 'recto';

export const blankReason = (rows: readonly BookPageRow[], sheet: number): BlankReason | null => {
  const page = rows.find((one) => one.sheet === sheet);
  if (!page || !page.blank) return null;
  if (page.blankFor) return 'writer';
  // **The block says so** (§9w). This read *the page in front is an
  // illustration, so this is its back*, which is a guess — and wrong exactly
  // where a picture opens a division, the leaf after it being the recto gap
  // the cutter left; the screen then told the writer it was a back page
  // nobody had asked for.
  //
  // **The back of what** is a fourth reason (§17e). §9i wrote this flag for a
  // picture, and §17d gave a part the same switch and §9r a chapter page, so
  // *the back of the picture in front of it* was said of a title page. Asking
  // the page before which it is, is **not** the guess removed above: the block
  // has already said this leaf is a back, and the page in front only says what
  // it is the back **of** — the same reading `pageRemoval` makes to decide
  // whose switch the × reaches.
  if (page.blankBack) {
    return rows.find((one) => one.sheet === sheet - 1)?.figureId ? 'back' : 'page_back';
  }
  return 'recto';
};

/**
 * The reason in words, in one place, for the help text and both refusals.
 *
 * **Who the sentence is about** (§17e). The help text stands on the blank
 * leaf's own screen, where *it* is the blank; a refusal stands on the page the
 * leaf is in front of, where *this one* is that page — and the `recto` reason
 * is the one that goes actively wrong when the two are confused, *the page
 * after it opens on a right-hand page* then naming the page after **this**
 * one, which is not the reason for anything. So the voice is asked for rather
 * than guessed, and there is one function rather than two copies of three
 * reasons: §9w's own finding (*a sentence whose second half has no referent*)
 * one clause in.
 */
export const sayBlankReason = (reason: BlankReason, about: 'the leaf' | 'the page behind it' = 'the leaf'): string => {
  const here = about === 'the leaf';
  if (reason === 'writer') return here ? 'you put it here' : 'you put it there';
  // The back of a picture reads the same either way: *it* can only be the
  // blank, the picture being named in the same breath.
  if (reason === 'back') return 'it is the back of the picture in front of it, kept empty so nothing shows through';
  if (reason === 'page_back') {
    return here
      ? 'the page in front of it is set to leave its back blank'
      : 'the page in front of this one is set to leave its back blank';
  }
  return here ? 'the page after it opens on a right-hand page' : 'this page opens on a right-hand page';
};

/** What a press would do, or why it may not be asked for (§9r, §9ac). */
export interface BlankOffer {
  /** Where the leaf would go. Null where the act may not be asked for here. */
  spot: string | null;
  /** The button's words for putting one in, where there is a button. */
  act: string | null;
  /**
   * The button's words for taking one away, where any of the writer's own
   * stand there (§9ac). Null where none do — the leaves the **cutter** left
   * are not removed here but by removing their reason, which is the page's
   * own × (§9x).
   */
  fewer: string | null;
  /** How many of the writer's own blank **pages** stand in front of that spot now. */
  pages: number;
  /** What a press would really cost, where that is not one more page. */
  note: string | null;
  /** Why there is none, in a sentence a writer can act on. */
  refusal: string | null;
  /**
   * **Half a sheet** (§9ae, from Ken: *we also need the ability to shift a
   * page to the left or right. So when you select a page, it will shift half
   * a page… if it's on the left-hand side, it'll swap it to the right-facing
   * page. If it's on the right, it'll swap it to the back of that page*).
   *
   * A sheet is the act that **moves nothing across the spine** — that is the
   * whole of §9ad, and an even number of pages cannot change which side
   * anything is on. This is its complement and the only other thing a writer
   * can want here: **one** page, which flips this page and every page after
   * it to the other side of the paper. Both acts write the same field, and
   * what differs is whether they write one or two.
   *
   * On and back are **not** two directions on the page: both land it on the
   * other side, because parity flips either way. What differs is whether the
   * book grows or shrinks, so they are named for that and the note says which
   * side it would land on.
   */
  shiftOn: string | null;
  shiftBack: string | null;
  /** Which side it would land on, and what it costs every page after it. */
  shiftNote: string | null;
  /** Why it cannot move back, where it cannot. */
  shiftRefusal: string | null;
  /**
   * **The division whose own recto rule the shift would turn off** (§9ae).
   *
   * Where the book holds a page on a right-hand side, a blank page in front
   * of it is taken up by the gap that rule already leaves, so adding one is a
   * press that changes nothing a writer can see. The thing that really moves
   * such a page is **the rule**, which §9x already made a per-chapter field —
   * so the shift there writes `opensRecto` rather than a blank, and this is
   * the id it writes it on. Null wherever the shift is an ordinary page.
   *
   * It is the same control and the same words: *what moves this page half a
   * sheet* is one question, and two buttons for its two mechanisms would be
   * the writer learning the cutter's rules to use a control about sides.
   */
  shiftFrees: string | null;
}

/**
 * **The side of the paper a sheet index falls on.** Sheet 1 is the first
 * recto and stands alone, so an odd sheet is a right-hand page and an even
 * one is a left-hand page — the one place that knows it, because the shift's
 * sentence and anything built on it must not disagree about which side a
 * writer is looking at.
 */
export const sideOf = (sheet: number): 'right' | 'left' => (sheet % 2 === 1 ? 'right' : 'left');

/**
 * **Whether a blank leaf may be asked for on this page** (§9r), and what a
 * press would do — the domain answering before the act can be asked for,
 * which is `trackRemoval`'s shape.
 *
 * It exists because of the one thing measuring the act caught. A blank block
 * takes the **next page**, and a chapter that opens on a right-hand page has
 * already left the verso in front of it empty — so asking for a leaf there
 * fills the gap the cutter left and **the book does not grow by a page**.
 * Nothing is wrong with that; what is wrong is a press that looks exactly
 * like the fault Ken reported, which is a screen doing something invisible
 * rather than saying what is already true.
 *
 * So where a leaf already stands in front of this page, the act is refused in
 * a sentence rather than offered and absorbed. It holds for every kind of
 * page, because the absorption is a fact about the cutter rather than about
 * chapters — chapters are merely where it happens on every one.
 */
export const blankOffer = (place: PagePlace, rows: readonly BookPageRow[], sheet: number): BlankOffer => {
  const page = rows.find((one) => one.sheet === sheet);
  const none = (refusal: string, pages = 0): BlankOffer => ({
    spot: null,
    act: null,
    fewer: null,
    pages,
    note: null,
    refusal,
    shiftOn: null,
    shiftBack: null,
    shiftNote: null,
    shiftRefusal: null,
    shiftFrees: null,
  });
  if (!page) return none('The book is still being set.');
  const spot = blankSpot(place, page);
  /**
   * **Why there is no leaf to be had here** (§9y). This answered with silence,
   * which was enough while the only caller was a panel that simply drew no
   * button — and is not enough for the Add menu, where an item with no reason
   * in its title is `pictureOffer`'s own fault before it was one reading. A
   * leaf hangs on a record, so a page with nothing of the book on it has
   * nothing for one to stand before.
   */
  if (spot === null) {
    return none('Nothing of the book stands on this page for a leaf to go in front of.');
  }
  /**
   * **How many of the writer's own leaves stand there** (§9ac), read off the
   * laid pages rather than off the record — the rows are what is in front of
   * the writer, and asking the document would need the document, which two of
   * the three screens that take this offer do not have in hand.
   */
  /**
   * **A leaf is two rows** (§9ad): every sheet the writer asks for lays a
   * front and a back, both carrying the same `blankFor`, so what is counted
   * here is sheets rather than sides. The back of a *page* (§17d) carries no
   * `blankFor` and so is not counted.
   */
  const pages = rows.filter((one) => one.blankFor === spot).length;
  const sheets = Math.floor(pages / SHEET);
  /**
   * **The shift, written once** (§9ae). It is the same field as the sheet and
   * one page rather than two, so it is built here beside it: two readings of
   * one count could differ about how many pages stand there, which is the one
   * thing a writer cannot check by looking.
   */
  const other = sideOf(sheet) === 'right' ? 'left' : 'right';
  /**
   * **A page the book itself holds on one side cannot shift** (§9ae), and
   * saying so is the whole of why this is a reading rather than two buttons.
   *
   * §9r measured it for the sheet: a division that opens on a right-hand page
   * has already left the verso in front of it empty, so **one** page asked
   * for there fills the cutter's own gap and the book does not grow — which
   * means the page does not move and does not change sides, a press that
   * changes nothing a writer can see. §9ad's sheet escapes it by being two.
   * The shift cannot, so it is refused here with the rule named and the one
   * place that rule is set, which is the page's own screen (§9x's
   * `opensRecto`).
   */
  const held = blankReason(rows, sheet - 1) === 'recto';
  /**
   * **And where the rule is what holds it, the shift writes the rule** — one
   * press, because *move this page to the other side* is one thing a writer
   * wants and the mechanism is the room's business. There is exactly one
   * direction to offer: the page is on a right-hand side **because** of the
   * rule, so freeing it can only put it on the left.
   */
  const frees = (held ? place.opensMarkerId : null) ?? null;
  const shift = (room: boolean) => ({
    shiftOn: frees ? 'Shift it on a page' : room && !held ? 'Shift it on a page' : null,
    shiftBack: pages > 0 && !held ? 'Shift it back a page' : null,
    shiftNote: frees
      ? `This page opens on a right-hand page, which is what holds it there. Shifting it stops that for this page alone, so it falls on the ${other}-hand side and the book is a page shorter.`
      : (room || pages > 0) && !held
        ? `Either shift puts this page on the ${other}-hand side of the spread, and the pages after it swap sides with it as far as the next opening the book holds on a right-hand page. A blank sheet is the one that moves nothing.`
        : null,
    shiftRefusal:
      held && !frees
        ? 'This page opens on a right-hand page, so the book already leaves the page in front of it empty and a single page would be taken up by that gap.'
        : pages > 0 || held
          ? null
          : 'Nothing blank stands in front of this page to take away, so it can only shift on.',
    shiftFrees: frees,
  });
  if (pages + SHEET > MAX_BLANK_PAGES) {
    return {
      spot,
      act: null,
      fewer: 'Take one away',
      pages,
      note: null,
      refusal: `${sheets} blank sheets already stand here, which is as many as one place takes.`,
      ...shift(pages < MAX_BLANK_PAGES),
    };
  }
  /**
   * **What a press really costs** (§9ad, from Ken: *when you enter a blank
   * page, it's entering a blank half page… if you insert a blank page, it's
   * blank on front and back, like a separating page*).
   *
   * It is two pages and it is always two pages, which is what makes it safe to
   * say in one sentence: an even number cannot change which side anything
   * after it is on, so a chapter that opened on a right-hand page still does.
   */
  return {
    spot,
    act: sheets === 0 ? 'Put a blank sheet here…' : 'Put another blank sheet here…',
    fewer: pages >= SHEET ? (sheets === 1 ? 'Take the blank sheet away' : 'Take one away') : null,
    pages,
    note:
      sheets === 0
        ? 'A blank sheet goes in: two pages, so there is nothing on either side of the paper here. Nothing after it changes which side it is on, and a picture put on it later takes the first of the two.'
        : null,
    refusal: null,
    ...shift(true),
  };
};

/**
 * **The same question asked of a part** (§9r), for the two screens that reach
 * the field from the part rather than from the page — the inspector's own
 * panel and the designed page's dialog.
 *
 * They exist because a part row shows the *part's* panel, so a writer in the
 * front matter reaches the act from there; and they read this rather than
 * toggling the field, because a screen that toggles it blind absorbs the
 * cutter's leaf silently, which is the very thing `blankOffer` was written to
 * stop. Three surfaces, one answer.
 */
export const partBlankOffer = (
  rows: readonly BookPageRow[],
  part: Pick<BookPart, 'id' | 'blankBefore'>,
): BlankOffer => {
  const pages = pagesBefore(part.blankBefore);
  const sheets = Math.floor(pages / SHEET);
  /**
   * **Which side this part's page falls on** (§9ae), read off the laid rows
   * rather than guessed: a part knows what it is and not where the cutter put
   * it, and the shift's sentence is about the side a writer is looking at.
   */
  const at = rows.find((one) => one.partId === part.id)?.sheet ?? null;
  const other = at === null ? null : sideOf(at) === 'right' ? 'left' : 'right';
  /** The same rule as the page's own screen, asked of a part (§9ae). */
  const held = at !== null && blankReason(rows, at - 1) === 'recto';
  // A part carries no division rule of its own, so there is nothing here for
  // a shift to free — the refusal names the fact and stops.
  const frees = null;
  const shift = (room: boolean) => ({
    shiftOn: room && !held ? 'Shift it on a page' : null,
    shiftBack: pages > 0 && !held ? 'Shift it back a page' : null,
    shiftNote:
      (room || pages > 0) && other && !held
        ? `Either shift puts this page on the ${other}-hand side of the spread, and the pages after it swap sides with it as far as the next opening the book holds on a right-hand page. A blank sheet is the one that moves nothing.`
        : null,
    shiftRefusal: held
      ? 'This page opens on a right-hand page, so the book already leaves the page in front of it empty and a single page would be taken up by that gap.'
      : pages > 0
        ? null
        : 'Nothing blank stands in front of this page to take away, so it can only shift on.',
    shiftFrees: frees,
  });
  if (pages + SHEET > MAX_BLANK_PAGES) {
    return {
      spot: part.id,
      act: null,
      fewer: 'Take one away',
      pages,
      note: null,
      refusal: `${sheets} blank sheets already stand here, which is as many as one place takes.`,
      ...shift(pages < MAX_BLANK_PAGES),
    };
  }
  /**
   * **Offered rather than refused, with the fact said before the press**
   * (§9ac) — `blankOffer`'s own correction, because this was the same
   * sentence: §9r refused wherever a leaf already stood in front, which left
   * the writer holding no act at all in the one place a page is most often
   * wanted. **And what it offers is a sheet** (§9ad), said in the same words
   * the page's own screen says, three surfaces having to agree about what a
   * press puts in.
   */
  return {
    spot: part.id,
    act: sheets === 0 ? 'Put a blank sheet before this one' : 'Put another blank sheet before this one',
    fewer: pages >= SHEET ? (sheets === 1 ? 'Take the blank sheet away' : 'Take one away') : null,
    pages,
    note:
      sheets === 0
        ? 'A blank sheet goes in: two pages, so there is nothing on either side of the paper here. Nothing after it changes which side it is on.'
        : null,
    refusal: null,
    ...shift(true),
  };
};

/**
 * **Whether a picture may be asked for on this page, and where it will land**
 * (§9w, from Ken: *on page three, when I try to put a picture, it snaps it
 * before page one for some reason*).
 *
 * Three screens add a picture to the page in hand — the rail's **+ Picture**,
 * the Add menu's two items and the page's own dialog — and each decided for
 * itself whether it could, which is how they came to disagree: the menu
 * refused on a page with nothing of the manuscript on it and said *Choose a
 * page first*, the button carried the same words **in its title and acted
 * anyway**, and what it did was put an art page at the **back of the book**.
 * A writer who asked for a picture on page two got one on page nine, with the
 * control's own tooltip saying it would not. So this is one reading, in
 * `trackRemoval`'s shape, and the fallthrough that landed a picture somewhere
 * else is gone with it: a picture asked for on a page goes on that page or is
 * refused in a sentence.
 *
 * The other half is the one Ken reported. Two true facts about the cutter make
 * a picture land on a page the writer did not point at, and neither was said:
 *
 * **An empty leaf in front of the page is filled rather than added to.** A
 * picture of its own takes the next page there is, so where the cutter has
 * already left the verso empty the picture fills *that* and the book does not
 * grow — correct typography, and from the writer's chair the picture has
 * jumped back a page for no reason they can see. §9r found the same fact for
 * blank leaves and answered it by saying so before the press; a picture is
 * wanted on that page either way, so this says it and does not refuse.
 *
 * **A division's own opening page is not the page its first element is on**,
 * where the division opens twice — a collection's story opens with its own
 * page and again with its first chapter's numeral (addendum 22 §6). §9t
 * rightly stopped the hoist there so a picture asked for on the numeral's page
 * lands between the two; the cost, unnoticed, was that a picture asked for on
 * the **story's own page** also landed between them, which is the next page
 * along. `beforeOpening` is what the room cannot work out for itself and the
 * writer has just said by pointing at a page, so it is carried on the figure
 * and read by the hoist.
 */
export interface PictureOffer {
  /** The element or part a picture asked for here goes before. Null where none can be. */
  spot: string | null;
  /**
   * **Where a picture that is a page of its own goes before** (§9af). The
   * same as `spot` on every page that does not open with somebody's half
   * paragraph; `topElement` says why those are two positions — a plate is
   * *reached* and waits for the next leaf, so the break at the top of this
   * page is what lands it on this page, where a box cut into the text wants
   * the first paragraph that begins here.
   */
  pageSpot: string | null;
  /** Which kind of thing `spot` names, so the caller builds the right target. */
  of: 'story' | 'part' | null;
  /**
   * Whether a page of its own asked for here stands in front of the division's
   * opening rather than after it (§9w).
   */
  beforeOpening: boolean;
  /** Where a page of its own will really land, said only where it is not this page. */
  note: string | null;
  /**
   * **The record whose blank leaf this picture takes** (§9aa), where the
   * writer put one in. A leaf and a page of its own are the same mechanism
   * pointed two ways (§9i), so they are the same page: somebody who asked for
   * a leaf here and then says what is on it meant one page and not two, and
   * the act clears the leaf as it puts the picture in. Null everywhere else,
   * the cutter's own empty leaf being filled rather than removed.
   */
  takesLeaf: string | null;
  /**
   * **Whether the only picture this page can carry is a page of its own**
   * (§9aa). A blank leaf *is* a page and is not a page of text, so a box cut
   * into the words and a graphic set over them have nothing to stand against:
   * both would ride a block that is on the page ahead and draw there, which is
   * §9w's own fault wearing a different control. §8c's claim that a vector
   * graphic is offered *on every page, a blank leaf included* is still one the
   * mechanism cannot keep; what it can keep is the page.
   */
  ownPageOnly: boolean;
  /**
   * **The part a new page of art would stand in front of** (§9ab, from Ken:
   * *right now, it's locking me out if it's a blank page, saying there's
   * nothing I can do with it*).
   *
   * §9aa gave a leaf in the story somewhere to put a picture and left a leaf
   * among the front or back pages refusing, with a sentence naming a route:
   * *+ Add puts one in, and its row drags to where you want it*. That is the
   * two-step detour §9aa was itself written to remove — the writer pointed at
   * a page and was told to make the thing elsewhere and drag it back. The
   * page of art goes **here** instead, which is `addPart`'s new position.
   */
  newPageBefore: string | null;
  /** Why a picture may not be asked for here, in a sentence a writer can act on. */
  refusal: string | null;
}

export const pictureOffer = (place: PagePlace, rows: readonly BookPageRow[], sheet: number): PictureOffer => {
  const page = rows.find((one) => one.sheet === sheet);
  const none = (refusal: string): PictureOffer => ({
    spot: null,
    pageSpot: null,
    of: null,
    beforeOpening: false,
    note: null,
    takesLeaf: null,
    ownPageOnly: false,
    newPageBefore: null,
    refusal,
  });
  if (!page) return none('The book is still being set.');
  /**
   * **A leaf kept empty on purpose is not a page to fill** (§9aa). The back of
   * a picture, and the back of a page whose own screen asks for one, exist in
   * order to have nothing on them — so the refusal names the switch and where
   * it is, rather than the reason for a different leaf. It is the one blank the
   * forward walk is right about and the room must still say no to.
   */
  if (page.blank) {
    const why = blankReason(rows, sheet);
    if (why === 'back' || why === 'page_back') {
      return none(
        `This leaf is kept empty because ${sayBlankReason(why)}. Print on that back, from the page in front of it, and a picture can stand here.`,
      );
    }
  }
  if (!place.elementId && !place.partId) {
    /**
     * **A leaf among the front or back pages takes a page of art, here**
     * (§9ab). §9aa's walk forward stops at a part without answering with it,
     * because a part's picture is its own art or an inset in its words: put
     * there, a picture asked for on the leaf would draw on the page ahead,
     * which is §9w's fault wearing a different control. So the answer is not
     * that part but **a new page of art standing where the leaf is** — which
     * §9aa named as a route and made the writer walk, and which `addPart`'s
     * position now does in one press.
     */
    const ahead = rows.find((one) => one.sheet > sheet && one.partId !== null);
    if (page.blank && ahead) {
      return {
        spot: null,
        pageSpot: null,
        of: null,
        beforeOpening: false,
        note: null,
        takesLeaf: page.blankFor,
        ownPageOnly: true,
        newPageBefore: ahead.partId,
        refusal: null,
      };
    }
    /**
     * **A page with nothing of the book on it and nothing of the book after
     * it.** A leaf is not a record — it is where the cutter stopped — so there
     * is no paragraph, no part and no chapter to hang a picture from, and
     * §9aa's walk forward has found none either.
     */
    return none(
      page.blank
        ? 'This page is blank and nothing of the book follows it, so there is nowhere for a picture to stand.'
        : 'Nothing of the book stands on this page yet.',
    );
  }
  /**
   * **A sheet the writer put in takes the picture itself** (§9ad): standing on
   * one, `takesLeaf` names it and the picture lands on this very page, so the
   * sentence about a picture standing a page earlier is not about this press
   * at all — it named the cutter's gap in front of the writer's own sheet,
   * which is a page they did not point at and the act never touches.
   */
  const leaf = place.elementId !== null && page.blankFor === null && blankReason(rows, sheet - 1) !== null
    ? rows.find((one) => one.sheet === sheet - 1)
    : undefined;
  /**
   * **The page a picture asked for here would really reach** (§9af), where
   * this page is nothing but the middle of one paragraph. Said in the
   * writer's own numbering, which is the whole use of saying it (§9w).
   */
  const began =
    place.elementBegins != null ? rows.find((one) => one.sheet === place.elementBegins)?.counted ?? null : null;
  return {
    spot: place.elementId ?? place.partId,
    pageSpot: place.topElementId ?? place.partId,
    of: place.elementId ? 'story' : 'part',
    takesLeaf: page.blankFor,
    ownPageOnly: page.blank,
    /**
     * **The page the division opens on**, which is the fact the writer has
     * just stated by pointing at it. Where the opening and the first words
     * share a page, *before the opening* and *before the first element* are
     * the same page and this changes nothing; where they do not, it is the
     * whole difference between the page asked for and the next one.
     */
    beforeOpening: place.opensMarkerId !== null,
    /**
     * **It names the page**, which is the whole use of saying it: *one page
     * earlier* is arithmetic a writer has to do while looking at a rail that
     * has already done it, and beside `blankOffer`'s own sentence about the
     * same leaf the two read as one fact said twice.
     */
    /**
     * **And where it moves the opening, said before the press** (§9ae, from
     * Ken: *when I go to add a picture to that page, there needs to be some
     * kind of warning or ask if you want to make this a chapter page… it adds
     * the picture in the right place, but moves that text to the next page*).
     *
     * The act is right and §9p settled it: a picture that is a page of its own
     * stands **in front of** the opening, which is where an illustration
     * facing a chapter belongs. What was missing is that the room said so
     * only in the `?` — so the one consequence a writer cares about arrived
     * after the press, and the other act (art **on** the opening, which moves
     * nothing) was a button away with nothing joining the two.
     *
     * The two cases cannot both hold: where a leaf already stands in front,
     * the picture fills it and the opening does not move at all, which is why
     * this is one note with two readings rather than two notes that would one
     * day both be true.
     */
    /**
     * **And where this page opens in the middle of a paragraph** (§9af). A
     * third reading of the same note, and the three cannot overlap: a blank
     * leaf in front and a chapter opening here both break the flow, so
     * neither page can be carrying the tail of anything.
     */
    note: leaf
      ? `A picture of its own will stand on page ${leaf.counted}: the leaf in front of this page is empty, and it fills that rather than adding one.`
      : place.opensMarkerId !== null && place.standsBefore === null
        ? 'A picture of its own goes in front of the opening that stands here, so the opening moves on a page. Setting this page’s own art instead puts the picture on the opening, and nothing moves.'
        : began
          ? `This page is the middle of one paragraph, which begins on page ${began}. A picture cut into the text stands in front of a paragraph rather than inside one, so a box asked for here will stand on page ${began}; a picture of its own still stands on this page.`
          : null,
    newPageBefore: null,
    refusal: null,
  };
};

/**
 * Put a blank leaf in, or take it away. **One act for all three**, because
 * which of them an id names is a fact the caller should not have to carry:
 * the ids are distinct, so the act reads which it is and nothing on a screen
 * holds a second answer.
 */
export const setBlankPage = (file: ProjectFile, id: string, blank: boolean): ProjectFile =>
  // **One is a sheet** (§9ad, §9ae): the switch means *a blank page*, and a
  // blank page is two sides of paper. The count is in pages since the shift
  // (§9ae), so the act that still speaks in whole pages says how many that is
  // rather than leaving `1` to mean a half of one.
  setBlankPages(file, id, blank ? SHEET : 0);

/**
 * **How many leaves stand there, said in one act** (§9ac, from Ken: *you
 * should be able to just put as many pages in between as you want*).
 *
 * The caller says the number it wants rather than *one more* or *one fewer*,
 * which is what lets the ceiling and the floor live here: a screen that
 * incremented would have to know both, and the two screens that reach the
 * field would then hold two answers. `leavesBefore` clamps, so asking for
 * thirteen gives twelve and asking for less than none gives none.
 */
export const setBlankPages = (file: ProjectFile, id: string, count: number): ProjectFile => {
  const want = pagesBefore(count);
  if (file.beats.some((beat) => beat.manuscript.elements.some((element) => (element.id as string) === id))) {
    return setBlanksBefore(file, id, want);
  }
  if (partsOf(file).some((part) => part.id === id)) return setPartBlank(file, id, 'before', want);
  if (file.markers.some((marker) => (marker.id as string) === id)) return setChapterBlank(file, id, 'before', want);
  return file;
};

/** How many leaves stand before whatever this id names (§9ac). */
export const blankPagesAt = (file: ProjectFile, id: string): number => {
  for (const beat of file.beats) {
    const element = beat.manuscript.elements.find((one) => (one.id as string) === id);
    if (element) return blanksBefore(element);
  }
  const part = partsOf(file).find((one) => one.id === id);
  if (part) return pagesBefore(part.blankBefore);
  const marker = file.markers.find((one) => (one.id as string) === id);
  if (marker) return pagesBefore(chapterPageSchema.parse(marker.page ?? {}).blankBefore);
  return 0;
};

/**
 * **A blank leaf before a part's page, or behind it** (§9r): the same act as
 * the manuscript's, said of the front and back matter, where *wherever you
 * want* had no answer at all.
 */
export const setPartBlank = (
  file: ProjectFile,
  partId: string,
  where: 'before' | 'back',
  // A count in front (§9ac) and a switch behind: there is one back to a leaf.
  blank: boolean | number,
): ProjectFile =>
  updatePart(
    file,
    partId,
    where === 'before' ? { blankBefore: pagesBefore(blank) } : { backBlank: pagesBefore(blank) > 0 },
  );

/**
 * **A blank leaf before a chapter opens, or on the back of its page** (§9r).
 *
 * On the chapter rather than on its first element, because a chapter opening
 * is emitted by the unit: hung on the element it lands between the numeral
 * and the words, which is §9p's fault exactly.
 */
export const setChapterBlank = (
  file: ProjectFile,
  markerId: string,
  where: 'before' | 'back',
  // A count in front (§9ac) and a switch behind: there is one back to a leaf.
  blank: boolean | number,
): ProjectFile => ({
  ...file,
  markers: file.markers.map((marker) => {
    if ((marker.id as string) !== markerId) return marker;
    const page = chapterPageSchema.parse(marker.page ?? {});
    return {
      ...marker,
      page:
        where === 'before'
          ? { ...page, blankBefore: pagesBefore(blank) }
          : { ...page, backBlank: pagesBefore(blank) > 0 },
    };
  }),
});

/**
 * **Whether this chapter opens on a right-hand page** (§9x), or back to the
 * book's answer. It is the act behind the × on the empty leaf the recto rule
 * leaves in front of a chapter: the leaf is not the thing to remove, the rule
 * that made it is.
 */
export const setChapterRecto = (file: ProjectFile, markerId: string, recto: boolean | null): ProjectFile => ({
  ...file,
  markers: file.markers.map((marker) => {
    if ((marker.id as string) !== markerId) return marker;
    const page = chapterPageSchema.parse(marker.page ?? {});
    return { ...marker, page: { ...page, opensRecto: recto } };
  }),
});

/**
 * Ask for that leaf, or stop asking. Only what differs from the default is
 * stored.
 *
 * **One act for all three, like `setBlankPage`** (§17e). It read the
 * manuscript and nothing else, which was the whole of what §9i needed — a
 * picture's back — and then §17d gave a **part** the same switch and §9r gave
 * a **chapter page** one, so the act had three callers and could answer for
 * one. The cost showed where the room reaches the field from a page rather
 * than from a record: the leaf behind the title page had no × on it, and the
 * sentence beside it named the recto rule, which is the reason for a different
 * leaf two pages away. Which collection an id is in is a fact the caller
 * should not have to carry, and that is this function's twin's own argument.
 */
export const setBackBlank = (file: ProjectFile, id: string, blank: boolean): ProjectFile => {
  if (partsOf(file).some((part) => part.id === id)) return setPartBlank(file, id, 'back', blank);
  if (file.markers.some((marker) => (marker.id as string) === id)) return setChapterBlank(file, id, 'back', blank);
  return setElementBackBlank(file, id, blank);
};

const setElementBackBlank = (file: ProjectFile, elementId: string, blank: boolean): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) => ({
    ...beat,
    manuscript: {
      ...beat.manuscript,
      elements: beat.manuscript.elements.map((element) => {
        if ((element.id as string) !== elementId) return element;
        const attributes = { ...element.attributes };
        if (blank) attributes.bookBackBlank = true;
        else delete attributes.bookBackBlank;
        return { ...element, attributes };
      }),
    },
  })),
});

/**
 * **Which opening a page-figure stands in front of** (§9w). Written only where
 * the writer pointed at a division's own opening page, and cleared otherwise,
 * so the figure never carries a stale answer about a page it has left.
 */
export const setBeforeOpening = (file: ProjectFile, elementId: string, before: boolean): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) => ({
    ...beat,
    manuscript: {
      ...beat.manuscript,
      elements: beat.manuscript.elements.map((element) => {
        if ((element.id as string) !== elementId) return element;
        const attributes = { ...element.attributes };
        if (before) attributes.bookBeforeOpening = true;
        else delete attributes.bookBeforeOpening;
        return { ...element, attributes };
      }),
    },
  })),
});

export const figurePlacement = (element: ManuscriptElement): BookFigurePlacement => {
  const place = element.attributes.bookPlace;
  const span = element.attributes.bookSpan;
  const side = element.attributes.bookSide;
  const standoff = element.attributes.bookStandoff;
  const chosen: FigurePlace =
    place === 'left' || place === 'right' || place === 'page' || place === 'free' ? place : 'measure';
  // A free graphic's width is a share of the **page** and may be anything
  // from an ornament to the whole sheet, so it is not held to an inset's
  // band — the two are different measurements of different things.
  const band = chosen === 'free' ? FREE_SPAN : INSET_SPAN;
  const fraction = typeof span === 'number' && Number.isFinite(span) ? Math.min(band.max, Math.max(band.min, span)) : band.default;
  const place01 = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  return {
    place: chosen,
    span: fraction,
    side: side === 'verso' || side === 'recto' ? side : 'either',
    standoff:
      typeof standoff === 'number' && Number.isFinite(standoff)
        ? Math.min(INSET_STANDOFF.max, Math.max(INSET_STANDOFF.min, standoff))
        : INSET_STANDOFF.default,
    boxHeight: place01(element.attributes.bookBoxHeight, 0),
    x: place01(element.attributes.bookX, 0.1),
    y: place01(element.attributes.bookY, 0.1),
  };
};

/** A figure in the book, for the rail: where it is and what it shows. */
export interface BookFigure {
  elementId: string;
  beatId: string;
  caption: string;
  assetId: string | null;
  assetName: string;
  placement: BookFigurePlacement;
  chapterTitle: string;
  /**
   * The chapter it falls in, so the rail can sit it under the chapter it is
   * in rather than walking the manuscript a second time to find out. Null
   * before the first chapter, where it belongs to none.
   */
  markerId: string | null;
  /**
   * The section it stands in (§9l). On a collection a story's sections are its
   * chapters, so the marker alone puts every picture in the story at the end
   * of it rather than under the numeral it actually falls in.
   */
  unitId: string | null;
  /** Marked decorative for the eBook (addendum 23 §11). */
  decorative: boolean;
  /** The leaf behind it left blank (§9i). Meaningless off a picture page. */
  backBlank: boolean;
}

export const bookFigures = (file: ProjectFile): BookFigure[] => {
  const names = new Map(file.assets.map((asset) => [asset.id as string, asset.name]));
  const divisions = new Map<string, PlacedMarker>(contentsDivisions(file).map((placed) => [placed.marker.unitId as string, placed]));
  const out: BookFigure[] = [];
  let chapterTitle = bookNames(file).title;
  let markerId: string | null = null;
  for (const unit of unitsInStoryOrder(file)) {
    if (!unit.inScript) continue;
    const placed = divisions.get(unit.id as string);
    if (placed) {
      chapterTitle = placed.marker.title.trim() || placed.label || chapterTitle;
      markerId = placed.marker.id as string;
    }
    for (const beat of beatsInScript(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        if (element.type !== 'figure') continue;
        const assetId = typeof element.attributes.assetId === 'string' ? element.attributes.assetId : null;
        out.push({
          elementId: element.id as string,
          beatId: beat.id as string,
          caption: element.text,
          assetId,
          assetName: (assetId && names.get(assetId)) || '',
          placement: figurePlacement(element),
          chapterTitle,
          markerId,
          unitId: unit.id as string,
          decorative: element.attributes.decorative === true,
          backBlank: backBlank(element),
        });
      }
    }
  }
  return out;
};

/**
 * Say whether a figure is decorative (addendum 23 §11): an ornament a
 * reader who cannot see it loses nothing by. On the element's attributes,
 * like its placement; off means the picture needs a description, which is
 * the default because a picture nobody has looked at is not known to be
 * decoration.
 */
export const markFigureDecorative = (file: ProjectFile, elementId: string, decorative: boolean): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) =>
    beat.manuscript.elements.some((element) => element.id === elementId)
      ? {
          ...beat,
          manuscript: {
            ...beat.manuscript,
            elements: beat.manuscript.elements.map((element) => {
              if (element.id !== elementId) return element;
              const { decorative: _was, ...rest } = element.attributes;
              return { ...element, attributes: decorative ? { ...rest, decorative: true } : rest };
            }),
          },
        }
      : beat,
  ),
});

/**
 * Place a figure in the book. Written on the element's attributes, which
 * the manuscript carries and never reads; *across the measure* clears them,
 * so an unplaced figure and one put back read the same.
 */
/** What a caller must say to place a figure: where, and anything else it is changing. */
export type FigurePlacementInput = Pick<BookFigurePlacement, 'place'> & Partial<BookFigurePlacement>;

export const placeBookFigure = (file: ProjectFile, elementId: string, placement: FigurePlacementInput): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) =>
    beat.manuscript.elements.some((element) => element.id === elementId)
      ? {
          ...beat,
          manuscript: {
            ...beat.manuscript,
            elements: beat.manuscript.elements.map((element) => {
              if (element.id !== elementId) return element;
              // The back leaf goes with the page: a picture cut into the text
              // has no back page to leave, so an answer left behind on it
              // would come back the next time it was made a page again.
              const {
                bookPlace: _place,
                bookSpan: _span,
                bookSide: _side,
                bookStandoff: _off,
                bookBackBlank: _back,
                bookBeforeOpening: _opening,
                bookX: _x,
                bookY: _y,
                ...rest
              } = element.attributes;
              // **The drawn height is not stripped** (§9z): it is the size
              // the box was dragged to rather than anything about the
              // arrangement, so it survives being made an inset and made a
              // measure figure again, and only a picture overrides it.
              const tall = placement.boxHeight ?? figurePlacement(element).boxHeight;
              if (tall > 0) rest.bookBoxHeight = tall;
              else delete rest.bookBoxHeight;
              if (placement.place === 'measure') return { ...element, attributes: rest };
              const attributes: Record<string, string | number | boolean> = { ...rest, bookPlace: placement.place };
              if (placement.place === 'page') {
                // A page needs no width and no standoff: it is the page.
                if (placement.side && placement.side !== 'either') attributes.bookSide = placement.side;
                if (element.attributes.bookBackBlank === true) attributes.bookBackBlank = true;
                // **Which opening it stands in front of goes with the page**
                // (§9w), for the back leaf's own reason: a picture cut into
                // the text is not in front of anything, so an answer left on
                // it would come back the next time it was made a page.
                if (element.attributes.bookBeforeOpening === true) attributes.bookBeforeOpening = true;
              } else if (placement.place === 'free') {
                // Where it stands and how wide, and nothing else: a free
                // graphic is out of the text's way, so it has no side to
                // take and no standoff to keep (§8c).
                const held = figurePlacement(element);
                attributes.bookSpan = Math.min(FREE_SPAN.max, Math.max(FREE_SPAN.min, placement.span ?? held.span));
                attributes.bookX = Math.min(1, Math.max(0, placement.x ?? held.x));
                attributes.bookY = Math.min(1, Math.max(0, placement.y ?? held.y));
              } else {
                /**
                 * **A placement says what it changes** (§9af, from Ken: *it
                 * doesn't allow me to move the box anywhere… and it pops the
                 * box on the wrong page at the wrong size*).
                 *
                 * These two read `INSET_SPAN.default` and
                 * `INSET_STANDOFF.default` where the line above reads the
                 * element's own — and the slide passes a placement carrying
                 * nothing but `place`, so **every slide rewrote the drawn
                 * width as 40% of the measure** and the border with it. A box
                 * dragged down the page came back narrower than it was
                 * dropped, which is the `1.67 × 3.21 in · 40% of the measure`
                 * in Ken's own screenshot: 40% is not a width anybody chose,
                 * it is this constant.
                 *
                 * The argument is `boxHeight`'s, two lines up, and the `free`
                 * branch's: a default is the answer for a figure that has
                 * never been given one, never for a caller that did not
                 * mention the field.
                 */
                const held = figurePlacement(element);
                attributes.bookSpan = Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, placement.span ?? held.span));
                const standoff = Math.min(INSET_STANDOFF.max, Math.max(INSET_STANDOFF.min, placement.standoff ?? held.standoff));
                // Only what differs from the default is written down, so a
                // document says what the writer chose and nothing else.
                if (standoff !== INSET_STANDOFF.default) attributes.bookStandoff = standoff;
              }
              return { ...element, attributes };
            }),
          },
        }
      : beat,
  ),
});

/**
 * What a page on the spread stands on (§9a, from Ken: *you select a page in
 * the layout view and then add picture… and it scoots all the text down*).
 *
 * A page is not a record — it is where the laying happened to cut — so a
 * press on one is answered by reading what is *on* it: the first block, and
 * through it the part or the manuscript element the page begins with. A
 * picture put in before that element makes the page start with the picture
 * and pushes everything after it down, which is the whole of what Ken asked
 * for and needs nothing stored about pages at all.
 */
export interface PagePlace {
  /** The manuscript element the page opens with, where it is in the story. */
  elementId: string | null;
  /** The part the page belongs to, where it is in the front or back matter. */
  partId: string | null;
  /** The chapter in force on it. */
  markerId: string | null;
  /** The chapter whose opening stands **on** this page, where one does (§9r). */
  opensMarkerId?: string | null;
  /**
   * **The section that opens on this page** (§9ac, from Ken: *then you can be
   * able to turn a blank page into a chapter page with a blank back or not*).
   *
   * A division begins where a section begins (§9ab), so the one thing that
   * could make a blank leaf into a chapter page is the section it stands in
   * front of — and the rail's own `opensUnitId` is a fact about the row, which
   * on a leaf is nothing at all. This is the same question asked of the place,
   * so §9aa's walk forward answers it and the act is offered on the leaf.
   */
  opensUnitId?: string | null;
  /**
   * Whether that opening **stands alone on its page**, so there is a back to
   * leave blank (§9r). Read from the laid page rather than from the block's
   * own `display` flag: a chapter page carrying nothing but its title stands
   * alone whether or not it was given a device, and Ken's stories are exactly
   * that shape — gating on the flag offered the control on none of them.
   */
  opensAlone?: boolean;
  /**
   * **The page this place was read off, where that is not this page** (§9aa,
   * from Ken: *I'm trying to put a picture on a page that is blank and there's
   * nothing I can do to edit it… every page should be editable*).
   *
   * A blank leaf carries nothing of the book, so for ten sections this
   * answered *nowhere* and every act built on it was absent — a picture, a
   * graphic, the route to the chapter's own page — on the one page in the book
   * a writer most often wants to use, and the one they deliberately put in.
   *
   * The sentence in this function's own doc finishes itself: a press on a page
   * is answered by reading what is **on** it, and where nothing is on it, by
   * reading what it stands **in front of**. The two are the same position — a
   * page of its own takes the next page there is, so the cutter fills an empty
   * leaf rather than adding one (§9w) — which is why what is asked for here
   * lands here, and why this is the existing rule applied one page along
   * rather than a second answer.
   *
   * Null wherever a page answers for itself, so a caller that must know what a
   * page **is** (rather than what may go on it) can tell them apart.
   */
  standsBefore?: number | null;
  /**
   * **The page the element at the head of this one begins on**, where that is
   * not this page (§9af, from Ken: *it pops the box on the wrong page… I was
   * trying on page 85. It ended up putting the box on page 84*).
   *
   * A page very often opens with the **tail of a paragraph that began on the
   * page before** — the cutter splits one wherever the page runs out — and
   * `elementId` is that paragraph. Everything built on this answer puts its
   * thing **in front of** the element: so a picture, or a blank sheet, asked
   * for at the head of such a page reaches back to where the paragraph
   * begins, which is a page the writer did not point at. Measured on a novel:
   * pressing *Put a blank sheet here…* on page 12 left the sheet where it was
   * asked for and took page 11 from 1,538 characters to 781, the rest of it
   * moving two pages on.
   *
   * It is **said rather than refused**, which is §9w's own answer to this
   * shape: a picture stands in front of a paragraph and never inside one, so
   * where this page opens in the middle of one there is no position on it to
   * be had and the honest thing is to name the page the act will really
   * reach. A box **drawn** over a paragraph that begins here is unaffected —
   * the drag names its own anchor — so the way to a picture on this page is
   * already on the screen.
   *
   * Null where the element begins on this page, which is every other page.
   */
  elementBegins?: number | null;
  /**
   * **The element whose own start is the top of this page** (§9af), which is
   * where a picture that is **a page of its own** goes in — `topElement` says
   * why the two are two positions rather than two answers. The same as
   * `elementId` on every page that does not open with somebody's half
   * paragraph, which is most of them.
   */
  topElementId?: string | null;
}

/**
 * What stands on one laid page: `pagePlace`'s answer for a page that has
 * something of the book on it, lifted out so the walk forward over a blank
 * leaf (§9aa) can ask the same question of the page ahead rather than keeping
 * a second, coarser copy of it.
 */
/**
 * **The element at the head of a page** (§9af, from Ken: *it pops the box on
 * the wrong page… I was trying on page 85. It ended up putting the box on
 * page 84*).
 *
 * Three rules, and the middle one is the fix. **Never a block that stands in
 * for a missing heading** (§9s): its id names the unit, so every act built on
 * this answer would look it up in the manuscript, find nothing and change
 * nothing — the first *real* element is the answer, and what is anchored to
 * it is emitted in front of the stand-in, so the whole opening moves on
 * together.
 *
 * **Never the tail of something that began on an earlier page.** `piece.from`
 * is the line of the block a piece starts at, so a piece with lines above it
 * is the **continuation** of a paragraph the cutter split — and everything
 * built on this answer puts its thing *in front of* the element, which for a
 * continuation is wherever that paragraph begins, a page or more back.
 * Measured on a novel before the fix: *Put a blank sheet here…* on page 12
 * took page 11 from 1,538 characters to 781, the rest of it moving two pages
 * on, and a picture asked for at the head of such a page landed on the page
 * before. **The head of a page is the first thing that begins on it**; a tail
 * is the head of nothing.
 *
 * **And where the page is nothing but a tail, that tail**, rather than
 * silence: a page carrying the middle of one long paragraph has no position
 * on it to be had, and answering *nowhere* would take every act off it, which
 * is §9aa's own fault. `elementBegins` names the page it reaches so the room
 * says so before the press.
 *
 * It is **one reading** because `bookPageRows` kept its own copy — *which is
 * `pagePlace`'s answer for one sheet*, said in that field's own doc while
 * answering differently (it skipped neither a stand-in nor a tail) — so a
 * row and a place disagreed about where a picture dropped on a page goes in.
 */
export const headElement = (page: BookPage, index: ReadonlyMap<string, BookBlock>): string | null => {
  let tail: string | null = null;
  for (const piece of page.pieces) {
    const block = index.get(piece.blockId);
    if (!block || !BODY_KINDS.has(block.kind) || block.standsIn) continue;
    if (piece.from === 0) return block.id;
    if (!tail) tail = block.id;
  }
  return tail;
};

/**
 * **The element whose own start is the top of this page** (§9af) — the first
 * body block on it, tail or not, which is what `headElement` answered before.
 *
 * It is kept because the two are **two positions and not two answers**, and
 * which one *here* means depends on what is going there:
 *
 * A picture cut into the text, and the writer's own blank sheet, **appear
 * where they are anchored**, so for them the head of the page is the first
 * thing that begins on it — anchored in front of a tail they reach back to
 * wherever that paragraph began.
 *
 * A picture that is **a page of its own** is *reached* rather than placed:
 * §9q made a plate wait for the next leaf while the text goes on filling the
 * page it was reached on, so it lands on the leaf **after** the break it
 * stands at. Anchored in front of a tail it is reached on the page before and
 * takes this one, with that page left exactly as full as it was — which is
 * why that is the right position for it and why the fix above would have put
 * every plate a page late. §9q's own suite is what caught it.
 */
export const topElement = (page: BookPage, index: ReadonlyMap<string, BookBlock>): string | null => {
  for (const piece of page.pieces) {
    const block = index.get(piece.blockId);
    if (block && BODY_KINDS.has(block.kind) && !block.standsIn) return block.id;
  }
  return null;
};

const onPage = (
  page: BookPage,
  index: Map<string, BookBlock>,
  blocks: readonly BookBlock[],
): Required<Pick<PagePlace, 'elementId' | 'topElementId' | 'partId' | 'opensMarkerId' | 'opensAlone' | 'opensUnitId'>> => {
  let elementId: string | null = headElement(page, index);
  let topElementId: string | null = topElement(page, index);
  let partId: string | null = null;
  for (const piece of page.pieces) {
    const block = index.get(piece.blockId);
    if (!block) continue;
    if (block.partId && !partId) partId = block.partId;
  }
  /**
   * **Which chapter opens *on* this page** (§9r), as against the chapter in
   * force, which every page inside one has. A blank leaf and a blank back are
   * the chapter page's own, so the room has to tell the page a chapter opens
   * on from the pages that merely follow it.
   */
  const opening = page.pieces
    .map((piece) => index.get(piece.blockId))
    .find((block) => block?.kind === 'chapter_opening');
  /**
   * **A page that only opens a chapter still has somewhere to put a picture**
   * (§9p, from Ken: *I tried to put a picture in chapter one and it didn't
   * even allow me to put a picture, it just did nothing*).
   *
   * A chapter opening is not a manuscript element, so a page carrying one and
   * nothing else answered *nowhere* — and the room greys its picture buttons
   * on exactly that answer, which is a control that does nothing for a reason
   * the writer cannot see. The chapter's **first element** is the answer, on
   * that page or on the next: putting a figure before it now puts it before
   * the opening, so the picture takes this page and the chapter opens after.
   */
  /**
   * **The section the page opens** (§9ac). `unitId` is on the first block of
   * each unit (§9b), which is what says a section opens here rather than
   * merely running through — and where the page carries a **chapter opening**
   * and nothing else, that block is on the page after it, so the opening's own
   * unit is read the way its first element is below. Without it a leaf in
   * front of a story's own page answered *no section*, which is the one page
   * a writer is most likely standing on when they want a story to begin
   * there.
   */
  let opensUnitId: string | null =
    page.pieces.map((piece) => index.get(piece.blockId)).find((one) => one?.unitId !== undefined)?.unitId ?? null;
  if ((!elementId || !opensUnitId) && opening) {
    const from = blocks.findIndex((block) => block.id === opening.id);
    // The first **real** element, for §9s's reason: a stand-in head names
    // the unit, so answering with one sends every act looking for an
    // element that is not there.
    const next = blocks.slice(from + 1).find((block) => BODY_KINDS.has(block.kind) && !block.standsIn);
    if (next && !elementId && !partId) elementId = next.id;
    // The chapter's first element is the top of this page too: a page that
    // opens a chapter cannot be carrying the tail of anything (§9af).
    if (next && !topElementId && !partId) topElementId = next.id;
    if (!opensUnitId) {
      opensUnitId = blocks.slice(from + 1).find((block) => block.unitId !== undefined)?.unitId ?? null;
    }
  }
  return {
    elementId,
    topElementId,
    partId,
    opensMarkerId: opening ? opening.id : null,
    opensAlone: opening !== undefined && page.pieces.length === 1,
    opensUnitId,
  };
};

export const pagePlace = (pages: readonly BookPage[], blocks: readonly BookBlock[], sheet: number): PagePlace => {
  const page = pages.find((one) => one.sheet === sheet);
  const index = new Map(blocks.map((block) => [block.id, block]));
  const place: PagePlace = {
    elementId: null,
    partId: null,
    markerId: null,
    opensMarkerId: null,
    opensUnitId: null,
    opensAlone: false,
    standsBefore: null,
    elementBegins: null,
    topElementId: null,
  };
  if (!page) return place;
  // The chapter in force is read from the last opening at or before the page,
  // so a page in the middle of a chapter still knows which chapter it is in.
  for (const block of blocks) {
    if (block.kind !== 'chapter_opening') continue;
    const at = pages.find((one) => one.pieces.some((piece) => piece.blockId === block.id));
    if (at && at.sheet <= sheet) place.markerId = block.id;
  }
  Object.assign(place, onPage(page, index, blocks));
  /**
   * **A blank leaf answers with the page it stands in front of** (§9aa).
   *
   * Three things are deliberately **not** carried over from that page. The
   * chapter does **not** open here, so `opensAlone` stays false and the back
   * of the chapter's own page is still set from that page rather than from
   * this leaf — two leaves a sheet apart being two different sides of paper.
   * Nor does a **part** answer: a part's picture is the part's own art or an
   * inset in its words, so a leaf in the front matter given one would put it
   * on the page ahead rather than on itself, which is the very fault this
   * fixes. `opensMarkerId` **is** carried, because §9t's hoist needs to know
   * the leaf stands in front of a division's whole opening rather than
   * between a collection's two — and `opensAlone` is what gates the controls
   * that would otherwise be fooled by it.
   */
  if (!place.elementId && !place.partId) {
    for (const after of pages) {
      if (after.sheet <= sheet) continue;
      const ahead = onPage(after, index, blocks);
      if (!ahead.elementId) {
        // A part ahead ends the walk rather than being skipped past: the leaf
        // stands in front of *that* page, and looking further would answer
        // with a page of the story on the other side of the front matter.
        if (ahead.partId) break;
        continue;
      }
      place.elementId = ahead.elementId;
      place.topElementId = ahead.topElementId;
      place.opensMarkerId = ahead.opensMarkerId;
      // **And the section that opens there** (§9ac): what makes a leaf into a
      // chapter page is a break started on the section it stands in front of,
      // and nothing on the leaf itself names one.
      place.opensUnitId = ahead.opensUnitId;
      place.standsBefore = after.sheet;
      break;
    }
  }
  /**
   * **Where that element begins** (§9af). A block's first page is the first
   * that carries a piece of it, so this is a reading of the pages already in
   * hand and nothing is stored; it is asked of the page the answer came off,
   * which on a leaf is the page ahead (§9aa).
   */
  if (place.elementId) {
    const on = place.standsBefore ?? sheet;
    const first = pages.find((one) => one.pieces.some((piece) => piece.blockId === place.elementId));
    place.elementBegins = first && first.sheet < on ? first.sheet : null;
  }
  return place;
};

/** The block kinds whose id is a manuscript element's. */
const BODY_KINDS = new Set<BlockKind>(['paragraph', 'heading', 'blockquote', 'scene_break', 'figure']);

/**
 * One page of the book, for the rail (§9h, from Ken: *you should be able to
 * drop down each chapter and see how many pages, so you can select an
 * individual page… and on that page you can see which one is art and which
 * one is not*).
 *
 * A page is still not a record — this is `pagePlace` said for every sheet at
 * once and with a word for what stands on it, so nothing is stored and a
 * chapter that grows a page grows a row with nothing run.
 */
export interface BookPageRow {
  sheet: number;
  /** The number it prints, roman or arabic, or empty where it prints none. */
  folio: string;
  /** What stands on it, in two or three words. Never a sentence. */
  says: string;
  /** The chapter in force, so the rail can sit it under one. */
  markerId: string | null;
  /**
   * The division in force one level down (§6b): a collection's chapter is a
   * **section**, so its pages are found by the unit rather than by a marker.
   * The rail folds a row on whichever of the two it stands for.
   */
  unitId: string | null;
  /**
   * The section that **opens** on this page, as against the one in force
   * (§9ab). `unitId` is carried forward so a page in the middle of a section
   * knows which it is in; starting a division needs the other question, a
   * marker sitting on a unit and so being placeable only where one begins.
   */
  opensUnitId: string | null;
  /** The part it belongs to, where it is front or back matter rather than story. */
  partId: string | null;
  /** The picture that **is** the page, where it is one — what the inspector edits. */
  figureId: string | null;
  /**
   * The manuscript element the page opens with (§9i): where a picture dropped
   * on this page goes in, which is `pagePlace`'s answer for one sheet.
   */
  elementId: string | null;
  /** Which page this is, printed or not (§9l): a picture page still counts. */
  counted: string;
  /**
   * Where this page is a blank leaf the *writer* put in (§9i): the element it
   * stands before, which is what taking it away again needs. Null on a leaf
   * the cutter left and on the back of a picture, neither being this page's
   * to remove.
   */
  blankFor: string | null;
  /**
   * Whether this blank page is the **back** of the leaf in front of it (§9w):
   * a picture page's, or a chapter page's. Said by the block rather than
   * guessed from what stands on the page before.
   */
  blankBack: boolean;
  blank: boolean;
  /**
   * **The manuscript elements that stand whole on this page** (§9x): what a ×
   * on the page's row cuts, and what the sentence counts before the press.
   *
   * Only the blocks the cutter did **not** split, because a paragraph that
   * runs on to the next page is not this page's to take — *the words on this
   * page go* has to mean the words on this page.
   */
  elementIds: string[];
}

export const bookPageRows = (
  pages: readonly BookPage[],
  blocks: readonly BookBlock[],
): BookPageRow[] => {
  const index = new Map(blocks.map((block) => [block.id, block]));
  let marker: string | null = null;
  let unit: string | null = null;
  return pages.map((page) => {
    const on = page.pieces.map((piece) => index.get(piece.blockId)).filter((block): block is BookBlock => block !== undefined);
    const opening = on.find((block) => block.kind === 'chapter_opening');
    // A new division ends the last one's run (§9j). Without this the unit in
    // force ran on past its own writing — the next story's opening page, and
    // the blank leaf before the back matter, were both credited to the last
    // section of the story before, so folding it open listed pages that were
    // not in it. The unit that opens on this page sets it again below.
    if (opening) {
      marker = opening.id;
      unit = null;
    }
    // `unitId` is on the first block of each unit (§9b), which is how a row
    // finds the page it opens on; read in order it is also what says which
    // division a page in the middle of one belongs to.
    const opened = on.find((block) => block.unitId !== undefined);
    if (opened) unit = opened.unitId ?? null;
    const part = on.find((block) => block.partId !== undefined);
    // A picture is a page of its own where its block takes the whole page,
    // which is the same `display` the print reads — not a second rule.
    const art = on.find((block) => block.kind === 'figure' && block.display);
    // The leaf asked for behind a picture (§9i). The cutter leaves a page
    // empty of its own accord too, and to a reader they are one thing: a
    // page with nothing on it. So the row says the same of both.
    const leaf = on.find((block) => block.kind === 'blank');
    const empty = page.blank || leaf !== undefined;
    // A chapter inside a story opens with its heading rather than with a
    // `chapter_opening` (addendum 22 §6), so without this every numeral's
    // page read *Text* and nothing on the rail said where a chapter began.
    const opensSection = on[0]?.kind === 'heading' && on[0]?.starts !== 'none';
    const says = empty
      ? 'Blank'
      : art
        ? 'Illustration'
        : opening || opensSection
          ? 'Chapter opens'
          : part
            ? 'Page'
            : 'Text';
    return {
      sheet: page.sheet,
      folio: page.folio,
      counted: page.counted,
      says,
      markerId: part ? null : marker,
      unitId: part ? null : unit,
      opensUnitId: part ? null : (opened?.unitId ?? null),
      partId: part?.partId ?? null,
      figureId: art?.id ?? null,
      // **`pagePlace`'s own answer, which this field's doc already claimed to
      // be** (§9af): it was the first body block on the page, stand-in or
      // tail, so a row and a place disagreed about where a picture dropped on
      // a page goes in.
      elementId: headElement(page, index),
      blankFor: leaf?.blankFor ?? null,
      blankBack: leaf?.blankBack === true,
      blank: empty,
      elementIds: page.pieces
        .filter((piece) => piece.cut !== true)
        .map((piece) => index.get(piece.blockId))
        .filter((block): block is BookBlock => block !== undefined && BODY_KINDS.has(block.kind) && !block.standsIn)
        .map((block) => block.id),
    };
  });
};

/**
 * Move a figure so it stands just before another element, wherever in the
 * manuscript that is. This is what re-drawing a picture's box on a different
 * page means: the box is where the picture goes, so drawing it elsewhere
 * moves the picture rather than making a second one.
 */
/**
 * Take a figure out of the manuscript, by its element alone (addendum 20 §9d).
 *
 * `removeFigure` wants the beat as well, which the room does not have: a page
 * knows the elements standing on it and nothing about which beat they came
 * from. Finding the beat here is the same walk `moveFigureBefore` already
 * does, so this is that walk with nothing put back — what the **✗** on a box
 * being placed presses, and the only thing that undoes drawing one.
 *
 * The picture itself is the library's and is not touched, which is the rule
 * every figure has followed since addendum 16 §9: cutting a figure keeps the
 * picture.
 */
export const removeBookFigure = (file: ProjectFile, elementId: string): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) => ({
    ...beat,
    manuscript: {
      ...beat.manuscript,
      elements: beat.manuscript.elements.filter((element) => (element.id as string) !== elementId),
    },
  })),
});

export const moveFigureBefore = (file: ProjectFile, elementId: string, beforeElementId: string): ProjectFile =>
  moveFigureTo(file, elementId, { elementId: beforeElementId, after: false });

/**
 * **Where a picture stands, said of an element** (§9z, from Ken: *I was trying
 * to fill the bottom of a last page of a section with a picture but it doesn't
 * allow me to move the picture around or place it somewhere*).
 *
 * A figure has always been anchored **before** an element, which is every
 * position in the writing but one — **after the last words on the page**,
 * which is exactly the foot of a page whose text runs short, and so exactly
 * what he was reaching for. The handle could not express it either: sliding
 * below the last line asked for *before the last paragraph*, which is a line
 * higher up, so the picture could be put anywhere except where he wanted it.
 *
 * So the anchor says which end, and the two acts are one act: *before* and
 * *after* are the same insertion with the index one apart, and writing them
 * separately would be two answers to where a picture goes.
 */
export interface FigureAnchor {
  elementId: string;
  /** True to stand after that element rather than in front of it. */
  after: boolean;
}

export const moveFigureTo = (file: ProjectFile, elementId: string, anchor: FigureAnchor): ProjectFile => {
  if (elementId === anchor.elementId) return file;
  const from = file.beats.find((beat) => beat.manuscript.elements.some((element) => (element.id as string) === elementId));
  const moving = from?.manuscript.elements.find((element) => (element.id as string) === elementId);
  if (!from || !moving) return file;
  // **Put down once** (§9z). It inserted wherever the anchor was found, so a
  // document with the same id in two beats — which a fixture is more likely
  // to hold than a manuscript, but nothing refuses — came back with the
  // picture in both: one act making two pictures. The first match is the
  // move, and every beat after it only has the picture taken out of it.
  let put = false;
  const beats = file.beats.map((beat) => {
    const elements = beat.manuscript.elements.filter((element) => (element.id as string) !== elementId);
    const at = put ? -1 : elements.findIndex((element) => (element.id as string) === anchor.elementId);
    if (at === -1) return beat.id === from.id || elements.length !== beat.manuscript.elements.length ? { ...beat, manuscript: { ...beat.manuscript, elements } } : beat;
    put = true;
    const where = anchor.after ? at + 1 : at;
    return { ...beat, manuscript: { ...beat.manuscript, elements: [...elements.slice(0, where), moving, ...elements.slice(where)] } };
  });
  return { ...file, beats };
};

/**
 * **What a box drawn on the page means** (§9z). The browser measures and the
 * domain decides (§4), so the share of the measure comes in and what the
 * picture *is* comes back.
 *
 * A box wider than an inset may ever be is **across the measure**: an inset
 * is a picture text runs round, and `INSET_SPAN.max` is already the widest
 * one where words still fit beside it — so past it there is no text to cut
 * into, and the drawing tool silently clamping a full-width box to 60% and
 * calling it *cut in at the left* was a picture that could not be what it
 * was drawn as. The number is the band's own; nothing new decides it.
 */
export const drawnFigurePlace = (share: number, side: 'left' | 'right'): FigurePlace =>
  share > INSET_SPAN.max ? 'measure' : side;

/**
 * **Move a picture onto the page an offer describes** (§9w): the act both of
 * the rail's drops run, so dragging a picture onto a page row and dragging it
 * onto a chapter's row cannot put it in two different places.
 *
 * It is `moveFigureBefore` with the one thing the move alone cannot say —
 * which of a division's two openings the writer pointed at — written on the
 * way, and cleared where they pointed at an ordinary page.
 */
export const movePictureTo = (file: ProjectFile, elementId: string, offer: PictureOffer): ProjectFile => {
  /**
   * **The act reads what the picture is** (§9af), so no caller has to choose
   * between the two positions: a page of its own takes the break at the top
   * of the page and anything cut into the text the first paragraph that
   * begins on it. `topElement` says why.
   */
  const element = file.beats
    .flatMap((beat) => beat.manuscript.elements)
    .find((one) => (one.id as string) === elementId);
  const spot = element && figurePlacement(element).place === 'page' ? offer.pageSpot : offer.spot;
  if (!spot || offer.of !== 'story') return file;
  return setBeforeOpening(moveFigureBefore(file, elementId, spot), elementId, offer.beforeOpening);
};

/**
 * **The leaf behind a page that asked to leave its back empty** (§9i), in one
 * place (§9w). It was written out where the manuscript's own elements are
 * emitted and **not** on the hoist path, so a picture standing in front of a
 * chapter's opening lost its back leaf — invisibly, because a picture on a
 * recto followed by a chapter on a recto leaves the verso between them empty
 * anyway. What was wrong was not the book but what the page then said about
 * itself: the cutter's reason, for a leaf the writer had asked for.
 */
const backLeaf = (id: string, chapterTitle: string): BookBlock =>
  block({
    id: `${id}:back`,
    kind: 'blank',
    numbering: 'arabic',
    starts: 'page',
    display: true,
    folio: false,
    unbreakable: true,
    chapterTitle,
    blankBack: true,
  });

const elementBlock = (element: ManuscriptElement, chapterTitle: string, opensChapter: boolean): BookBlock | null => {
  const id = element.id as string;
  const set = setting(element);
  switch (element.type) {
    case 'paragraph':
      return block({ id, kind: 'paragraph', numbering: 'arabic', text: element.text, spans: parseInline(element.text), chapterTitle, opensChapter, ...set });
    case 'heading':
      return block({ id, kind: 'heading', numbering: 'arabic', text: element.text, spans: parseInline(element.text), chapterTitle, keepWithNext: true, unbreakable: true, ...set });
    case 'blockquote':
      return block({ id, kind: 'blockquote', numbering: 'arabic', text: element.text, spans: parseInline(element.text), chapterTitle, ...set });
    case 'scene_break':
      return block({ id, kind: 'scene_break', numbering: 'arabic', chapterTitle, unbreakable: true, keepWithNext: true });
    case 'figure': {
      // An illustrated page inside the story (§8a): a page of its own, on
      // the side the writer asked for, with no running head over it.
      const placed = figurePlacement(element);
      const page = placed.place === 'page';
      // **The back of a leaf is the other side of that sheet** (§9j, from
      // Ken: *when you insert a picture on the left-hand page, leaving a
      // blank page just makes the next page blank — it's not the back of the
      // page*). He is right, and it is why a picture asked to leave its back
      // blank takes a **recto**: a recto's back is the verso after it, so the
      // blank that follows really is behind the picture. On a verso the page
      // after is the front of the *next* leaf, which shows through nothing.
      const leafToItself = page && backBlank(element);
      return block({
        id,
        kind: 'figure',
        numbering: 'arabic',
        chapterTitle,
        unbreakable: true,
        display: page,
        folio: !page,
        starts: !page
          ? 'none'
          : leafToItself
            ? 'recto'
            : placed.side === 'verso'
              ? 'verso'
              : placed.side === 'recto'
                ? 'recto'
                : 'page',
        assetId: typeof element.attributes.assetId === 'string' ? element.attributes.assetId : null,
        caption: element.text,
        decorative: element.attributes.decorative === true,
        ...(placed.boxHeight > 0 ? { boxHeight: placed.boxHeight } : {}),
      });
    }
    default:
      // A script's elements have no place in a book; a prose project has none.
      return null;
  }
};

/**
 * The whole book as blocks (§5): the front matter, then the story with its
 * chapter openings and any plate anchored before one, then the back matter.
 * Numbering is roman across the front and arabic from the first page of the
 * story, continuing through the back.
 */
export const bookBlocks = (file: ProjectFile): BookBlock[] => {
  const settings = bookSettingsOf(file);
  const parts = partsOf(file);
  const bookTitle = bookNames(file).title;
  // What a prose part starts as: the book's chapter opening for its heading
  // and the book's body for its words (§7a), so nothing drawn before the
  // control existed moves.
  const prose = proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), settings.size);
  const out: BookBlock[] = [];

  for (const part of frontParts(parts)) out.push(...partBlocks(part, 'roman', bookTitle, prose, file, parts));

  const platesBefore = new Map<string, BookPart[]>();
  for (const part of parts) {
    if (part.kind !== 'plate' || !part.beforeMarkerId) continue;
    const list = platesBefore.get(part.beforeMarkerId) ?? [];
    list.push(part);
    platesBefore.set(part.beforeMarkerId, list);
  }

  const divisions = new Map<string, PlacedMarker>(
    contentsDivisions(file).map((placed) => [placed.marker.unitId as string, placed]),
  );
  let chapterTitle = bookTitle;
  let opensChapter = false;
  /** On a collection a story's sections are its chapters (addendum 22 §6). */
  const chapters = isCollection(file.project.format);
  let pending: BookBlock | null = null;
  /** Free graphics waiting for the next block to ride (§8c). */
  const floating: FigureFree[] = [];
  const elementById = new Map<string, ManuscriptElement>(
    file.beats.flatMap((beat) => beat.manuscript.elements.map((element) => [element.id as string, element] as const)),
  );
  for (const unit of unitsInStoryOrder(file)) {
    if (!unit.inScript) continue;
    const placed = divisions.get(unit.id as string);
    /**
     * **A picture that is a page of its own, standing at the head of a
     * chapter, comes before the chapter opens** (§9p, from Ken: *I went to add
     * a picture on a page that had chapter two on it, but it didn't shift the
     * chapter page to the next page and then put the picture on the wrong page
     * and started chapter two with the format all messed up*).
     *
     * The room's rule is that a picture goes in **before the element the page
     * opens with** (§9a), and on a chapter's opening page that element is the
     * chapter's first paragraph — so the figure landed *between* the opening
     * and the words. The numeral was left alone on its page, the picture took
     * the next one and the chapter's text began on the one after, which is
     * three pages doing the work of two and none of them what was asked for.
     *
     * The opening is emitted by the **unit** rather than by an element, so
     * *before it* cannot be said with a `beforeElementId` at all. Saying it
     * here instead is one branch and needs nothing stored: a page-figure at
     * the head of the unit is emitted first, and the chapter opens after it.
     * The figure keeps the chapter it is in, which is where §9l's rail puts
     * it and where a writer would look for it.
     */
    const leading: ManuscriptElement[] = [];
    if (placed) {
      const run: ManuscriptElement[] = [];
      let next: ManuscriptElement | null = null;
      walk: for (const beat of beatsInScript(file, unit.id)) {
        for (const element of beat.manuscript.elements) {
          if (element.type === 'figure' && element.attributes?.bookPlace === 'page') run.push(element);
          else {
            next = element;
            break walk;
          }
        }
      }
      /**
       * **Only where nothing else would stand between the picture and the
       * opening** (§9t, from Ken: *I go to add a picture on that page, which
       * should shift that Roman numeral to the following page. But instead it
       * adds the picture on the opposite of the chapter page*).
       *
       * The hoist above is right for a chapter whose opening and whose first
       * words share a page: there is nowhere else for a picture to be, so it
       * goes in front. It is wrong where the unit carries **a division heading
       * of its own** — a story's first section opens twice, once with the
       * story's page and again with its numeral (addendum 22 §6) — because
       * then the picture asked for on the numeral's page has a real place
       * between the two, which is exactly where the writing already puts it.
       * Hoisting took the only expression of *before the opening* and used it
       * for both, so a picture asked for on page four landed facing page two.
       *
       * The unit's own heading is a heading element, or the title §9l stands
       * in where the manuscript carries none — his book being the second.
       */
      const opensTwice = chapters && (next?.type === 'heading' || unit.title.trim().length > 0);
      /**
       * **Where it opens twice, the figure says which opening it stands in
       * front of** (§9w). §9t's guard is right about the numeral's page and
       * was silently wrong about the story's own: a picture asked for *there*
       * also landed between the two, because *before the heading* is the only
       * thing a `beforeElementId` can say and both openings are before it.
       * Which of them the writer meant is not derivable from the manuscript —
       * they said it by pointing at a page — so `bookBeforeOpening` carries
       * it, and nothing written before this carries it, which is why no
       * existing book moves.
       */
      leading.push(...(opensTwice ? run.filter((element) => element.attributes?.bookBeforeOpening === true) : run));
    }
    const beforeOpening = new Set(leading.map((element) => element.id as string));
    if (placed) {
      if (pending) {
        out.push(pending);
        pending = null;
      }
      for (const plate of platesBefore.get(placed.marker.id as string) ?? []) {
        out.push(...partBlocks(plate, 'arabic', chapterTitle));
      }
      // The running head is still the chapter before's, which is what these
      // leaves stand after — and a picture that fills the page prints none
      // anyway, so it is the honest answer rather than a consequential one.
      for (const element of leading) {
        const made = elementBlock(element, chapterTitle, false);
        if (!made) continue;
        out.push(made);
        // The leaf behind it goes with it (§9w): the main element loop has
        // always emitted one and this path did not, so the writer's own
        // answer was lost on exactly the pictures §9w lets them ask for.
        if (backBlank(element)) out.push(backLeaf(element.id as string, chapterTitle));
      }
      /**
       * **A blank leaf before the chapter opens** (§9r). It is the chapter's
       * rather than the manuscript's for §9p's reason: hung on the chapter's
       * first *element* it lands between the numeral and the words and splits
       * the chapter in two, which is the very fault §9p fixed for pictures.
       */
      const own = chapterPageSchema.parse(placed.marker.page ?? {});
      /**
       * **As many as the writer asked for** (§9ac), each one a **sheet** and
       * not a side (§9ad).
       */
      out.push(
        ...blankPages(pagesBefore(own.blankBefore), (suffix) =>
          block({
            id: `${placed.marker.id as string}:${suffix}`,
            kind: 'blank',
            numbering: 'arabic',
            starts: 'page',
            display: true,
            folio: false,
            unbreakable: true,
            chapterTitle,
            blankFor: placed.marker.id as string,
          }),
        ),
      );
      const leaf = chapterLeafContent(file, placed);
      chapterTitle = leaf.title.trim() || leaf.label;
      const onLeaf = opensOnLeaf(leaf);
      out.push(
        block({
          id: placed.marker.id as string,
          kind: 'chapter_opening',
          numbering: 'arabic',
          /**
           * The chapter's own answer where it has one (§9x), the book's
           * otherwise — null-means-the-book's, so nothing existing moves.
           *
           * §9ac stood this rule down wherever a writer had put a leaf in
           * front, so that one leaf could be one page. **§9ad takes that
           * back**: a leaf is a sheet and two pages cannot change which side
           * anything is on, so the chapter opens exactly where it always did
           * and the writer's sheets go in front of it.
           */
          starts: (own.opensRecto ?? settings.chaptersOpenRecto) ? 'recto' : 'page',
          display: onLeaf,
          folio: settings.folioOnOpening,
          keepWithNext: !onLeaf,
          unbreakable: true,
          chapter: leaf,
          leaf: onLeaf,
          chapterTitle,
        }),
      );
      /**
       * **A blank on the chapter page's back** (§9r, Ken's own words): the
       * leaf right behind the page the chapter opens on.
       *
       * It is emitted whenever it is asked for, because it is an explicit
       * ask; **where it is offered** is the room's question, and the room
       * offers it where the opening stands alone on its page (`opensAlone`)
       * — on a page that carries the chapter's first words as well there is
       * no back to leave, the next page being the middle of the chapter.
       */
      if (own.backBlank) {
        out.push(backLeaf(placed.marker.id as string, chapterTitle));
      }
      opensChapter = true;
    }
    // A chapter inside a story (addendum 22 §6, from Ken: *divide short
    // stories into chapters at the Roman numerals*). In a collection the
    // chapter-kind marker is the **story**, so a division inside one is its
    // section — and what makes that section read as a chapter is not a
    // second record but where it falls: a heading that opens a section
    // starts a new page, the way a chapter opening does. The running head
    // stays the story's, because a reader turning the page wants to know
    // which story they are in and not which numeral.
    // Every section of a story opens, **the first included** (§9j, from Ken).
    // It used to be `chapters && !placed`, which read *the story's opening is
    // this section's opening* — but they are two pages: the story's carries
    // its title, the section's carries its numeral, and skipping the second
    // left chapter one as the only chapter in the book that did not open.
    let atSectionHead = chapters;
    /**
     * What this section would print as its heading if the manuscript carries
     * none (§9l). Empty on every other format, and on a section the writer
     * left unnamed — there is nothing to print then, and nothing is invented.
     */
    const sectionHeading = chapters ? unit.title.trim() : '';
    // The first block of the unit carries it, whatever that block turns out
    // to be: a section with a heading and one without both need a page the
    // rail can find, and the heading is not guaranteed.
    let atUnitHead = true;
    for (const beat of beatsInScript(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        // Already drawn, before the chapter opened (§9p).
        if (beforeOpening.has(element.id as string)) continue;
        if (element.text.trim().length === 0 && element.type !== 'scene_break' && element.type !== 'figure') continue;
        const made = elementBlock(element, chapterTitle, opensChapter && element.type === 'paragraph');
        if (!made) continue;
        // A blank page the writer put in (§9i, from Ken: *insert a blank page
        // … and it will slide what was on that page to the next page*). It is
        // an attribute on the element the page opens with, so it moves with
        // the writing and nothing about pages is stored; the sliding is the
        // whole mechanism, there being nothing else to do.
        const leaves = blanksBefore(element);
        if (leaves > 0) {
          if (pending) {
            out.push(pending);
            pending = null;
          }
          // **As many as the writer asked for** (§9ac), each one a **sheet**
          // and not a side (§9ad).
          out.push(
            ...blankPages(leaves, (suffix) =>
              block({
                id: `${element.id as string}:${suffix}`,
                kind: 'blank',
                numbering: 'arabic',
                starts: 'page',
                display: true,
                folio: false,
                unbreakable: true,
                chapterTitle,
                blankFor: element.id as string,
              }),
            ),
          );
        }
        if (atUnitHead) {
          atUnitHead = false;
          made.unitId = unit.id as string;
        }
        // **A picture that is a page of its own does not open the section**
        // (§9s): it stands in front of what does, so the head stays pending
        // and the numeral — real heading or §9l's stand-in — is emitted after
        // the picture. That is *open the chapter with a picture*, and it also
        // stops a unit that has a real heading being given a stand-in as well.
        if (atSectionHead && !(made.kind === 'figure' && figurePlacement(element).place === 'page')) {
          atSectionHead = false;
          if (made.kind === 'heading') {
            // A new page, never a forced recto: the **story** opens on a
            // right-hand page where the book says so, but a chapter inside
            // one that did the same would leave a blank verso between every
            // numeral, which in a ten-page story is most of the paper.
            made.starts = 'page';
            made.keepWithNext = true;
            opensChapter = true;
          } else if (sectionHeading.length > 0) {
            // **A chapter's heading is its own title where the manuscript has
            // none** (§9l, from Ken: *how that page is formatted, it should be
            // the same for the first chapter*).
            //
            // §9j taught the importer to keep a bare numeral, but a book
            // imported before that fix has a first section with no heading
            // element at all — and the rule above can only act on one. So the
            // *unit's* title stands in, which is the same words the rail shows
            // and the contents page lists: one chapter in the book opening
            // differently from every other is a fault whichever way it was
            // arrived at, and repairing the manuscript to fix a page is the
            // one thing this room may never do.
            const stand = block({
              id: `${unit.id as string}:head`,
              kind: 'heading',
              numbering: 'arabic',
              starts: 'page',
              keepWithNext: true,
              unbreakable: true,
              text: sectionHeading,
              spans: parseInline(sectionHeading),
              chapterTitle,
              unitId: unit.id as string,
              standsIn: true,
            });
            out.push(stand);
            atUnitHead = false;
            opensChapter = true;
          }
        }
        // A figure cut into the text (§8) waits for the paragraph it cuts
        // into, and rides in that block: the renderer measures the wrapped
        // paragraph with the float in place, so the cutter needs no rule
        // for it. With nothing to cut into, it stands across the measure.
        if (made.kind === 'figure') {
          const placement = figurePlacement(element);
          // The leaf behind a picture page, where the writer asked for one
          // (§9i). It follows the picture rather than preceding it, which is
          // what *back page* means, and it counts in the numbering and prints
          // nothing — the same two facts as the picture itself.
          if (placement.place === 'page' && backBlank(element)) {
            out.push(made);
            out.push(backLeaf(element.id as string, chapterTitle));
            continue;
          }
          // A page stands where it is; only an inset waits for a paragraph
          // to cut into.
          if (placement.place === 'left' || placement.place === 'right') {
            if (pending) out.push(pending);
            pending = made;
            continue;
          }
          // A free graphic (§8c) waits for a paragraph too, but rides it
          // without taking a line — it is set over the page rather than in
          // the text — so several may wait at once and none of them ever
          // becomes a block of its own.
          if (placement.place === 'free') {
            floating.push({
              figureId: element.id as string,
              assetId: made.assetId ?? null,
              x: placement.x,
              y: placement.y,
              span: placement.span,
              decorative: made.decorative === true,
              caption: made.caption ?? '',
            });
            continue;
          }
        }
        if (pending) {
          if (made.kind === 'paragraph') {
            const placement = figurePlacement(elementById.get(pending.id) as ManuscriptElement);
            made.inset = {
              place: placement.place as 'left' | 'right',
              span: placement.span,
              side: placement.side,
              standoff: placement.standoff,
              figureId: pending.id,
              assetId: pending.assetId ?? null,
              caption: pending.caption ?? '',
              decorative: pending.decorative === true,
              boxHeight: placement.boxHeight,
            };
            made.unbreakable = true;
          } else {
            out.push(pending);
          }
          pending = null;
        }
        // Whatever is waiting rides the next block that lands on a page,
        // whether that is a paragraph or a heading — a free graphic asks
        // nothing of what it sits over.
        if (floating.length > 0) {
          made.free = [...floating];
          floating.length = 0;
        }
        if (made.kind === 'paragraph') opensChapter = false;
        out.push(made);
      }
    }
  }
  if (pending) out.push(pending);

  for (const part of backParts(parts)) out.push(...partBlocks(part, 'arabic', bookTitle, prose, file, parts));
  return out;
};

/**
 * Bring a picture page into the story, at a page (§9i, from Ken: *when I
 * insert a picture it goes to the bottom, but it doesn't allow me to drag it
 * up and place it… I can drag it in between the pages, and it will change the
 * numbering of the pages*).
 *
 * An **art page is a part** — front matter, back matter, or facing a chapter —
 * and a part has nowhere to stand between page six and page seven of chapter
 * three. A **figure a page of its own** (§8a) does: it stands where it is in
 * the writing, which is what a place among the pages means. So dropping a
 * picture page on a page is a conversion rather than a move, and this is it:
 * the part goes, and its picture becomes a figure standing before the element
 * that page opens with.
 *
 * Nothing is stored about pages either way. The picture lands where it lands
 * because of what it stands in front of, so the numbering follows by itself —
 * which is Ken's *the illustration will be page seven and the story picks up
 * at eight*, and is what `layPages` has always done with a page that carries
 * no folio: it **counts** and prints nothing.
 */
export const plateIntoStory = (
  file: ProjectFile,
  partId: string,
  beforeElementId: string,
): { file: ProjectFile; elementId: string | null } => {
  const part = partsOf(file).find((one) => one.id === partId);
  if (!part || part.kind !== 'plate') return { file, elementId: null };
  const beat = file.beats.find((one) => one.manuscript.elements.some((element) => (element.id as string) === beforeElementId));
  if (!beat) return { file, elementId: null };
  const made = placeFigure(file, {
    beatId: beat.id,
    assetId: (part.assetId ?? null) as never,
    beforeElementId: beforeElementId as never,
    caption: part.title.trim(),
    attributes: { bookPlace: 'page' },
  });
  if (!made.elementId) return { file, elementId: null };
  return { file: removePart(made.file, partId), elementId: made.elementId as string };
};
