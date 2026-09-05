import { projectFileSchema, type ProjectFile } from './project-file.js';
import type { SyncConflict } from './sync-merge.js';

/**
 * Putting back a version a merge discarded (spec §15: no manuscript data loss
 * on a sync conflict).
 *
 * Reporting a conflict is not the same as honouring that requirement. The
 * merge has to pick one version to be the project's current state, but the
 * writer is the only one who can say which version was the good one, and they
 * cannot answer if the loser is gone. So a conflict carries the losing record
 * and this puts it back.
 *
 * Restoring is an ordinary edit, not a rewind: `updatedAt` is stamped now, so
 * the restored version is the newest on both sides and the next sync carries
 * it out rather than treating it as stale and overwriting it again. That also
 * means the round trip is symmetrical — restoring the wrong one is undone by
 * restoring the other, and neither is destructive.
 */

interface Identified {
  id: string;
  [key: string]: unknown;
}

export const restoreDiscardedVersion = (
  file: ProjectFile,
  conflict: SyncConflict,
  now: string = new Date().toISOString(),
): ProjectFile => {
  if (conflict.collection === 'project') {
    const { settings, ...project } = conflict.discarded as Record<string, unknown> & {
      settings?: unknown;
    };
    return projectFileSchema.parse({
      ...file,
      project: { ...project, updatedAt: now },
      settings: settings ?? file.settings,
    });
  }

  const current = file[conflict.collection] as unknown as Identified[];
  // The id comes from the conflict rather than the payload: it is the record
  // this conflict is about, and it must not be possible to restore a version
  // under some other record's id.
  const restored: Identified = { ...conflict.discarded, id: conflict.id, updatedAt: now };
  const present = current.some((record) => record.id === conflict.id);

  // A record can lose a conflict and then be deleted before anyone looks at
  // the report. Appending rather than only replacing means "restore" still
  // means restore in that case.
  const next = present
    ? current.map((record) => (record.id === conflict.id ? restored : record))
    : [...current, restored];

  return projectFileSchema.parse({ ...file, [conflict.collection]: next });
};

/**
 * Whether the discarded version can be put back into this project.
 *
 * A beat whose scene is gone cannot be restored on its own — §19 forbids a
 * free-floating beat, and the merge's own orphan pruning would drop it again
 * on the next sync. Better to say so than to appear to restore something and
 * silently lose it a second time.
 */
export const canRestore = (file: ProjectFile, conflict: SyncConflict): boolean => {
  const parentOf: Partial<Record<SyncConflict['collection'], { field: string; collection: keyof ProjectFile }>> = {
    units: { field: 'laneId', collection: 'lanes' },
    beats: { field: 'unitId', collection: 'units' },
    researchItems: { field: 'categoryId', collection: 'researchCategories' },
  };

  const parent = parentOf[conflict.collection];
  if (!parent) return true;

  const parentId = conflict.discarded[parent.field];
  if (typeof parentId !== 'string') return false;

  return (file[parent.collection] as unknown as Identified[]).some((record) => record.id === parentId);
};
