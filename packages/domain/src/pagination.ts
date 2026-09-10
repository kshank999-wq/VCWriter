import { beatsInScript, relatedEntities, unitsInStoryOrder } from './selectors.js';
import {
  chapterPageContent,
  chapterPagesFor,
  contentsDivisions,
  hasContentsPage,
  type ChapterPageContent,
  type ContentsEntry,
  type ContentsPage,
  type PlacedMarker,
} from './markers.js';
import { episodeTitlePages, episodes, type Episode } from './episodes.js';
import type { TitlePage } from './entities/title-page.js';
import { groupManuscript } from './editing.js';
import { parseInline, type InlineSpan, type InlineStyle } from './entities/inline.js';
import type { ManuscriptElement, ManuscriptElementType } from './entities/manuscript.js';
import type { ParagraphStyle, ProjectFormat, ScriptFormat } from './entities/project.js';
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
  /**
   * Extra columns given to the **first line only**. A prose paragraph's
   * five-space indent is a first-line indent: indenting every line would make
   * a block quote of it. Absent means the block is set flush at `indent`.
   */
  firstIndent?: Record<string, number>;
  /** Characters per line before wrapping. */
  width: Record<string, number>;
  /** Element types rendered in capitals. */
  uppercase: ReadonlySet<string>;
  /** Prose is double spaced; screenplays are not. */
  doubleSpaced: boolean;
  /**
   * Element types that follow their own kind with no blank between them.
   *
   * Standard manuscript format runs paragraphs on and marks each new one
   * with a first-line indent; block style leaves the indent off and marks
   * the break with a space instead. The two are the same page set two ways,
   * so it is one set here rather than two layouts (§6.4).
   */
  runOn?: ReadonlySet<string>;
  /**
   * Elements that sit on the line straight under the one before, with no
   * blank between them.
   *
   * A speech is **one block**: the cue, its wryly and the words are
   * consecutive lines, and a blank line anywhere inside them is the mistake
   * every writer spots at a glance. Everything else on a screenplay page —
   * scene heading, action, a new cue, a transition — takes exactly one blank
   * line before it, and never two. Keyed by the element, valued by the
   * element types it may follow this closely.
   */
  follows?: Record<string, ReadonlySet<string>>;
  /**
   * Blank lines before a scene heading, where a format wants more than one.
   * Absent means the ordinary single blank that separates any two blocks.
   */
  blanksBeforeHeading?: number;
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
  // The cue, its wryly and the speech are one block, on consecutive lines.
  follows: {
    parenthetical: new Set(['character', 'dialogue', 'parenthetical']),
    dialogue: new Set(['character', 'parenthetical', 'dialogue']),
  },
  // Two 27-character columns with 6 between them: the 60-character body,
  // halved, with each speech's cue sitting over its own column.
  dual: {
    width: 27,
    gap: 6,
    indent: { character: 8, parenthetical: 3, dialogue: 0 },
  },
};

/**
 * BBC script format (spec §6.5).
 *
 * The same twelve-point Courier, set for a different job. US studio format is
 * laid out for reading and for timing; the BBC's grew up around taped
 * television, where the margins carried the crew's technical notes — so the
 * dialogue is a wide block sitting under a cue that is barely indented, rather
 * than a narrow column down the middle of the page.
 *
 * A4 rather than US Letter: 8.27" × 11.69" with the same 1.5" left, 1" right
 * and 1" top and bottom margins gives a 57-character column and 58 lines.
 *
 * A new scene heading takes a double blank line, which is how a BBC page
 * blocks out a change of setting; nothing else about the vertical spacing
 * differs. Scene headings are not set in bold — the house discourages it.
 */
export const BBC_LAYOUT: PageLayoutSpec = {
  linesPerPage: 58,
  columns: 57,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 0,
    shot: 0,
    general: 0,
    // 2.5" from the paper's edge: the cue sits close to the action, not out
    // in the middle of the page.
    character: 10,
    parenthetical: 10,
    // Directly under the name, and running to the right margin.
    dialogue: 10,
    transition: 42,
  },
  width: {
    scene_heading: 57,
    action: 57,
    shot: 57,
    general: 57,
    character: 47,
    parenthetical: 47,
    dialogue: 47,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  follows: {
    parenthetical: new Set(['character', 'dialogue', 'parenthetical']),
    dialogue: new Set(['character', 'parenthetical', 'dialogue']),
  },
  // A heavy visual boundary at a change of setting.
  blanksBeforeHeading: 2,
  dual: {
    width: 26,
    gap: 5,
    indent: { character: 0, parenthetical: 0, dialogue: 0 },
  },
};

