import { beatsInScript, unitsInStoryOrder } from './selectors.js';
import { groupManuscript } from './editing.js';
import { parseInline, type InlineSpan, type InlineStyle } from './entities/inline.js';
import type { ManuscriptElement, ManuscriptElementType } from './entities/manuscript.js';
import type { ProjectFormat } from './entities/project.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';

/**
 * Page layout for screenplays and prose manuscripts (spec §6).
 *
 * A screenplay page is a fixed physical object: 12pt Courier on US Letter is
 * 10 characters to the inch and 6 lines to the inch, which with 1" top and
 * bottom margins gives 55 lines, and with a 1.5" left and 1" right margin
 * gives a 60-character text column. Every indent and width below is that
 * geometry expressed in characters, which is why a page count from this engine
 * means what the industry means by "a page".
 *
 * The preview, the print stylesheet and the PDF export all read this one
 * layout, so they cannot drift apart.
 */

export interface PageLayoutSpec {
  linesPerPage: number;
  /** Column each element starts at, measured from the left of the text area. */
  indent: Record<string, number>;
  /** Characters per line before wrapping. */
  width: Record<string, number>;
  /** Element types rendered in capitals. */
  uppercase: ReadonlySet<string>;
  /** Prose is double spaced; screenplays are not. */
  doubleSpaced: boolean;
  columns: number;
  /**
   * Two speeches printed side by side. Absent in a format that has no
   * dialogue to speak of.
   */
  dual?: {
    /** Characters in each of the two columns. */
    width: number;
    /** Characters between them. */
    gap: number;
    /** Indent of each element within its column. */
    indent: Record<string, number>;
  };
}

export const SCREENPLAY_LAYOUT: PageLayoutSpec = {
  linesPerPage: 55,
  columns: 60,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 0,
    shot: 0,
    general: 0,
    character: 22,
    parenthetical: 16,
    dialogue: 10,
    transition: 45,
  },
  width: {
    scene_heading: 60,
    action: 60,
    shot: 60,
    general: 60,
    character: 38,
    parenthetical: 25,
    dialogue: 35,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  // Two 27-character columns with 6 between them: the 60-character body,
  // halved, with each speech's cue sitting over its own column.
  dual: {
    width: 27,
    gap: 6,
    indent: { character: 8, parenthetical: 3, dialogue: 0 },
  },
};

export const PROSE_LAYOUT: PageLayoutSpec = {
  // Standard manuscript format: 12pt Courier, double spaced, ~25 lines a page.
  linesPerPage: 25,
  columns: 60,
  doubleSpaced: true,
  indent: { paragraph: 5, heading: 0, blockquote: 5, scene_break: 28 },
  width: { paragraph: 60, heading: 60, blockquote: 55, scene_break: 5 },
  uppercase: new Set(['heading']),
};

export const layoutFor = (format: ProjectFormat): PageLayoutSpec =>
  format === 'novel' || format === 'short_story' ? PROSE_LAYOUT : SCREENPLAY_LAYOUT;

export interface PageLine {
  text: string;
  type: ManuscriptElementType | 'blank' | 'more' | 'continued';
  indent: number;
  /**
   * The same characters as `text`, carrying the emphasis they were written
   * with. Renderers that can show bold and italic draw these; anything that
   * cannot use `text` and loses nothing but the styling.
   */
  spans: InlineSpan[];
}

export interface Page {
  number: number;
  lines: PageLine[];
  /**
   * The manuscript element the page opens with, so an editor showing the
   * text as a flow can draw the page breaks where the printed page puts
   * them. Null when nothing was laid out.
   */
  startsWith: string | null;
}

/** Greedy wrap at `width`, breaking on spaces and never mid-word when avoidable. */
export const wrapText = (text: string, width: number): string[] => {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      if (current.length === 0) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
      // A single word longer than the column has to be broken somewhere.
      while (current.length > width) {
        lines.push(current.slice(0, width));
        current = current.slice(width);
      }
    }
    if (current.length > 0) lines.push(current);
  }

  return lines;
};

