/**
 * Emphasis inside a line: bold, italic, underline (spec §6, addendum 02 §7.1).
 *
 * The manuscript stays a list of typed elements whose text is plain text
 * (§14), so emphasis is written into the text with the marks the screenplay
 * world already uses — Fountain's `**bold**`, `*italic*` and `_underline_`,
 * with `\*` for a literal star. Nothing about a project file needs a rich
 * text engine to be read, converted or diffed, and a script exported to
 * Fountain or pasted into another program keeps its emphasis.
 *
 * A mark counts only when it is closed. `5 * 3` and `a_b` are what they
 * look like, not the start of an emphasis that runs to the end of the line.
 */

export interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface InlineSpan extends InlineStyle {
  text: string;
  /** The marks themselves. They are shown while writing and never printed. */
  marker?: boolean;
  /**
   * A citation's place in the text (addendum 43): the `[^ab12cd]` token, by
   * its key. Printed as its marker, never as its characters, so where nothing
   * knows how to number it yet the span prints nothing at all.
   */
  citation?: string;
}

/** A citation token at the start of `text`: `[^` and six hex characters and `]` (addendum 43). */
export const CITATION_TOKEN = /^\[\^([0-9a-f]{6})\]/;

const MARKS = ['***', '**', '*', '_'] as const;

const styleFor = (mark: string, style: InlineStyle): InlineStyle =>
  mark === '***'
    ? { ...style, bold: true, italic: true }
    : mark === '**'
      ? { ...style, bold: true }
      : mark === '*'
        ? { ...style, italic: true }
        : { ...style, underline: true };

/** Where this mark is closed, or -1. A `*` is never closed by half of a `**`. */
const closerFor = (text: string, mark: string, from: number): number => {
  for (let index = from; index <= text.length - mark.length; index += 1) {
    if (!text.startsWith(mark, index)) continue;
    if (text[index - 1] === '\\') continue;
    if (mark === '*' && (text.startsWith('**', index) || text[index - 1] === '*')) continue;
    if (mark === '**' && text.startsWith('***', index)) continue;
    return index;
  }
  return -1;
};

const sameStyle = (a: InlineStyle, b: InlineStyle): boolean =>
  Boolean(a.bold) === Boolean(b.bold) &&
  Boolean(a.italic) === Boolean(b.italic) &&
  Boolean(a.underline) === Boolean(b.underline);

const walk = (text: string, style: InlineStyle, keepMarks: boolean, out: InlineSpan[]): void => {
  let buffer = '';
  let index = 0;
  const flush = () => {
    if (buffer.length > 0) {
      out.push({ text: buffer, ...style });
      buffer = '';
    }
  };

  while (index < text.length) {
    const character = text[index] as string;

    // An escaped mark is the character itself.
    if (character === '\\' && (text[index + 1] === '*' || text[index + 1] === '_')) {
      if (keepMarks) {
        flush();
        out.push({ text: '\\', ...style, marker: true });
      }
      buffer += text[index + 1] as string;
      index += 2;
      continue;
    }

    // A citation token is one thing, wherever it stands, and never emphasis.
    if (character === '[' && text[index + 1] === '^') {
      const token = CITATION_TOKEN.exec(text.slice(index));
      if (token) {
        flush();
        out.push({ text: keepMarks ? token[0] : '', ...style, citation: token[1]!, ...(keepMarks ? { marker: true } : {}) });
        index += token[0].length;
        continue;
      }
    }

    const mark = MARKS.find((candidate) => text.startsWith(candidate, index));
    if (mark) {
      const close = closerFor(text, mark, index + mark.length);
      if (close !== -1) {
        flush();
        if (keepMarks) out.push({ text: mark, ...style, marker: true });
        walk(text.slice(index + mark.length, close), styleFor(mark, style), keepMarks, out);
        if (keepMarks) out.push({ text: mark, ...style, marker: true });
        index = close + mark.length;
        continue;
      }
    }

    buffer += character;
    index += 1;
  }
  flush();
};

const merged = (spans: InlineSpan[]): InlineSpan[] => {
  const out: InlineSpan[] = [];
  for (const span of spans) {
    const last = out[out.length - 1];
    if (last && !last.marker && !span.marker && !last.citation && !span.citation && sameStyle(last, span)) last.text += span.text;
    else out.push({ ...span });
  }
  return out;
};

/** The text as it prints: the marks are gone and what they styled is styled. */
export const parseInline = (text: string): InlineSpan[] => {
  const out: InlineSpan[] = [];
  walk(text, {}, false, out);
  return merged(out);
};

/**
 * The text as it is written: every character of it, the marks included and
 * flagged, so an editor can draw the styling over the very characters the
 * writer is typing without anything shifting.
 */
export const parseInlineMarks = (text: string): InlineSpan[] => {
  const out: InlineSpan[] = [];
  walk(text, {}, true, out);
  return out;
};

/** The printed text with the marks removed. */
export const plainInline = (text: string): string =>
  parseInline(text)
    .map((span) => span.text)
    .join('');

export type InlineMark = 'bold' | 'italic' | 'underline';

const MARK_FOR: Record<InlineMark, string> = { bold: '**', italic: '*', underline: '_' };

export interface InlineEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Put emphasis on the selection, or take it off when it is already exactly
 * wrapped. With nothing selected the pair is inserted and the caret is left
 * between the marks, so Ctrl+B then typing is bold.
 */
export const toggleInline = (text: string, start: number, end: number, mark: InlineMark): InlineEdit => {
  const marks = MARK_FOR[mark];
  const width = marks.length;
  const wrapped = text.slice(start - width, start) === marks && text.slice(end, end + width) === marks;

  if (wrapped) {
    return {
      text: text.slice(0, start - width) + text.slice(start, end) + text.slice(end + width),
      selectionStart: start - width,
      selectionEnd: end - width,
    };
  }

  /**
   * **The marks go round the words and never round the spaces beside them**
   * — the Word importer's own rule when it writes emphasis back (`*the *` for
   * `the ` reads as a stray asterisk), said here because this is where a
   * writer makes one.
   *
   * It matters more than it did: a double-click selects a word **and its
   * trailing space** in every browser, and the toolbar (addendum 02 §19a)
   * makes double-click-then-press the commonest way emphasis is put on. An
   * empty selection is left exactly as it is, that being somebody asking for
   * a pair of marks to type between.
   */
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from] as string)) from += 1;
  while (to > from && /\s/.test(text[to - 1] as string)) to -= 1;
  if (from === to) {
    from = start;
    to = end;
  }

  return {
    text: `${text.slice(0, from)}${marks}${text.slice(from, to)}${marks}${text.slice(to)}`,
    selectionStart: from + width,
    selectionEnd: to + width,
  };
};
