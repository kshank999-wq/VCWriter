import { z } from 'zod';

/**
 * The book (addendum 20): how the manuscript is set as one, and the parts
 * that stand in front of the story and behind it.
 *
 * Stored in `settings.book`, beside the title page and the chapter-page
 * style, because all of it is the book's furniture rather than writing of
 * the story (§2, §5) — and like them it needs no migration: the settings
 * are one JSON column already.
 *
 * **Nearly everything here is a choice, and nothing here is a measurement
 * the program worked out.** The margins, the lines per page, the running
 * heads' words and every page number are readings (§3, §7); the only
 * measurements stored are the trim, which the writer chose, and an override
 * where the writer typed one over a derived value — `null` meaning *worked
 * out*, `minimumSetups`' shape.
 */

/** A trim size, in inches. `0 × 0` means the format's own (§3). */
export const trimSchema = z.object({
  width: z.number().min(0).max(14).default(0),
  height: z.number().min(0).max(20).default(0),
});
export type Trim = z.infer<typeof trimSchema>;

/**
 * The faces offered, named for what they are rather than for a font that
 * may not be installed (§6): each resolves to a stack ending in a generic
 * family, so a book set here prints on a machine that has none of them.
 */
export const BOOK_FACES = ['old_style', 'transitional', 'modern', 'sans'] as const;
export const bookFaceSchema = z.enum(BOOK_FACES);
export type BookFace = z.infer<typeof bookFaceSchema>;

/** What a chapter's first paragraph does (§6). */
export const OPENINGS = ['none', 'small_caps', 'drop_cap'] as const;
export const openingSchema = z.enum(OPENINGS);
export type Opening = z.infer<typeof openingSchema>;

/** What a running head carries on each side (§7). */
export const versoHeadSchema = z.enum(['author', 'title', 'none']);
export const rectoHeadSchema = z.enum(['chapter', 'title', 'none']);
export type VersoHead = z.infer<typeof versoHeadSchema>;
export type RectoHead = z.infer<typeof rectoHeadSchema>;

/** Where the page number sits (§7). */
export const FOLIO_PLACES = ['foot_outside', 'foot_centre', 'head_outside'] as const;
export const folioPlaceSchema = z.enum(FOLIO_PLACES);
export type FolioPlace = z.infer<typeof folioPlaceSchema>;

/** An override of a derived margin: null is *worked out from the trim*. */
const inchesOrDerived = z.number().min(0).max(4).nullable().default(null);

/**
 * The parts of the book that are not the story (§5).
 *
 * Three kinds of part, and the kind says what is stored: a **text** part
 * carries its own words (a dedication, *About the author*); a **reading**
 * part stores only its place, its pages being read from the book every time
 * (the contents, the index, the title page); a **plate** is a picture.
 */
export const PART_KINDS = [
  'half_title',
  'title_page',
  'copyright',
  'dedication',
  'epigraph',
  'contents',
  'foreword',
  'preface',
  'introduction',
  'prologue',
  'epilogue',
  'afterword',
  'acknowledgements',
  'glossary',
  'about_the_author',
  'also_by',
  'index',
  'plate',
] as const;
export const partKindSchema = z.enum(PART_KINDS);
export type PartKind = z.infer<typeof partKindSchema>;

export const bookPartSchema = z.object({
  id: z.string(),
  kind: partKindSchema,
  /** The heading as it prints; empty means the kind's own name. */
  title: z.string().default(''),
  /**
   * The words, for a text part: paragraphs separated by blank lines. Empty
   * on a reading part and a plate, whose pages come from elsewhere.
   */
  text: z.string().default(''),
  /** The picture, for a plate: an id in the graphics library. */
  assetId: z.string().nullable().default(null),
  /** A plate's caption, under the picture. */
  caption: z.string().default(''),
  /**
   * A plate's place: before the chapter with this marker id, so moving the
   * chapter moves the plate (§8). Null means among the back matter.
   */
  beforeMarkerId: z.string().nullable().default(null),
});
export type BookPart = z.infer<typeof bookPartSchema>;

export const bookSettingsSchema = z.object({
  trim: trimSchema.default({}),
  /** Typed over the derived margins, in inches; null is derived (§3). */
  margins: z
    .object({
      inside: inchesOrDerived,
      outside: inchesOrDerived,
      top: inchesOrDerived,
      bottom: inchesOrDerived,
    })
    .default({}),
  face: bookFaceSchema.default('old_style'),
  /** Body size in points. */
  size: z.number().min(8).max(14).default(11),
  /** Leading in points; null is proposed from the size. */
  leading: z.number().min(8).max(30).nullable().default(null),
  justify: z.boolean().default(true),
  hyphenate: z.boolean().default(true),
  opening: openingSchema.default('small_caps'),
  /** The ornament at a scene break; empty is a blank line. */
  ornament: z.string().default(''),
  /** Every chapter opens on a right-hand page, with a blank before it if need be. */
  chaptersOpenRecto: z.boolean().default(true),
  runningHeads: z
    .object({
      verso: versoHeadSchema.default('author'),
      recto: rectoHeadSchema.default('chapter'),
    })
    .default({}),
  folio: folioPlaceSchema.default('foot_outside'),
  /** A chapter opening carries its number at the foot, whatever the folio's place. */
  folioOnOpening: z.boolean().default(true),
  /** The publisher's name, on the title page and the copyright page. */
  imprint: z.string().default(''),
  /** The front and back matter, in order (§5). Absent means the default plan. */
  parts: z.array(bookPartSchema).nullable().default(null),
});
export type BookSettings = z.infer<typeof bookSettingsSchema>;
