import {
  BOOK_FACES,
  bookSettingsSchema,
  type BookFace,
  type BookSettings,
  type Trim,
} from './entities/book.js';
import type { ProjectFormat } from './entities/project.js';
import type { ProjectFile } from './project-file.js';
import { nowIso } from './entities/common.js';
import { titlePageOf } from './entities/title-page.js';

/**
 * The trim size, and everything worked out from it (addendum 20 §3).
 *
 * Ken's sentence — *you enter in the trim size and it will automatically set
 * up margins, page numbers, headers, footers* — built literally: the writer
 * chooses a trim and **every other measurement is a reading of it**. The
 * margins come from the trim by proportion and from the page count by the
 * gutter a thick book needs; the text block is what is left; the lines per
 * page are the block over the leading. Nothing here is stored except the
 * trim itself and an override where the writer typed one over a derived
 * value, so a book that grows from two hundred pages to four hundred widens
 * its own gutter with nothing run.
 */

// ------------------------------------------------------------------- trims

export interface TrimPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  /** What it is usually for, said on the list. */
  note: string;
}

/** The sizes printers take, in inches. */
export const TRIM_PRESETS: readonly TrimPreset[] = [
  { id: '5x8', name: '5 × 8 in', width: 5, height: 8, note: 'a small paperback' },
  { id: '5.25x8', name: '5¼ × 8 in', width: 5.25, height: 8, note: 'a small paperback' },
  { id: '5.5x8.5', name: '5½ × 8½ in', width: 5.5, height: 8.5, note: 'the usual trade paperback' },
  { id: '6x9', name: '6 × 9 in', width: 6, height: 9, note: 'a trade paperback or hardback' },
  { id: 'royal', name: 'Royal · 6.14 × 9.21 in', width: 6.14, height: 9.21, note: 'a UK hardback' },
  { id: 'b_format', name: 'B format · 5.06 × 7.81 in', width: 5.06, height: 7.81, note: 'a UK paperback' },
  { id: 'a5', name: 'A5 · 5.83 × 8.27 in', width: 5.83, height: 8.27, note: 'a European paperback' },
  { id: '7x10', name: '7 × 10 in', width: 7, height: 10, note: 'a textbook or a workbook' },
  { id: '8.5x11', name: '8½ × 11 in', width: 8.5, height: 11, note: 'a manual or a large workbook' },
];

/** What a format is set in until somebody says otherwise. */
export const defaultTrimFor = (format: ProjectFormat): Trim =>
  format === 'instructional' ? { width: 7, height: 10 } : { width: 5.5, height: 8.5 };

/** The trim as it stands: the writer's where they chose one, the format's where not. */
export const trimOf = (settings: BookSettings, format: ProjectFormat): Trim =>
  settings.trim.width > 0 && settings.trim.height > 0 ? settings.trim : defaultTrimFor(format);

/** The preset a trim matches, for the list to show as chosen; null for a custom size. */
export const trimPresetOf = (trim: Trim): TrimPreset | null =>
  TRIM_PRESETS.find((preset) => near(preset.width, trim.width) && near(preset.height, trim.height)) ?? null;

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;

// ---------------------------------------------------------------- settings

/**
 * What the book is called, by whom, and who publishes it (§9, from Ken:
 * *it is taking it from the actual saved file name, and that is ending up
 * on the tops of the pages*).
 *
 * **One reading, everywhere the book names itself**: the running heads, the
 * contents page, the chapter fallback, the title page, the copyright
 * notice, the eBook's metadata and the exported file all ask this, so they
 * cannot disagree. The writer's own title wins; the project's name — which
 * an import took from the file on disk — is only the fallback, and is
 * shown as the placeholder so it is clear which is which.
 */
export const bookNames = (file: ProjectFile): { title: string; author: string; imprint: string } => {
  const page = titlePageOf(file.project, file.settings);
  return {
    title: page.title.trim() || file.project.title,
    author: page.author.trim() || file.project.author,
    imprint: bookSettingsOf(file).imprint,
  };
};

export const bookSettingsOf = (file: ProjectFile): BookSettings =>
  bookSettingsSchema.parse(file.settings.book ?? {});

/**
 * Change the book's settings. A patch of the top-level fields; a nested
 * object given whole replaces the one there, which is what a control that
 * writes `margins` or `runningHeads` wants.
 */
