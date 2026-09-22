import {
  BARE_LABEL,
  CHAPTER_HEAD,
  pageNumberParagraphs,
  summarise,
  type ImportedElement,
  type ImportedScene,
  type ImportedScript,
} from './importing.js';

/**
 * A plain-text document read as prose (addendum 22 §6).
 *
 * The reason this exists: a `.txt` or `.md` short story used to arrive as
 * **one undivided block of paragraphs**. The Word reader has divided at a
 * chapter heading and at a bare numeral since addendum 21 §10, but plain
 * text went through a three-line splitter in the renderer that had never
 * heard of either — so *II*, *III*, *IV* came in as three paragraphs in the
 * middle of the prose, and Ken correctly reported that the Roman numerals
 * were not recognised.
 *
 * So the rule is the same rule. `CHAPTER_HEAD` and `BARE_LABEL` live in
 * `importing.ts` and both readers ask them, because *what divides a
 * document* is one question and two answers to it is the bug.
 *
 * What plain text cannot say is kept out rather than guessed at: there are
 * no styles, so a heading is recognised only by **what it says** and by
 * standing alone on its line.
 */

/** No longer than a heading ever is: past this it is a sentence that starts with a numeral. */
const HEADING_AT_MOST = 60;

/**
 * Whether a paragraph of plain text opens a division. The page numbers are
 * taken out first, so a bare *3* here is a label rather than the foot of
 * page three — the same order `docxToProse` reads in.
 */
export const opensDivision = (text: string): boolean => {
  const line = text.trim();
  if (line.length === 0 || line.length > HEADING_AT_MOST) return false;
  if (CHAPTER_HEAD.test(line)) return true;
  return BARE_LABEL.test(line);
};

/** The paragraphs of a plain-text document: blank lines divide, single newlines do not. */
const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);

/**
 * Read plain text as prose. Its divisions are its headings; where it has
 * none the whole document is one, which is what an undivided short story
 * is and not a failure to read it.
 */
export const textToProse = (text: string, options: { title?: string } = {}): ImportedScript => {
  const paragraphs = paragraphsOf(text);
  // A typed page number at the foot of every page is not a chapter (§10):
  // the same reading the Word importer makes, over the same rule.
  const numbers = pageNumberParagraphs(paragraphs.map((plain) => ({ plain })));

  const scenes: ImportedScene[] = [];
  let open: ImportedScene = { heading: '', elements: [] };
  const close = () => {
    if (open.heading.trim().length > 0 || open.elements.length > 0) scenes.push(open);
  };

  paragraphs.forEach((paragraph, index) => {
    if (numbers.has(index)) return;
    if (opensDivision(paragraph)) {
      close();
      open = { heading: paragraph, elements: [] };
      return;
    }
    const element: ImportedElement = { type: 'paragraph', text: paragraph };
    open.elements.push(element);
  });
  close();

  return summarise({
    title: options.title ?? '',
    author: '',
    scenes: scenes.length > 0 ? scenes : [{ heading: '', elements: [] }],
    warnings: [],
    source: 'text',
  });
};
