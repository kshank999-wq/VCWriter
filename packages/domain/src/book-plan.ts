import { PART_KINDS, bookPartSchema, partInsetSchema, type BookPart, type PartInset, type PartKind } from './entities/book.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import { parseInline, type InlineSpan } from './entities/inline.js';
import { chapterLeafContent, chapterPageStyleSchema, type LineStyle } from './chapter-style.js';
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
): { file: ProjectFile; partId: string | null } => {
  const parts = partsOf(file);
  if (PART_INFO[kind].once && parts.some((part) => part.kind === kind)) return { file, partId: null };
  const part = bookPartSchema.parse({ ...input, id: newId() as string, kind });
  const half = halfOf(part);
  if (half === 'front') {
    const last = parts.map((one) => halfOf(one)).lastIndexOf('front');
    const at = last === -1 ? 0 : last + 1;
    return { file: writeParts(file, [...parts.slice(0, at), part, ...parts.slice(at)]), partId: part.id };
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
  if (!part.backBlank || !partTakesBlankBack(part.kind) || own.length === 0) return own;
  const first = own[0] as BookBlock;
  return [
    { ...first, starts: 'recto' },
    ...own.slice(1),
    block({
      id: `${part.id}:back`,
      kind: 'blank',
      numbering,
      starts: 'page',
      display: true,
      folio: false,
      unbreakable: true,
      chapterTitle,
      partId: part.id,
    }),
  ];
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
          starts: 'verso',
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
export const blankBefore = (element: ManuscriptElement): boolean => element.attributes?.bookBlankBefore === true;

/** Put a blank page in before this element, or take it away again. */
export const setBlankBefore = (file: ProjectFile, elementId: string, blank: boolean): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) => ({
    ...beat,
    manuscript: {
      ...beat.manuscript,
      elements: beat.manuscript.elements.map((element) => {
        if ((element.id as string) !== elementId) return element;
        const attributes = { ...element.attributes };
        if (blank) attributes.bookBlankBefore = true;
        else delete attributes.bookBlankBefore;
        return { ...element, attributes };
      }),
    },
  })),
});

/** Ask for that leaf, or stop asking. Only what differs from the default is stored. */
export const setBackBlank = (file: ProjectFile, elementId: string, blank: boolean): ProjectFile => ({
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
                bookX: _x,
                bookY: _y,
                ...rest
              } = element.attributes;
              if (placement.place === 'measure') return { ...element, attributes: rest };
              const attributes: Record<string, string | number | boolean> = { ...rest, bookPlace: placement.place };
              if (placement.place === 'page') {
                // A page needs no width and no standoff: it is the page.
                if (placement.side && placement.side !== 'either') attributes.bookSide = placement.side;
                if (element.attributes.bookBackBlank === true) attributes.bookBackBlank = true;
              } else if (placement.place === 'free') {
                // Where it stands and how wide, and nothing else: a free
                // graphic is out of the text's way, so it has no side to
                // take and no standoff to keep (§8c).
                const held = figurePlacement(element);
                attributes.bookSpan = Math.min(FREE_SPAN.max, Math.max(FREE_SPAN.min, placement.span ?? held.span));
                attributes.bookX = Math.min(1, Math.max(0, placement.x ?? held.x));
                attributes.bookY = Math.min(1, Math.max(0, placement.y ?? held.y));
              } else {
                attributes.bookSpan = Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, placement.span ?? INSET_SPAN.default));
                const standoff = Math.min(INSET_STANDOFF.max, Math.max(INSET_STANDOFF.min, placement.standoff ?? INSET_STANDOFF.default));
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
}

