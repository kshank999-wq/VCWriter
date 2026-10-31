/**
 * The word a right-click lands on, and the small edits the writing menu makes
 * (from Ken: *a right-click menu like standard in writing software with a
 * suggestion and other standard menu options*). Pure, so the menu's arithmetic
 * is tested without a browser.
 */

const LETTER = /[\p{L}\p{M}\p{N}'’]/u;

/**
 * The word at a place in a line: what is selected when that is one word, or
 * the word the caret stands in or against. Null where there is none.
 */
export const wordAt = (text: string, start: number, end: number): { word: string; from: number; to: number } | null => {
  let from = Math.max(0, Math.min(start, text.length));
  let to = Math.max(from, Math.min(end, text.length));
  if (from === to) {
    while (from > 0 && LETTER.test(text[from - 1]!)) from -= 1;
    while (to < text.length && LETTER.test(text[to]!)) to += 1;
  }
  // Quotes and apostrophes at the edges are punctuation, not the word.
  while (from < to && /['’]/.test(text[from]!)) from += 1;
  while (to > from && /['’]/.test(text[to - 1]!)) to -= 1;
  const word = text.slice(from, to);
  if (!word || /\s/.test(word)) return null;
  return { word, from, to };
};

/** The line with one stretch of it replaced. */
export const replaceRange = (text: string, from: number, to: number, put: string): string =>
  text.slice(0, from) + put + text.slice(to);
