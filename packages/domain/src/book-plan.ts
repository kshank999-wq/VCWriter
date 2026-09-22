import { PART_KINDS, bookPartSchema, partInsetSchema, type BookPart, type PartInset, type PartKind } from './entities/book.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import { parseInline, type InlineSpan } from './entities/inline.js';
import { chapterLeafContent } from './chapter-style.js';
import { contentsDivisions, type ChapterPageContent, type PlacedMarker } from './markers.js';
import { bookNames, bookSettingsOf, setBookSettings } from './book-layout.js';
import { beatsInScript, unitsInStoryOrder } from './selectors.js';
import { newId } from './ids.js';
import { partHasStyle, partStyleOf, type PartStyle } from './part-style.js';
import { isCollection } from './formats.js';
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
  acknowledgements: info('acknowledgements', 'Acknowledgements', 'text', 'back', false, 'who helped'),
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
  | 'plate';

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
  /** How a designed page is set (addendum 20 §9), resolved from the part. */
  partStyle?: PartStyle;
  /**
   * A figure cut into this paragraph at the left or the right (§8), at a
   * fraction of the measure. The figure is the manuscript's; where it sits
   * in the book is read off its element and honoured here alone.
   */
  inset?: FigureInset;
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

const partBlocks = (part: BookPart, numbering: 'roman' | 'arabic', chapterTitle: string): BookBlock[] => {
  const title = partTitle(part);
  switch (part.kind) {
    // Either may be a piece of art brought in whole (§8, from Ken): the
    // asset on the part is the page, and the printer draws it edge to edge
    // in place of the typed title.
    case 'half_title':
      return [block({ id: part.id, kind: 'half_title', numbering, starts: 'recto', display: true, folio: false, partId: part.id, unbreakable: true, assetId: part.assetId, partStyle: partStyleOf(part) })];
    case 'title_page':
      return [block({ id: part.id, kind: 'title_page', numbering, starts: 'recto', display: true, folio: false, partId: part.id, unbreakable: true, assetId: part.assetId, partStyle: partStyleOf(part) })];
    case 'copyright':
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
          text: part.text,
          spans: parseInline(part.text),
        }),
      ];
    case 'contents':
      return [block({ id: part.id, kind: 'contents', numbering, starts: 'recto', partId: part.id, title, chapterTitle: title })];
    case 'index':
      return [block({ id: part.id, kind: 'index', numbering, starts: 'recto', partId: part.id, title, chapterTitle: title })];
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
      const opening = block({
        id: part.id,
        kind: 'part_opening',
        numbering,
        starts: 'recto',
        keepWithNext: true,
        unbreakable: true,
        partId: part.id,
        title,
        chapterTitle: title,
      });
      const words = paragraphsOf(part.text);
      const paragraphs = words.map((text, index) =>
        block({
          id: `${part.id}:${index}`,
          kind: 'paragraph',
          numbering,
          text,
          spans: parseInline(text),
          partId: part.id,
          chapterTitle: title,
          opensChapter: index === 0,
        }),
      );
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
      return [opening, ...paragraphs];
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
export type FigurePlace = 'measure' | 'left' | 'right' | 'page';

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
}

export interface FigureInset extends BookFigurePlacement {
  place: 'left' | 'right';
  /** The figure element's id, for finding it on the page and in the rail. */
  figureId: string;
  assetId: string | null;
  caption: string;
  decorative: boolean;
}

export const INSET_SPAN = { min: 0.2, max: 0.6, default: 0.4 } as const;
export const INSET_STANDOFF = { min: 0, max: 3, default: 1 } as const;

/**
 * A figure's placement, read off its element (§8). The manuscript prints
 * every figure across the measure and never looks at this; only the book
 * does. Absent means across the measure.
 */