interface Block {
  /** The element this block came from, so a page can name where it starts. */
  id: string;
  type: ManuscriptElementType;
  lines: string[];
  /** The emphasis on each of those lines, character for character. */
  spans: InlineSpan[][];
  indent: number;
  /**
   * A scene heading or character cue must not be the last thing on a page —
   * the reader would turn over to find the content it introduces.
   */
  keepWithNext: boolean;
  /** Dialogue may be split across pages with (MORE) / (CONT'D). */
  splittable: boolean;
  /** The speaker, so a continuation can be labelled. */
  speaker: string | null;
}

const MIN_SPLIT_LINES = 2;

const sameStyle = (a: InlineStyle, b: InlineStyle): boolean =>
  Boolean(a.bold) === Boolean(b.bold) &&
  Boolean(a.italic) === Boolean(b.italic) &&
  Boolean(a.underline) === Boolean(b.underline);

/**
 * Wrap a written line to the column and keep its emphasis on the characters
 * it belongs to. Wrapping is done on the printed text — the marks take no
 * room on the page — and the styles are carried across by walking the two
 * strings together, which works because wrapping only ever changes spaces.
 */
const layoutText = (
  raw: string,
  width: number,
  uppercase: boolean,
): { lines: string[]; spans: InlineSpan[][] } => {
  const styles: InlineStyle[] = [];
  let plain = '';
  for (const span of parseInline(raw)) {
    const text = uppercase ? span.text.toUpperCase() : span.text;
    plain += text;
    for (let index = 0; index < text.length; index += 1) {
      styles.push({ bold: span.bold, italic: span.italic, underline: span.underline });
    }
  }

  const lines = wrapText(plain, width);
  const spans: InlineSpan[][] = [];
  let cursor = 0;
  for (const line of lines) {
    const row: InlineSpan[] = [];
    for (const character of line) {
      while (cursor < plain.length && plain[cursor] !== character) cursor += 1;
      const style = styles[cursor] ?? {};
      const last = row[row.length - 1];
      if (last && sameStyle(last, style)) last.text += character;
      else row.push({ text: character, ...style });
      cursor += 1;
    }
    spans.push(row);
  }
  return { lines, spans };
};

const toBlock = (element: ManuscriptElement, layout: PageLayoutSpec, speaker: string | null): Block => {
  const width = layout.width[element.type] ?? layout.columns;
  const indent = layout.indent[element.type] ?? 0;
  const { lines, spans } = layoutText(element.text, width, layout.uppercase.has(element.type));
  return {
    id: element.id,
    type: element.type,
    lines,
    spans,
    indent,
    keepWithNext: element.type === 'scene_heading' || element.type === 'character' || element.type === 'parenthetical',
    splittable: element.type === 'dialogue',
    speaker,
  };
};

/**
 * Two speeches printed side by side (addendum 02 §7.1). Each column is laid
 * out on its own and the two are set into one block of lines, so the page
 * flow below needs to know nothing about it: to the paginator a dual speech
 * is one wide block that does not split.
 */
const toDualBlock = (
  left: readonly ManuscriptElement[],
  right: readonly ManuscriptElement[],
  layout: PageLayoutSpec,
): Block => {
  const dual = layout.dual as NonNullable<PageLayoutSpec['dual']>;
  const column = (elements: readonly ManuscriptElement[]) => {
    const rows: { text: string; spans: InlineSpan[]; indent: number }[] = [];
    for (const element of elements) {
      if (element.text.trim().length === 0) continue;
      const indent = dual.indent[element.type] ?? 0;
      const { lines, spans } = layoutText(element.text, dual.width - indent, layout.uppercase.has(element.type));
      lines.forEach((text, position) => rows.push({ text, spans: spans[position] ?? [], indent }));
    }
    return rows;
  };

  const leftRows = column(left);
  const rightRows = column(right);
  const lines: string[] = [];
  const spans: InlineSpan[][] = [];
  const columnWidth = dual.width + dual.gap;

  for (let index = 0; index < Math.max(leftRows.length, rightRows.length); index += 1) {
    const leftRow = leftRows[index];
    const rightRow = rightRows[index];
    const leftText = leftRow ? ' '.repeat(leftRow.indent) + leftRow.text : '';
    const rightText = rightRow ? ' '.repeat(rightRow.indent) + rightRow.text : '';
    lines.push(rightText.length > 0 ? leftText.padEnd(columnWidth) + rightText : leftText);

    const row: InlineSpan[] = [];
    if (leftRow) {
      if (leftRow.indent > 0) row.push({ text: ' '.repeat(leftRow.indent) });
      row.push(...leftRow.spans);
    }
    if (rightText.length > 0) {
      const gap = columnWidth - leftText.length;
      if (gap > 0) row.push({ text: ' '.repeat(gap) });
      if (rightRow && rightRow.indent > 0) row.push({ text: ' '.repeat(rightRow.indent) });
      if (rightRow) row.push(...rightRow.spans);
    }
    spans.push(row);
  }

  const first = left[0] ?? right[0];
  return {
    id: first ? first.id : '',
    type: 'dialogue',
    lines,
    spans,
    indent: 0,
    keepWithNext: false,
    // Two columns cannot be resumed under one (MORE); the pair moves together.
    splittable: false,
    speaker: null,
  };
};

