import { z } from 'zod';
import { BOOK_FACES, type BookFace, type BookPart, type PartKind } from './entities/book.js';
import { lineStyleSchema, lineStyleVars, type ChapterPageStyle, type LineStyle } from './chapter-style.js';
import { faceStackOf } from './book-layout.js';
import { sinkDrop } from './sinks.js';
import type { BookFont } from './entities/book.js';

/**
 * How a page of the front matter is set (addendum 20 §9, from Ken: *the
 * pop-up needs options for different templates, a way to redo the wording
 * and the fonts, and stylize the page*).
 *
 * The chapter page's vocabulary pointed at the half title, the title page,
 * a dedication and an epigraph: a **template** says where the block sits
 * and how it is ranged, a **face** says what it is set in, and a line style
 * says how big, how cased and how weighted the title and the lines under it
 * are. The style is the part's own — a half title and a title page are one
 * page each, so there is no book-wide look to keep them in step, unlike the
 * chapter pages — and it is stored on the part, so no migration.
 *
 * **A template is never stored.** It is read back from the alignment and the
 * drop (`partTemplateOf`), the way the book's type preset is read back, so a
 * hand change makes the page *custom* by itself and nothing can disagree
 * about which template is in force.
 */

/**
 * **A template is a height** (§9n, from Ken's handoff), and the alignment is
 * its own control beside it.
 *
 * The first five conflated the two — *High and left*, *Low and right* — so
 * ranging a page left made it *Custom* even though it sat exactly where
 * *Classic* puts it, and choosing a template silently moved it across the
 * page. Two questions, two controls: this table answers *how far down*, and
 * nothing here touches the alignment.
 *
 * The four are the ones a compositor names. *Optical centre* is the one
 * worth knowing: a block placed at the true middle reads as though it has
 * sagged, so the eye's centre is a little above it.
 */
export const PART_TEMPLATES = ['upper_third', 'optical', 'centred', 'low'] as const;
export type PartTemplate = (typeof PART_TEMPLATES)[number];

export type PartAlign = 'left' | 'center' | 'right';

export const PART_TEMPLATE_WORDS: Record<PartTemplate, { name: string; says: string; drop: number }> = {
  upper_third: { name: 'Upper third', says: 'A third of the way down: what most books do.', drop: 33 },
  optical: { name: 'Optical centre', says: 'A little above the middle, where the eye reads the centre to be.', drop: 42 },
  centred: { name: 'Centred', says: 'At the true middle of the page.', drop: 50 },
  low: { name: 'Low', says: 'Low on the page, the space above it doing the work.', drop: 62 },
};

/** The book's own face, or one of the book faces chosen for this page alone. */
export const PART_FACES = ['book', ...BOOK_FACES] as const;
export type PartFace = (typeof PART_FACES)[number];

