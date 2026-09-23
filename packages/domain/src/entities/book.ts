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
/**
 * The faces a book may be set in. `imported` is not a face but a rule: each
 * paragraph is set in whatever face and size the document it was imported
 * from gave it (addendum 21 §3), falling back to old-style where one said
 * nothing.
 */
export const BOOK_FACES = [
  'old_style',
  'transitional',
  'modern',
  'sans',
  // Six faces asked for by name (addendum 20 §6a, from Ken). The four above
  // name a **kind** and these name a **font**, which is the distinction worth
  // keeping: a writer who knows they want Garamond should not have to work out
  // that it is an old-style serif, and one who does not should not have to
  // know what Garamond is.
  'garamond',
  'baskerville',
  'georgia',
  'caslon',
  'gill_sans',
  'lato',
  'imported',
] as const;
export const bookFaceSchema = z.enum(BOOK_FACES);
export type BookFace = z.infer<typeof bookFaceSchema>;

/** What a chapter's first paragraph does (§6). */
export const OPENINGS = ['none', 'small_caps', 'drop_cap'] as const;
export const openingSchema = z.enum(OPENINGS);
export type Opening = z.infer<typeof openingSchema>;

/**
 * What a running head carries (§7a). **One list for both sides**, where
 * there used to be two that differed — the verso could not carry the chapter
 * and the recto could not carry the author, for no reason either side could
 * state. `custom` is the writer's own words, which nothing else could say.
 */
export const HEAD_CONTENTS = ['author', 'title', 'chapter', 'custom', 'none'] as const;
export const headContentSchema = z.enum(HEAD_CONTENTS);
export type HeadContent = z.infer<typeof headContentSchema>;

/** Kept for what already reads them; both are the one list now. */
export const versoHeadSchema = headContentSchema;
export const rectoHeadSchema = headContentSchema;
export type VersoHead = HeadContent;
export type RectoHead = HeadContent;

/** Where a running head sits across the page (§7a). */
export const HEAD_PLACES = ['centre', 'outside', 'inside'] as const;
export const headPlaceSchema = z.enum(HEAD_PLACES);
export type HeadPlace = z.infer<typeof headPlaceSchema>;

/** Where the page number sits (§7). `none` prints no folio at all. */
export const FOLIO_PLACES = ['foot_outside', 'foot_centre', 'head_outside', 'none'] as const;
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

/**
 * A picture cut into a text part's words (addendum 20 §8, from Ken): an
 * inset beside a paragraph of a foreword or an afterword, as against an art
 * page, which is the whole page. It names the paragraph it cuts into by its
 * place in the part's text, so it is the same inset the manuscript's figure
 * makes and the cutter needs no second rule for it.
 */
export const partInsetSchema = z.object({
  id: z.string(),
  /** The picture: an id in the graphics library. */
  assetId: z.string().nullable().default(null),
  /** Which paragraph it cuts into, counted from nought. */
  paragraph: z.number().int().min(0).default(0),
  place: z.enum(['left', 'right']).default('left'),
  /** The fraction of the measure it takes, 0.2 to 0.6. */
  span: z.number().min(0.2).max(0.6).default(0.4),
  /** The white space the text keeps clear around it, in ems of the body size. */
  standoff: z.number().min(0).max(3).default(1),
  caption: z.string().default(''),
});
export type PartInset = z.infer<typeof partInsetSchema>;

