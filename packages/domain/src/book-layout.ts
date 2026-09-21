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
  // The stack a paragraph falls back to where the document named no face.
  imported: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
};

export const FACE_NAMES: Record<BookFace, string> = {
  old_style: 'Old-style serif',
  transitional: 'Transitional serif',
  modern: 'Modern serif',
  sans: 'Sans serif',
  imported: 'As imported',
};

export const FACE_NOTES: Record<BookFace, string> = {
  old_style: 'Palatino, Iowan — what most novels are set in',
  transitional: 'Baskerville, Times — a little crisper',
  modern: 'Didot, Bodoni — high contrast; best at larger sizes',
  sans: 'Helvetica — for a textbook or a manual',
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
    runningHeads: { verso: 'author', recto: 'chapter' },
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
    runningHeads: { verso: 'title', recto: 'chapter' },
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
    runningHeads: { verso: 'title', recto: 'chapter' },
    folio: 'foot_centre',
    folioOnOpening: true,
  },
};

export const PRESET_INFO: Record<BookPreset, { name: string; about: string }> = {
  classic: { name: 'Classic', about: 'old-style serif, small capitals to open, a blank line between scenes, folios at the outer foot' },
  modern: { name: 'Modern', about: 'transitional serif, a drop cap, chapters on either page, folios at the outer head' },
  textbook: { name: 'Textbook', about: 'sans serif, ragged right, no hyphenation, folios at the centre foot' },
};

/** Which preset the settings match whole, or null where a field was changed by hand. */
export const bookPresetOf = (settings: BookSettings): BookPreset | null => {
  for (const preset of BOOK_PRESET_NAMES) {
    const fields = BOOK_PRESETS[preset];
    const same = (Object.keys(fields) as (keyof PresetFields)[]).every((key) =>
      key === 'runningHeads'
        ? settings.runningHeads.verso === fields.runningHeads.verso && settings.runningHeads.recto === fields.runningHeads.recto
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
   * Where the running head's baseline and the folio's sit, as a distance from
   * the paper's top and bottom edges. Halfway into the margin, so the head
   * neither crowds the text nor the edge.
   */
  headFromTop: number;
  footFromBottom: number;
  /** The page count the gutter was worked out for. */
  pages: number;
}

/** Rounded to the nearest sixteenth of an inch, which is what a printer reads. */
const sixteenth = (inches: number): number => Math.round(inches * 16) / 16;

/**
 * The extra a thick book needs on the inside, because the binding swallows
 * it. The tiers are the ones print-on-demand houses publish, which is the
 * one place a number here comes from outside this file.
 */
export const gutterFor = (pages: number): number => {
  if (pages <= 150) return 0.125;
  if (pages <= 300) return 0.25;
  if (pages <= 500) return 0.375;
  if (pages <= 700) return 0.5;
  return 0.625;
};

/**
 * The margins a trim proposes (§3): the outside a tenth of the width, the
 * head a twelfth of the height, the foot a little more than the head so the
 * block sits high on the page as a book's does, and the inside the outside
 * plus the gutter. Never less than three-eighths at any edge, which is what
 * a printer will trim to.
 */
export const derivedMargins = (
  trim: Trim,
  pages: number,
): { inside: number; outside: number; top: number; bottom: number } => {
  const outside = Math.max(0.375, sixteenth(trim.width * 0.105));
  const top = Math.max(0.375, sixteenth(trim.height * 0.083));
  const bottom = Math.max(0.375, sixteenth(trim.height * 0.097));
  const inside = sixteenth(outside + gutterFor(pages));
  return { inside, outside, top, bottom };
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
  const gutter = gutterFor(geometry.pages);
  const tiers = [150, 300, 500, 700];
  const next = tiers.find((tier) => geometry.pages <= tier);
  const growth = next === undefined ? 'It is at its widest.' : `Past ${next} pages it widens to ${fraction(gutterFor(next + 1))} in by itself.`;
  return `The inside margin carries an extra ${fraction(gutter)} in for the spine, worked out from ${geometry.pages} ${geometry.pages === 1 ? 'page' : 'pages'}, so the text clears the binding on every page. ${growth}`;
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
