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

/**
 * **How many blank pages a writer may ask for in one place** (addendum 20
 * §9ac, from Ken: *you should be able to just put as many pages in between as
 * you want*).
 *
 * *As many as you want* is a count rather than a switch, which is what the
 * flag was — one leaf per place, so a writer who wanted a picture page and a
 * blank between two stories could ask for the first of the two and stop. The
 * ceiling is here because both records that carry the count read it, and a
 * number with no top can be typed into a document by anything and lay a
 * thousand pages nobody asked for.
 *
 * **It counts pages rather than leaves** (§9ae, from Ken: *we also need the
 * ability to shift a page to the left or right… it will shift half a page*).
 * §9ad's sheet and this shift are the same stored fact at two granularities —
 * a sheet is two pages and a shift is one — so counting leaves could express
 * only the first, and a second field for the half would be two records of one
 * number, free to disagree the first time either is written. The acts differ
 * and the field does not: a sheet writes two, a shift writes one.
 */
export const MAX_BLANK_PAGES = 24;

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

/**
 * A font the writer brought in themselves (addendum 20 §6b, from Ken: *put
 * an option to import a font … so you can download a font and select it from
 * a browse, and add it to your fonts*).
 *
 * This is §12's open question answered from the other end. Shipping font
 * files with the program is a licensing decision that is not ours to make;
 * a writer who has licensed Sabon can hand it to their own book, and the
 * **file travels in the project** so the same book prints the same on the
 * next machine — which is the whole point, since a stack resolves to
 * whatever happens to be installed.
 */
export const bookFontSchema = z.object({
  id: z.string(),
  /** What it is called in the list. The file's name until the writer says otherwise. */
  family: z.string(),
  /** The file it came from, so a writer can tell two weights apart. */
  fileName: z.string().default(''),
  /** `woff2`, `woff`, `truetype`, `opentype` — what `@font-face` is told. */
  format: z.enum(['woff2', 'woff', 'truetype', 'opentype']).default('truetype'),
  /** The file itself, as a data URL. */
  data: z.string(),
  /** How big it was, so the room can say what the project is carrying. */
  bytes: z.number().min(0).default(0),
  /** Whether it reads as a serif, which is the fallback a missing file gets. */
  serif: z.boolean().default(true),
});
export type BookFont = z.infer<typeof bookFontSchema>;

/** A face is one of the names above, or `font:<id>` for an imported one. */
export const faceValueSchema = z.union([bookFaceSchema, z.string().regex(/^font:/)]);

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

/**
 * **One division's own heads, foot and numbering** (addendum 43 §10, Ken's
 * citations spec §6: *chapter/section-specific and first-page-different
 * layouts… restart per section*). Keyed by the division's record — a chapter's
 * marker, a part, a section's unit — which is what the contents page keys a
 * row by, so it survives the book being laid again.
 *
 * Every override is null where the division takes the book's own.
 */
