import type { ManuscriptElement } from './entities/manuscript.js';
import type { ProjectFormat } from './entities/project.js';
import { isProseFormat } from './formats.js';

/**
 * **How a line of the manuscript is set** (addendum 02 §19a, from Ken: *I
 * imported some text that was italicized and I realized that there's no way
 * to adjust the style of the text in the beats. So you need to be able to
 * bold, italicize, or underline. and be able to justify it left, right, or
 * center… And even change the color and size of the text*).
 *
 * **The audit paid here before a line was written, and paid nearly all of
 * it.** Emphasis has been built since spec §6 — `entities/inline.ts` writes
 * Fountain's own `**bold**`, `*italic*` and `_underline_` into the text, the
 * writing screen draws them, the print reads them, and Ctrl/Cmd+B, I and U
 * have put them on the selection since the beat editor was written. And
 * **alignment, face and size have been on the element and in the printed
 * book since addendum 21 §3**: the Word importer writes them into
 * `attributes` and `book-plan.ts`'s own `setting()` reads them onto the
 * block.
 *
 * So almost nothing here is a new fact about a manuscript. What was missing
 * is **a way in** — every one of those was written by the importer and
 * reachable by nobody, and the keys were reachable only by somebody who
 * already knew they were there, which is addendum 29 §2's lesson (*the act
 * worked, every test passed, and there was no way to see it was there*).
 *
 * ## Two kinds of thing, and the line between them
 *
 * **A mark is the selection's and the type is the line's.** Bold, italic and
 * underline go round the words a writer picked, because they are characters
 * in the text and travel with it — into Fountain, into the eBook, into a
 * paste. Alignment, size and colour are the **paragraph's**, because the
 * manuscript is a list of typed elements whose text is plain text (§14): an
 * inline colour would have to invent a mark this program's own export
 * formats have never heard of, and it would print into them.
 *
 * That is not a limitation dressed up as a rule — it is what keeps a project
 * file readable, diffable and convertible without a rich-text engine, which
 * is the sentence `entities/inline.ts` opens with.
 */

// ---------------------------------------------------------------------------
// Where the words are ranged
// ---------------------------------------------------------------------------

/**
 * The four a paragraph may be ranged (Ken's *justify it left, right, or
 * center*, with justified beside them because a book's body is very often
 * justified and a writer wanting one paragraph ranged left has to be able to
 * say so).
 *
 * `left` is stored like any other: the default is **absent**, not `left`, so
 * a paragraph nobody has ranged goes on taking the book's own alignment and
 * the markup of an existing book is unchanged.
 */
export const PARAGRAPH_ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export type ParagraphAlign = (typeof PARAGRAPH_ALIGNS)[number];

export const ALIGN_WORDS: Record<ParagraphAlign, string> = {
  left: 'Left',
  center: 'Centred',
  right: 'Right',
  justify: 'Justified',
};

const isAlign = (value: unknown): value is ParagraphAlign =>
  typeof value === 'string' && (PARAGRAPH_ALIGNS as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// How big
// ---------------------------------------------------------------------------

/**
 * The sizes offered, in points. A free number box was weighed and refused:
 * what a writer wants here is *bigger than the body* or *smaller than it*,
 * and a list they can read is a better control than a box that will take 7.5
 * and print a line nobody can read.
 *
 * **Nothing is the default**, which is the book's own body size — set in
 * Layout, one size for the whole book, and what every paragraph takes until
 * somebody says otherwise.
 */
export const TEXT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36] as const;

export const MIN_TEXT_SIZE = TEXT_SIZES[0];
export const MAX_TEXT_SIZE = TEXT_SIZES[TEXT_SIZES.length - 1];

// ---------------------------------------------------------------------------
// What colour
// ---------------------------------------------------------------------------

/**
 * The inks offered.
 *
 * **An ink is chosen on one screen and read on another**, which is the one
 * rule here that is not obvious: the writing screen may be dark ink on white
 * paper or white on dark depending on the gear, the Layout room draws white
 * paper always, and the printed book *is* white paper. So every offered ink
 * is a mid-tone that reads against both, and there is **no white and no
 * black** — white would be a paragraph that vanishes when it prints, and
 * black is what the default already is.
 *
 * The custom swatch beside them is a writer's own, and the control draws it
 * against **paper** rather than against the screen's background, for the
 * same reason.
 */
export interface TextInk {
  /** What is stored, and what prints. */
  value: string;
  label: string;
}

export const TEXT_INKS: readonly TextInk[] = [
  { value: '#b4232a', label: 'Red' },
  { value: '#1f5fa9', label: 'Blue' },
  { value: '#1d6b45', label: 'Green' },
  { value: '#6b3fa0', label: 'Purple' },
  { value: '#9a5b1e', label: 'Brown' },
  { value: '#6b6b6b', label: 'Grey' },
];

