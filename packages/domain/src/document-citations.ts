import { newId } from './ids.js';
import { linkedCopy } from './library-links.js';
import { nowIso } from './entities/common.js';
import { parseInline } from './entities/inline.js';
import { referenceSchema, type Reference } from './entities/reference.js';
import { citationSettingsOf, citedReferences, normalizeDoi, occurrencesIn, referenceCreator, type CitationOccurrence } from './citations.js';
import { bibliographyHeadingOf, citationInText, citationNotes, referenceBibliography, usesFootnotes } from './citation-style.js';
import type { ReferenceId } from './ids.js';
import type { ProjectFile } from './project-file.js';
import type { DocNode } from './entities/document.js';

/**
 * **The Reference Library in the word processor** (addendum 43 §11).
 *
 * A Document project keeps a library of its own, the same `references` and
 * `citations` every project file carries, and cites it the way a book does:
 * Chicago's notes, APA's and MLA's parentheses, markers in the writer's
 * scheme, and a bibliography kept current. The differences are the editor's:
 *
 * - a citation is an inline node, `citation` with its key, rather than a
 *   token in a line of text
 * - each document counts its notes on its own, from 1
 * - the browser cannot put a note at the foot of the page it falls on, so
 *   print and PDF set the pages first, in the renderer, with each page's
 *   notes at its foot (§23); Word sets them as its own footnotes
 * - a bibliography is a block the writer puts where it goes, and it fills
 *   itself from the sources the document cites
 */

/** Everything a document's citations print as, in one reading. */
export interface DocumentCitations {
  /** Footnote markers (Chicago, custom) or parentheticals (APA, MLA). */
  raised: boolean;
  occurrences: CitationOccurrence[];
  /** By key: the marker, or the parenthetical in inline marks. */
  inText: ReadonlyMap<string, string>;
  /** Each note in order, for each place cited, in inline marks. Empty for APA and MLA. */
  notes: { key: string; marker: string; text: string }[];
  heading: string;
  /** The bibliography's entries, in inline marks. */
  bibliography: string[];
  /**
   * The writer's own endnotes, in order (addendum 42 §18): set at the end of
   * the document under *Endnotes*, numbered i, ii, iii as Word numbers them.
   * Their footnotes are in `notes`, numbered with the citations' notes.
   */
  endnotes: { key: string; marker: string; text: string }[];
}

export const documentCitations = (file: ProjectFile, documentId: string): DocumentCitations => {
  const settings = citationSettingsOf(file);
  const occurrences = occurrencesIn(file, documentId);
  const inText = new Map<string, string>();
  for (const occurrence of occurrences) if (!inText.has(occurrence.key)) inText.set(occurrence.key, citationInText(file, occurrence));
  return {
    raised: usesFootnotes(settings),
    occurrences,
    inText,
    notes: citationNotes(file, occurrences).map((note) => ({ key: note.occurrence.key, marker: note.marker, text: note.text })),
    heading: bibliographyHeadingOf(settings),
    bibliography: referenceBibliography(file, occurrences).map((entry) => entry.text),
    endnotes: [],
  };
};

// ------------------------------------------------- the writer's own notes

/** A footnote or endnote the writer wrote (addendum 42 §18), as the editor holds it. */
export interface WriterNote {
  id: string;
  kind: 'foot' | 'end';
  text: string;
}