export const sectionLayoutSchema = z.object({
  id: z.string(),
  /** What the left-hand and right-hand tops say here: words with fields, or null for the book's. */
  verso: z.string().nullable().default(null),
  recto: z.string().nullable().default(null),
  /** The running foot here, or null for the book's. */
  foot: z.string().nullable().default(null),
  /** The opening page carries the heads and the foot too, rather than standing clear of them. */
  headsOnOpening: z.boolean().default(false),
  /** Page numbers start again at 1 (or i) where this division opens. */
  restart: z.boolean().default(false),
  /** Numbered in roman or arabic from here; null follows the book. */
  numbering: z.enum(['roman', 'arabic']).nullable().default(null),
});
export type SectionLayout = z.infer<typeof sectionLayoutSchema>;

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
  // The back matter's own (addendum 20 §17, from Ken's handoff). The other
  // five it asks for were already kinds; these three were not.
  'appendix',
  'bibliography',
  'reader_extra',
  'glossary',
  'about_the_author',
  'also_by',
  'index',
  'plate',
  /**
   * **A page of the book that is nobody else's page** (addendum 20 §19, from
   * Ken: *on blank pages, I want this level of styling to where you can add a
   * graphic at the top, you can add text in it, you can add a graphic at the
   * bottom… you're able to put the text and everything in the dialog box*).
   *
   * It is a part rather than a new idea of what a designed page is, which is
   * what §9aa named as the blocker and what the audit found mostly built: a
   * part already stands in the story (`halfOf` has answered *body* since
   * plates faced chapters), already carries a template, a drop, a rule, an
   * alignment, a face and its own words, and already has a screen of its own.
   * What was new is one kind and one anchor.
   */
  'leaf',
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
   * **Leave the back of this leaf blank** (addendum 20 §17d, from Ken: *on
   * the title page, there needs to be an option to leave the back of the page
   * blank, because it could be a printed page on different paper*).
   *
   * It is the same question §9i answered of a picture in the writing, asked
   * of a part: the page takes a **recto** so the leaf after it really is its
   * back, and a `blank` block follows — counted like every page and printing
   * no folio. On the title page that means the copyright page comes off its
   * reverse and onto the next leaf, which is what a title page printed on
   * heavier or coloured stock needs.
   */
  backBlank: z.boolean().default(false),
  /**
   * **A blank leaf before this page** (addendum 20 §9r, from Ken: *you should
   * be able to enter a blank page wherever you want*).
   *
   * *Wherever* was the whole of the ask and the whole of the gap: the act
   * hung on a manuscript element, so it was offered on a page of the story
   * and **absent on every page of the front and back matter** — a writer
   * could not put a leaf between the title page and the copyright page, or
   * before an appendix, which is where a book most often wants one.
   *
   * **A count of pages, with `true` its older spelling** (§9ac, §9ae): *as
   * many pages in between as you want* is a number, and every page made
   * before this carries a boolean — so `true` reads as one whole sheet (two
   * pages, §9ad), nothing is migrated and no book moves. `pagesBefore` is the
   * one place that resolves it.
   */
  blankBefore: z.union([z.boolean(), z.number().int().min(0).max(MAX_BLANK_PAGES)]).default(false),
  /**
   * A **logotype** in place of the typed title, on a designed page (§9n): an
   * id in the graphics library, like every other picture the book uses.
   *
   * The title page has carried one since long before this, as
   * `settings.titlePage.titleImage` — a data URI written by *File ▸ Title
   * page…*. That is the **older spelling of the same intent** and is still
   * honoured where a part carries none, which is `template`/`layout`'s shape
   * (§14): nothing is migrated, no page moves, and there is one reading
   * (`partLogo`) that says which is in force.
   */
  logoAssetId: z.string().nullable().default(null),
  /**
   * The title page's own fields (addendum 20 §16): a translator or an editor,
   * the publisher's mark, and which of the optional elements the page shows.
   *
   * Held loosely and parsed by `titlePageFieldsOf`, the copyright page's
   * shape — so the schema of what a title page carries stays in its own
   * module rather than being spelled out a second time here. Everything else
   * the page prints is read from somewhere that already held it: the title
   * and the author from the book's names, the subtitle from
   * `settings.titlePage`, the publisher and the edition from the copyright
   * page's record.
   */
  titlePage: z.unknown().nullable().default(null),
  /**
   * A back-matter page's own fields (addendum 20 §17): the sign-off on an
   * acknowledgements page, the photograph and links on *About the author*,
   * the questions on a reader extra. Held loosely and parsed by the reading
   * that wants it, the copyright page's and the title page's shape — so what
   * each page carries stays in its own module rather than being spelled out
   * a second time here.
   */
  about: z.unknown().nullable().default(null),
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
   * **The record this page stands in front of** (addendum 20 §19) — a
   * manuscript element, a chapter page's marker, or another part: whichever
   * of them a blank leaf was hanging on when the writer designed it.
   *
   * `beforeMarkerId` is the **older and narrower spelling** of the same
   * intent, kept because a plate facing a chapter reads it by name and
   * nothing about an existing book may move; `anchorOf` is the one reading
   * that answers for both.
   *
   * A page is not a record, so this names the record rather than a page
   * number: the words move, and the page that stands in front of them moves
   * with them (§9i).
   */
  beforeId: z.string().nullable().default(null),
  /**
   * **Where a picture stands when the page carries words too** (addendum 20
   * §19, from Ken: *you can add a graphic at the top, you can add text in it,
   * you can add a graphic at the bottom*).
   *
   * A logotype has stood **where the title would** since the title page took
   * one, which is above the words — so the default is false and no page
   * already set moves. It means nothing on a page that is all picture or all
   * words, and the control is absent there.
   */
  pictureBelow: z.boolean().default(false),
  /**
   * **How many of the record's own blank leaves stand in front of this page**
   * (addendum 20 §19a, from Ken: *if I add a page after and go on that, it's
   * adding the page on the page before for some reason*).
   *
   * A record may carry several leaves and `beforeId` names only the record,
   * so a page taken from the second of two had no way to say so and was drawn
   * in front of the first. Nought is the first, which is where every page
   * anchored before this existed stands — so nothing moves.
   */
  afterLeaves: z.number().int().min(0).default(0),
  /**
   * A plate with no chapter to face stands in the front matter when this is
   * set, at the back otherwise (§9, from Ken: a title page or an index that
   * is a piece of art has to be able to go where those go).
   */
  inFront: z.boolean().default(false),
  /**
   * The copyright page's own fields (addendum 20 §9k): the notice, the
   * numbers, the publisher, the edition, the disclaimer, the printing and a
   * box for a barcode. Read through `copyright-page.ts`, which is the one
   * place that turns them into the page.
   *
   * **Null until a writer opens the dialog**, and that is load-bearing: while
   * it is null the page prints the free text it always printed, so no book
   * made before this moves a millimetre.
   */
  copyright: z.record(z.unknown()).nullable().default(null),
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
  /**
   * Copyright-page orders the writer has kept (§15b). The same shape as the
   * four the program ships, so everything that reads a preset takes one
   * without being told they exist — a publisher's own order being the case
   * this is for.
   */
  copyrightPresets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        order: z.array(z.string()),
        hidden: z.array(z.string()),
        position: z.enum(['top', 'middle', 'bottom']),
        align: z.enum(['left', 'center', 'right']),
      }),
    )
    .default([]),
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
  face: faceValueSchema.default('old_style'),
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
  /**
   * **A sheet with nothing on either side between one whole work and the
   * next** (addendum 22 §9, from Ken: *between stories, there needs to be a
   * full blank sheet*).
   *
   * It is a **sheet and never a side** (addendum 20 §9ad), so it cannot change
   * which side anything after it is on and every story goes on opening exactly
   * where the recto rule puts it. Read on a collection and a series alone
   * (`holdsWholeWorks`): a chapter is a division *of* a novel and a reader
   * turning from chapter four to chapter five has not finished anything.
   *
   * It defaults **on**, which is the one thing here that moves an existing
   * book — a separation a reader is meant to feel, asked for as a
   * requirement rather than as an option.
   */
  sheetBetweenWorks: z.boolean().default(true),
  /**
   * **And a sheet at the end of the last one** (§9ao, from Ken: *yes, make
   * that end-of-story page automatic*, approving §9an's named item — *there
   * always needs to be an extra page at the end of all the stories between
   * the stories and the back matter*).
   *
   * It is `sheetBetweenWorks`' other end and the same sheet, so it is read on
   * `holdsWholeWorks` alone and defaults **on** for that field's own reason.
   * What it is *not* is a sheet after a particular work: which work is last
   * changes the day another is imported, so this is the book's and there is
   * no per-work override — it separates the story from the back matter rather
   * than one story from another, which is also why it is absent where nothing
   * follows the story. A separation is between two things (addendum 22 §9),
   * and a blank sheet at the very end of a book separates nothing.
   */
  sheetAfterWorks: z.boolean().default(true),
  /**
   * **The writer's own blank pages after the last page of the book** (§9ao,
   * from Ken: *I can't put a page after the end once I remove it*).
   *
   * A leaf hangs **in front of** a record (§9i), so the end of the book was
   * the one position with nothing to hang on and the only answer the room had
   * was a refusal. The book is the record: `BOOK_END` names it, and every act
   * that reaches a leaf — the Add menu, the page's own ×, a drag — works
   * unchanged through `setBlankPages`.
   *
   * A count in pages (§9an), with `true` the older spelling of one sheet
   * (`blankBefore`'s shape), so nothing is migrated.
   */
  blankAtEnd: z.union([z.boolean(), z.number().int().min(0).max(MAX_BLANK_PAGES)]).default(false),
  runningHeads: z
    .object({
      verso: headContentSchema.default('author'),
      recto: headContentSchema.default('chapter'),
      /** The words each side carries where it carries `custom`. */
      versoText: z.string().default(''),
      rectoText: z.string().default(''),
      /** Where the head sits across the page, the folio's place's counterpart. */
      place: headPlaceSchema.default('centre'),
      /**
       * **A running foot** (addendum 43 §10): a line at the foot of every
       * text page, in words with fields — *{title}*, *{chapter}*,
       * *{author}*, *{page}*, *{pages}*, *{date}*. Empty prints none.
       */
      foot: z.string().default(''),
      footPlace: headPlaceSchema.default('centre'),
    })
    .default({}),
  /** Divisions laid out differently from the book (addendum 43 §10). */
  sections: z.array(sectionLayoutSchema).default([]),
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
  /** The fonts the writer imported (§6b). Empty until one is. */
  fonts: z.array(bookFontSchema).default([]),
  /**
   * What the contents page does **not** list (§9v, from Ken: *you need to be
   * able to select in the menu what is going to be in the table of contents*).
   *
   * The ids that are **out**, rather than the ids that are in, because a
   * contents page lists the book: a chapter written tomorrow belongs on it
   * without anybody being asked, and a list of what is in would silently drop
   * it. Each is a division's marker, a section's unit or a part — whichever
   * record the entry stands for — and one that no longer exists is simply
   * ignored, so deleting a chapter needs nothing run here.
   */
  contentsOut: z.array(z.string()).default([]),
});
export type BookSettings = z.infer<typeof bookSettingsSchema>;
