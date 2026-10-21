import { z } from 'zod';
import type { ProjectId, WpDocumentId } from '../ids.js';
import { id, timestamps } from './common.js';

/**
 * **A word-processor document** (addendum 42).
 *
 * Its body is the editor's own document model: a ProseMirror tree as JSON,
 * the shape TipTap reads and writes. It is stored as the editor keeps it
 * rather than translated into beats and elements, because a letter or a
 * report has tables, lists and runs of mixed formatting that the manuscript
 * model was never meant to hold. The spec's rule (§11) is a mature
 * editor-native model, with the plain text derived for counting and search.
 *
 * The schema checks the tree's shape and nothing about which node types it
 * holds: what a node means is the editor's business, and a file written by a
 * later build with a node this one does not know must still open.
 */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

const docMarkSchema: z.ZodType<DocMark> = z
  .object({ type: z.string().min(1), attrs: z.record(z.unknown()).optional() })
  .passthrough();

export const docNodeSchema: z.ZodType<DocNode> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      attrs: z.record(z.unknown()).optional(),
      content: z.array(docNodeSchema).optional(),
      marks: z.array(docMarkSchema).optional(),
      text: z.string().optional(),
    })
    .passthrough(),
);

/** The paper a document is set on. Inches, as Word's own Page Setup speaks. */
export const paperSizeSchema = z.enum(['letter', 'legal', 'a4', 'a5']);
export type PaperSize = z.infer<typeof paperSizeSchema>;

export const PAPER_SIZES: Record<PaperSize, { name: string; width: number; height: number }> = {
  letter: { name: 'Letter (8.5 × 11 in)', width: 8.5, height: 11 },
  legal: { name: 'Legal (8.5 × 14 in)', width: 8.5, height: 14 },
  a4: { name: 'A4 (210 × 297 mm)', width: 8.27, height: 11.69 },
  a5: { name: 'A5 (148 × 210 mm)', width: 5.83, height: 8.27 },
};

export const documentPageSetupSchema = z.object({
  paper: paperSizeSchema.default('letter'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  margins: z
    .object({
      top: z.number().min(0).max(4).default(1),
      right: z.number().min(0).max(4).default(1),
      bottom: z.number().min(0).max(4).default(1),
      left: z.number().min(0).max(4).default(1),
    })
    .default({}),
});
export type DocumentPageSetup = z.infer<typeof documentPageSetupSchema>;

/** One outline row and what it stands for in the document. */
export const documentOutlineLinkSchema = z.object({
  itemId: z.string().min(1),
  /** The heading's own id, which it keeps however it is edited or moved. */
  headingId: z.string().nullable().default(null),
  /** An extract the row was made from, in the Extract & Organize bins. */
  extractId: z.string().nullable().default(null),
});
export type DocumentOutlineLink = z.infer<typeof documentOutlineLinkSchema>;

/** Bumped when the stored tree changes shape in a way a reader must know about. */
export const DOCUMENT_SCHEMA_VERSION = 1;

export const wpDocumentSchema = z.object({
  id: id<WpDocumentId>(),
  projectId: id<ProjectId>(),
  title: z.string().max(300).default(''),
  content: docNodeSchema,
  schemaVersion: z.number().int().positive().default(DOCUMENT_SCHEMA_VERSION),
  pageSetup: documentPageSetupSchema.default({}),
  /**
   * Counts every change to the body. A saved extract records the revision it
   * was taken at (spec §5.2), which is how it knows its source has moved on.
   */
  revision: z.number().int().nonnegative().default(0),
  /**
   * The document's own outline (addendum 42 §9): the Outliner tab's tree,
   * kept in step with the headings. Null until the tab is first opened.
   */
  outlineId: z.string().nullable().default(null),
  /**
   * Which outline row stands for which heading, and which for which extract.
   * Kept here rather than on the row: an outline row is synced to the cloud
   * column by column, and a field it did not know would be lost on the way
   * back. The document is the one place that knows its headings, so the
   * binding is the document's.
   */
  outlineLinks: z.array(documentOutlineLinkSchema).default([]),
  /** How the headings are numbered, on the page and in the outline (WP spec §6). */
  headingNumbering: z.enum(['none', 'decimal', 'outline']).default('none'),
  ...timestamps,
});
export type WpDocument = z.infer<typeof wpDocumentSchema>;

/** A document with nothing in it: one empty paragraph, as the editor starts. */
export const emptyDocContent = (): DocNode => ({ type: 'doc', content: [{ type: 'paragraph' }] });