/**
 * Flow a manuscript into pages.
 *
 * Two rules do the real work, and both exist because a page break in the wrong
 * place changes how a script reads:
 *
 *  - A scene heading or character cue never ends a page. It moves down with
 *    whatever it introduces.
 *  - Dialogue that will not fit is split with `(MORE)` and resumed under
 *    `NAME (CONT'D)`, but only if at least two lines can stay on each side;
 *    otherwise the whole speech moves to the next page.
 */
export const paginateElements = (
  elements: readonly ManuscriptElement[],
  layout: PageLayoutSpec,
  speakerFor: (element: ManuscriptElement) => string | null = () => null,
): Page[] => {
  const blocks: Block[] = [];
  let currentSpeaker: string | null = null;

  // Dual speeches are laid out as one two-column block; everything else is
  // an element on its own.
  for (const item of groupManuscript(elements)) {
    if (item.kind === 'dual') {
      if (layout.dual) {
        blocks.push(toDualBlock(item.left, item.right, layout));
        const last = item.right[item.right.length - 1];
        currentSpeaker = last ? (item.right[0] as ManuscriptElement).text.toUpperCase() : currentSpeaker;
        continue;
      }
      // A format without dual columns prints the two speeches in sequence.
      for (const element of [...item.left, ...item.right]) {
        if (element.text.trim().length === 0) continue;
        if (element.type === 'character') currentSpeaker = element.text.toUpperCase();
        blocks.push(toBlock(element, layout, element.type === 'dialogue' ? (speakerFor(element) ?? currentSpeaker) : null));
      }
      continue;
    }

    const element = item.element;
    if (element.text.trim().length === 0 && element.type !== 'scene_break') continue;
    if (element.type === 'character') currentSpeaker = element.text.toUpperCase();
    const speaker = speakerFor(element) ?? currentSpeaker;
    blocks.push(toBlock(element, layout, element.type === 'dialogue' ? speaker : null));
  }

  const pages: Page[] = [];
  let lines: PageLine[] = [];
  const spacing = layout.doubleSpaced ? 2 : 1;
  // The element being laid out, and the one that opened the page in hand.
  let currentId: string | null = null;
  let pageStart: string | null = null;

  const remaining = () => layout.linesPerPage - lines.length;
  const startNewPage = () => {
    if (lines.length > 0) pages.push({ number: pages.length + 1, lines, startsWith: pageStart });
    lines = [];
    pageStart = null;
  };
  const pushBlank = () => {
    if (lines.length === 0) return;
    for (let i = 0; i < spacing; i += 1) lines.push({ text: '', type: 'blank', indent: 0, spans: [] });
  };

  /**
   * Push one manuscript line, breaking the page when it is full. Everything
   * goes through here so a block longer than a whole page — a page-long
   * paragraph, a monologue — flows across pages instead of overflowing one.
   * A blank spacing line is never carried to the top of the next page.
   */
  const pushContent = (text: string, type: PageLine['type'], indent: number, spans: InlineSpan[]) => {
    if (lines.length >= layout.linesPerPage) startNewPage();
    if (pageStart === null) pageStart = currentId;
    lines.push({ text, type, indent, spans });
    if (layout.doubleSpaced && lines.length < layout.linesPerPage) {
      lines.push({ text: '', type: 'blank', indent: 0, spans: [] });
    }
  };

  const pushBlockLines = (block: Block, from = 0, to = Number.POSITIVE_INFINITY) => {
    block.lines.slice(from, to).forEach((text, offset) => {
      pushContent(text, block.type, block.indent, block.spans[from + offset] ?? [{ text }]);
    });
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] as Block;
    currentId = block.id;
    const separator = lines.length === 0 ? 0 : spacing;
    const needed = block.lines.length * spacing + separator;

    // A block that keeps with the next one needs room for a couple of lines of
    // that next block too, or the page break lands between them.
    const follower = blocks[index + 1];
    const companionLines = block.keepWithNext && follower ? Math.min(2, follower.lines.length) * spacing + spacing : 0;

    if (needed + companionLines <= remaining()) {
      pushBlank();
      pushBlockLines(block);
      continue;
    }

    // It does not fit. Split dialogue when both halves stay readable.
    const availableForLines = remaining() - separator - spacing; // reserve the (MORE) line
    const fittable = Math.floor(availableForLines / spacing);
    if (
      block.splittable &&
      fittable >= MIN_SPLIT_LINES &&
      block.lines.length - fittable >= MIN_SPLIT_LINES
    ) {
      pushBlank();
      pushBlockLines(block, 0, fittable);
      lines.push({ text: '(MORE)', type: 'more', indent: layout.indent['parenthetical'] ?? 16, spans: [{ text: '(MORE)' }] });
      startNewPage();
      if (block.speaker) {
        const continued = `${block.speaker} (CONT'D)`;
        lines.push({
          text: continued,
          type: 'continued',
          indent: layout.indent['character'] ?? 22,
          spans: [{ text: continued }],
        });
      }
      pushBlockLines(block, fittable);
      continue;
    }

    // Otherwise the whole block moves down. `pushContent` keeps breaking pages
    // underneath it if the block is longer than a page on its own.
    startNewPage();
    pushBlockLines(block);
  }

  if (lines.length > 0) pages.push({ number: pages.length + 1, lines, startsWith: pageStart });
  return pages;
};

