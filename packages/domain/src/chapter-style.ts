import { z } from 'zod';
import type { ProjectFile } from './project-file.js';
import { nowIso } from './entities/common.js';
import { chapterTemplateSchema, type ChapterTemplate, type StoryMarker } from './entities/structure.js';
import { chapterPageContent, hasChapterPages, placedMarkers, type ChapterPageContent, type PlacedMarker } from './markers.js';
import type { StoryMarkerId } from './ids.js';

/**
 * How a book sets the type on its chapter pages (addendum 02 §12a).
 *
 * **The look belongs to the book; the words belong to the chapter.** This is
 * the same rule the numbering already follows — *a book whose chapters are
 * numbered three different ways is not a book* — and it holds for the same
 * reason. A reader turning to chapter nine and finding its heading in a
 * different face has found a mistake, not a design, so there is deliberately
 * nowhere to style one chapter page on its own.
 *
 * What *is* the chapter's own is everything the chapter page says: its name,
 * its epigraph, its illustration, whether it shows a number at all. Those live
 * on the marker, where they always have.
 *
 * The number itself is neither — it is **worked out** from where the chapter
 * falls in the story order (`placedMarkers`), so there is no field for it here
 * or anywhere else. Move chapter nine and it becomes chapter eight with
 * nothing run, and the page it opens with says so.
 */

/**
 * How the words are cased.
 *
 * `small_caps` is a real typographic setting rather than upper-casing the
 * letters, because a heading whose characters have been changed can no longer
 * be set any other way — and the writer typed *The Drowned Bell*, not *THE
 * DROWNED BELL*.
 */
export const TYPE_CASES = ['as_typed', 'capitals', 'small_caps'] as const;
export const typeCaseSchema = z.enum(TYPE_CASES);
export type TypeCase = z.infer<typeof typeCaseSchema>;

/**
 * The faces offered.
 *
 * Three, named by what they are for rather than by a font that may not be
 * installed: the printing resolves each to a stack ending in a generic family,
 * so a page set here prints on a machine that has none of them.
 */
export const TYPE_FACES = ['manuscript', 'serif', 'sans'] as const;
export const typeFaceSchema = z.enum(TYPE_FACES);
export type TypeFace = z.infer<typeof typeFaceSchema>;

const FACE_STACKS: Record<TypeFace, string> = {
  // What the rest of the manuscript is set in, so a chapter page that says
  // nothing looks like the book it is in.
  manuscript: "'Courier New', Courier, ui-monospace, monospace",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif",
};

/** One line of type on the page: how big, how cased, how weighted. */
const lineStyleSchema = z.object({
  /** In points, because this prints. */
  size: z.number().min(6).max(72).default(12),
  case: typeCaseSchema.default('as_typed'),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  /** Letter-spacing, in hundredths of an em. Books track their heads open. */
  tracking: z.number().min(0).max(50).default(0),
});
export type LineStyle = z.infer<typeof lineStyleSchema>;

export const chapterPageStyleSchema = z.object({
  face: typeFaceSchema.default('manuscript'),
  /** "Chapter Nine" — the derived number, and the noun in front of it. */
  number: lineStyleSchema.default({ size: 12, case: 'capitals', tracking: 20 }),
  /** The chapter's name, where it has one. */
  title: lineStyleSchema.default({ size: 14 }),
  epigraph: lineStyleSchema.default({ size: 11, italic: true }),
  /**
   * The summary's size and weight (addendum 19 §7). Its face is not chosen
   * here: a summary is reading matter, so it is set in the reading face —
   * the manuscript's — whatever display face the heading wears.
   */
  summary: lineStyleSchema.default({ size: 11 }),
  /** A rule under the heading, which is a thing books do and a thing they do not. */
  rule: z.boolean().default(false),
  /**
   * Where every chapter page puts its graphic (addendum 19 §7), unless a
   * chapter says otherwise. *Middle* is what every page made before there was
   * a choice has always drawn — the heading, then the device, then the lines
   * under it — so a book that never chooses looks exactly as it did.
   */
  template: chapterTemplateSchema.default('graphic_middle'),
  /**
   * How far down the page the block sits, in inches. A chapter opening falls
   * about a third of the way down in most books, which is where this starts.
   */
  dropInches: z.number().min(0).max(6).default(2.5),
});
export type ChapterPageStyle = z.infer<typeof chapterPageStyleSchema>;

/** The book's chapter-page style, defaulted for a project made before there was one. */
export const chapterPageStyleOf = (file: ProjectFile): ChapterPageStyle =>
  chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {});

export const setChapterPageStyle = (
  file: ProjectFile,
  patch: Partial<ChapterPageStyle>,
): ProjectFile => ({
  ...file,
  settings: {
    ...file.settings,
    chapterPageStyle: chapterPageStyleSchema.parse({ ...chapterPageStyleOf(file), ...patch }),
  },
  project: { ...file.project, updatedAt: nowIso() },
});

/** Patch one line of the style without restating the other two. */
export const setChapterLineStyle = (
  file: ProjectFile,
  line: 'number' | 'title' | 'epigraph' | 'summary',
  patch: Partial<LineStyle>,
): ProjectFile =>
  setChapterPageStyle(file, { [line]: { ...chapterPageStyleOf(file)[line], ...patch } } as Partial<ChapterPageStyle>);

/**
 * The style as CSS, in custom properties.
 *
 * **One function, read by the preview and by the print alike.** The preview
 * exists to answer *what will this look like*, and a preview that worked the
 * type out its own way would be answering a different question — so the
 * stylesheet on both sides declares nothing but `var(--chapter-…)`, and this
 * is the only place that decides what those mean.
 */
