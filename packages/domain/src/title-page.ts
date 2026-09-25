import { z } from 'zod';
import type { BookPart } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { bookNames, bookSettingsOf } from './book-layout.js';
import { copyrightOf } from './copyright-page.js';
import { titlePageOf, titlePageSchema } from './entities/title-page.js';
import type { PartStyle } from './part-style.js';

/**
 * **The book's title page** (addendum 20 §16, from Ken's own handoff): the
 * seven things that may stand on it, where the title and the author sit, and
 * what each one is read from.
 *
 * The audit paid a **nineteenth** time, and in two directions at once.
 *
 * **Four of the seven were already printing.** The title is `bookNames`', the
 * subtitle is `settings.titlePage.episode` — the older spelling, which the
 * page has drawn under the title since the room was built — the author is
 * `bookNames`' too, and the publisher is `settings.book.imprint`.
 *
 * **Two more were already *typed*, on the copyright page.** `publisher`,
 * `publisherPlace` and `edition` have been fields on that record since §9k,
 * and they are facts about the **book** rather than about that page: a title
 * page and a copyright page naming different publishers is a mistake, not a
 * design. So this reads them rather than growing a second set, and there is
 * one place to type each.
 *
 * Only the **contributor** — a translator or an editor — had nowhere to live,
 * so it is the one field this adds to what a title page stores.
 *
 * The other decision is §15's, pointed at a different page: **an element
 * turned off is not an element left empty.** *This book has no second
 * edition* and *this book has one and the title page does not print it* look
 * alike on the page and are different intentions, so each optional element
 * has a switch of its own and switching one off keeps its words.
 */

/** Which of the two a named contributor is. A book says one or the other. */
export const CONTRIBUTOR_ROLES = ['translator', 'editor'] as const;
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number];

/**
 * The optional elements, by the name the screen calls them. The title and the
 * author are not here: they are **required**, a title page without them not
 * being a title page, so there is no switch that could turn one off.
 */
export const TITLE_PAGE_OPTIONAL = ['subtitle', 'contributor', 'edition', 'publisher', 'location'] as const;
export type TitlePageElement = (typeof TITLE_PAGE_OPTIONAL)[number];

/**
 * What the title page carries that nothing else already holds.
 *
 * The defaults are **exactly what the page printed before there were
 * switches**: the subtitle and the publisher have always been drawn where
 * they were given, and the contributor and the edition have never been drawn
 * at all. The location is on because it prints nothing until somebody types a
 * city — an element that is on and empty prints nothing, which is the whole
 * of why the switch and the field are two different things.
 */
export const titlePageFieldsSchema = z.object({
  /** A translator or an editor, by name. Empty prints no line whatever the switch says. */
  contributor: z.string().default(''),
  contributorRole: z.enum(CONTRIBUTOR_ROLES).default('translator'),
  /** The publisher's mark in place of its name, from the graphics library. */
  imprintAssetId: z.string().nullable().default(null),
  shows: z
    .object({
      subtitle: z.boolean().default(true),
      contributor: z.boolean().default(false),
      edition: z.boolean().default(false),
      publisher: z.boolean().default(true),
      location: z.boolean().default(true),
    })
    .default({}),
});
export type TitlePageFields = z.infer<typeof titlePageFieldsSchema>;

/** The part's own fields, or the defaults where it has never been set. */
export const titlePageFieldsOf = (part: Pick<BookPart, 'titlePage'>): TitlePageFields =>
  titlePageFieldsSchema.parse(part.titlePage ?? {});

/**
 * The publisher as the **book** knows it, which is the copyright page's
 * record over the book's own imprint.
 *
 * The imprint is `settings.book.imprint` and has named the publisher on both
 * pages since the room was built; the place and the edition are the copyright
 * page's `publisherPlace` and `edition`. Reading them here rather than adding
 * a second pair is the point: a writer types the publisher once and both
 * pages say it.
 */
/*
 * It takes the **parts** rather than reaching for them, so this module
 * imports nothing from `book-plan`, which imports this one to build the
 * page. Every caller already has the plan in hand.
 */
export const publisherOf = (
  file: ProjectFile,
  parts: readonly BookPart[],
): { name: string; place: string; edition: string } => {
  const page = parts.find((one) => one.kind === 'copyright');
  const copyright = page ? copyrightOf(page) : null;
  return {
    name: (copyright?.publisher ?? '').trim() || bookSettingsOf(file).imprint.trim(),
    place: (copyright?.publisherPlace ?? '').trim(),
    edition: (copyright?.edition ?? '').trim(),
  };
};

/**
 * **What the writer has typed, exactly as typed** — the other half of
 * `publisherOf` and of `titlePageOf`, and the half a *box* must be bound to.
 *
 * Both of those are readings **for the page**: they trim every field and put
 * the book's own name in where nothing has been typed, which is right for
 * ink and wrong for a control. Bound to an input it costs a writer two
 * things, and Ken hit both — *the publisher location won't allow input* and
 * *the author name does not allow input*. A **trailing space is trimmed off
 * on the way back**, so the space bar does nothing and a two-word name
 * cannot be typed; and a **fallback arrives as the value**, so the box shows
 * the project's name as though somebody had typed it, typing appends to it,
 * and clearing it hands it straight back.
 *
 * So the rule, which is `partStyleOf`'s and `bookPresetOf`'s pointed at a
 * form: **a reading says what will print and a field says what was typed.**
 * The fallback belongs in the *placeholder*, where it says *this is what the
 * page will use* without pretending to be the writer's words.
 */
