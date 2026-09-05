import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
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
}

export interface Page {
  number: number;
  lines: PageLine[];
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
  type: ManuscriptElementType;
  lines: string[];
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

const toBlock = (element: ManuscriptElement, layout: PageLayoutSpec, speaker: string | null): Block => {
  const width = layout.width[element.type] ?? layout.columns;
  const indent = layout.indent[element.type] ?? 0;
  const text = layout.uppercase.has(element.type) ? element.text.toUpperCase() : element.text;
  return {
    type: element.type,
    lines: wrapText(text, width),
    indent,
    keepWithNext: element.type === 'scene_heading' || element.type === 'character' || element.type === 'parenthetical',
    splittable: element.type === 'dialogue',
    speaker,
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

  for (const element of elements) {
    if (element.text.trim().length === 0 && element.type !== 'scene_break') continue;
    if (element.type === 'character') currentSpeaker = element.text.toUpperCase();
    const speaker = speakerFor(element) ?? currentSpeaker;
    blocks.push(toBlock(element, layout, element.type === 'dialogue' ? speaker : null));
  }

  const pages: Page[] = [];
  let lines: PageLine[] = [];
  const spacing = layout.doubleSpaced ? 2 : 1;

  const remaining = () => layout.linesPerPage - lines.length;
  const startNewPage = () => {
    if (lines.length > 0) pages.push({ number: pages.length + 1, lines });
    lines = [];
  };
  const pushBlank = () => {
    if (lines.length === 0) return;
    for (let i = 0; i < spacing; i += 1) lines.push({ text: '', type: 'blank', indent: 0 });
  };

  /**
   * Push one manuscript line, breaking the page when it is full. Everything
   * goes through here so a block longer than a whole page — a page-long
   * paragraph, a monologue — flows across pages instead of overflowing one.
   * A blank spacing line is never carried to the top of the next page.
   */
  const pushContent = (text: string, type: PageLine['type'], indent: number) => {
    if (lines.length >= layout.linesPerPage) startNewPage();
    lines.push({ text, type, indent });
    if (layout.doubleSpaced && lines.length < layout.linesPerPage) {
      lines.push({ text: '', type: 'blank', indent: 0 });
    }
  };

  const pushBlockLines = (block: Block, from = 0, to = Number.POSITIVE_INFINITY) => {
    for (const text of block.lines.slice(from, to)) pushContent(text, block.type, block.indent);
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] as Block;
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
      lines.push({ text: '(MORE)', type: 'more', indent: layout.indent['parenthetical'] ?? 16 });
      startNewPage();
      if (block.speaker) {
        lines.push({
          text: `${block.speaker} (CONT'D)`,
          type: 'continued',
          indent: layout.indent['character'] ?? 22,
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

  if (lines.length > 0) pages.push({ number: pages.length + 1, lines });
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
  unitsInStoryOrder(file).flatMap((unit) =>
    beatsForUnit(file, unit.id).flatMap((beat) => {
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
    beatsForUnit(file, unitId).flatMap((beat) => beat.manuscript.elements),
    layoutFor(file.project.format),
  );

/** Page count in the sense the industry means it. */
export const pageCount = (file: ProjectFile): number => paginateProject(file).length;