export const setBookSettings = (file: ProjectFile, patch: Partial<BookSettings>): ProjectFile => ({
  ...file,
  settings: {
    ...file.settings,
    book: bookSettingsSchema.parse({ ...bookSettingsOf(file), ...patch }),
  },
  project: { ...file.project, updatedAt: nowIso() },
});

// ------------------------------------------------------------------- faces

/**
 * Each face resolved to a stack that ends in a generic family (§6), so a
 * book set in *old-style serif* prints on a machine that has none of the
 * named fonts — in its own old-style serif, or its nearest.
 */
export const FACE_STACKS: Record<BookFace, string> = {
  old_style: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  transitional: "Baskerville, 'Libre Baskerville', 'Times New Roman', Times, serif",
  modern: "Didot, 'Bodoni MT', 'Bodoni 72', Georgia, serif",
  sans: "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif",
  // The six named faces (§6a). Each stack is headed by the font asked for and
  // ends in a generic family, so a machine without it still prints the book —
  // in the nearest thing it has, which the room says out loud rather than
  // pretending otherwise.
  garamond: "Garamond, 'EB Garamond', 'Adobe Garamond Pro', 'Cormorant Garamond', 'Apple Garamond', Georgia, serif",
  baskerville: "Baskerville, 'Libre Baskerville', 'Baskerville Old Face', 'Times New Roman', Times, serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  caslon: "'Adobe Caslon Pro', 'Libre Caslon Text', 'Big Caslon', 'Caslon', Georgia, serif",
  gill_sans: "'Gill Sans', 'Gill Sans MT', 'Gill Sans Nova', Calibri, 'Trebuchet MS', ui-sans-serif, sans-serif",
  lato: "Lato, 'Lato Regular', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif",
  // The stack a paragraph falls back to where the document named no face.
  imported: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
};

export const FACE_NAMES: Record<BookFace, string> = {
  old_style: 'Old-style serif',
  transitional: 'Transitional serif',
  modern: 'Modern serif',
  sans: 'Sans serif',
  garamond: 'Garamond',
  baskerville: 'Baskerville',
  georgia: 'Georgia',
  caslon: 'Caslon',
  gill_sans: 'Gill Sans',
  lato: 'Lato',
  imported: 'As imported',
};

export const FACE_NOTES: Record<BookFace, string> = {
  old_style: 'Palatino, Iowan — what most novels are set in',
  transitional: 'Baskerville, Times — a little crisper',
  modern: 'Didot, Bodoni — high contrast; best at larger sizes',
  sans: 'Helvetica — for a textbook or a manual',
  garamond: 'The old-style classic; sets small, so give it a point more',
  baskerville: 'Crisper than Garamond, and wider',
  georgia: 'On nearly every machine there is — the safe choice',
  caslon: 'When in doubt, set it in Caslon',
  gill_sans: 'A humanist sans; a clean, English look',
  lato: 'A modern sans; even and quiet at text sizes',
  imported: 'Each paragraph in the face and size its Word document gave it',
};

export const faceStackOf = (face: BookFace): string => FACE_STACKS[face] ?? FACE_STACKS.old_style;

/**
 * The three presets (§6): a whole style set at once, every field changeable
 * after. A preset is a patch, nothing more — which one is in force is read
 * back from the settings (`bookPresetOf`) rather than stored, so a field
 * changed by hand makes the style *custom* by itself.
 */
export type BookPreset = 'classic' | 'modern' | 'textbook';
export const BOOK_PRESET_NAMES: readonly BookPreset[] = ['classic', 'modern', 'textbook'];

export type PresetFields = Pick<
  BookSettings,
  'face' | 'size' | 'leading' | 'justify' | 'hyphenate' | 'opening' | 'ornament' | 'chaptersOpenRecto' | 'runningHeads' | 'folio' | 'folioOnOpening'
>;