export const bookPartSchema = z.object({
  id: z.string(),
  kind: partKindSchema,
  /** Pictures cut into the text, on a text part that has paragraphs. */
  insets: z.array(partInsetSchema).default([]),
  /**
   * How the page is set, on a half title, a title page, a dedication or an
   * epigraph (addendum 20 §9): a patch over the kind's defaults, read by
   * `partStyleOf` in `part-style.ts`. Empty means the kind's own look.
   */
  style: z.record(z.unknown()).default({}),
  /** The heading as it prints; empty means the kind's own name. */
  title: z.string().default(''),
  /**
   * The words, for a text part: paragraphs separated by blank lines. Empty
   * on a reading part and a plate, whose pages come from elsewhere.
   */
  text: z.string().default(''),
  /** The picture, for a plate: an id in the graphics library. */
  assetId: z.string().nullable().default(null),
  /**
   * A plate's description. Nothing prints on the page — the art is the page
   * (§8, from Ken) — but the eBook reads it to a reader who cannot see the
   * picture, and the library shows it.
   */
  caption: z.string().default(''),
  /**
   * A plate's place: before the chapter with this marker id, so moving the
   * chapter moves the plate (§8). Null means among the front matter or the
   * back, which `inFront` decides.
   */
  beforeMarkerId: z.string().nullable().default(null),
  /**
   * A plate with no chapter to face stands in the front matter when this is
   * set, at the back otherwise (§9, from Ken: a title page or an index that
   * is a piece of art has to be able to go where those go).
   */
  inFront: z.boolean().default(false),
});
export type BookPart = z.infer<typeof bookPartSchema>;

/**
 * What the eBook carries that the printed book does not (addendum 23 §4):
 * the metadata a retailer's package wants and the cover. Stored on the
 * project rather than typed at export, so the second export says the same
 * as the first. Empty means *not given*; the exporter falls back to the
 * project's own fields where it can and says where it cannot.
 */
export const ebookSettingsSchema = z.object({
  /** BCP-47: en-US, en-GB, fr. */
  language: z.string().default('en-US'),
  /** The eBook's ISBN, digits and hyphens. Empty means the project's own id names the package. */
  isbn: z.string().default(''),
  /** Empty means the book's imprint. */
  publisher: z.string().default(''),
  /** ISO date, YYYY-MM-DD, or empty. */
  published: z.string().default(''),
  /** Empty means the project's synopsis, then its logline. */
  description: z.string().default(''),
  /** The rights statement: "Copyright © 2026 K. Shank. All rights reserved." */
  rights: z.string().default(''),
  seriesName: z.string().default(''),
  seriesNumber: z.string().default(''),
  /** The cover, from the graphics library. Null is no cover. */
  coverAssetId: z.string().nullable().default(null),
  /** The retailer the last export was made for. */
  target: z.string().default('universal'),
  /**
   * Reflowable, the store's recommendation for a novel, or fixed: every
   * page as the Layout room laid it, for an illustrated book (addendum 23 §10).
   */
  layout: z.enum(['reflowable', 'fixed']).default('reflowable'),
});
export type EbookSettings = z.infer<typeof ebookSettingsSchema>;

export const bookSettingsSchema = z.object({
  /** The eBook's own fields (addendum 23). */
  ebook: ebookSettingsSchema.default({}),
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
      verso: headContentSchema.default('author'),
      recto: headContentSchema.default('chapter'),
      /** The words each side carries where it carries `custom`. */
      versoText: z.string().default(''),
      rectoText: z.string().default(''),
      /** Where the head sits across the page, the folio's place's counterpart. */
      place: headPlaceSchema.default('centre'),
    })
    .default({}),
  folio: folioPlaceSchema.default('foot_outside'),
  /** A chapter opening carries its number at the foot, whatever the folio's place. */
  folioOnOpening: z.boolean().default(true),
  /**
   * How the running heads and the folios are set (§7a). Held loosely here and
   * parsed by `runningHeadStyleOf`, so the schema of a line stays in one
   * module rather than being spelled out a second time in the entity.
   */
  runningHeadStyle: z.unknown().nullable().default(null),
  /** The publisher's name, on the title page and the copyright page. */
  imprint: z.string().default(''),
  /** The front and back matter, in order (§5). Absent means the default plan. */
  parts: z.array(bookPartSchema).nullable().default(null),
});
export type BookSettings = z.infer<typeof bookSettingsSchema>;