/**
 * Standard manuscript format: 12pt Courier, double spaced, ~25 lines a page,
 * paragraphs running on with a five-space first-line indent.
 */
export const PROSE_LAYOUT: PageLayoutSpec = {
  linesPerPage: 25,
  columns: 60,
  doubleSpaced: true,
  indent: { paragraph: 0, heading: 0, blockquote: 5, scene_break: 28 },
  // Five spaces on the opening line, and the rest of the paragraph flush.
  firstIndent: { paragraph: 5 },
  width: { paragraph: 60, heading: 60, blockquote: 55, scene_break: 5 },
  uppercase: new Set(['heading']),
  // The indent is what says "a new paragraph", so nothing else has to.
  runOn: new Set(['paragraph']),
};

/**
 * The same page, set block style: no first-line indent, and a space between
 * paragraphs to mark the break the indent would otherwise have marked. One
 * or the other — a page with both is a page that says it twice.
 */
export const PROSE_BLOCK_LAYOUT: PageLayoutSpec = {
  ...PROSE_LAYOUT,
  firstIndent: {},
  runOn: new Set<string>(),
};

/**
 * A series and a short-form piece are both written in script format: the
 * same geometry, the same elements, the same two keys. What differs is how
 * they are divided (§14), not how a page is set.
 */
export const layoutFor = (
  format: ProjectFormat,
  paragraphStyle?: ParagraphStyle,
  scriptFormat?: ScriptFormat,
): PageLayoutSpec => {
  if (format !== 'novel' && format !== 'short_story') {
    return scriptFormat === 'bbc' ? BBC_LAYOUT : SCREENPLAY_LAYOUT;
  }
  return paragraphStyle === 'blocked' ? PROSE_BLOCK_LAYOUT : PROSE_LAYOUT;
};

/**
 * The layout this project is written in — the format's geometry, set the way
 * the writer asked for it. Everything that paginates a whole file goes
 * through here, so the choice cannot be honoured in one place and missed in
 * another.
 */