export const BOOK_PRESETS: Record<BookPreset, PresetFields> = {
  classic: {
    face: 'old_style',
    size: 11,
    leading: null,
    justify: true,
    hyphenate: true,
    opening: 'small_caps',
    // A blank line between scenes, which is what most trade fiction does;
    // it is also the book's default, so a new book reads as Classic.
    ornament: '',
    chaptersOpenRecto: true,
    runningHeads: { verso: 'author', recto: 'chapter', versoText: '', rectoText: '', place: 'centre' },
    folio: 'foot_outside',
    folioOnOpening: true,
  },
  modern: {
    face: 'transitional',
    size: 10.5,
    leading: null,
    justify: true,
    hyphenate: true,
    opening: 'drop_cap',
    ornament: '',
    chaptersOpenRecto: false,
    runningHeads: { verso: 'title', recto: 'chapter', versoText: '', rectoText: '', place: 'centre' },
    folio: 'head_outside',
    folioOnOpening: false,
  },
  textbook: {
    face: 'sans',
    size: 10,
    leading: null,
    justify: false,
    hyphenate: false,
    opening: 'none',
    ornament: '',
    chaptersOpenRecto: true,
    runningHeads: { verso: 'title', recto: 'chapter', versoText: '', rectoText: '', place: 'centre' },
    folio: 'foot_centre',
    folioOnOpening: true,
  },
};

export const PRESET_INFO: Record<BookPreset, { name: string; about: string }> = {
  classic: { name: 'Classic', about: 'old-style serif, small capitals to open, a blank line between scenes, folios at the outer foot' },
  modern: { name: 'Modern', about: 'transitional serif, a drop cap, openings on either page, folios at the outer head' },
  textbook: { name: 'Textbook', about: 'sans serif, ragged right, no hyphenation, folios at the centre foot' },
};

/** Which preset the settings match whole, or null where a field was changed by hand. */
export const bookPresetOf = (settings: BookSettings): BookPreset | null => {
  for (const preset of BOOK_PRESET_NAMES) {
    const fields = BOOK_PRESETS[preset];
    const same = (Object.keys(fields) as (keyof PresetFields)[]).every((key) =>
      key === 'runningHeads'
        ? settings.runningHeads.verso === fields.runningHeads.verso &&
          settings.runningHeads.recto === fields.runningHeads.recto &&
          settings.runningHeads.place === fields.runningHeads.place
        : settings[key] === fields[key],
    );
    if (same) return preset;
  }
  return null;
};

export const applyBookPreset = (file: ProjectFile, preset: BookPreset): ProjectFile => setBookSettings(file, BOOK_PRESETS[preset]);

export { BOOK_FACES };

// ---------------------------------------------------------------- geometry

/** The page, worked out. Inches unless said otherwise. */
export interface BookGeometry {
  trim: Trim;
  /** The margins as they stand, derived or typed. */
  margins: { inside: number; outside: number; top: number; bottom: number };
  /** Which of the four the writer typed, so the inspector can grey the rest. */
  overridden: { inside: boolean; outside: boolean; top: boolean; bottom: boolean };
  /** The text block: what is left inside the margins. */
  text: { width: number; height: number };
  /** Body size and leading, in points. */
  size: number;
  leading: number;
  /** How many lines of the body face a full page holds. */
  linesPerPage: number;
  /** About how many characters fit on a line at this size and face. */
  measure: number;
  /**
   * Where the running head and the folio sit, as the distance from the paper's
   * edge to the **near side of the line** — the top of the head's box and the
   * bottom of the folio's, both set solid, so this is the clear space itself
   * rather than a baseline. Halfway into the margin, so the line neither
   * crowds the text nor the edge, and never under the quarter inch a printer's
   * trim can take off (§3b).
   */
  headFromTop: number;
  footFromBottom: number;
  /** The page count the gutter was worked out for. */
  pages: number;
}

/** Rounded to the nearest sixteenth of an inch, which is what a printer reads. */
const sixteenth = (inches: number): number => Math.round(inches * 16) / 16;