export const chapterStyleVars = (style: ChapterPageStyle): Record<string, string> => {
  const line = (name: string, one: LineStyle): Record<string, string> => ({
    [`--chapter-${name}-size`]: `${one.size}pt`,
    [`--chapter-${name}-case`]: one.case === 'capitals' ? 'uppercase' : 'none',
    // Small caps is a font variant rather than a transform, so it is its own
    // property: the two do different things and setting both would shout.
    [`--chapter-${name}-variant`]: one.case === 'small_caps' ? 'small-caps' : 'normal',
    [`--chapter-${name}-weight`]: one.bold ? '700' : '400',
    [`--chapter-${name}-style`]: one.italic ? 'italic' : 'normal',
    [`--chapter-${name}-tracking`]: `${one.tracking / 100}em`,
  });
  return {
    '--chapter-face': FACE_STACKS[style.face],
    '--chapter-drop': `${style.dropInches}in`,
    // The same drop as a share of the sheet, for a preview drawn smaller than
    // paper: CSS cannot divide a length by a length, and a small sheet whose
    // block dropped a literal two and a half inches would be blank.
    '--chapter-drop-ratio': `${((style.dropInches / 11) * 100).toFixed(2)}%`,
    '--chapter-rule': style.rule ? '1px solid currentColor' : 'none',
    // The reading face, whatever the heading wears (addendum 19 §7).
    '--chapter-summary-face': FACE_STACKS.manuscript,
    ...line('number', style.number),
    ...line('title', style.title),
    ...line('epigraph', style.epigraph),
    ...line('summary', style.summary),
  };
};

// ------------------------------------------------ the page for a book (§7)

/** What each template is called, and what it does, for the tiles. */
export const CHAPTER_TEMPLATE_WORDS: Record<ChapterTemplate, { name: string; says: string }> = {
  graphic_top: { name: 'Graphic at the top', says: 'The picture first, then the heading and the summary under it.' },
  graphic_middle: { name: 'Graphic in the middle', says: 'The heading, the picture, then the summary.' },
  graphic_bottom: { name: 'Graphic at the bottom', says: 'The heading and the summary, the picture at the foot.' },
};

/**
 * The template a chapter page draws with: its own where it has said so, the
 * book's otherwise (addendum 19 §7).
 */
export const templateOf = (file: ProjectFile, marker: StoryMarker): ChapterTemplate =>
  // A page that says nothing — `book`, or a page read without the field —
  // follows the book, which is the one answer that cannot be wrong.
  !marker.page.template || marker.page.template === 'book' ? chapterPageStyleOf(file).template : marker.page.template;

/**
 * The leaf as it will draw, with everything resolved that the marker alone
 * cannot resolve: the template, which may be the book's, and the picture,
 * which on a book comes from the library by id (addendum 19 §7).
 *
 * **One function for the print, the preview and the dialog's sheet**, for
 * the reason `chapterStyleVars` is one: a writer looking at two answers to
 * *what will it look like* has no way to tell which one the book will use.
 * A library picture that has gone draws nothing rather than a broken
 * plate, and the data-URL illustration stands in where no asset is named.
 */
export const chapterLeafContent = (file: ProjectFile, placed: PlacedMarker): ChapterPageContent => {
  const content = chapterPageContent(placed);
  const page = placed.marker.page;
  const asset = page.assetId ? (file.assets ?? []).find((one) => one.id === page.assetId) : undefined;
  return {
    ...content,
    template: templateOf(file, placed.marker),
    image: asset ? { dataUrl: asset.data, name: asset.altText || asset.name, width: page.graphicWidth } : content.image,
  };
};

/** The same, as an inline `style="…"` for the printed document. */
export const chapterStyleAttr = (style: ChapterPageStyle): string =>
  Object.entries(chapterStyleVars(style))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/**
 * Give every chapter a page, or take them all away.
 *
 * The one bulk act this needs. A book has thirty chapters and a writer who has
 * decided it opens each one with a leaf should not have to say so thirty times
 * — and nothing else about the page is touched, so a chapter that already had
 * a name and an epigraph keeps them.
 */
export const chapterPagesEverywhere = (file: ProjectFile, include: boolean): ProjectFile => {
  if (!hasChapterPages(file.project.format)) return file;
  const divisions = new Set(
    placedMarkers(file)
      .filter((placed) => placed.marker.kind !== 'note')
      .map((placed) => placed.marker.id as string),
  );
  const at = nowIso();
  return {
    ...file,
    markers: file.markers.map((marker) =>
      divisions.has(marker.id as string)
        ? { ...marker, page: { ...marker.page, include }, updatedAt: at }
        : marker,
    ),
  };
};

/**
 * The chapters that can have a page, with the number each would show.
 *
 * The list the screen picks from. *Just a note* is left out: it is a labelled
 * point in the story rather than a division of the work, so it takes no number
 * and opens no chapter (`placedMarkers` says the same thing from the other
 * end).
 */
export interface ChapterChoice {
  markerId: StoryMarkerId;
  /** "Chapter Nine" — worked out from where it falls, never typed. */
  label: string;
  title: string;
  hasPage: boolean;
}

export const chapterChoices = (file: ProjectFile): ChapterChoice[] =>
  placedMarkers(file)
    .filter((placed) => placed.marker.kind !== 'note')
    .map((placed) => ({
      markerId: placed.marker.id,
      label: placed.label,
      title: placed.marker.title,
      hasPage: placed.marker.page.include,
    }));
