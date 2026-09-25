import { z } from 'zod';
import type { BookPart, PartKind } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { bookNames } from './book-layout.js';
export { BACK_SINKS, backSinkOf, sinkDrop, sinkPatch, type Sink } from './sinks.js';

/**
 * **The back matter** (addendum 20 §17, from Ken's own handoff): seven pages
 * that come after the story, each with its own first section and one shared
 * screen behind them all.
 *
 * The audit paid a **twentieth** time, and this one is mostly shell.
 *
 * **The screen exists.** §9n and §16 built exactly the handoff's shape —
 * numbered section cards down the left, the page as the book sets it on the
 * right, a navigator, Guides, and a footer of *Reset to page style · Cancel ·
 * Done*. The handoff says so itself: *identical in structure to the Half
 * title and Title page panels*.
 *
 * **Sections 2 and 3 exist.** A part's `PartStyle` has carried the heading's
 * line, the alignment and the rule since §7a; the body's size is its `line`
 * and the sink is its `drop`, which a prose part has stored and ignored. What
 * is new is **columns**, and saying *which page* prints a folio and *which*
 * opens on a recto — both of which the cutter has always understood and
 * neither of which could be asked for.
 *
 * **Five of the seven pages exist as part kinds**: `acknowledgements`,
 * `glossary`, `about_the_author`, `also_by` and `index`. The index in
 * particular is addendum 10 whole — marks placed in the manuscript, page
 * numbers read off the pagination every time, letter dividers — which is the
 * handoff's *Build from the manuscript* tile already built and already
 * better than its own promise, since the numbers are a reading rather than a
 * stored list. What is genuinely new is an appendix, a bibliography, the
 * reader extras, and the importers.
 */

/**
 * The seven, in the order a book puts them. The navigator steps through the
 * ones the book **has**, so this is the order rather than the list.
 */
export const BACK_MATTER_ORDER: readonly PartKind[] = [
  'acknowledgements',
  'appendix',
  'glossary',
  'bibliography',
  'index',
  'about_the_author',
  'reader_extra',
];

/** Whether this kind is one of the seven the back-matter screen serves. */
export const isBackMatterPage = (kind: PartKind): boolean => BACK_MATTER_ORDER.includes(kind);

// ------------------------------------------------------- the acknowledgements

/**
 * What an acknowledgements page carries beyond its words: the sign-off, set
 * apart under the thanks.
 *
 * It is **its own field rather than a last paragraph**, because the page sets
 * it differently — ranged right and in italic — and a writer who typed it as
 * a paragraph would have no way to say so.
 */
export const acknowledgementsSchema = z.object({
  /** Whether the sign-off prints. Its words are kept either way (§15's rule). */
  signOff: z.boolean().default(false),
  signOffText: z.string().default(''),
});
export type Acknowledgements = z.infer<typeof acknowledgementsSchema>;

// ------------------------------------------------------ about the author

export const AUTHOR_PHOTO_PLACES = ['above', 'beside', 'none'] as const;
export type AuthorPhotoPlace = (typeof AUTHOR_PHOTO_PLACES)[number];

export const AUTHOR_PHOTO_SHAPES = ['square', 'rounded', 'circle'] as const;
export type AuthorPhotoShape = (typeof AUTHOR_PHOTO_SHAPES)[number];

/** The three a reader is given. Each prints only where its words are there. */
export const AUTHOR_LINKS = ['website', 'newsletter', 'social'] as const;
export type AuthorLinkKind = (typeof AUTHOR_LINKS)[number];

export const AUTHOR_LINK_WORDS: Record<AuthorLinkKind, string> = {
  website: 'Website',
  newsletter: 'Newsletter',
  social: 'Social',
};

/**
 * The author's page. Two things are deliberately **not** fields here.
 *
 * The **name** is the book's, read from `bookNames`, so a pen name typed on
 * the title page is the one on this page too — §16d's argument about one
 * value with two doors, pointed at the back of the book.
 *
 * And the **biography is the page's words**, `part.text`, which every prose
 * part has carried since §5 and which the printer already sets. A `bio`
 * beside it was written first and deleted: it would have stranded whatever an
 * author had already typed on the page and given the book two answers to what
 * this page says. What is this page's own is the photograph and the links.
 */
export const aboutAuthorSchema = z.object({
  /** The photograph, from the graphics library. Null is no photograph. */
  photoAssetId: z.string().nullable().default(null),
  place: z.enum(AUTHOR_PHOTO_PLACES).default('above'),
  shape: z.enum(AUTHOR_PHOTO_SHAPES).default('circle'),
  /** Empty means the book's author, which is the usual case. */
  name: z.string().default(''),
  links: z
    .array(
      z.object({
        kind: z.enum(AUTHOR_LINKS),
        shows: z.boolean().default(true),
        text: z.string().default(''),
      }),
    )
    .default([]),
});
export type AboutAuthor = z.infer<typeof aboutAuthorSchema>;

/** The page's own fields, or the defaults where it has never been set. */
export const aboutAuthorOf = (part: Pick<BookPart, 'about'>): AboutAuthor =>
  aboutAuthorSchema.parse(part.about ?? {});

export const acknowledgementsOf = (part: Pick<BookPart, 'about'>): Acknowledgements =>
  acknowledgementsSchema.parse(part.about ?? {});

/** Who the page is about: this page's name, or the book's. */
export const authorNameOf = (file: ProjectFile, part: Pick<BookPart, 'about'>): string =>
  aboutAuthorOf(part).name.trim() || bookNames(file).author;

/** The links that print, in the order they are given, worded as typed. */
export const authorLinksShown = (part: Pick<BookPart, 'about'>): string[] =>
  aboutAuthorOf(part)
    .links.filter((one) => one.shows && one.text.trim().length > 0)
    .map((one) => one.text.trim());

// ------------------------------------------------------------------ status

/**
 * What the footer says about the page: green where there is nothing to see,
 * amber where something wants looking at.
 *
 * It is **a reading of the page's own content**, so nothing is stored and a
 * writer who cuts a paragraph is told so with nothing run. The handoff asks
 * for the acknowledgements' length to be computed from the real layout rather
 * than from a word count — until the laying is in hand this answers from the
 * words, and says *about* so it cannot be mistaken for a measurement.
 */
export interface BackMatterStatus {
  text: string;
  /** True where the writer should look at something before printing. */
  warn: boolean;
}

/** Words in a piece of prose, for the card's own count. */
export const wordsIn = (text: string): number => (text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length);

/** Above this many words an acknowledgements page runs past one page. */
export const ACKNOWLEDGEMENTS_ONE_PAGE = 400;
/** Above this many words a biography may run to a second page. */
export const BIO_ONE_PAGE = 150;

export const backMatterStatus = (part: BookPart): BackMatterStatus => {
  switch (part.kind) {
    case 'acknowledgements': {
      const words = wordsIn(part.text);
      return words > ACKNOWLEDGEMENTS_ONE_PAGE
        ? { text: `Running past one page — ${words} words`, warn: true }
        : { text: 'Fits on one page', warn: false };
    }
    case 'about_the_author': {
      const words = wordsIn(part.text);
      return words > BIO_ONE_PAGE
        ? { text: `A bio over ${BIO_ONE_PAGE} words may run to a second page`, warn: true }
        : { text: `Bio length looks right · ${words} words`, warn: false };
    }
    default:
      return { text: '', warn: false };
  }
};