/**
 * The margins, from the published standard (§3b, from Ken: *the proportions
 * need to be appropriate for the book size, here is the standard*).
 *
 * The rule here was a **proportion of the trim** and it was wrong twice over,
 * in opposite directions, which is why a proportion cannot do this job. It
 * gave a paperback too little (a tenth of a 5 in page is 1/2 in of fore-edge
 * whatever the book weighs) and a wide page too much. A floor over the top of
 * it — the last attempt — only moved the error: one pair of numbers for every
 * trim gave a mass-market paperback 3/4 in of fore-edge out of 4¼ in of paper,
 * which is a fifth of the page thrown away on each side.
 *
 * **The standard is a band per page size, not a proportion and not a floor.**
 * A bigger page takes a bigger margin, but not in proportion — the jump from a
 * pocket book to a trade paperback is a quarter of an inch of trim and an
 * eighth of an inch of margin. So this is a table, read by the size of the
 * page:
 *
 * | page size            | inside / gutter | outside | top   | bottom  |
 * | -------------------- | --------------- | ------- | ----- | ------- |
 * | pocket / mass market | 5/8 – 3/4       | 1/2     | 1/2   | 5/8     |
 * | digest / small novel | 3/4 – 7/8       | 1/2–5/8 | 1/2–5/8 | 5/8–3/4 |
 * | US trade             | 3/4 – 9/10      | 1/2–5/8 | 5/8–3/4 | 3/4–7/8 |
 *
 * Three rules decide where in a band a book lands, and all three are the
 * standard's own:
 *
 * **The thicker the book, the wider the gutter** — the inside walks its band
 * as the page count rises, which is the one margin that is not a fact about
 * the trim alone. On a trade paperback the walk is the standard's own
 * schedule: 3/4 in to 150 pages, 13/16 to 300 (its 0.825, said as the nearest
 * sixteenth), 7/8 past that.
 *
 * **The thumb factor** — the outside is never under 1/2 in, or a reader's
 * thumb sits on the words. It is the bottom of every band above rather than a
 * value anything computes.
 *
 * **Optical centring** — the foot is always wider than the head, or the block
 * looks as though it is sinking down the page.
 *
 * Everything lands on the sixteenth the rest of this module speaks in, so a
 * margin prints as a fraction a printer can set. Where a band gives a range
 * this takes its middle, the ends of a range being the standard's tolerance
 * rather than two different right answers — **except the head and the foot**,
 * which the standard ranges over the whole of a book (top 1/2 to 3/4, foot 5/8
 * to 7/8) and then breaks in two rather than by trim row:
 *
 * - **5½ × 8½ and smaller** take the **bottom** of both, 1/2 and 5/8, because
 *   on a small page the point is to maximise the reading space.
 * - **6 × 9 and larger** take the middle of 5/8–3/4 and 3/4–7/8, so the text
 *   block is not swallowed by white borders.
 *
 * That break is why pocket and digest carry the same head and foot while their
 * sides differ: the question a head answers is *how tall is the page*, and the
 * question a fore-edge answers is *where is the thumb*.
 *
 * The third rule the standard states about the head and the foot is about what
 * sits **inside** them, and it is kept in `geometryOf` rather than here: a
 * running head or a folio must clear the paper's edge by **at least 1/4 in**
 * or the printer's trim can take it off.
 */
export type TrimClass = 'pocket' | 'digest' | 'trade' | 'large';

export interface MarginStandard {
  /** What a printer calls a page this size. */
  name: string;
  outside: number;
  top: number;
  bottom: number;
  /** The gutter band: a thin book at one end, a thick one at the other. */
  insideLeast: number;
  insideMost: number;
}

export const MARGIN_STANDARD: Record<TrimClass, MarginStandard> = {
  // The head and the foot break at 5½ × 8½ rather than at each row (§3b): up
  // to that size the standard takes the **bottom** of its own range, to
  // maximise reading space on a small page, so pocket and digest share them.
  pocket: { name: 'a pocket paperback', outside: 0.5, top: 0.5, bottom: 0.625, insideLeast: 0.625, insideMost: 0.75 },
  digest: { name: 'a digest paperback', outside: 0.5625, top: 0.5, bottom: 0.625, insideLeast: 0.75, insideMost: 0.875 },
  trade: { name: 'a trade paperback', outside: 0.625, top: 0.6875, bottom: 0.8125, insideLeast: 0.75, insideMost: 0.9375 },
  // The standard stops at 6 × 9, novels being what it is written for. A
  // workbook is extrapolated from the same shape, said here rather than
  // pretending the table covers it.
  large: { name: 'a textbook or a workbook', outside: 0.75, top: 0.75, bottom: 0.875, insideLeast: 0.875, insideMost: 1.125 },
};

/**
 * Which of the four a trim is, **by area** rather than by width: how much
 * paper is in the hand is what the standard's rows are about, and a tall
 * narrow page and a short wide one of the same area take the same margins.
 * The boundaries fall between the presets — a B format and a 5 × 8 are
 * pocket books, a 5¼ × 8 and an A5 are digest, a Royal is trade.
 */
export const trimClassOf = (trim: Trim): TrimClass => {
  const area = trim.width * trim.height;
  if (area <= 41) return 'pocket';
  if (area <= 50) return 'digest';
  if (area <= 60) return 'trade';
  return 'large';
};