export const partStyleSchema = z.object({
  align: z.enum(['left', 'center', 'right']).default('center'),
  /**
   * How far down the page the block begins, as a share of the page's height.
   *
   * **33 rather than 30** (§9n): the default is now *Upper third*, one of the
   * four the room offers, so a page nobody has touched reads as a template
   * rather than as *Custom · placed by hand* — which would be a lie about a
   * page, and would make the template row useless on every book out of the
   * box. It is the one place a page that was never set moves, by 3% of the
   * height on the four designed block pages, and it is the handoff's own
   * number. A page whose drop was ever chosen keeps it.
   */
  drop: z.number().min(0).max(80).default(33),
  /**
   * How far down the page the **author** stands, on the title page (§16).
   *
   * **Null means directly under the title**, which is one field answering
   * both of the handoff's controls rather than a number and a mode beside it
   * that could disagree — `minimumSetups`' shape, and the reason is the same:
   * two fields for one question drift the moment one is written without the
   * other. It is also what the page has always done, so a title page nobody
   * has arranged is unchanged.
   *
   * Every other kind ignores it, as they ignore the dividers.
   */
  authorDrop: z.number().min(10).max(85).nullable().default(null),
  face: z.enum(PART_FACES).default('book'),
  /** The title, or the words of a dedication. */
  title: lineStyleSchema.default({ size: 24, tracking: 2 }),
  /** The lines under the title: a subtitle, the author, the publisher. */
  line: lineStyleSchema.default({ size: 12, case: 'capitals', tracking: 12 }),
  /**
   * The letter dividers of an index — the A, the B — which are a third kind of
   * line on that page and not the entries under them (§7a). The default is
   * what the stylesheet drew, bold at the reading size, so an index nobody has
   * touched is unchanged; the kinds that have no dividers ignore it, the way
   * the foot-hung and flowing pages ignore the drop.
   */
  divider: lineStyleSchema.default({ size: 11, bold: true }),
  /**
   * Whether the title page's subtitle is set in italic (§16).
   *
   * Its **size is derived** — a little over half the title's — because a
   * subtitle is a line of the title group rather than a line of its own, so
   * it should grow when the title does; there is nowhere to type one, which
   * is this project's rule about a derived fact arriving on a page for the
   * tenth time. The slope is the one thing books really disagree about, so
   * it is the one thing there is to set.
   */
  subtitleItalic: z.boolean().default(true),
  /** A rule under the title. */
  rule: z.boolean().default(false),
  /**
   * Whether the page prints its number, and whether it opens on a right-hand
   * page. The cutter has understood both since §4 — `layPages` takes `folio`
   * and `starts` on every block — and neither could be **asked for** until
   * the back matter's screen wanted them per page.
   */
  folio: z.boolean().default(true),
  /**
   * **True by default**, because that is what every prose part has done: a
   * foreword, a preface and an introduction each open on a right-hand page,
   * and did so before this could be asked for. The back-matter kinds turn it
   * off in their own defaults below, which is the handoff's table (§17) — so
   * the control arrives without moving a page in a book made before it.
   */
  recto: z.boolean().default(true),
});
export type PartStyle = z.infer<typeof partStyleSchema>;

/** What a part stores: any of the fields, the rest read from the kind's defaults. */
export const partStylePatchSchema = partStyleSchema.partial();
export type PartStylePatch = z.infer<typeof partStylePatchSchema>;

/**
 * The kinds whose page **prints type of its own** and is therefore designed
 * (§7a) — which is every part but a **plate**, a plate being a picture edge to
 * edge with no type on it at all.
 *
 * This once excluded the prose parts too, on the ground that a foreword's body
 * *is* the book's body text and should stay it. That was a **statement about
 * the default mistaken for a statement about the permission** (from Ken: *the
 * about the author page needs the same style options*). A prose part's heading
 * and words still start as the book's, so nothing drawn before this moves; a
 * writer who wants the biography a size smaller than the story can now say so,
 * which is the whole difference.
 */
export const partHasStyle = (kind: PartKind): boolean => kind !== 'plate';

/**
 * How a designed page sits, which is what the page **is** rather than a choice
 * the writer makes (§7a) — so the template and the drop are **absent** on the
 * two that are not a block, rather than offered and wrong.
 *
 * - `block`: a few words placed on a page of their own, dropped from the head.
 *   The template and the drop are theirs.
 * - `foot`: the copyright page. A notice floating a third of the way down is
 *   not a copyright page, and the block is long enough that a drop would push
 *   it off the foot.
 * - `flows`: the contents and the index. They run to as many pages as they
 *   need, so there is no single block to place; the heading stands at the head
 *   and the entries follow.
 * - `prose`: a foreword, an afterword, *About the author*. Its heading stands
 *   at the head of the page and its paragraphs run on under it, for as many
 *   pages as they take — the same reason `flows` has no block to place.
 */
export type PartPlacement = 'block' | 'foot' | 'flows' | 'prose';
export const partPlacement = (kind: PartKind): PartPlacement =>
  kind === 'copyright'
    ? 'foot'
    : kind === 'contents' || kind === 'index'
      ? 'flows'
      : kind === 'half_title' || kind === 'title_page' || kind === 'dedication' || kind === 'epigraph' || kind === 'plate'
        ? 'block'
        : 'prose';

