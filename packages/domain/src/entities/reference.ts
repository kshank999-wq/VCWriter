import { z } from 'zod';
import type { CitationId, ProjectId, ReferenceId } from '../ids.js';
import { id, timestamps } from './common.js';

/**
 * **The Reference Library** (addendum 43, Ken's *Citations & References*
 * spec): a source entered once and cited as often as the writer likes.
 *
 * A **reference** is the source's facts, kept apart from any way of printing
 * them: the style renderer (`citation-style.ts`) turns the same facts into a
 * Chicago note, an APA reference or an MLA entry. A **citation** is one place
 * the source is cited: which source, and the pinpoint (a page, a section, a
 * time) and any note of the writer's. Where a citation stands in the text is a
 * token in the manuscript (`[^cite:id]`), so it moves with its words, and the
 * printed 1, 2, 3 is worked out from the order of the tokens — the spec's
 * design note: *internal source IDs and printed markers are distinct*.
 */

export const referenceTypeSchema = z.enum(['book', 'chapter', 'journal', 'website', 'report', 'interview', 'video', 'other']);
export type ReferenceType = z.infer<typeof referenceTypeSchema>;

export const referenceSchema = z.object({
  id: id<ReferenceId>(),
  projectId: id<ProjectId>(),
  type: referenceTypeSchema.default('book'),
  /** The writer's own handle for it: R12, A, Smith2024. Optional, and never printed. */
  shortCode: z.string().max(40).default(''),
  /** People, each as "Last, First" (or one name for an organisation as author). */
  authors: z.array(z.string().max(200)).default([]),
  /** Editors, or an interview's interviewer. */
  editors: z.array(z.string().max(200)).default([]),
  /** A body as author, where no person is: a ministry, a company. */
  organization: z.string().max(300).default(''),
  title: z.string().max(1000).default(''),
  /** What it appeared in: the journal, the book a chapter is in, the website, the channel. */
  container: z.string().max(1000).default(''),
  publisher: z.string().max(300).default(''),
  place: z.string().max(200).default(''),
  edition: z.string().max(60).default(''),
  /** As much of the date as is known: 2024, 2024-03 or 2024-03-15. */
  date: z.string().max(40).default(''),
  volume: z.string().max(40).default(''),
  issue: z.string().max(40).default(''),
  pages: z.string().max(60).default(''),
  doi: z.string().max(300).default(''),
  url: z.string().max(2000).default(''),
  accessed: z.string().max(40).default(''),
  isbn: z.string().max(40).default(''),
  notes: z.string().max(20_000).default(''),
  /**
   * **A source brought in as one line of text** (addendum 43 §9): a Word
   * footnote, read back with its parts run together. Kept exactly as it came,
   * in the inline marks, and printed as written while the source has no
   * title — a style is a rule about parts, and these have none yet. The
   * library flags it until the writer has separated them.
   */
  asWritten: z.string().max(5000).default(''),
  tags: z.array(z.string().max(80)).default([]),
  /** Set when archived: out of the pickers, kept for every citation already made. */
  archivedAt: z.string().datetime({ offset: true }).nullable().default(null),
  ...timestamps,
});
export type Reference = z.infer<typeof referenceSchema>;

/** What a pinpoint is: the page of a book, the section of a report, the minute of a video. */
export const locatorKindSchema = z.enum(['page', 'pages', 'section', 'chapter', 'paragraph', 'timestamp', 'other']);
export type LocatorKind = z.infer<typeof locatorKindSchema>;

export const citationSchema = z.object({
  id: id<CitationId>(),
  projectId: id<ProjectId>(),
  referenceId: id<ReferenceId>(),
  /**
   * What the manuscript's token names: `[^ab12cd]`. Six hex characters
   * rather than the id, because the token is typed into the line itself and
   * every character of it takes room on the screen; unique in the project,
   * which `insertCitation` makes sure of.
   */
  key: z.string().regex(/^[0-9a-f]{6}$/),
  locatorKind: locatorKindSchema.default('page'),
  locator: z.string().max(120).default(''),
  /** The writer's own words added to the note. */
  note: z.string().max(5000).default(''),
  ...timestamps,
});
export type Citation = z.infer<typeof citationSchema>;

/** How notes and the bibliography are written. Chicago is the footnote-first default (spec §5). */
export const referenceStyleSchema = z.enum(['chicago', 'mla', 'apa', 'custom']);
export type ReferenceStyle = z.infer<typeof referenceStyleSchema>;

export const markerSchemeSchema = z.enum(['numeric', 'alpha', 'symbol']);
export type MarkerScheme = z.infer<typeof markerSchemeSchema>;

/**
 * A project's citation settings (the spec's DocumentCitationSettings). The
 * marker scheme and the note's form are used by **footnote** styles; MLA and
 * APA cite in parentheses in the text, as they are written, and are never
 * dressed up as footnotes (spec §5). *Custom* is footnotes in the marker and
 * note form the writer chooses.
 */
export const citationSettingsSchema = z.object({
  style: referenceStyleSchema.default('chicago'),
  markers: markerSchemeSchema.default('numeric'),
  /** After *, †, ‡, §, ‖, ¶: double them (**, ††…) or go over to numbers. */
  symbolOverflow: z.enum(['double', 'numeric']).default('double'),
  /** Custom only: which style's form the notes take. */
  customNoteForm: z.enum(['chicago', 'apa', 'mla']).default('chicago'),
  /** Where the markers count from: the whole book, or each chapter afresh. */
  restartEach: z.enum(['book', 'chapter']).default('book'),
  bibliographyScope: z.enum(['cited', 'all']).default('cited'),
  bibliographySort: z.enum(['author', 'citation']).default('author'),
  /** Blank means the style's own: Bibliography for Chicago, References for APA, Works Cited for MLA. */
  bibliographyHeading: z.string().max(80).default(''),
});
export type CitationSettings = z.infer<typeof citationSettingsSchema>;