export const titlePageTyped = (file: ProjectFile): { title: string; subtitle: string; author: string } => {
  const page = titlePageSchema.parse(file.settings.titlePage ?? {});
  return { title: page.title, subtitle: page.episode, author: page.author };
};

/** The publisher's three, as typed on the copyright page. */
export const publisherTyped = (
  parts: readonly BookPart[],
): { name: string; place: string; edition: string } => {
  const page = parts.find((one) => one.kind === 'copyright');
  const copyright = page ? copyrightOf(page) : null;
  return {
    name: copyright?.publisher ?? '',
    place: copyright?.publisherPlace ?? '',
    edition: copyright?.edition ?? '',
  };
};

/**
 * Everything the title page will print, worked out once and read by the
 * print, the preview and the dialog alike — so the page beside the controls
 * is the page in the book.
 *
 * Each line is what it says **and** whether it says it: an element that is
 * switched on but has no words prints nothing, which is why `shows` and the
 * text are kept apart all the way down here rather than being collapsed into
 * one truthy string on the way in.
 */
export interface TitlePageContent {
  title: string;
  subtitle: string;
  author: string;
  /** *Translated by Jane Doe*, assembled here so no screen writes the words. */
  contributor: string;
  edition: string;
  publisher: string;
  location: string;
}

export const titlePageContent = (
  file: ProjectFile,
  part: Pick<BookPart, 'titlePage'>,
  parts: readonly BookPart[],
): TitlePageContent => {
  const fields = titlePageFieldsOf(part);
  const names = bookNames(file);
  const page = titlePageOf(file.project, file.settings);
  const house = publisherOf(file, parts);
  const on = (element: TitlePageElement, text: string): string => (fields.shows[element] ? text.trim() : '');
  const who = fields.contributor.trim();
  return {
    title: page.title.trim() || names.title,
    subtitle: on('subtitle', page.episode),
    author: page.author.trim() || names.author,
    contributor: on('contributor', who.length > 0 ? `${fields.contributorRole === 'editor' ? 'Edited' : 'Translated'} by ${who}` : ''),
    edition: on('edition', house.edition),
    publisher: on('publisher', house.name),
    location: on('location', house.place),
  };
};

/** How many of the seven the page is set to show, for the section's count. */
export const titlePageShown = (part: Pick<BookPart, 'titlePage'>): number =>
  2 + TITLE_PAGE_OPTIONAL.filter((one) => titlePageFieldsOf(part).shows[one]).length;

/**
 * **Where the title and the author sit**, as the four arrangements the
 * handoff names.
 *
 * Three place the block down the page and the fourth, *Flush left*, is
 * Classic's heights ranged left. §9n's rule — a template is a height, the
 * alignment is its own control — is kept by having the **reading** ask all
 * three numbers rather than by dropping the arrangement: Classic is 30/52
 * centred and Flush left is 30/52 left, so each names one whole arrangement
 * and nothing is stored. Ranging a Classic page left reads as *Flush left*,
 * which is what it now is; the alignment control stays beside them and any
 * other combination reads as *Custom*.
 */
export const TITLE_TEMPLATES = ['classic', 'stacked', 'high', 'flush_left'] as const;
export type TitleTemplate = (typeof TITLE_TEMPLATES)[number];

export const TITLE_TEMPLATE_WORDS: Record<
  TitleTemplate,
  { name: string; says: string; drop: number; authorDrop: number | null; align: 'left' | 'center' | 'right' }
> = {
  classic: {
    name: 'Classic',
    says: 'The title a third down, the author well below it.',
    drop: 30,
    authorDrop: 52,
    align: 'center',
  },
  stacked: {
    name: 'Stacked',
    says: 'The author directly under the title, as one block.',
    drop: 36,
    authorDrop: null,
    align: 'center',
  },
  high: {
    name: 'Set high',
    says: 'Both placed high, the space beneath doing the work.',
    drop: 20,
    authorDrop: 36,
    align: 'center',
  },
  flush_left: {
    name: 'Flush left',
    says: 'Classic’s heights, ranged to the left margin.',
    drop: 30,
    authorDrop: 52,
    align: 'left',
  },
};

/**
 * Which arrangement the page is in, or null where it was placed by hand —
 * a **reading** of the two heights and the alignment, never a stored word,
 * so moving either slider makes the page *Custom* by itself (§9n,
 * `bookPresetOf`'s rule).
 *
 * It asks all three, because on this page no one of them describes the
 * arrangement: a title at 30% tells you nothing about whether the author is
 * under it or half a page below, and Classic and Flush left differ only in
 * where they are ranged.
 */
export const titleTemplateOf = (style: Pick<PartStyle, 'drop' | 'authorDrop' | 'align'>): TitleTemplate | null =>
  TITLE_TEMPLATES.find(
    (one) =>
      TITLE_TEMPLATE_WORDS[one].drop === style.drop &&
      TITLE_TEMPLATE_WORDS[one].authorDrop === (style.authorDrop ?? null) &&
      TITLE_TEMPLATE_WORDS[one].align === style.align,
  ) ?? null;

/** The arrangement whole: its two heights and where it is ranged. */
export const titleTemplatePatch = (
  template: TitleTemplate,
): Pick<PartStyle, 'drop' | 'authorDrop' | 'align'> => ({
  drop: TITLE_TEMPLATE_WORDS[template].drop,
  authorDrop: TITLE_TEMPLATE_WORDS[template].authorDrop,
  align: TITLE_TEMPLATE_WORDS[template].align,
});
