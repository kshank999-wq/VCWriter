import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { ImportBatchId, ProjectId } from '../ids.js';

/**
 * A record of one import (addendum 16 §4, §11's `ImportBatch`).
 *
 * The module exists for one sentence in §4: **never silently discard
 * unsupported content; flag it and preserve the source file reference for
 * review.** A batch is how that promise is kept — every file offered gets an
 * entry, whether it became something or not, and a file nothing could be made
 * of is named rather than dropped.
 *
 * Without this record an import of two hundred notes that quietly skipped nine
 * of them is indistinguishable from one that took them all, and the author
 * finds out a year later when they go looking for a note that was never there.
 */

/**
 * What became of one file.
 *
 * `skipped` and `failed` are separate because they mean different things to
 * the person reading the list. Skipped is *we do not read this kind of file* —
 * their answer is to convert it, or to ask for the format. Failed is *we tried
 * and could not* — their answer is to look at that particular file.
 */
export const IMPORT_OUTCOMES = ['read', 'empty', 'skipped', 'failed'] as const;
export const importOutcomeSchema = z.enum(IMPORT_OUTCOMES);
export type ImportOutcome = z.infer<typeof importOutcomeSchema>;

export const importEntrySchema = z.object({
  /**
   * The file's own name, exactly as it came in.
   *
   * §4 asks that original filenames be preserved, and this is the only place
   * they survive: a note's title is the author's to change, and the moment
   * they change it the trail back to `lecture-notes-final-v3.txt` is gone
   * unless it was written down here.
   */
  name: z.string().default(''),
  outcome: importOutcomeSchema,
  /** Why, in a sentence, for anything that is not `read`. */
  detail: z.string().default(''),
  /** The research items it became. Empty for everything else. */
  itemIds: z.array(z.string()).default([]),
  /** The graphics it became. Empty for everything else. */
  assetIds: z.array(z.string()).default([]),
});
export type ImportEntry = z.infer<typeof importEntrySchema>;

export const importBatchSchema = z.object({
  id: id<ImportBatchId>(),
  projectId: id<ProjectId>(),
  /** Every file offered, in the order they were offered. */
  entries: z.array(importEntrySchema).default([]),
  ...timestamps,
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

/**
 * There is no `status` and no `warnings` column, which §11 lists.
 *
 * Both are **readings of the entries** — a batch with a skipped file has
 * warnings, and a batch is finished when it is written down. Storing either
 * would be a second copy of something the entries already say, and the copy is
 * the one that goes stale when an entry is corrected.
 */
