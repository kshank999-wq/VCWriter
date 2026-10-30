import { headingNumbers, headingsOf } from './document-outline.js';
import type { DocNode, WpDocument } from './entities/document.js';

/**
 * **A table of contents** (addendum 42 §19, from Ken: *go ahead with the
 * table of contents*). A block the writer puts where it goes, that fills itself
 * from the document's headings, as the bibliography fills itself from the
 * sources: each heading to the depth asked for, with its number where the
 * document numbers its headings, and the page it falls on.
 *
 * The page is the one thing the document cannot know by itself: the screen's
 * page view finds it on the screen, print finds it once it has set the pages,
 * and Word finds it when it updates its own field. So a page number is a
 * placeholder here, `data-toc-page`, filled by whoever has the pages.
 */

export interface TocEntry {
  headingId: string;
  level: number;
  /** The heading's number under the document's scheme, or empty. */
  number: string;
  text: string;
}

/** How deep a table of contents goes when nobody has said: Word's three levels. */
export const CONTENTS_DEPTH = 3;

/** The headings a table of contents lists, in order, to the given depth. */
export const contentsEntries = (document: Pick<WpDocument, 'content' | 'headingNumbering'>, depth = CONTENTS_DEPTH): TocEntry[] => {
  const numbers = headingNumbers(document.content, document.headingNumbering);
  return headingsOf(document.content)
    .filter((heading) => heading.level <= depth && heading.text.length > 0)
    .map((heading) => ({
      headingId: heading.headingId,
      level: heading.level,
      number: numbers.get(heading.headingId) ?? '',
      text: heading.text,
    }));
};

/** Whether the document has a table of contents in it. */
export const hasContents = (content: DocNode): boolean => (content.content ?? []).some((block) => block.type === 'tableOfContents');

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The table as the page sets it: *Contents*, then a line per heading, indented
 * by its level, with dot leaders to its page number. Each line links to its
 * heading (`#h-<id>`), which a PDF keeps as a link.
 */
export const contentsHtml = (entries: readonly TocEntry[], pageOf?: ReadonlyMap<string, number>): string =>
  '<nav class="wp-toc"><h2 class="wp-toc-heading">Contents</h2>' +
  (entries.length === 0
    ? '<p class="wp-toc-empty">The headings you add will be listed here. Use the Styles box on the Home tab.</p>'
    : entries
        .map(
          (entry) =>
            `<p class="wp-toc-entry wp-toc-l${entry.level}"><a href="#h-${escape(entry.headingId)}" data-toc-target="${escape(entry.headingId)}">` +
            `<span class="wp-toc-text">${entry.number ? `${escape(entry.number)} ` : ''}${escape(entry.text)}</span>` +
            '<span class="wp-toc-leader"></span>' +
            `<span class="wp-toc-page" data-toc-page="${escape(entry.headingId)}">${pageOf?.get(entry.headingId) ?? ''}</span></a></p>`,
        )
        .join('')) +
  '</nav>';

/**
 * **The editor's HTML with its table of contents set** (§19): each
 * `<div data-toc>` becomes the table, and each heading takes the anchor its
 * line links to.
 */
export const contentsDocumentHtml = (
  document: Pick<WpDocument, 'content' | 'headingNumbering'>,
  html: string,
  pageOf?: ReadonlyMap<string, number>,
): string => {
  if (!/<div\b[^>]*\bdata-toc\b/.test(html)) return html;
  const table = contentsHtml(contentsEntries(document), pageOf);
  return html
    .replace(/<div\b[^>]*\bdata-toc\b[^>]*>[\s\S]*?<\/div>/g, () => table)
    .replace(/<h([1-6])\b([^>]*)\sdata-heading-id="([^"]+)"/g, (_whole, level: string, before: string, id: string) => `<h${level}${before} id="h-${id}" data-heading-id="${id}"`);
};

/** The page each heading stands on, read from pages already set (§19): the first page its anchor is on. */
export const headingPagesIn = (pages: readonly { body: string }[]): Map<string, number> => {
  const found = new Map<string, number>();
  pages.forEach((page, at) => {
    for (const match of page.body.matchAll(/\bdata-heading-id="([^"]+)"/g)) {
      const id = match[1] as string;
      if (!found.has(id)) found.set(id, at + 1);
    }
  });
  return found;
};

/** The table's page numbers filled in, once the pages are known (§19). */
export const fillContentsPages = (html: string, pageOf: ReadonlyMap<string, number>): string =>
  html.replace(/(<span class="wp-toc-page" data-toc-page="([^"]+)">)[^<]*(<\/span>)/g, (_whole, open: string, id: string, close: string) => `${open}${pageOf.get(id) ?? ''}${close}`);

/** How the table looks on the page and the paper. */
export const DOCUMENT_CONTENTS_CSS = `
.wp-toc { margin: 0 0 12pt; }
.wp-toc .wp-toc-heading { font-size: 16pt; font-weight: 700; margin: 0 0 8pt; }
.wp-toc .wp-toc-entry { margin: 0 0 3pt; }
.wp-toc .wp-toc-entry a { display: flex; align-items: baseline; gap: 4pt; color: inherit; text-decoration: none; }
.wp-toc .wp-toc-leader { flex: 1; border-bottom: 1pt dotted currentColor; transform: translateY(-3pt); min-width: 12pt; }
.wp-toc .wp-toc-page { min-width: 1.5em; text-align: right; }
.wp-toc .wp-toc-l1 { font-weight: 600; }
.wp-toc .wp-toc-l2 { padding-left: 0.25in; }
.wp-toc .wp-toc-l3 { padding-left: 0.5in; }
.wp-toc .wp-toc-empty { color: #888; font-style: italic; }
`;
