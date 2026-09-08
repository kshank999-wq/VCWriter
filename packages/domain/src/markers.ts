import { unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { ProjectFormat } from './entities/project.js';
import type { StoryMarker, StoryMarkerKind } from './entities/structure.js';

/**
 * Markers: the points a writer puts in the story, and what they are called
 * (addendum 02 §11).
 *
 * Every format has them and every format means something different by them.
 * A screenplay's are **acts**, and what hangs off one is a note — there is no
 * page to design, because a script does not print a leaf between acts. A
 * novel's are **chapters**, and each can open a page of its own. A short
 * story's are chapters too, numbered in Roman numerals as short stories
 * conventionally are.
 *
 * The numbering is a project setting rather than a property of each marker,
 * because a book whose chapters are numbered three different ways is not a
 * book. What the writer types in a marker's title is *beside* the number, not
 * instead of it.
 */

export type MarkerNumbering = 'numeric' | 'roman' | 'roman_lower' | 'letters' | 'words' | 'symbol' | 'none';

export const MARKER_NUMBERINGS: ReadonlyArray<{ value: MarkerNumbering; label: string; example: string }> = [
  { value: 'numeric', label: 'Numbers', example: '4' },
  { value: 'roman', label: 'Roman numerals', example: 'IV' },
  { value: 'roman_lower', label: 'Roman, lower case', example: 'iv' },
  { value: 'letters', label: 'Letters', example: 'D' },
  { value: 'words', label: 'Words', example: 'Four' },
  { value: 'symbol', label: 'A symbol', example: '❦' },
  { value: 'none', label: 'No number', example: '' },
];

/** What a format calls its markers, and how they are numbered, before the writer says otherwise. */
export const defaultMarkerKind = (format: ProjectFormat): StoryMarkerKind =>
  format === 'series' ? 'episode' : format === 'novel' || format === 'short_story' ? 'chapter' : 'act';

export const defaultMarkerNumbering = (format: ProjectFormat): MarkerNumbering => {
  // A short story's sections are numbered I, II, III by long convention; a
  // screenplay's acts likewise. A novel counts its chapters, and so does a
  // series count its episodes — nobody writes "Episode IV" on a call sheet.
  if (format === 'novel' || format === 'series') return 'numeric';
  return 'roman';
};

/**
 * Whether this format prints a leaf ahead of each division. A book puts one
 * between chapters and an episodic script puts a title card in front of each
 * episode; a feature has nothing of the kind between its acts.
 */
export const hasChapterPages = (format: ProjectFormat): boolean =>
  format === 'novel' || format === 'short_story' || format === 'series';

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export const toRoman = (value: number): string => {
  if (!Number.isFinite(value) || value < 1) return '';
  let left = Math.floor(value);
  let out = '';
  for (const [amount, glyph] of ROMAN) {
    while (left >= amount) {
      out += glyph;
      left -= amount;
    }
  }
  return out;
};

/** A, B … Z, AA, AB — the spreadsheet column scheme, which never runs out. */
export const toLetters = (value: number): string => {
  if (!Number.isFinite(value) || value < 1) return '';
  let left = Math.floor(value);
  let out = '';
  while (left > 0) {
    const remainder = (left - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    left = Math.floor((left - 1) / 26);
  }
  return out;
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = [
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** "Chapter Thirty-Two", which plenty of books use and no library gives you. */
export const toWords = (value: number): string => {
  if (!Number.isFinite(value) || value < 1) return '';
  const whole = Math.floor(value);
  if (whole >= 1000) return String(whole);
  const hundreds = Math.floor(whole / 100);
  const rest = whole % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest >= 20) {
    const tens = TENS[Math.floor(rest / 10)] as string;
    const ones = ONES[rest % 10] as string;
    parts.push(ones ? `${tens}-${ones}` : tens);
  } else if (rest >= 10) {
    parts.push(TEENS[rest - 10] as string);
  } else if (rest > 0) {
    parts.push(ONES[rest] as string);
  }
  return parts.join(' ');
};

/** The number itself, in the scheme asked for. */
export const markerNumber = (position: number, numbering: MarkerNumbering, symbol = '❦'): string => {
  switch (numbering) {
    case 'numeric':
      return String(position);
    case 'roman':
      return toRoman(position);
    case 'roman_lower':
      return toRoman(position).toLowerCase();
    case 'letters':
      return toLetters(position);
    case 'words':
      return toWords(position);
    case 'symbol':
      // Every one the same: a symbol says *a break happens here*, not which.
      return symbol;
    case 'none':
      return '';
  }
};

/** What a marker of this kind is called before its number: "Chapter 4". */
export const markerNoun = (kind: StoryMarkerKind): string =>
  kind === 'chapter'
    ? 'Chapter'
    : kind === 'episode'
      ? 'Episode'
      : kind === 'part'
        ? 'Part'
        : kind === 'sequence'
          ? 'Sequence'
          : kind === 'note'
            ? ''
            : 'Act';

export interface MarkerNumbers {
  numbering: MarkerNumbering;
  symbol: string;
}

/** Empty means "whatever this format does", which is the setting's default. */
const settingsOf = (file: ProjectFile): MarkerNumbers => ({
  numbering: (file.settings.markerNumbering as MarkerNumbering) || defaultMarkerNumbering(file.project.format),
  symbol: file.settings.markerSymbol || '❦',
});

/** The scheme in force, whether it was chosen or inherited from the format. */
export const markerNumbering = (file: ProjectFile): MarkerNumbering => settingsOf(file).numbering;

/**
 * The markers of a project in story order, each with the position it holds
 * among markers of its own kind — so a chapter is the fourth chapter whether
 * or not there are parts interleaved with it.
 */
export interface PlacedMarker {
  marker: StoryMarker;
  /** 1-based, among the markers of the same kind. */
  position: number;
  /** Where it sits in the story: the index of the unit it is anchored to. */
  unitIndex: number;
  /** "Chapter 4", "ACT II", "IV" — what to draw on it and print at its head. */
  label: string;
  /** Just the number part, for a page that shows the two separately. */
  number: string;
}

export const placedMarkers = (file: ProjectFile): PlacedMarker[] => {
  const order = unitsInStoryOrder(file);
  const indexOf = new Map(order.map((unit, index) => [unit.id as string, index]));
  const { numbering, symbol } = settingsOf(file);

  const inOrder = file.markers
    .filter((marker) => indexOf.has(marker.unitId as string))
    .sort((a, b) => (indexOf.get(a.unitId as string) ?? 0) - (indexOf.get(b.unitId as string) ?? 0));

  const counts = new Map<StoryMarkerKind, number>();
  return inOrder.map((marker) => {
    const position = (counts.get(marker.kind) ?? 0) + 1;
    counts.set(marker.kind, position);
    const number = markerNumber(position, numbering, symbol);
    const noun = markerNoun(marker.kind);
    // A screenplay prints ACT TWO in capitals; a book prints Chapter Two.
    // A script prints ACT TWO and EPISODE 2 in capitals; a book prints
    // Chapter Two.
    const shouts = marker.kind === 'act' || marker.kind === 'episode';
    const head = shouts ? `${noun} ${number}`.trim().toUpperCase() : `${noun} ${number}`.trim();
    return {
      marker,
      position,
      unitIndex: indexOf.get(marker.unitId as string) ?? 0,
      number,
      label: head.length > 0 ? head : marker.title,
      };
  });
};

/** The marker anchored to a unit, with its number and label worked out. */
export const placedMarkerForUnit = (file: ProjectFile, unitId: string): PlacedMarker | undefined =>
  placedMarkers(file).find((placed) => (placed.marker.unitId as string) === unitId);

/**
 * A project file's project title and a chapter page's own words, ready to
 * draw. The label is the marker's, and `title` is what the writer named it —
 * both are optional on the page, and a page that shows neither is a device
 * on a blank leaf, which is a real thing books do.
 */
export interface ChapterPageContent {
  label: string;
  title: string;
  epigraph: string;
  image: { dataUrl: string; name: string; width: number } | null;
  align: 'left' | 'center';
}

export const chapterPageContent = (placed: PlacedMarker): ChapterPageContent => ({
  label: placed.marker.page.showNumber ? placed.label : '',
  title: placed.marker.page.showTitle ? placed.marker.title : '',
  epigraph: placed.marker.page.epigraph,
  image: placed.marker.page.image,
  align: placed.marker.page.align,
});

/**
 * The chapter pages a printing should carry, in story order — none at all
 * for a format that has no such thing, or when the printing asks for them to
 * be left out.
 */
export const chapterPagesFor = (
  file: ProjectFile,
  options: { includeChapterPages?: boolean } = {},
): PlacedMarker[] => {
  if (!hasChapterPages(file.project.format)) return [];
  const wanted = options.includeChapterPages ?? file.settings.includeChapterPagesInExport ?? true;
  if (!wanted) return [];
  return placedMarkers(file).filter((placed) => placed.marker.page.include);
};

/** A cap on what can be pasted onto a chapter page: the project is a text file. */
export const MAX_CHAPTER_IMAGE_BYTES = 5 * 1024 * 1024;
