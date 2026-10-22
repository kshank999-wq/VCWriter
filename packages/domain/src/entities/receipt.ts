import { z } from 'zod';

/**
 * **A receipt for something sent to a project** (addendum 42 §10, §13): the
 * project, the place in it, and the record it became. Extracts carry theirs;
 * the document carries its outline rows'.
 *
 * Its own file because both an extract and a document hold receipts, and an
 * extract's schema already reads the document's.
 */
export const transferAreaSchema = z.enum(['research', 'scene', 'beat', 'document']);
export type TransferArea = z.infer<typeof transferAreaSchema>;

export const extractReceiptSchema = z.object({
  projectId: z.string().min(1),
  projectTitle: z.string().default(''),
  /** The file it was written into, where the host has one. */
  path: z.string().nullable().default(null),
  area: transferAreaSchema,
  /** The shelf or scene's name in that project, as the writer saw it. */
  areaName: z.string().default(''),
  /** The id of what it became there: a research item, a scene, a beat, a document. */
  resultId: z.string().min(1),
  at: z.string().datetime({ offset: true }),
});
export type ExtractReceipt = z.infer<typeof extractReceiptSchema>;

/** An outline row's receipt: the same, with the row it was for. */
export const rowReceiptSchema = extractReceiptSchema.extend({ itemId: z.string().min(1) });
export type RowReceipt = z.infer<typeof rowReceiptSchema>;