export const pagePlace = (pages: readonly BookPage[], blocks: readonly BookBlock[], sheet: number): PagePlace => {
  const page = pages.find((one) => one.sheet === sheet);
  const index = new Map(blocks.map((block) => [block.id, block]));
  const place: PagePlace = { elementId: null, partId: null, markerId: null };
  if (!page) return place;
  // The chapter in force is read from the last opening at or before the page,
  // so a page in the middle of a chapter still knows which chapter it is in.
  for (const block of blocks) {
    if (block.kind !== 'chapter_opening') continue;
    const at = pages.find((one) => one.pieces.some((piece) => piece.blockId === block.id));
    if (at && at.sheet <= sheet) place.markerId = block.id;
  }
  for (const piece of page.pieces) {
    const block = index.get(piece.blockId);
    if (!block) continue;
    if (block.partId && !place.partId) place.partId = block.partId;
    if (BODY_KINDS.has(block.kind) && !place.elementId) place.elementId = block.id;
  }
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
  if (!place.elementId && !place.partId) {
    const at = page.pieces.findIndex((piece) => index.get(piece.blockId)?.kind === 'chapter_opening');
    if (at !== -1) {
      const from = blocks.findIndex((block) => block.id === page.pieces[at]!.blockId);
      const next = blocks.slice(from + 1).find((block) => BODY_KINDS.has(block.kind));
      if (next) place.elementId = next.id;
    }
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
  blank: boolean;
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
      partId: part?.partId ?? null,
      figureId: art?.id ?? null,
      elementId: on.find((block) => BODY_KINDS.has(block.kind))?.id ?? null,
      blankFor: leaf?.blankFor ?? null,
      blank: empty,
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

export const moveFigureBefore = (file: ProjectFile, elementId: string, beforeElementId: string): ProjectFile => {
  if (elementId === beforeElementId) return file;
  const from = file.beats.find((beat) => beat.manuscript.elements.some((element) => (element.id as string) === elementId));
  const moving = from?.manuscript.elements.find((element) => (element.id as string) === elementId);
  if (!from || !moving) return file;
  const beats = file.beats.map((beat) => {
    const elements = beat.manuscript.elements.filter((element) => (element.id as string) !== elementId);
    const at = elements.findIndex((element) => (element.id as string) === beforeElementId);
    if (at === -1) return beat.id === from.id ? { ...beat, manuscript: { ...beat.manuscript, elements } } : beat;
    return { ...beat, manuscript: { ...beat.manuscript, elements: [...elements.slice(0, at), moving, ...elements.slice(at)] } };
  });
  return { ...file, beats };
};

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
      walk: for (const beat of beatsInScript(file, unit.id)) {
        for (const element of beat.manuscript.elements) {
          if (element.type === 'figure' && element.attributes?.bookPlace === 'page') leading.push(element);
          else break walk;
        }
      }
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
        if (made) out.push(made);
      }
      const leaf = chapterLeafContent(file, placed);
      chapterTitle = leaf.title.trim() || leaf.label;
      const onLeaf = opensOnLeaf(leaf);
      out.push(
        block({
          id: placed.marker.id as string,
          kind: 'chapter_opening',
          numbering: 'arabic',
          starts: settings.chaptersOpenRecto ? 'recto' : 'page',
          display: onLeaf,
          folio: settings.folioOnOpening,
          keepWithNext: !onLeaf,
          unbreakable: true,
          chapter: leaf,
          leaf: onLeaf,
          chapterTitle,
        }),
      );
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
        if (blankBefore(element)) {
          if (pending) {
            out.push(pending);
            pending = null;
          }
          out.push(
            block({
              id: `${element.id as string}:before`,
              kind: 'blank',
              numbering: 'arabic',
              starts: 'page',
              display: true,
              folio: false,
              unbreakable: true,
              chapterTitle,
              blankFor: element.id as string,
            }),
          );
        }
        if (atUnitHead) {
          atUnitHead = false;
          made.unitId = unit.id as string;
        }
        if (atSectionHead) {
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
            out.push(
              block({
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
              }),
            );
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
            out.push(
              block({
                id: `${element.id as string}:back`,
                kind: 'blank',
                numbering: 'arabic',
                starts: 'page',
                display: true,
                folio: false,
                unbreakable: true,
                chapterTitle,
              }),
            );
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
