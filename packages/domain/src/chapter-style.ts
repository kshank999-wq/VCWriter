import { z } from 'zod';
import { bookSettingsOf, estimatedPages, faceStackOf, fontOf, geometryOf } from './book-layout.js';
import { projectStats } from './selectors.js';
import type { BookFont } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { nowIso } from './entities/common.js';
import { chapterTemplateSchema, type ChapterTemplate, type StoryMarker } from './entities/structure.js';
import {
  chapterPageContent,
  contentsDivisions,
  hasChapterPages,
  placedMarkers,
  type ChapterPageContent,
  type ChapterPlacement,
  type PlacedMarker,
} from './markers.js';
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
 * The faces offered (§7a, from Ken: *the chapter openings need the same style
 * options*).
 *
 * There were three — *manuscript*, *serif*, *sans* — and a chapter opening
 * could not be set in the book's own face by name, nor in two of the faces the
 * book itself offers. Worse, `manuscript` **secretly meant the book's face**
 * inside a book: the print stack overrode `--chapter-face` after the fact, so
 * the word on the screen and the type on the page said different things. The
 * running heads had already got this right with an explicit `book`, so this is
 * that list: the book's own face, the five it offers, and `manuscript` for the
 * Courier a script's chapter leaf actually wants.
 *
 * `serif` is kept out of the offered list and still parses, being stored in
 * projects made before this — history rather than a second answer. It resolves
 * to old-style, which is the stack it always drew.
 */
export const TYPE_FACES = [
  'book',
  'old_style',
  'transitional',
  'modern',
  'sans',
  'garamond',
  'baskerville',
  'georgia',
  'caslon',
  'gill_sans',
  'lato',
  'manuscript',
] as const;
/** What a stored value may be: the list above, plus the name `serif` used to have. */
export const typeFaceSchema = z.enum([...TYPE_FACES, 'serif'] as const);
export type TypeFace = z.infer<typeof typeFaceSchema>;

const FACE_STACKS: Record<TypeFace, string> = {
  // `book` is resolved against the book's own face before this is read; the
  // manuscript's is what is left where there is no book, which is right —
  // a script's chapter leaf is Courier like the rest of it.
  book: "'Courier New', Courier, ui-monospace, monospace",
  manuscript: "'Courier New', Courier, ui-monospace, monospace",
  old_style: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  transitional: "Baskerville, 'Libre Baskerville', 'Times New Roman', Times, serif",
  modern: "Didot, 'Bodoni MT', 'Bodoni 72', Georgia, serif",
  sans: "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif",
  // The six by name (§6a). The same stacks the body offers, because a heading
  // set in *Garamond* and a page set in *Garamond* have to be the same font.
  garamond: "Garamond, 'EB Garamond', 'Adobe Garamond Pro', 'Cormorant Garamond', 'Apple Garamond', Georgia, serif",
  baskerville: "Baskerville, 'Libre Baskerville', 'Baskerville Old Face', 'Times New Roman', Times, serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  caslon: "'Adobe Caslon Pro', 'Libre Caslon Text', 'Big Caslon', 'Caslon', Georgia, serif",
  gill_sans: "'Gill Sans', 'Gill Sans MT', 'Gill Sans Nova', Calibri, 'Trebuchet MS', ui-sans-serif, sans-serif",
  lato: "Lato, 'Lato Regular', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif",
  // Stored before the list widened; the stack it always drew.
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
};