/**
 * Whether the page divides its entries under **letters** (§7a, from Ken:
 * *separate out the letter dividers*). The index does and nothing else does —
 * a contents page is in the book's own order, so there is nothing to divide
 * it by. It is a predicate rather than `kind === 'index'` written into the
 * screen, so the print and the dialog cannot disagree about which page has
 * them.
 */
export const partHasDividers = (kind: PartKind): boolean => kind === 'index';

/**
 * What each kind looks like until somebody touches it — exactly what the
 * printed page drew before there was a style, so a book that never chooses
 * looks as it did. A dedication's words are set at reading size, in italic.
 */
/** The size the reference pages set, from the handoff's §3 table. */
const PROSE_SMALL = { size: 10, case: 'as_typed', bold: false, italic: false, tracking: 0 } as const;

const KIND_DEFAULTS: Partial<Record<PartKind, PartStylePatch>> = {
  half_title: { title: { size: 24, case: 'as_typed', bold: false, italic: false, tracking: 2 } },
  // **Stacked**, which is what the page has always drawn (§16): the author
  // directly under the title, as one block. 36 rather than the schema's 33 so
  // a title page nobody has arranged reads as one of the three arrangements
  // rather than as *Custom · placed by hand* — §9n's argument, which moved
  // the half title by 3% for the same reason and on the handoff's own number.
  title_page: { drop: 36, authorDrop: null },
  // The lines under the words start as the words (§7a): an epigraph's
  // attribution and a dedication's second line are set the same until somebody
  // says otherwise, so a page made before there were two styles is unchanged.
  dedication: {
    title: { size: 11, case: 'as_typed', bold: false, italic: true, tracking: 0 },
    line: { size: 11, case: 'as_typed', bold: false, italic: true, tracking: 0 },
  },
  epigraph: {
    title: { size: 11, case: 'as_typed', bold: false, italic: true, tracking: 0 },
    line: { size: 11, case: 'as_typed', bold: false, italic: true, tracking: 0 },
  },
  // Small print ranged left at the foot, which is what the page drew before
  // it could be set at all. Nine point where the stylesheet said `0.8em` — 8.8
  // at an eleven-point body — because this is furniture and does not grow when
  // the body does, which is the running heads' rule (§7a).
  copyright: {
    align: 'left',
    title: { size: 9, case: 'as_typed', bold: false, italic: false, tracking: 0 },
    line: { size: 9, case: 'as_typed', bold: false, italic: false, tracking: 0 },
  },
  // The heading over the entries, and the entries: what the stylesheet drew
  // before either could be set — 1.3em of an eleven-point body, tracked open
  // and in capitals, over entries at the reading size (§7a). Points rather
  // than a share of the body, which is what a designed page is set in
  // everywhere else here; a book whose body is not eleven point is the one
  // thing that reads differently, as it was for the running heads.
  contents: {
    title: { size: 14, case: 'capitals', bold: false, italic: false, tracking: 12 },
    line: { size: 11, case: 'as_typed', bold: false, italic: false, tracking: 0 },
  },
  // The index is both: a designed page with its own heading (§7a) and one of
  // the back matter's seven (§17), so its entry carries the handoff's sink,
  // size, folio and side alongside the type it has had since §7a.
  index: {
    title: { size: 14, case: 'capitals', bold: false, italic: false, tracking: 12 },
    line: { size: 9.5, case: 'as_typed', bold: false, italic: false, tracking: 0 },
    drop: sinkDrop('shallow'),
    folio: true,
    recto: false,
  },
  // **The back matter's seven** (§17), from the handoff's own §3 table: the
  // sink, the text size, whether a number prints and which side it opens on,
  // per page. `sinkDrop` rather than a literal, so the three named steps have
  // one table and the back matter cannot drift from the chapter openings.
  //
  // It corrects a first version that gave all seven *At the head* on §7a's
  // rule — a style starts as exactly what the page prints — and the
  // correction is the interesting half: that rule is about **not moving work
  // somebody did**, and it is not a reason to withhold a design from a page
  // that has never had one, which is what a handoff is for. *At the head*
  // stays as the fourth step, so the older look is one press away.
  // **The prose pages that are not one of the seven keep the look they had.**
  // `drop` defaults to 33 for the pages that place a block on a leaf, and a
  // prose part stored it and never read it — so the day §17 made the sink
  // real was the day a foreword would have moved. §7a's rule, and the reason
  // the seven below are the exception rather than the change being general.
  foreword: { drop: 0 },
  preface: { drop: 0 },
  introduction: { drop: 0 },
  prologue: { drop: 0 },
  epilogue: { drop: 0 },
  afterword: { drop: 0 },
  also_by: { drop: 0 },
  acknowledgements: { drop: sinkDrop('standard'), folio: true, recto: false },
  appendix: { drop: sinkDrop('standard'), line: PROSE_SMALL, folio: true, recto: false },
  glossary: { drop: sinkDrop('standard'), line: PROSE_SMALL, folio: true, recto: false },
  bibliography: { drop: sinkDrop('standard'), line: PROSE_SMALL, folio: true, recto: false },
  about_the_author: { drop: sinkDrop('standard'), folio: false, recto: false },
  // A last page a reader is meant to act on: dropped deep, ruled, on a
  // right-hand page and carrying no number.
  reader_extra: { drop: sinkDrop('deep'), rule: true, folio: false, recto: true },
};