/** The page counts the gutter widens at, and where a count falls among them. */
const PAGE_TIERS = [150, 300, 500, 700] as const;
const tierOf = (pages: number): number => {
  const found = PAGE_TIERS.findIndex((tier) => pages <= tier);
  return found === -1 ? PAGE_TIERS.length : found;
};

/**
 * The inside margin: the band's low end for a thin book, a sixteenth more at
 * each tier, and never past the band's top. A book that grows from two
 * hundred pages to four hundred widens its own gutter with nothing run.
 */
export const insideFor = (trim: Trim, pages: number): number => {
  const band = MARGIN_STANDARD[trimClassOf(trim)];
  return Math.min(band.insideMost, band.insideLeast + tierOf(pages) / 16);
};

/** What the inside carries over the outside — the spine allowance itself. */
export const gutterFor = (trim: Trim, pages: number): number =>
  insideFor(trim, pages) - MARGIN_STANDARD[trimClassOf(trim)].outside;

/**
 * A page larger than the standard describes. The table's widest row is a
 * workbook; a custom trim bigger than that would take a workbook's margins
 * and look starved, so the old proportion comes back as a **floor on the
 * sides alone** — the two edges a thumb and a binding take. The coefficient
 * is set so this never bites on any trim in the list.
 */
const OVERSIZE = 0.088;

/**
 * The margins a trim proposes (§3, §3b): the table above, read by the size of
 * the page and the thickness of the book. Nothing is stored — a trim changed
 * in the room re-reads the whole of this.
 */
export const derivedMargins = (
  trim: Trim,
  pages: number,
): { inside: number; outside: number; top: number; bottom: number } => {
  const band = MARGIN_STANDARD[trimClassOf(trim)];
  const outside = Math.max(band.outside, sixteenth(trim.width * OVERSIZE));
  const standard = insideFor(trim, pages);
  // Where the page was too big for the table and the fore-edge grew, the
  // gutter grows with it rather than being eaten by it.
  const inside = Math.max(standard, outside + (standard - band.outside));
  return { inside, outside, top: band.top, bottom: band.bottom };
};

/** The leading a size proposes: a third again, to the nearest half point. */
export const derivedLeading = (size: number): number => Math.round(size * 1.35 * 2) / 2;

/**
 * About how wide a character is, in ems, for saying how many fit on a line.
 * An average over ordinary English text in each kind of face; a reading
 * for the inspector's sentence and the measure warning, never for a break.
 */
const CHAR_EMS: Record<BookFace, number> = {
  old_style: 0.47,
  transitional: 0.46,
  modern: 0.45,
  sans: 0.5,
  // Garamond sets narrow and Georgia wide, which is most of why one needs a
  // point more than the other to read the same.
  garamond: 0.44,
  baskerville: 0.46,
  georgia: 0.5,
  caslon: 0.46,
  gill_sans: 0.47,
  lato: 0.48,
  // Whatever the document said, which the sentence cannot know; the fallback's.
  imported: 0.47,
};

export const geometryOf = (settings: BookSettings, format: ProjectFormat, pages: number): BookGeometry => {
  const trim = trimOf(settings, format);
  const derived = derivedMargins(trim, Math.max(1, pages));
  const chosen = settings.margins;
  const margins = {
    inside: chosen.inside ?? derived.inside,
    outside: chosen.outside ?? derived.outside,
    top: chosen.top ?? derived.top,
    bottom: chosen.bottom ?? derived.bottom,
  };
  const overridden = {
    inside: chosen.inside !== null,
    outside: chosen.outside !== null,
    top: chosen.top !== null,
    bottom: chosen.bottom !== null,
  };
  const text = {
    width: Math.max(0, trim.width - margins.inside - margins.outside),
    height: Math.max(0, trim.height - margins.top - margins.bottom),
  };
  const size = settings.size;
  const leading = settings.leading ?? derivedLeading(size);
  const linesPerPage = Math.max(0, Math.floor((text.height * 72) / leading));
  const measure = Math.round((text.width * 72) / (size * (CHAR_EMS[settings.face] ?? 0.47)));
  return {
    trim,
    margins,
    overridden,
    text,
    size,
    leading,
    linesPerPage,
    measure,
    headFromTop: Math.max(0.25, margins.top / 2),
    footFromBottom: Math.max(0.25, margins.bottom / 2),
    pages: Math.max(1, pages),
  };
};

/**
 * A first guess at the page count, for the gutter before anything has been
 * laid: a novel runs about three hundred words to a page at a common trim,
 * and every chapter opening costs a page and a half on average. Said so in
 * the name — the laid count replaces it the moment there is one.
 */
