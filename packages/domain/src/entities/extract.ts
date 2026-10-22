import { z } from 'zod';
import type { ExtractCategoryId, ExtractId, ExtractPaletteId, ProjectId, WpDocumentId } from '../ids.js';
import { id, orderKey, timestamps } from './common.js';
import { docNodeSchema } from './document.js';
import { extractReceiptSchema } from './receipt.js';

/**
 * **Extract & Organize** (addendum 42 §8, the WP spec's §5).
 *
 * A **palette** is a set of category buttons: General Writing ships with every
 * document, and a writer makes others ("Math Instruction": Addition,
 * Subtraction…). A **category** is one button and the bin behind it. An
 * **extract** is a passage captured into a bin by pressing that button.
 */

/**
 * What a category *is*, whatever it is labelled: the canonical type a later
 * stage maps to a destination (a character's notes, a scene, a beat). The
 * Notes app's own capture keys are reused where they mean the same thing
 * (`capture-vocabulary.ts`). A category a writer makes is `other` unless
 * they say, and no destination is ever assumed from a label (WP spec §5.3).
 */
export const extractKindSchema = z.enum([
  'scene',
  'beat',
  'character',
  'characterization',
  'dialogue',
  'description',
  'location',
  'object',
  'plot_point',
  'note',
  'idea',
  'setup',
  'payoff',
  'research',
  'other',
]);
export type ExtractKind = z.infer<typeof extractKindSchema>;

export const extractPaletteSchema = z.object({
  id: id<ExtractPaletteId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1).max(80),
  /** Set on the palette every document starts with, so it can be found again. */
  builtIn: z.enum(['general_writing']).nullable().default(null),
  orderKey: orderKey(),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type ExtractPalette = z.infer<typeof extractPaletteSchema>;

export const extractCategorySchema = z.object({
  id: id<ExtractCategoryId>(),
  paletteId: id<ExtractPaletteId>(),
  label: z.string().min(1).max(60),
  kind: extractKindSchema.default('other'),
  /** A swatch, so a button and its marks in the page can be told apart at a glance. */
  color: z.string().max(20).default('#8FA8C4'),
  orderKey: orderKey(),
  enabled: z.boolean().default(true),
  /**
   * The research shelf this button's extracts go to by default, by name
   * (WP spec §5: *default destination*): "Multiplication" in a Math palette
   * can land on a Multiplication shelf of the book. Made in the target if it
   * is not there. Null goes by the kind.
   */
  targetShelf: z.string().max(120).nullable().default(null),
  ...timestamps,
});
export type ExtractCategory = z.infer<typeof extractCategorySchema>;

export const extractStatusSchema = z.enum(['unassigned', 'ready', 'exported', 'failed']);
export type ExtractStatus = z.infer<typeof extractStatusSchema>;

/** Where an extract went: the receipt is shared with the document's outline rows. */
export { transferAreaSchema, extractReceiptSchema, type TransferArea, type ExtractReceipt } from './receipt.js';

export const extractSchema = z.object({
  id: id<ExtractId>(),
  documentId: id<WpDocumentId>(),
  categoryId: id<ExtractCategoryId>(),
  /**
   * The words as they were when captured. **A snapshot, never a link**: an
   * edit to the document later does not silently change what was saved
   * (WP spec §5.2), and the sidebar says when the two have parted.
   */
  textPlain: z.string().max(200_000),
  /** The same passage with its formatting, as the editor's tree. */
  textRich: z.array(docNodeSchema).default([]),
  /** The document's revision when it was taken. */
  sourceRevision: z.number().int().nonnegative().default(0),
  title: z.string().max(200).default(''),
  tags: z.array(z.string().max(40)).max(30).default([]),
  status: extractStatusSchema.default('unassigned'),
  /** Its place in the bin. */
  orderKey: orderKey(),
  /**
   * Every project it has been sent to, and what it became there (addendum
   * 42 §10). The receipt is what stops a second send making a second copy,
   * and what the bin shows as *Sent to…*.
   */
  sentTo: z.array(extractReceiptSchema).default([]),
  ...timestamps,
});
export type Extract = z.infer<typeof extractSchema>;
