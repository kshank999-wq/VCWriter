import { z } from 'zod';
import { BOOK_FACES, type BookFace, type BookPart, type PartKind } from './entities/book.js';
import { lineStyleSchema, lineStyleVars, type LineStyle } from './chapter-style.js';
import { FACE_STACKS } from './book-layout.js';

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

export const PART_TEMPLATES = ['classic', 'centred', 'high_left', 'low_left', 'low_right'] as const;
export type PartTemplate = (typeof PART_TEMPLATES)[number];

export type PartAlign = 'left' | 'center' | 'right';

export const PART_TEMPLATE_WORDS: Record<PartTemplate, { name: string; says: string; align: PartAlign; drop: number }> = {
  classic: { name: 'Classic', says: 'Centred, a third of the way down: what most books do.', align: 'center', drop: 30 },
  centred: { name: 'Centred', says: 'Centred, at the middle of the page.', align: 'center', drop: 42 },
  high_left: { name: 'High and left', says: 'Ranged left, near the head of the page: a modern look.', align: 'left', drop: 10 },
  low_left: { name: 'Low and left', says: 'Ranged left, low on the page, the space above it doing the work.', align: 'left', drop: 60 },
  low_right: { name: 'Low and right', says: 'Ranged right, low on the page.', align: 'right', drop: 60 },
};

/** The book's own face, or one of the book faces chosen for this page alone. */
export const PART_FACES = ['book', ...BOOK_FACES] as const;
export type PartFace = (typeof PART_FACES)[number];

export const partStyleSchema = z.object({
  align: z.enum(['left', 'center', 'right']).default('center'),
  /** How far down the page the block begins, as a share of the page's height. */
  drop: z.number().min(0).max(80).default(30),
  face: z.enum(PART_FACES).default('book'),
  /** The title, or the words of a dedication. */
  title: lineStyleSchema.default({ size: 24, tracking: 2 }),
  /** The lines under the title: a subtitle, the author, the publisher. */
  line: lineStyleSchema.default({ size: 12, case: 'capitals', tracking: 12 }),
  /** A rule under the title. */
  rule: z.boolean().default(false),
});
export type PartStyle = z.infer<typeof partStyleSchema>;

/** What a part stores: any of the fields, the rest read from the kind's defaults. */
export const partStylePatchSchema = partStyleSchema.partial();
export type PartStylePatch = z.infer<typeof partStylePatchSchema>;

/** The kinds whose page is designed rather than read or written. */
export const partHasStyle = (kind: PartKind): boolean =>
  kind === 'half_title' || kind === 'title_page' || kind === 'dedication' || kind === 'epigraph' || kind === 'copyright';

/**
 * Whether the page **hangs at the foot** rather than being dropped from the
 * head (§7a). The copyright page is the one that does, and it is what the page
 * *is* rather than a choice: a copyright block floating a third of the way
 * down is not a copyright page, and the block is long enough that a drop
 * would push it off the foot. So the template and the drop are **absent**
 * on it rather than offered and wrong — everything about its type is not.
 */
export const partHangsAtFoot = (kind: PartKind): boolean => kind === 'copyright';

/**
 * What each kind looks like until somebody touches it — exactly what the
 * printed page drew before there was a style, so a book that never chooses
 * looks as it did. A dedication's words are set at reading size, in italic.
 */
const KIND_DEFAULTS: Partial<Record<PartKind, PartStylePatch>> = {
  half_title: { title: { size: 24, case: 'as_typed', bold: false, italic: false, tracking: 2 } },
  title_page: {},
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
};

/** The part's style as it stands: what it stored over its kind's defaults. */
export const partStyleOf = (part: Pick<BookPart, 'kind' | 'style'>): PartStyle =>
  partStyleSchema.parse({ ...(KIND_DEFAULTS[part.kind] ?? {}), ...part.style });

/** Which template the style matches, or null where the alignment or the drop was changed by hand. */
export const partTemplateOf = (style: Pick<PartStyle, 'align' | 'drop'>): PartTemplate | null =>
  PART_TEMPLATES.find((template) => PART_TEMPLATE_WORDS[template].align === style.align && PART_TEMPLATE_WORDS[template].drop === style.drop) ?? null;

/** The template's placement, as a patch: everything else about the page is kept. */
export const partTemplatePatch = (template: PartTemplate): Pick<PartStyle, 'align' | 'drop'> => ({
  align: PART_TEMPLATE_WORDS[template].align,
  drop: PART_TEMPLATE_WORDS[template].drop,
});

const lineVars = (name: string, one: LineStyle): Record<string, string> => lineStyleVars(`--pt-${name}`, one);

/**
 * The style as CSS custom properties: the one place that decides what they
 * mean, read by the print and the screen alike, the chapter page's rule.
 * *Book* as the face means the book's body face, which is passed in.
 */
export const partStyleVars = (style: PartStyle, bookFace: BookFace): Record<string, string> => ({
  '--pt-face': FACE_STACKS[style.face === 'book' ? bookFace : style.face] ?? FACE_STACKS.old_style,
  '--pt-drop': `${style.drop}%`,
  '--pt-align': style.align,
  '--pt-items': style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
  '--pt-rule': style.rule ? '1px solid currentColor' : 'none',
  ...lineVars('title', style.title),
  ...lineVars('line', style.line),
});

/** The same, as a `style` attribute's text. */
export const partStyleAttr = (style: PartStyle, bookFace: BookFace): string =>
  Object.entries(partStyleVars(style, bookFace))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