/** A colour this program will store: `#rgb` or `#rrggbb`, and nothing else. */
export const isInkColour = (value: unknown): value is string =>
  typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

// ---------------------------------------------------------------------------
// What a line is set in, read and written
// ---------------------------------------------------------------------------

/**
 * **Who set it.** `attributes.face` and `attributes.size` have meant *what
 * the document this came from said* since the Word importer was built, and
 * the book honours those only under the **As imported** face — under any
 * other the book is set in one face, which is what choosing one means
 * (addendum 21 §3, `blockStyle`'s own rule).
 *
 * That rule is right about an import and wrong about a writer: a size
 * somebody deliberately chose in the beat is not Word's accidental Calibri
 * on four hundred paragraphs, and dropping it because the book is set in
 * Garamond would read as the control not working. So **one field carries the
 * fact and a second says where it came from** — `found`'s shape (addendum 25
 * §2): a fact about provenance, never a status, written by the toolbar and
 * never by the importer, so nothing already imported changes.
 */
export const TYPE_FROM_WRITER = 'writer';

export const setByWriter = (element: ManuscriptElement): boolean =>
  element.attributes['typeFrom'] === TYPE_FROM_WRITER;

/** How a line is set, as the controls read it: null is *the book's own*. */
export interface LineType {
  align: ParagraphAlign | null;
  size: number | null;
  colour: string | null;
}

export const lineTypeOf = (element: ManuscriptElement): LineType => {
  const { align, size, color } = element.attributes;
  return {
    align: isAlign(align) ? align : null,
    size: typeof size === 'number' && size > 0 ? size : null,
    colour: isInkColour(color) ? color.trim().toLowerCase() : null,
  };
};

/**
 * A line set as the patch says, with **null clearing the field outright**
 * rather than writing a default into it.
 *
 * That is the whole of what keeps this additive: an element nobody has
 * touched carries none of these attributes, so it measures, lays out and
 * prints byte for byte as it did — `partStyleOf`'s and `bookPresetOf`'s rule
 * (*only what differs is stored*) pointed at a paragraph.
 */
export const withLineType = (element: ManuscriptElement, patch: Partial<LineType>): ManuscriptElement => {
  const attributes: ManuscriptElement['attributes'] = { ...element.attributes };
  const set = (key: string, value: string | number | null | undefined, keep: boolean) => {
    if (value === undefined) return;
    if (value === null || !keep) delete attributes[key];
    else attributes[key] = value;
  };

  set('align', patch.align, patch.align !== null && isAlign(patch.align));
  set('size', patch.size, typeof patch.size === 'number' && patch.size > 0);
  set(
    'color',
    typeof patch.colour === 'string' ? patch.colour.trim().toLowerCase() : patch.colour,
    isInkColour(patch.colour),
  );

  /**
   * The stamp goes on when a **size** is set and comes off when the last one
   * goes, because the size is the one field whose meaning turns on who chose
   * it. Alignment is honoured whatever the book is set in and a colour has
   * no importer behind it at all, so neither needs the stamp — and writing it
   * for them would be claiming a provenance about fields that never had one.
   */
  if ('size' in patch) {
    if (typeof attributes['size'] === 'number') attributes['typeFrom'] = TYPE_FROM_WRITER;
    else delete attributes['typeFrom'];
  }

  return { ...element, attributes };
};

// ---------------------------------------------------------------------------
// Which formats get which half
// ---------------------------------------------------------------------------

/**
 * **Emphasis is every format's and the type is prose's** — which is the split
 * Ken's own sentence makes (*especially for novels, short stories, and
 * instructional books. That will not be needed in scripts, episodic, or short
 * form*).
 *
 * Bold, italic and underline are Fountain's own marks: a screenplay uses them,
 * the keys have put them on every format since the editor was written, and
 * drawing three buttons for an act that already works everywhere costs a
 * screenwriter nothing and is strictly better than a key nobody knows about.
 *
 * The **type** is a different matter. A screenplay's geometry is the format's
 * — Courier, a character grid, a fixed measure — and a paragraph set in 18
 * point and centred is not a screenplay; a short-form board is a sheet of
 * timings. So those controls are **absent rather than greyed** there, this
 * room's own idiom for *this does not apply here*.
 */
export const mayMarkText = (_format: ProjectFormat): boolean => true;

export const maySetType = (format: ProjectFormat): boolean => isProseFormat(format);

/**
 * The one sentence that says where the line between the two halves falls,
 * said on the screen rather than discovered by pressing — a writer who
 * selects three words and presses **Centred** otherwise finds the whole
 * paragraph moves and has no way to know why.
 */
export const TYPE_REACH_NOTE =
  'Bold, italic and underline go round the words you have picked. The rest is the whole paragraph the cursor is in.';
