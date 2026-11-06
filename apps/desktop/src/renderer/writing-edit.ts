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

/**
 * Which character of a text box the pointer is over (for the right-click
 * menus). A right-click does not move the caret everywhere (on Windows it
 * stays where it was), so the word under the pointer is found by laying the
 * box's text out in an invisible copy with the same font, size and wrapping,
 * and asking the browser which character is at that point.
 */
export const offsetAtPoint = (box: HTMLTextAreaElement | HTMLInputElement, x: number, y: number): number | null => {
  const doc = box.ownerDocument;
  const caret = (doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint;
  if (typeof caret !== 'function' || typeof box.getBoundingClientRect !== 'function') return null;
  const style = doc.defaultView?.getComputedStyle(box);
  if (!style) return null;
  const rect = box.getBoundingClientRect();
  const mirror = doc.createElement('div');
  const copied = [
    'boxSizing', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize',
    'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'wordSpacing', 'tabSize',
  ] as const;
  for (const key of copied) (mirror.style as unknown as Record<string, string>)[key] = (style as unknown as Record<string, string>)[key] ?? '';
  Object.assign(mirror.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    margin: '0',
    borderStyle: 'solid',
    borderColor: 'transparent',
    overflow: 'hidden',
    whiteSpace: box instanceof HTMLInputElement ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
    visibility: 'visible',
    opacity: '0',
    zIndex: '2147483647',
    pointerEvents: 'auto',
  });
  const text = doc.createTextNode(box.value + '​');
  mirror.appendChild(text);
  doc.body.appendChild(mirror);
  mirror.scrollTop = box.scrollTop;
  mirror.scrollLeft = box.scrollLeft;
  try {
    const range = caret.call(doc, x, y);
    if (!range || range.startContainer !== text) return null;
    return Math.min(range.startOffset, box.value.length);
  } finally {
    mirror.remove();
  }
};