/**
 * The part's style as it stands: what it stored, over its kind's defaults,
 * over a **base** the caller supplies.
 *
 * The base exists for the prose parts (§7a). What a foreword's heading and
 * words look like today is the *book's* — the chapter-opening style and the
 * body — and those are settings the writer may already have changed, so a
 * static default would move an existing page the moment the control appeared.
 * Passing the book's own values as the floor makes the offered style start as
 * exactly what is on the page, and a stored field is an override of it, which
 * is `minimumSetups`' shape and the margins'. The dialog resolves the same way
 * it is printed, so the screen and the page cannot say different things.
 */
export const partStyleOf = (part: Pick<BookPart, 'kind' | 'style'>, base: PartStylePatch = {}): PartStyle =>
  partStyleSchema.parse({ ...base, ...(KIND_DEFAULTS[part.kind] ?? {}), ...part.style });

/**
 * Which template the page's height matches, or null where it was dragged to
 * a height of its own — still a **reading** rather than a stored word, so a
 * hand change makes the page *custom* by itself (§9n).
 *
 * It asks the **drop alone**. The alignment is a control beside it now, so a
 * page ranged left at a third of the way down is still *Upper third*: where
 * it sits down the page is what the word is about.
 */
export const partTemplateOf = (style: Pick<PartStyle, 'drop'>): PartTemplate | null =>
  PART_TEMPLATES.find((template) => PART_TEMPLATE_WORDS[template].drop === style.drop) ?? null;

/** The template's height, as a patch: everything else about the page is kept — the alignment among it. */
export const partTemplatePatch = (template: PartTemplate): Pick<PartStyle, 'drop'> => ({
  drop: PART_TEMPLATE_WORDS[template].drop,
});

/**
 * What the page carries in place of its title (§9n) — a **reading**, so
 * nothing stores a mode that could disagree with what the page prints.
 *
 * - `art`: a picture fills the whole page, and the title is in the art.
 * - `logo`: a picture stands where the title would, and the words are not set.
 * - `text`: the book's own title, set in type.
 *
 * The order matters and is the print's: a page of art beats a logotype,
 * because a picture edge to edge leaves nothing for a logotype to sit on.
 */
export type PartMode = 'text' | 'logo' | 'art';

export const partModeOf = (part: Pick<BookPart, 'kind' | 'assetId' | 'logoAssetId'>, titleImage = ''): PartMode =>
  part.assetId ? 'art' : partLogo(part, titleImage) ? 'logo' : 'text';

/**
 * The logotype in force: the part's own picture, or the title page's older
 * `titleImage` where it has none. A library id and a data URI are told apart
 * by the caller, which is why this says which of the two it found.
 */
export const partLogo = (
  part: Pick<BookPart, 'kind' | 'logoAssetId'>,
  titleImage = '',
): { assetId: string; data: null } | { assetId: null; data: string } | null => {
  if (part.logoAssetId) return { assetId: part.logoAssetId, data: null };
  if (part.kind === 'title_page' && titleImage.trim().length > 0) return { assetId: null, data: titleImage };
  return null;
};