/** One line of type on the page: how big, how cased, how weighted. */
export const lineStyleSchema = z.object({
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
  // `manuscript` rather than `book` so a project made before the list widened
  // draws as it did: inside a book the print already swapped it for the body
  // face, and outside one it is the Courier a script wants.
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
  /**
   * How far down a chapter opening sits where it opens **above its first
   * paragraph** rather than on a leaf of its own, in lines of the body (§7a).
   *
   * This was `calc(var(--bk-lead) * 8)` in the print stylesheet, and the
   * screen said so out loud — *a chapter that opens above its first paragraph
   * keeps the book's own opening depth* — which is an admission rather than a
   * setting. Lines rather than inches, because what it has to look right
   * against is the text under it, and that is measured in lines. Eight is
   * what it always drew.
   */
  openingLines: z.number().min(0).max(24).default(8),
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
/**
 * One line's style as CSS custom properties under a caller's prefix — the
 * one place that decides what a `LineStyle` means, wherever it is set.
 *
 * The chapter page, the front matter's pages and the running heads all set a
 * line, so all three ask this; a private copy per module is a second answer
 * waiting to drift the next time a field is added.
 */
export const lineStyleVars = (prefix: string, one: LineStyle): Record<string, string> => ({
  [`${prefix}-size`]: `${one.size}pt`,
  [`${prefix}-case`]: one.case === 'capitals' ? 'uppercase' : 'none',
  // Small caps is a font variant rather than a transform, so it is its own
  // property: the two do different things and setting both would shout.
  [`${prefix}-variant`]: one.case === 'small_caps' ? 'small-caps' : 'normal',
  [`${prefix}-weight`]: one.bold ? '700' : '400',
  [`${prefix}-style`]: one.italic ? 'italic' : 'normal',
  [`${prefix}-tracking`]: `${one.tracking / 100}em`,
});

/**
 * `bookFace` is the stack the book's own body is set in, where the caller is
 * a book — what `book` as the face resolves to (§7a). The print used to patch
 * this on afterwards, which made the word on the screen and the type on the
 * page disagree; now the one function knows, and a manuscript print that
 * passes nothing gets Courier, which is what a script's leaf wants.
 */
export const chapterStyleVars = (
  style: ChapterPageStyle,
  bookFace?: string,
  fonts: readonly BookFont[] = [],
): Record<string, string> => {
  const line = (name: string, one: LineStyle): Record<string, string> => lineStyleVars(`--chapter-${name}`, one);
  return {
    // `manuscript` is the older spelling of the same intent and is stored in
    // projects made before `book` existed, so both resolve to the body face
    // where there is a book — an existing chapter page draws exactly as it did.
    // An imported font (§6b) is resolved by the one resolver; everything else
    // is this module's own table, which holds the manuscript's Courier that
    // the book's list has no word for.
    '--chapter-face':
      (style.face === 'book' || style.face === 'manuscript') && bookFace
        ? bookFace
        : (fontOf(style.face, fonts) ? faceStackOf(style.face, fonts) : FACE_STACKS[style.face as TypeFace]) ??
          FACE_STACKS.old_style,
    '--chapter-drop': `${style.dropInches}in`,
    /** A chapter opening above its first paragraph, in lines of the body. */
    '--chapter-opening-lines': `${style.openingLines}`,
    '--chapter-rule': style.rule ? '1px solid currentColor' : 'none',
    // The reading face, whatever the heading wears (addendum 19 §7) — which in
    // a book is the book's own body face and in a manuscript is Courier. It
    // was Courier either way, so the dialog's preview drew a typeset book's
    // summary in a typewriter face the printed book never uses (§9g).
    '--chapter-summary-face': bookFace ?? FACE_STACKS.manuscript,
    ...line('number', style.number),
    ...line('title', style.title),
    ...line('epigraph', style.epigraph),
    ...line('summary', style.summary),
  };
};

/**
 * The sheet a chapter page is **judged on** (addendum 20 §9g): the book's page.
 *
 * The dialog's preview was a letter-size sheet in Courier with fixed margins,
 * and the comment over it said *the shape it will print* — true when it was
 * written and false the day the Layout room existed. So a writer set *how far
 * down the page* to 2½ in and judged it against eleven inches of paper while
 * the book printed eight and a half, in a face the preview never showed. The
 * drop was the worst of it: 2½ in is 23% of a letter page and 29% of a digest
 * one, so the preview drew the heading higher than the book prints it.
 *
 * The **drop as a share** lives here rather than in `chapterStyleVars`,
 * because how tall the sheet is, is the sheet's business and not the style's —
 * that is where the hard-coded eleven inches had been hiding. The margins are
 * read at the estimated page count, which the room's own first pass uses: the
 * only margin a count reaches is the inside one, and an eighth of an inch of
 * gutter on a sheet drawn 280 pixels wide is under half a pixel.
 */
export const chapterSheetVars = (file: ProjectFile, style: ChapterPageStyle): Record<string, string> => {
  const settings = bookSettingsOf(file);
  const geometry = geometryOf(
    settings,
    file.project.format,
    estimatedPages(projectStats(file).wordCount, contentsDivisions(file).length),
  );
  const { trim, margins } = geometry;
  /**
   * An inch of the page, as a percentage.
   *
   * Over the trim's **width** whichever edge it is on, because a percentage
   * padding in CSS resolves against the containing block's width even at the
   * top — the trap the old sheet fell into, dividing its drop by eleven inches
   * of height and landing at three quarters of where it meant to.
   */
  const share = (inches: number) => `${((inches / trim.width) * 100).toFixed(2)}%`;
  return {
    '--leaf-ratio': `${trim.width} / ${trim.height}`,
    '--leaf-top': share(margins.top),
    // A chapter opens on a recto, so the gutter is on the left of the sheet.
    '--leaf-left': share(margins.inside),
    '--leaf-right': share(margins.outside),
    '--leaf-face': faceStackOf(settings.face, settings.fonts),
    /**
     * The drop, for a sheet drawn smaller than paper — CSS cannot divide a
     * length by a length, and a block dropped a literal 2½ in would fall off
     * a 285-pixel page.
     *
     * Measured from the **top margin** and over the **text block's** width,
     * because that is the box the block's padding resolves against; the drop
     * itself is from the top of the paper, so the margin already spent comes
     * off first. Getting this wrong is invisible — the page still looks like a
     * page, with the heading in the wrong place.
     */
    '--chapter-drop-ratio': `${((Math.max(0, style.dropInches - margins.top) / geometry.text.width) * 100).toFixed(2)}%`,
  };
};

/** The face the book sets its body in, for a preview that must not lie about the type. */
export const bookFaceOf = (file: ProjectFile): string => {
  const settings = bookSettingsOf(file);
  return faceStackOf(settings.face, settings.fonts);
};

// ------------------------------------------------ the page for a book (§7)

/** What each template is called, and what it does, for the tiles. */
export const CHAPTER_TEMPLATE_WORDS: Record<ChapterTemplate, { name: string; says: string }> = {
  graphic_top: { name: 'Graphic at the top', says: 'The picture first, then the heading and the summary under it.' },
  graphic_middle: { name: 'Graphic in the middle', says: 'The heading, the picture, then the summary.' },
  graphic_bottom: { name: 'Graphic at the bottom', says: 'The heading and the summary, the picture at the foot.' },
  full_page: { name: 'Full-page art', says: 'The picture is the page, edge to edge; the number and the name are drawn into it.' },
};

/**
 * Whether a leaf is its picture and nothing else (the *full_page*
 * template with a picture to fill it). A full-page template with no
 * picture yet draws as the middle one, so choosing the template before
 * importing the art leaves a page that still reads.
 */
export const isFullPageArt = (chapter: Pick<ChapterPageContent, 'template' | 'image'>): boolean =>
  chapter.template === 'full_page' && chapter.image !== null;

/**
 * The template a chapter page draws with: its own where it has said so, the
 * book's otherwise (addendum 19 §7).
 */
export const templateOf = (file: ProjectFile, marker: StoryMarker): ChapterTemplate =>
  // A page that says nothing — `book`, or a page read without the field —
  // follows the book, which is the one answer that cannot be wrong.
  !marker.page.template || marker.page.template === 'book' ? chapterPageStyleOf(file).template : marker.page.template;

/**
 * How one page is **placed** — its rule, its drop and the air over its first
 * paragraph — the page's own where it has said, the book's otherwise
 * (addendum 20 §9c).
 *
 * `templateOf`'s shape, and the one function that resolves it: the print, the
 * preview and the dialog all ask this, so what a writer is shown while
 * dragging a slider is what the book will print.
 */
export const chapterPlacementOf = (file: ProjectFile, marker: StoryMarker): ChapterPlacement => {
  const book = chapterPageStyleOf(file);
  const page = marker.page;
  return {
    rule: page.rule ?? book.rule,
    dropInches: page.dropInches ?? book.dropInches,
    openingLines: page.openingLines ?? book.openingLines,
  };
};

/** Whether this page places itself at all, for the screen to say so. */
export const placesItself = (marker: StoryMarker): boolean =>
  (marker.page.template ?? 'book') !== 'book' ||
  marker.page.rule !== null ||
  marker.page.dropInches !== null ||
  marker.page.openingLines !== null;

/** The book's style with one page's placement written over it. */
export const chapterStyleWith = (style: ChapterPageStyle, placement?: ChapterPlacement): ChapterPageStyle =>
  placement ? { ...style, ...placement } : style;

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
    placement: chapterPlacementOf(file, placed.marker),
    image: asset ? { dataUrl: asset.data, name: asset.altText || asset.name, width: page.graphicWidth } : content.image,
  };
};

/** The same, as an inline `style="…"` for the printed document. */
export const chapterStyleAttr = (
  style: ChapterPageStyle,
  bookFace?: string,
  fonts: readonly BookFont[] = [],
): string =>
  Object.entries(chapterStyleVars(style, bookFace, fonts))
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