/** The writer's notes in a document, in the order they stand. */
export const writerNotesIn = (content: DocNode): WriterNote[] => {
  const found: WriterNote[] = [];
  const walk = (node: DocNode) => {
    if (node.type === 'footnote') {
      found.push({
        id: String(node.attrs?.['id'] ?? ''),
        kind: node.attrs?.['kind'] === 'end' ? 'end' : 'foot',
        text: String(node.attrs?.['text'] ?? ''),
      });
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(content);
  return found;
};

const ROMAN: ReadonlyArray<[number, string]> = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];
/** An endnote's number as Word sets it: i, ii, iii. */
export const romanNumeral = (n: number): string => {
  let left = n;
  let out = '';
  for (const [value, letters] of ROMAN) {
    while (left >= value) {
      out += letters;
      left -= value;
    }
  }
  return out;
};

/**
 * **The writer's footnotes and endnotes, with the citations' notes**
 * (addendum 42 §18, from Ken: *let's get the word processor going*). One
 * sequence of notes at the foot of the page, as Word keeps: a footnote style's
 * citation notes and the writer's footnotes numbered together in the order
 * they stand, 1, 2, 3 — so where there are footnotes the citations' own
 * markers give way to the shared count. Endnotes are their own sequence,
 * i, ii, iii, set at the end. Keyed `fn:<id>` and `en:<id>` beside the
 * citations' keys, so the page view and print find them the same way.
 */
export const withWriterNotes = (cites: DocumentCitations, content: DocNode): DocumentCitations => {
  const writer = writerNotesIn(content);
  if (writer.length === 0) return cites;
  const notes: DocumentCitations['notes'] = [];
  const endnotes: DocumentCitations['endnotes'] = [];
  let citeAt = 0;
  const walk = (node: DocNode) => {
    if (node.type === 'citation' && cites.raised) {
      const note = cites.notes[citeAt];
      citeAt += 1;
      if (note) notes.push(note);
    } else if (node.type === 'footnote') {
      const id = String(node.attrs?.['id'] ?? '');
      const text = String(node.attrs?.['text'] ?? '');
      if (node.attrs?.['kind'] === 'end') endnotes.push({ key: `en:${id}`, marker: '', text });
      else notes.push({ key: `fn:${id}`, marker: '', text });
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(content);
  const inText = new Map(cites.inText);
  const numbered = notes.map((note, at) => ({ ...note, marker: String(at + 1) }));
  for (const note of numbered) inText.set(note.key, note.marker);
  const ended = endnotes.map((note, at) => ({ ...note, marker: romanNumeral(at + 1) }));
  for (const note of ended) inText.set(note.key, note.marker);
  return { ...cites, notes: numbered, endnotes: ended, inText };
};

// ------------------------------------------------------------------ print

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Words in the inline marks as HTML: a style's italics, a source's own bold. */
export const inlineMarksHtml = (text: string): string =>
  parseInline(text)
    .map((span) => {
      const inner = escape(span.text);
      if (!span.bold && !span.italic && !span.underline) return inner;
      return `${span.bold ? '<strong>' : ''}${span.italic ? '<em>' : ''}${span.underline ? '<u>' : ''}${inner}${span.underline ? '</u>' : ''}${span.italic ? '</em>' : ''}${span.bold ? '</strong>' : ''}`;
    })
    .join('');

const markOf = (marker: string): string => (/^[0-9a-z]+$/.test(marker) ? `${marker}.` : marker);

/** The nth note (from 1) as the page sets it: its marker, linked back to where it is cited, and its words. */
export const noteHtml = (cites: DocumentCitations, n: number): string => {
  const note = cites.notes[n - 1];
  if (!note) return '';
  return `<p class="wp-note" id="wp-note-${n}"><a href="#wp-ref-${n}">${escape(markOf(note.marker))}</a> ${inlineMarksHtml(note.text)}</p>`;
};

/** The nth endnote (from 1), as the end of the document sets it (addendum 42 §18). */
export const endnoteHtml = (cites: DocumentCitations, n: number): string => {
  const note = cites.endnotes[n - 1];
  if (!note) return '';
  return `<p class="wp-note wp-endnote-text" id="wp-endnote-${n}"><a href="#wp-endref-${n}">${escape(markOf(note.marker))}</a> ${inlineMarksHtml(note.text)}</p>`;
};

/** The bibliography as the page sets it: its heading and one hanging entry per source. */
export const bibliographyHtml = (cites: DocumentCitations): string =>
  `<section class="wp-bibliography"><h2>${escape(cites.heading)}</h2>` +
  (cites.bibliography.length === 0
    ? '<p class="wp-bibliography-empty">The sources this document cites will be listed here.</p>'
    : cites.bibliography.map((entry) => `<p class="wp-bibliography-entry">${inlineMarksHtml(entry)}</p>`).join('')) +
  '</section>';

/**
 * **The editor's HTML with its citations set** (addendum 43 §11): each
 * citation node's empty `<sup>` becomes its marker or its parenthetical, each
 * bibliography block its list, and in a footnote style the notes follow the
 * text under *Notes*, before the bibliography where there is one — a document
 * laid out by the browser has no page foot to put them at.
 */
export const citeDocumentHtml = (
  cites: DocumentCitations,
  html: string,
  /**
   * Whether the notes are set at the end. Print and PDF set them at the foot
   * of each page instead (§23), and ask for none here.
   */
  notesAtEnd = true,
): string => {
  let at = 0;
  let endAt = 0;
  const set = html
    // Citations and the writer's notes in one pass, so the notes at the foot
    // number in the order they stand (addendum 42 §18).
    .replace(
      /<sup\b[^>]*\bdata-cite="([0-9a-f]{6})"[^>]*>\s*<\/sup>|<sup\b([^>]*\bdata-footnote="([^"]*)"[^>]*)>[^<]*<\/sup>/g,
      (_whole, key: string | undefined, attrs: string | undefined, id: string | undefined) => {
        if (key) {
          const said = cites.inText.get(key);
          if (!said) return '';
          if (cites.raised) {
            at += 1;
            return `<sup class="wp-cite"><a href="#wp-note-${at}" id="wp-ref-${at}">${escape(said)}</a></sup>`;
          }
          return ` <span class="wp-cite-text">${inlineMarksHtml(said)}</span>`;
        }
        const end = /\bdata-kind="end"/.test(attrs ?? '');
        const said = cites.inText.get(`${end ? 'en' : 'fn'}:${id ?? ''}`);
        if (!said) return '';
        if (end) {
          endAt += 1;
          return `<sup class="wp-cite wp-endref"><a href="#wp-endnote-${endAt}" id="wp-endref-${endAt}">${escape(said)}</a></sup>`;
        }
        at += 1;
        return `<sup class="wp-cite"><a href="#wp-note-${at}" id="wp-ref-${at}">${escape(said)}</a></sup>`;
      },
    )
    .replace(/<div\b[^>]*\bdata-bibliography\b[^>]*>\s*<\/div>/g, () => bibliographyHtml(cites));
  const sections: string[] = [];
  if (notesAtEnd && cites.notes.length > 0) {
    sections.push(`<section class="wp-notes"><h2>Notes</h2>${cites.notes.map((_note, index) => noteHtml(cites, index + 1)).join('')}</section>`);
  }
  // Endnotes always stand at the end, on paper as on the screen.
  if (cites.endnotes.length > 0) {
    sections.push(`<section class="wp-notes wp-endnotes"><h2>Endnotes</h2>${cites.endnotes.map((_note, index) => endnoteHtml(cites, index + 1)).join('')}</section>`);
  }
  if (sections.length === 0) return set;
  // Notes come before the bibliography, as a paper sets them; with none, at the end.
  const section = sections.join('');
  const bibliographyAt = set.indexOf('<section class="wp-bibliography">');
  return bibliographyAt >= 0 ? `${set.slice(0, bibliographyAt)}${section}${set.slice(bibliographyAt)}` : `${set}${section}`;
};

/** How the notes, the markers and the bibliography look on the page and the paper. */
export const DOCUMENT_CITATION_CSS = `
.wp-doc .wp-cite, .ProseMirror .wp-cite { font-size: 0.7em; line-height: 0; vertical-align: super; }
.wp-doc .wp-cite a { color: inherit; text-decoration: none; }
.wp-doc .wp-notes { margin-top: 2em; border-top: 0.5pt solid currentColor; padding-top: 0.6em; font-size: 0.85em; break-before: auto; }
.wp-doc .wp-notes h2, .wp-doc .wp-bibliography h2 { font-size: 1.1em; }
.wp-doc .wp-note { margin: 0 0 0.4em; }
.wp-doc .wp-note a { color: inherit; text-decoration: none; }
.wp-doc .wp-page-notes { margin-top: auto; padding-top: 4pt; font-size: 0.85em; }
.wp-doc .wp-page-notes::before { content: ""; display: block; width: 2in; border-top: 0.5pt solid currentColor; margin-bottom: 4pt; }
.wp-doc .wp-page-notes .wp-note:last-child { margin-bottom: 0; }
.wp-doc .wp-page-notes.continues::before { width: 100%; }
.wp-doc .wp-note.wp-split { margin-bottom: 0; }
.wp-doc .wp-bibliography-entry, .ProseMirror .wp-bibliography-entry { padding-left: 0.5in; text-indent: -0.5in; margin: 0 0 0.6em; }
`;

// ------------------------------------------------------------- the library

/** What makes two sources the same one: a DOI, an ISBN, or a title by the same first author. */
const sameSourceKeys = (reference: Reference): string[] => {
  const squash = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return [
    reference.doi ? `doi:${normalizeDoi(reference.doi).toLowerCase()}` : '',
    reference.isbn ? `isbn:${reference.isbn.replace(/[\s-]/g, '')}` : '',
    reference.title ? `title:${squash(reference.title)}|${squash(referenceCreator(reference))}` : '',
    !reference.title && reference.asWritten ? `written:${squash(reference.asWritten)}` : '',
  ].filter(Boolean);
};

/**
 * **Bring sources in from another project's library** (addendum 43 §11): the
 * library a book was cited from, shared with the report written about it, or
 * the other way round.
 *
 * Each source comes in as a copy with an id of this project's — a project
 * file is a whole thing of its own, kept and synced on its own, so two files
 * cannot hold one record. A source this library already has (the same DOI, the
 * same ISBN, or the same title by the same first author) is not brought in
 * twice; archived ones are left where they are.
 */
export const bringInReferences = (
  file: ProjectFile,
  from: readonly Reference[],
  /** Only these, where the writer picked; every live source otherwise. */
  only: ReadonlySet<string> | null = null,
  /**
   * The project they come from, where they are to stay linked to it (§29):
   * each copy then follows that library, and a change on either side reaches
   * the other when the library is next opened.
   */
  linkTo: { path: string; title: string } | null = null,
): { file: ProjectFile; added: Reference[]; already: Reference[] } => {
  const known = new Set(file.references.flatMap(sameSourceKeys));
  const added: Reference[] = [];
  const already: Reference[] = [];
  const timestamp = nowIso();
  for (const source of from) {
    if (source.archivedAt !== null) continue;
    if (only && !only.has(source.id)) continue;
    const keys = sameSourceKeys(source);
    if (keys.some((key) => known.has(key))) {
      already.push(source);
      continue;
    }
    for (const key of keys) known.add(key);
    const copy = referenceSchema.parse({
      ...source,
      id: newId<ReferenceId>(),
      projectId: file.project.id,
      link: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    added.push(linkTo ? linkedCopy(copy, source, linkTo.path, linkTo.title) : copy);
  }
  return { file: added.length > 0 ? { ...file, references: [...file.references, ...added] } : file, added, already };
};

/**
 * **The source in this library that is the same as one from another** (§30),
 * by the rule bringing in uses (a DOI, an ISBN, or a title by the same first
 * author); null where this library has none.
 */
export const sameSourceIn = (file: ProjectFile, source: Reference): Reference | null => {
  const keys = new Set(sameSourceKeys(source));
  if (keys.size === 0) return null;
  return file.references.find((one) => one.archivedAt === null && sameSourceKeys(one).some((key) => keys.has(key))) ?? null;
};

/** Sources a document cites, for a count beside the library. */
export const documentCitedCount = (file: ProjectFile, documentId: string): number => citedReferences(file, occurrencesIn(file, documentId)).length;