/**
 * How many of the page's settings differ from the style it would otherwise
 * take (§9n, the handoff's *6 changes from the front-matter style*).
 *
 * It compares the **resolved** style against the same style with nothing
 * stored, so it counts what a writer has actually chosen rather than how
 * many keys happen to sit in the record — a field set back to its default by
 * hand is not a change, and should not be counted as one.
 */
export const partChanges = (part: Pick<BookPart, 'kind' | 'style'>, base: PartStylePatch = {}): number => {
  const mine = partStyleOf(part, base);
  const theirs = partStyleOf({ kind: part.kind, style: {} }, base);
  // **Leaf by leaf**, so a writer who set the size, the case and the slope
  // is told they changed three things. Counting `title` as one would say
  // *1 change* over a page that had been taken apart, which is a figure
  // nobody can check against what they did.
  const leaves = (one: PartStyle): unknown[] => [
    one.align,
    one.drop,
    one.authorDrop,
    one.face,
    one.rule,
    one.subtitleItalic,
    one.folio,
    one.recto,
    ...([one.title, one.line, one.divider] as const).flatMap((line) => [
      line.size,
      line.case,
      line.bold,
      line.italic,
      line.tracking,
    ]),
  ];
  const a = leaves(mine);
  const b = leaves(theirs);
  return a.filter((value, at) => value !== b[at]).length;
};

/**
 * What a prose part looks like **before anybody sets it** — which is not a
 * constant but the book's own two answers: its heading is drawn with the
 * chapter-opening style and its words with the body (§7a). Handed to
 * `partStyleOf` as the floor, so *About the author* opens on exactly what the
 * page already prints and every field is an override from there.
 *
 * The chapter face's `manuscript` means *the book's own* inside a book, which
 * is `book` in this vocabulary — the older spelling of the same intent, as
 * `chapterStyleVars` reads it.
 */
export const proseStyleBase = (chapter: Pick<ChapterPageStyle, 'face' | 'title'>, bodySize: number): PartStylePatch => ({
  face: chapter.face === 'manuscript' || chapter.face === 'book' || chapter.face === 'serif' ? 'book' : chapter.face,
  title: chapter.title,
  line: { size: bodySize, case: 'as_typed', bold: false, italic: false, tracking: 0 },
});

const lineVars = (name: string, one: LineStyle): Record<string, string> => lineStyleVars(`--pt-${name}`, one);

/**
 * The style as CSS custom properties: the one place that decides what they
 * mean, read by the print and the screen alike, the chapter page's rule.
 * *Book* as the face means the book's body face, which is passed in.
 */
export const partStyleVars = (
  style: PartStyle,
  bookFace: string,
  fonts: readonly BookFont[] = [],
): Record<string, string> => ({
  // `faceStackOf` rather than a copy of the table (§6b): a face may name an
  // imported font, and a second resolver here would set the story in Sabon
  // and the front matter in whatever the table happened to hold.
  '--pt-face': faceStackOf(style.face === 'book' ? bookFace : style.face, fonts),
  '--pt-drop': `${style.drop}%`,
  // Null means *directly under the title* (§16), which on the page is the
  // author standing inside the title's own group — so there is no second
  // height to declare and the property is simply not set.
  ...(style.authorDrop === null ? {} : { '--pt-author-drop': `${style.authorDrop}%` }),
  '--pt-subtitle-style': style.subtitleItalic ? 'italic' : 'normal',
  '--pt-align': style.align,
  '--pt-items': style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
  '--pt-rule': style.rule ? '1px solid currentColor' : 'none',
  ...lineVars('title', style.title),
  ...lineVars('line', style.line),
  ...lineVars('divider', style.divider),
});

/** The same, as a `style` attribute's text. */
export const partStyleAttr = (style: PartStyle, bookFace: string, fonts: readonly BookFont[] = []): string =>
  Object.entries(partStyleVars(style, bookFace, fonts))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
