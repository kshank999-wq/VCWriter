import { z } from 'zod';
import { id, isoDateTime } from './common.js';
import type { ProjectId, SnapshotId } from '../ids.js';

/**
 * Recovery points (spec §6 autosave/version protection, §14 backup before
 * destructive migrations, §15 "no manuscript data loss").
 */
export const snapshotReasonSchema = z.enum(['autosave', 'manual', 'pre_migration', 'pre_import', 'pre_sync_merge']);
export type SnapshotReason = z.infer<typeof snapshotReasonSchema>;

export const snapshotSchema = z.object({
  id: id<SnapshotId>(),
  projectId: id<ProjectId>(),
  createdAt: isoDateTime(),
  reason: snapshotReasonSchema,
  label: z.string().default(''),
  formatVersion: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative().default(0),
  /** Content hash so identical autosaves are not stored twice. */
  contentHash: z.string().default(''),
  /** Path/key of the stored payload; local file path on desktop, object key in cloud. */
  location: z.string().default(''),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