export interface ManuscriptOptions {
  /**
   * Emit each beat's internal title as an annotation. Off by default and named
   * explicitly at every call site: §5.3 and §19 make the beat title authoring
   * metadata, so the delivered manuscript never contains it.
   */
  includeBeatTitles?: boolean;
}

/** Every manuscript element in the project, in reading order. */
export const manuscriptElements = (
  file: ProjectFile,
  options: ManuscriptOptions = {},
): ManuscriptElement[] =>
  unitsInStoryOrder(file)
    // A scene switched off stays in the structure and leaves the manuscript.
    .filter((unit) => unit.inScript)
    .flatMap((unit) =>
    beatsInScript(file, unit.id).flatMap((beat) => {
      const body = beat.manuscript.elements;
      if (!options.includeBeatTitles || beat.title.length === 0) return body;
      const annotation: ManuscriptElement = {
        id: `${beat.id}-title` as ManuscriptElement['id'],
        type: 'general',
        text: `[${beat.title}]`,
        characterId: null,
        attributes: { annotation: true },
      };
      return [annotation, ...body];
    }),
  );

export const paginateProject = (file: ProjectFile, options: ManuscriptOptions = {}): Page[] =>
  paginateElements(manuscriptElements(file, options), layoutFor(file.project.format), (element) => {
    if (!element.characterId) return null;
    return file.characters.find((character) => character.id === element.characterId)?.name.toUpperCase() ?? null;
  });

export const paginateUnit = (file: ProjectFile, unitId: StructuralUnitId): Page[] =>
  paginateElements(
    beatsInScript(file, unitId).flatMap((beat) => beat.manuscript.elements),
    layoutFor(file.project.format),
  );

/** Page count in the sense the industry means it. */
export const pageCount = (file: ProjectFile): number => paginateProject(file).length;

/**
 * Where the printed pages begin, as element id -> page number, for every
 * page after the first. The Script draws the manuscript as one flow and
 * uses this to rule the page breaks exactly where the printed page has
 * them, without pagination and editing having to be the same thing.
 */
export const pageBreaks = (file: ProjectFile, options: ManuscriptOptions = {}): Map<string, number> => {
  const breaks = new Map<string, number>();
  for (const page of paginateProject(file, options)) {
    if (page.number > 1 && page.startsWith) breaks.set(page.startsWith, page.number);
  }
  return breaks;
};
