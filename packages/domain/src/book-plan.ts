import { PART_KINDS, bookPartSchema, type BookPart, type PartKind } from './entities/book.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import { parseInline, type InlineSpan } from './entities/inline.js';
import { chapterLeafContent } from './chapter-style.js';
import { contentsDivisions, type ChapterPageContent, type PlacedMarker } from './markers.js';
import { bookSettingsOf, setBookSettings } from './book-layout.js';
import { beatsInScript, unitsInStoryOrder } from './selectors.js';
import { newId } from './ids.js';
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
  plate: info('plate', 'Plate', 'plate', 'either', false, 'a full-page picture, before a chapter'),
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

/** Which half a part stands in. A plate before a chapter is in the story. */
export const halfOf = (part: BookPart): 'front' | 'body' | 'back' => {
  const half = PART_INFO[part.kind].half;
  if (half !== 'either') return half;
  return part.beforeMarkerId ? 'body' : 'back';
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

/** Whether a kind can still be added: once-only kinds the book already has cannot. */
export const mayAdd = (file: ProjectFile, kind: PartKind): boolean =>
  !PART_INFO[kind].once || !partsOf(file).some((part) => part.kind === kind);

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
  /** The first paragraph after a chapter opening, which the style may set differently. */
  opensChapter?: boolean;
  /** The part this block belongs to, where it belongs to one. */
  partId?: string;
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
    case 'half_title':
      return [block({ id: part.id, kind: 'half_title', numbering, starts: 'recto', display: true, folio: false, partId: part.id, unbreakable: true })];
    case 'title_page':
      return [block({ id: part.id, kind: 'title_page', numbering, starts: 'recto', display: true, folio: false, partId: part.id, unbreakable: true })];
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
          title: part.kind === 'epigraph' ? '' : '',
          text: part.text,
          spans: parseInline(part.text),
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
      const paragraphs = paragraphsOf(part.text).map((text, index) =>
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
    case 'figure':
      return block({
        id,
        kind: 'figure',
        numbering: 'arabic',
        chapterTitle,
        unbreakable: true,
        assetId: typeof element.attributes.assetId === 'string' ? element.attributes.assetId : null,
        caption: element.text,
      });
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
  const bookTitle = file.project.title;
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
  for (const unit of unitsInStoryOrder(file)) {
    if (!unit.inScript) continue;
    const placed = divisions.get(unit.id as string);
    if (placed) {
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
    for (const beat of beatsInScript(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        if (element.text.trim().length === 0 && element.type !== 'scene_break' && element.type !== 'figure') continue;
        const made = elementBlock(element, chapterTitle, opensChapter && element.type === 'paragraph');
        if (!made) continue;
        if (made.kind === 'paragraph') opensChapter = false;
        out.push(made);
      }
    }
  }

  for (const part of backParts(parts)) out.push(...partBlocks(part, 'arabic', bookTitle));
  return out;
};