export const estimatedPages = (wordCount: number, chapters: number): number =>
  Math.max(1, Math.ceil(wordCount / 300) + Math.ceil(chapters * 1.5));

// ------------------------------------------------------------- in words

const fraction = (inches: number): string => {
  const whole = Math.floor(inches);
  const part = Math.round((inches - whole) * 16);
  if (part === 0) return `${whole}`;
  if (part === 16) return `${whole + 1}`;
  const glyphs: Record<number, string> = {
    2: '⅛',
    4: '¼',
    6: '⅜',
    8: '½',
    10: '⅝',
    12: '¾',
    14: '⅞',
  };
  const glyph = glyphs[part];
  const tail = glyph ?? `${part}/16`;
  return whole === 0 ? tail : `${whole}${glyph ? '' : ' '}${tail}`;
};

/**
 * The spine, in words (§3, from Ken: *there's an adjustment made to
 * compensate at the centre spine, and it should be automatic*). It is: the
 * inside margin carries the outside plus what the binding swallows, read
 * from the page count every time the book is laid, and the sentence says
 * what it carries now and when it next widens — or that a typed inside
 * margin has taken the working-out away.
 */
export const describeSpine = (geometry: BookGeometry): string => {
  if (geometry.overridden.inside) {
    return 'The inside margin is typed, so nothing is being added for the spine. Clear it to have the allowance worked out from the page count again.';
  }
  const { trim, pages } = geometry;
  const band = MARGIN_STANDARD[trimClassOf(trim)];
  const gutter = gutterFor(trim, pages);
  const next = PAGE_TIERS.find((tier) => pages <= tier);
  const wider = next === undefined ? null : insideFor(trim, next + 1);
  const growth =
    wider === null || wider === insideFor(trim, pages)
      ? 'It is as wide as the standard takes it.'
      : `Past ${next} pages it widens to ${fraction(wider)} in by itself.`;
  return (
    `The standard for ${band.name} puts the inside margin between ${fraction(band.insideLeast)} and ${fraction(band.insideMost)} in. ` +
    `At ${pages} ${pages === 1 ? 'page' : 'pages'} it is ${fraction(geometry.margins.inside)} in, which is ${fraction(gutter)} in more than the ` +
    `fore-edge for the spine, so the text clears the binding on every page. ${growth}`
  );
};

/** A trim as a printer names it: *5½ × 8½ in*, or the preset's name. */
export const describeTrim = (trim: Trim): string => trimPresetOf(trim)?.name ?? `${fraction(trim.width)} × ${fraction(trim.height)} in`;

/**
 * The geometry in words, for the inspector: what was chosen, what was
 * worked out from it, and what that comes to on a page. The sentence says
 * *worked out* or *typed* for the margins, so a writer can see what an
 * override is overriding.
 */
export const describeGeometry = (geometry: BookGeometry, face: BookFace): string => {
  const { margins, overridden } = geometry;
  const anyTyped = Object.values(overridden).some(Boolean);
  const how = anyTyped
    ? 'Margins partly typed'
    : `Margins worked out from the trim and ${geometry.pages} ${geometry.pages === 1 ? 'page' : 'pages'}`;
  const edge = (name: keyof typeof margins) =>
    `${name} ${fraction(margins[name])} in${overridden[name] ? ' (typed)' : ''}`;
  return (
    `${describeTrim(geometry.trim)}. ${how}: ${edge('inside')}, ${edge('outside')}, ${edge('top')}, ${edge('bottom')}. ` +
    `${geometry.linesPerPage} lines of ${FACE_NAMES[face].toLowerCase()} at ${geometry.size} on ${geometry.leading} pt, ` +
    `about ${geometry.measure} characters to the line.`
  );
};

/**
 * Whether the line is comfortable to read (§3). A measure much over
 * seventy-five characters loses the eye on the way back, and one much under
 * forty-five breaks every sentence twice; the room says so rather than
 * letting it happen quietly.
 */
export const measureWarning = (geometry: BookGeometry): string | null => {
  if (geometry.measure > 75) {
    return `About ${geometry.measure} characters to the line is a long line to read: a larger size, or wider margins, would shorten it.`;
  }
  if (geometry.measure < 45 && geometry.measure > 0) {
    return `About ${geometry.measure} characters to the line is a short line: a smaller size, or narrower margins, would lengthen it.`;
  }
  return null;
};