export const figurePlacement = (element: ManuscriptElement): BookFigurePlacement => {
  const place = element.attributes.bookPlace;
  const span = element.attributes.bookSpan;
  const side = element.attributes.bookSide;
  const standoff = element.attributes.bookStandoff;
  const chosen: FigurePlace = place === 'left' || place === 'right' || place === 'page' ? place : 'measure';
  const fraction = typeof span === 'number' && Number.isFinite(span) ? Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, span)) : INSET_SPAN.default;
  return {
    place: chosen,
    span: fraction,
    side: side === 'verso' || side === 'recto' ? side : 'either',
    standoff:
      typeof standoff === 'number' && Number.isFinite(standoff)
        ? Math.min(INSET_STANDOFF.max, Math.max(INSET_STANDOFF.min, standoff))
        : INSET_STANDOFF.default,
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
  /** Marked decorative for the eBook (addendum 23 §11). */
  decorative: boolean;
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
          decorative: element.attributes.decorative === true,
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
              const { bookPlace: _place, bookSpan: _span, bookSide: _side, bookStandoff: _off, ...rest } = element.attributes;
              if (placement.place === 'measure') return { ...element, attributes: rest };
              const attributes: Record<string, string | number | boolean> = { ...rest, bookPlace: placement.place };
              if (placement.place === 'page') {
                // A page needs no width and no standoff: it is the page.
                if (placement.side && placement.side !== 'either') attributes.bookSide = placement.side;
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
  return place;
};

/** The block kinds whose id is a manuscript element's. */
const BODY_KINDS = new Set<BlockKind>(['paragraph', 'heading', 'blockquote', 'scene_break', 'figure']);

/**
 * Move a figure so it stands just before another element, wherever in the
 * manuscript that is. This is what re-drawing a picture's box on a different
 * page means: the box is where the picture goes, so drawing it elsewhere
 * moves the picture rather than making a second one.
 */
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
      return block({
        id,
        kind: 'figure',
        numbering: 'arabic',
        chapterTitle,
        unbreakable: true,
        display: page,
        folio: !page,
        starts: page ? (placed.side === 'verso' ? 'verso' : placed.side === 'recto' ? 'recto' : 'page') : 'none',
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
  const out: BookBlock[] = [];

  for (const part of frontParts(parts)) out.push(...partBlocks(part, 'roman', bookTitle));

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
  const elementById = new Map<string, ManuscriptElement>(
    file.beats.flatMap((beat) => beat.manuscript.elements.map((element) => [element.id as string, element] as const)),
  );
  for (const unit of unitsInStoryOrder(file)) {
    if (!unit.inScript) continue;
    const placed = divisions.get(unit.id as string);
    if (placed) {
      if (pending) {
        out.push(pending);
        pending = null;
      }
      for (const plate of platesBefore.get(placed.marker.id as string) ?? []) {
        out.push(...partBlocks(plate, 'arabic', chapterTitle));
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
    let atSectionHead = chapters && !placed;
    for (const beat of beatsInScript(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        if (element.text.trim().length === 0 && element.type !== 'scene_break' && element.type !== 'figure') continue;
        const made = elementBlock(element, chapterTitle, opensChapter && element.type === 'paragraph');
        if (!made) continue;
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
          }
        }
        // A figure cut into the text (§8) waits for the paragraph it cuts
        // into, and rides in that block: the renderer measures the wrapped
        // paragraph with the float in place, so the cutter needs no rule
        // for it. With nothing to cut into, it stands across the measure.
        if (made.kind === 'figure') {
          const placement = figurePlacement(element);
          // A page stands where it is; only an inset waits for a paragraph
          // to cut into.
          if (placement.place === 'left' || placement.place === 'right') {
            if (pending) out.push(pending);
            pending = made;
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
        if (made.kind === 'paragraph') opensChapter = false;
        out.push(made);
      }
    }
  }
  if (pending) out.push(pending);

  for (const part of backParts(parts)) out.push(...partBlocks(part, 'arabic', bookTitle));
  return out;
};