export const layoutForFile = (file: ProjectFile): PageLayoutSpec =>
  layoutFor(file.project.format, file.settings.paragraphStyle, file.settings.scriptFormat);

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
  /**
   * Set in the margins beside this line rather than in the column: a scene
   * number, which a shooting script prints at both edges and which must not
   * take room from the 60 characters the text is set in.
   */
  mark?: string;
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
  /**
   * Set on a chapter page (addendum 02 §11): a leaf of the book carrying the
   * chapter's number, its name and whatever the writer put on it, rather
   * than lines of manuscript. `lines` is empty on such a page.
   */
  chapter?: ChapterPageContent;
  /**
   * Set on a front page (spec §6.1, addendum 02 §17): the title page an
   * episode opens with, rather than lines of manuscript. `lines` is empty,
   * and `number` is 0 — a title page is not numbered, and does not take a
   * number from the page that follows it.
   */
  titlePage?: TitlePage;
  /**
   * Set on the contents page a season is bound with (addendum 02 §17): what
   * is in the stack, at the front of the stack. `lines` is empty, and like a
   * title page it takes no number.
   */
  contents?: ContentsPage;
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
  /** Extra columns on the opening line only: a paragraph's first-line indent. */
  firstIndent: number;
  /**
   * A scene heading or character cue must not be the last thing on a page —
   * the reader would turn over to find the content it introduces.
   */
  keepWithNext: boolean;
  /** Dialogue may be split across pages with (MORE) / (CONT'D). */
  splittable: boolean;
  /** Printed in the margins beside the block's first line: a scene number. */
  mark?: string;
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
    firstIndent: layout.firstIndent?.[element.type] ?? 0,
    keepWithNext: element.type === 'scene_heading' || element.type === 'character' || element.type === 'parenthetical',
    splittable: element.type === 'dialogue',
    speaker,
    mark: typeof element.attributes['sceneNumber'] === 'string' ? element.attributes['sceneNumber'] : undefined,
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
    firstIndent: 0,
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
  // What separates two blocks. A double-spaced page already carries a blank
  // under every line, so one more is a paragraph break; a single-spaced
  // screenplay page needs the whole line.
  const gap = layout.doubleSpaced ? 1 : spacing;
  const pushBlank = (howMany = gap) => {
    if (lines.length === 0) return;
    for (let i = 0; i < howMany; i += 1) lines.push({ text: '', type: 'blank', indent: 0, spans: [] });
  };
  /**
   * What goes before this block: nothing inside a speech, more than one blank
   * before a scene heading in a format that asks for it, one otherwise.
   */
  const blanksBefore = (block: Block, previous: Block | null): number => {
    if (previous === null) return 0;
    if (layout.follows?.[block.type]?.has(previous.type) ?? false) return 0;
    if (block.type === 'scene_heading' && layout.blanksBeforeHeading) {
      return layout.blanksBeforeHeading * gap;
    }
    return gap;
  };

  /**
   * Push one manuscript line, breaking the page when it is full. Everything
   * goes through here so a block longer than a whole page — a page-long
   * paragraph, a monologue — flows across pages instead of overflowing one.
   * A blank spacing line is never carried to the top of the next page.
   */
  const pushContent = (
    text: string,
    type: PageLine['type'],
    indent: number,
    spans: InlineSpan[],
    mark?: string,
  ) => {
    if (lines.length >= layout.linesPerPage) startNewPage();
    if (pageStart === null) pageStart = currentId;
    lines.push({ text, type, indent, spans, ...(mark ? { mark } : {}) });
    if (layout.doubleSpaced && lines.length < layout.linesPerPage) {
      lines.push({ text: '', type: 'blank', indent: 0, spans: [] });
    }
  };

  const pushBlockLines = (block: Block, from = 0, to = Number.POSITIVE_INFINITY) => {
    block.lines.slice(from, to).forEach((text, offset) => {
      // The mark belongs beside the first line of the block, not every one.
      const mark = from + offset === 0 ? block.mark : undefined;
      // The first-line indent belongs to the paragraph's opening line, so a
      // paragraph resumed at the top of a page is set flush, as it should be.
      const indent = block.indent + (from + offset === 0 ? block.firstIndent : 0);
      pushContent(text, block.type, indent, block.spans[from + offset] ?? [{ text }], mark);
    });
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] as Block;
    currentId = block.id;
    // A paragraph that runs on from the paragraph before it takes no blank:
    // in standard manuscript format the indent is what marks the new one. Nor
    // does a line inside a speech, which is one block down the page.
    const previous = index > 0 ? (blocks[index - 1] as Block) : null;
    const runsOn =
      previous !== null && previous.type === block.type && (layout.runOn?.has(block.type) ?? false);
    const before = runsOn ? 0 : blanksBefore(block, previous);
    const separator = lines.length === 0 ? 0 : before;
    const needed = block.lines.length * spacing + separator;

    // A block that keeps with the next one needs room for a couple of lines of
    // that next block too, or the page break lands between them.
    const follower = blocks[index + 1];
    const companionLines = block.keepWithNext && follower ? Math.min(2, follower.lines.length) * spacing + spacing : 0;

    if (needed + companionLines <= remaining()) {
      if (before > 0) pushBlank(before);
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
      if (before > 0) pushBlank(before);
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

/**
 * What a printing carries (addendum 02 §13).
 *
 * Everything here is off unless it is part of the delivered manuscript. A
 * script sent out is scene headings, action and dialogue; a **reference
 * copy** — the one a writer prints for themselves — can carry the beat
 * labels, the scene summaries, the links, the scene numbers. Nothing in the
 * second list is the writing, so nothing in it prints by accident.
 */
export interface ManuscriptOptions {
  /**
   * Emit each beat's internal title as an annotation. Off by default and named
   * explicitly at every call site: §5.3 and §19 make the beat title authoring
   * metadata, so the delivered manuscript never contains it.
   */
  includeBeatTitles?: boolean;
  /**
   * Print the leaf a chapter opens with (addendum 02 §11). Defaults to the
   * project's own setting; a format with no chapter pages ignores it.
   */
  includeChapterPages?: boolean;
  /**
   * Print the front pages: the document's, and the one each episode opens
   * with (§6.1, addendum 02 §17). On unless asked otherwise — one switch for
   * all of them, because a writer who does not want a title page does not
   * want eleven of them.
   */
  includeTitlePage?: boolean;
  /**
   * Print the contents page a season is bound with (addendum 02 §17). On
   * unless asked otherwise, and only where there is more than one episode to
   * list.
   */
  includeContentsPage?: boolean;
  /**
   * The sluglines themselves. On unless asked otherwise — a script without
   * them is a rehearsal script or a prose read-through, which is a real
   * thing to want and never the default.
   */
  includeSceneHeadings?: boolean;
  /**
   * Number the scenes, in the margins at both edges, the way a shooting
   * script does. Off: a script is not numbered until it is going into
   * production, and numbering a draft misrepresents it.
   */
  includeSceneNumbers?: boolean;
  /** Each scene's summary, as an annotation under its heading. */
  includeSceneSummary?: boolean;
  /** What each scene is linked to: setups, payoffs, research, characters. */
  includeSceneLinks?: boolean;
}

/** Every manuscript element in the project, in reading order. */
export const manuscriptElements = (file: ProjectFile, options: ManuscriptOptions = {}): ManuscriptElement[] =>
  unitsInStoryOrder(file)
    // A scene switched off stays in the structure and leaves the manuscript.
    .filter((unit) => unit.inScript)
    // Scene numbers count the scenes that are in the script, in story order:
    // a scene switched off is not scene 4 and never was.
    .flatMap((unit, index) => unitElements(file, unit.id, options, String(index + 1)));

/**
 * The whole project, paginated — with the leaves a book puts between its
 * chapters (addendum 02 §11).
 *
 * A chapter page is a page in its own right, so the story is paginated in
 * runs between them rather than as one stream. That is not a compromise: a
 * chapter starts on a fresh page in every book ever printed, which is
 * exactly what breaking the run does. A format with no chapter pages, or a
 * printing that leaves them out, paginates as one run and is unchanged.
 */
export const paginateProject = (file: ProjectFile, options: ManuscriptOptions = {}): Page[] => {
  const speakerFor = (element: ManuscriptElement) => {
    if (!element.characterId) return null;
    return file.characters.find((character) => character.id === element.characterId)?.name.toUpperCase() ?? null;
  };
  const layout = layoutForFile(file);

  const leaves = chapterPagesFor(file, options);
  const fronts = episodeTitlePages(file, options);
  // Every episode begins a script of its own, whether or not its front page
  // is printing: it starts on a fresh page and numbers from one (§17).
  const opensEpisode = new Map(episodes(file).map((episode) => [episode.marker.unitId as string, episode]));
  // Nothing to divide the run and nothing to list: one flat pass, unchanged.
  if (leaves.length === 0 && fronts.length === 0 && opensEpisode.size === 0 && !hasContentsPage(file, options)) {
    return numbered(paginateElements(manuscriptElements(file, options), layout, speakerFor), new Set());
  }

  // Where each leaf falls, and where each episode's front page does, by the
  // unit each is anchored to.
  const opensAt = new Map(leaves.map((placed) => [placed.marker.unitId as string, placed]));
  const frontAt = new Map(fronts.map((front) => [front.episode.marker.unitId as string, front.page]));
  const units = unitsInStoryOrder(file).filter((unit) => unit.inScript);

  // The same numbering as the flat run above, worked out once.
  const sceneNumbers = new Map(units.map((unit, index) => [unit.id as string, index + 1]));

  const pages: Page[] = [];
  /** Where a script begins: the index of each episode's own page one. */
  const restartAt = new Set<number>();
  /**
   * Each division's run: which page index it opens on, and how far into the
   * manuscript it falls. The contents page is written from these once the
   * pages exist — how long each part runs, and where to turn for it.
   */
  const runs: Division[] = [];
  /** Every element as it went in, so a division with no leaf can be placed. */
  const emitted: string[] = [];
  const divisions = new Map(contentsDivisions(file).map((placed) => [placed.marker.unitId as string, placed]));
  let run: ManuscriptElement[] = [];
  const flush = () => {
    if (run.length === 0) return;
    pages.push(...paginateElements(run, layout, speakerFor));
    run = [];
  };

  for (const unit of units) {
    /** The first page this unit opens: its cover, its leaf, or its own page one. */
    let opensAtIndex = -1;

    const episode = opensEpisode.get(unit.id as string);
    if (episode) {
      // The episode before it ends where it ends; this one starts on paper of
      // its own, with its front page ahead of it where it has one.
      flush();
      opensAtIndex = pages.length;
      const front = frontAt.get(unit.id as string);
      if (front) pages.push({ number: 0, lines: [], startsWith: null, titlePage: front });
      // Whatever is pushed next — a chapter leaf, or the first page of the
      // script — is this episode's page one.
      restartAt.add(pages.length);
    }

    const leaf = opensAt.get(unit.id as string);
    if (leaf) {
      flush();
      if (opensAtIndex < 0) opensAtIndex = pages.length;
      pages.push({ number: 0, lines: [], startsWith: null, chapter: chapterPageContent(leaf) });
    }

    // A division opens at the first leaf of its own — its cover, its chapter
    // page — or, where it has neither, at whatever page its first line falls
    // on, which `emitted` is kept for.
    const opens = divisions.get(unit.id as string);
    if (opens) runs.push({ placed: opens, from: opensAtIndex, at: emitted.length });

    const elements = unitElements(file, unit.id, options, String(sceneNumbers.get(unit.id as string) ?? 0));
    emitted.push(...elements.map((element) => element.id as string));
    run.push(...elements);
  }
  flush();

  const laid = numbered(pages, restartAt);

  // The list at the front, which can only be written once the pages exist:
  // it says where to turn, and a page that is not there cannot be pointed at.
  if (hasContentsPage(file, options)) {
    laid.unshift({
      number: 0,
      lines: [],
      startsWith: null,
      contents: contentsOf(file, laid, runs, emitted),
    });
  }
  return laid;
};

/** A division of the document, and where it landed once the pages were laid. */
interface Division {
  placed: PlacedMarker;
  /** The page index its own leaves begin at, or -1 where it has none. */
  from: number;
  /** How many elements went in ahead of it, for a division with no leaf. */
  at: number;
}

/**
 * What is in the stack: one line for each episode, with how long it runs.
 *
 * The length is counted from the pages themselves rather than estimated —
 * the covers between the scripts belong to no script and are not counted in
 * one — so the figure on the contents page is the figure the last page of
 * that episode carries.
 */
const contentsOf = (
  file: ProjectFile,
  pages: readonly Page[],
  runs: readonly Division[],
  emitted: readonly string[],
): ContentsPage => {
  // Where each element fell, so a division with no leaf of its own can still
  // be pointed at: the page it opens on is the last one that had begun by the
  // time its first line went in.
  const position = new Map(emitted.map((id, index) => [id, index]));
  const begun = pages.map((page, index) => ({
    index,
    at: page.startsWith === null ? -1 : (position.get(page.startsWith) ?? -1),
  }));
  const pageOf = (at: number): number => {
    let found = 0;
    for (const page of begun) {
      if (page.at >= 0 && page.at <= at) found = page.index;
    }
    return found;
  };

  const opensAt = runs.map((run) => (run.from >= 0 ? run.from : pageOf(run.at)));

  const entries: ContentsEntry[] = runs.map((run, position_) => {
    const from = opensAt[position_] as number;
    const end = opensAt[position_ + 1] ?? pages.length;
    const own = pages.slice(from, end);
    return {
      label: run.placed.label,
      title: run.placed.marker.title,
      // The covers between the scripts belong to no script; the pages do.
      pages: own.filter((page) => page.titlePage === undefined).length,
      // Sheet one is the contents page itself, which is not in `pages` yet.
      sheet: from + 2,
      // What the page it opens on prints on its own face. A cover carries no
      // number, so the number is the first one the division actually has.
      page: own.find((page) => page.number > 0)?.number ?? 0,
    };
  });

  return {
    kind: file.project.format === 'series' ? 'episodes' : 'chapters',
    title: file.project.title,
    entries,
  };
};

/**
 * Number the pages: from one, and from one again at the head of each script.
 *
 * A series is a stack of scripts, not one long document, so **each episode
 * numbers from its own page one** (§17) — page two of episode three is page
 * two, the way it would be if that episode had been printed on its own.
 *
 * The covers and the contents page take no number and give none away: the
 * page after the front page of episode two is that episode's page one, and
 * the leaves between the scripts are counted in neither of them.
 */
const numbered = (pages: Page[], restartAt: ReadonlySet<number>): Page[] => {
  let n = 0;
  return pages.map((page, index) => {
    if (restartAt.has(index)) n = 0;
    const front = page.titlePage !== undefined || page.contents !== undefined;
    return front ? { ...page, number: 0 } : { ...page, number: (n += 1) };
  });
};

/** An annotation: the writer's own note about the text, not the text. */
const annotation = (id: string, text: string): ManuscriptElement => ({
  id: id as ManuscriptElement['id'],
  type: 'general',
  text,
  characterId: null,
  attributes: { annotation: true },
});

/**
 * One unit's manuscript, and whatever annotations this printing asked for.
 *
 * The scene's own things — its number, its summary, what it is linked to —
 * are attached at the scene, ahead of its first beat. The beat labels sit
 * with their beats. All of it is optional and all of it is off by default.
 */
const unitElements = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  options: ManuscriptOptions,
  sceneNumber?: string,
): ManuscriptElement[] => {
  const unit = file.units.find((candidate) => candidate.id === unitId);
  const body = beatsInScript(file, unitId).flatMap((beat) => {
    const elements =
      options.includeSceneHeadings === false
        ? beat.manuscript.elements.filter((element) => element.type !== 'scene_heading')
        : beat.manuscript.elements;
    if (!options.includeBeatTitles || beat.title.length === 0) return elements;
    const note = annotation(`${beat.id}-title`, `[${beat.title}]`);
    // Under the slugline, never above it: a note above the heading reads as
    // belonging to the scene before.
    return elements[0]?.type === 'scene_heading'
      ? [elements[0], note, ...elements.slice(1)]
      : [note, ...elements];
  });

  // The number rides on the heading itself, so it stays with the scene
  // wherever the page break falls, and prints in the margins rather than
  // taking room from the 60 characters the text is set in.
  const numbered =
    sceneNumber && options.includeSceneNumbers
      ? body.map((element, index) =>
          index === body.findIndex((candidate) => candidate.type === 'scene_heading')
            ? { ...element, attributes: { ...element.attributes, sceneNumber } }
            : element,
        )
      : body;

  const before: ManuscriptElement[] = [];
  if (options.includeSceneSummary && unit && unit.summary.trim().length > 0) {
    before.push(annotation(`${unitId}-summary`, `[${unit.summary.trim()}]`));
  }
  if (options.includeSceneLinks && unit) {
    const related = relatedEntities(file, { type: 'unit', id: unitId })
      .map((entry) => `${entry.link.type.replace(/_/g, ' ')}: ${entry.other.label}`)
      .filter((line) => line.trim().length > 0);
    if (related.length > 0) before.push(annotation(`${unitId}-links`, `[${related.join(' · ')}]`));
  }

  // The annotations follow the heading rather than preceding it: a note
  // above the slugline would read as belonging to the scene before.
  if (before.length === 0) return numbered;
  const headingAt = numbered.findIndex((element) => element.type === 'scene_heading');
  if (headingAt === -1) return [...before, ...numbered];
  return [...numbered.slice(0, headingAt + 1), ...before, ...numbered.slice(headingAt + 1)];
};

export const paginateUnit = (file: ProjectFile, unitId: StructuralUnitId): Page[] =>
  paginateElements(
    beatsInScript(file, unitId).flatMap((beat) => beat.manuscript.elements),
    layoutForFile(file),
  );

/** Page count in the sense the industry means it. */
export const pageCount = (file: ProjectFile): number => paginateProject(file).length;

/**
 * Where the printed pages begin, as element id -> page number, for every
 * page after the first. The Script draws the manuscript as one flow and
 * uses this to rule the page breaks exactly where the printed page has
 * them, without pagination and editing having to be the same thing.
 *
 * Every break after the document's first page of manuscript is ruled, with
 * its own number on it. That includes an episode's page one (§17): it is a
 * break in the flow like any other, and the one a reader most wants to see
 * coming. The covers are not in the flow and rule nothing.
 */
export const pageBreaks = (file: ProjectFile, options: ManuscriptOptions = {}): Map<string, number> => {
  const breaks = new Map<string, number>();
  let started = false;
  for (const page of paginateProject(file, options)) {
    if (page.titlePage || page.contents || page.chapter) continue;
    if (started && page.startsWith) breaks.set(page.startsWith, page.number);
    started = true;
  }
  return breaks;
};
