import { projectFileSchema, type ProjectFile } from './project-file.js';
import { SYNC_COLLECTIONS, type SyncCollection } from './sync-mapping.js';

/**
 * Merging a local project with the copy in the cloud (spec §14: optimistic
 * local editing with safe sync behaviour where mobile and desktop may edit the
 * same project; §15: no manuscript data loss on a sync conflict).
 *
 * The merge is per record, not per project, and it uses the timestamp of the
 * last successful sync to tell "changed since we last agreed" from "unchanged":
 *
 *  - changed on one side only  → that side wins, no conflict
 *  - changed on both sides     → the newer `updatedAt` wins, and the loser is
 *                                reported so the writer can be told
 *  - present locally, missing remotely, created after the last sync
 *                              → a local creation to push
 *  - present locally, missing remotely, created before the last sync
 *                              → deleted remotely, so delete locally
 *  - missing locally, present remotely, created after the last sync
 *                              → a remote creation to pull
 *  - missing locally, present remotely, created before the last sync
 *                              → deleted locally, so delete remotely
 *
 * One deliberate asymmetry: when a record was edited on one side and deleted on
 * the other, the edit wins and the record survives. Losing a scene someone was
 * still writing is the worse failure, and an unwanted record is one click to
 * remove again.
 */

export interface SyncState {
  /** ISO timestamp of the last successful sync, or null if never synced. */
  lastSyncedAt: string | null;
}

export interface SyncConflict {
  collection: SyncCollection | 'project';
  id: string;
  label: string;
  /** Which side the merge kept. */
  kept: 'local' | 'remote';
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  /**
   * The version the merge did not keep, whole.
   *
   * §15 asks for no manuscript data loss on a sync conflict, and a merge that
   * picks a winner and forgets the loser cannot honour that however carefully
   * it reports the count. So the losing record travels with the conflict: the
   * desktop shows what was overwritten and can put it back.
   *
   * Typed loosely because one conflict list spans every collection. Read it
   * through `discardedText`, which knows where the prose is in each.
   */
  discarded: Record<string, unknown>;
}

/**
 * The writer-visible text of a version that lost, or null when there is none.
 *
 * A beat's prose lives in its manuscript elements, a research item's in its
 * body, a character's in their notes. This is what goes in front of someone
 * deciding whether they have just lost something they wanted.
 */
export const discardedText = (conflict: SyncConflict): string | null => {
  const record = conflict.discarded;

  const manuscript = record['manuscript'];
  if (manuscript && typeof manuscript === 'object' && Array.isArray((manuscript as { elements?: unknown }).elements)) {
    const text = ((manuscript as { elements: Array<{ text?: unknown }> }).elements ?? [])
      .map((element) => (typeof element.text === 'string' ? element.text : ''))
      .filter((line) => line.trim().length > 0)
      .join('\n');
    if (text.trim().length > 0) return text;
  }

  for (const field of ['body', 'summary', 'notes', 'arcNotes', 'description'] as const) {
    const value = record[field];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }

  return null;
};

export interface MergeResult {
  merged: ProjectFile;
  conflicts: SyncConflict[];
  /** Counts for a plain-language report to the writer. */
  summary: {
    pulled: number;
    pushed: number;
    deletedLocally: number;
    revivedByEdit: number;
  };
}

interface Timestamped {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const labelOf = (record: Record<string, unknown>): string => {
  const candidate = record['title'] ?? record['name'];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'Untitled';
};

const changedSince = (record: Timestamped, since: string | null): boolean =>
  since === null || record.updatedAt > since;

const createdSince = (record: Timestamped, since: string | null): boolean =>
  since === null || record.createdAt > since;

interface CollectionMerge<T extends Timestamped> {
  records: T[];
  conflicts: SyncConflict[];
  pulled: number;
  pushed: number;
  deletedLocally: number;
  revivedByEdit: number;
}

const mergeCollection = <T extends Timestamped>(
  collection: SyncCollection,
  local: readonly T[],
  remote: readonly T[],
  lastSyncedAt: string | null,
): CollectionMerge<T> => {
  const result: CollectionMerge<T> = {
    records: [],
    conflicts: [],
    pulled: 0,
    pushed: 0,
    deletedLocally: 0,
    revivedByEdit: 0,
  };

  const localById = new Map(local.map((record) => [record.id, record]));
  const remoteById = new Map(remote.map((record) => [record.id, record]));

  for (const localRecord of local) {
    const remoteRecord = remoteById.get(localRecord.id);

    if (!remoteRecord) {
      if (createdSince(localRecord, lastSyncedAt)) {
        // New here since the last sync: push it.
        result.records.push(localRecord);
        result.pushed += 1;
      } else if (changedSince(localRecord, lastSyncedAt)) {
        // Deleted there, edited here. The edit wins; the record survives.
        result.records.push(localRecord);
        result.revivedByEdit += 1;
        result.pushed += 1;
      } else {
        result.deletedLocally += 1;
      }
      continue;
    }

    const localChanged = changedSince(localRecord, lastSyncedAt);
    const remoteChanged = changedSince(remoteRecord, lastSyncedAt);

    if (localChanged && remoteChanged && localRecord.updatedAt !== remoteRecord.updatedAt) {
      const keepLocal = localRecord.updatedAt > remoteRecord.updatedAt;
      result.records.push(keepLocal ? localRecord : remoteRecord);
      if (keepLocal) result.pushed += 1;
      else result.pulled += 1;
      result.conflicts.push({
        collection,
        id: localRecord.id,
        label: labelOf(localRecord as unknown as Record<string, unknown>),
        kept: keepLocal ? 'local' : 'remote',
        localUpdatedAt: localRecord.updatedAt,
        remoteUpdatedAt: remoteRecord.updatedAt,
        discarded: (keepLocal ? remoteRecord : localRecord) as unknown as Record<string, unknown>,
      });
      continue;
    }

    if (remoteChanged && !localChanged) {
      result.records.push(remoteRecord);
      result.pulled += 1;
      continue;
    }

    if (localChanged && !remoteChanged) {
      result.records.push(localRecord);
      result.pushed += 1;
      continue;
    }

    // Neither side moved; either copy will do.
    result.records.push(localRecord);
  }

  for (const remoteRecord of remote) {
    if (localById.has(remoteRecord.id)) continue;

    if (createdSince(remoteRecord, lastSyncedAt)) {
      result.records.push(remoteRecord);
      result.pulled += 1;
    } else if (changedSince(remoteRecord, lastSyncedAt)) {
      // Deleted here, edited there. Same rule, other direction.
      result.records.push(remoteRecord);
      result.revivedByEdit += 1;
      result.pulled += 1;
    }
    // Otherwise it was deleted locally and unchanged remotely: stay deleted.
  }

  return result;
};

/**
 * Drop records whose parent did not survive the merge, so a revived beat never
 * ends up without the scene it belongs to (§19: no free-floating beats).
 */
const pruneOrphans = (file: ProjectFile): ProjectFile => {
  const laneIds = new Set(file.lanes.map((lane) => lane.id as string));
  const units = file.units.filter((unit) => laneIds.has(unit.laneId));
  const unitIds = new Set(units.map((unit) => unit.id as string));
  const beats = file.beats.filter((beat) => unitIds.has(beat.unitId));
  const categoryIds = new Set(file.researchCategories.map((category) => category.id as string));
  const researchItems = file.researchItems.filter((item) => categoryIds.has(item.categoryId));

  const survivingIds = new Set<string>([
    file.project.id,
    ...laneIds,
    ...unitIds,
    ...beats.map((beat) => beat.id as string),
    ...categoryIds,
    ...researchItems.map((item) => item.id as string),
    ...file.characters.map((character) => character.id as string),
    ...file.setupsPayoffs.map((record) => record.id as string),
  ]);

  return {
    ...file,
    units,
    beats,
    researchItems,
    links: file.links.filter((link) => survivingIds.has(link.from.id) && survivingIds.has(link.to.id)),
  };
};

export const mergeProjects = (
  local: ProjectFile,
  remote: ProjectFile,
  state: SyncState,
): MergeResult => {
  const conflicts: SyncConflict[] = [];
  const summary = { pulled: 0, pushed: 0, deletedLocally: 0, revivedByEdit: 0 };
  const collections: Partial<Record<SyncCollection, unknown[]>> = {};

  for (const collection of SYNC_COLLECTIONS) {
    const merged = mergeCollection(
      collection,
      local[collection] as unknown as Timestamped[],
      remote[collection] as unknown as Timestamped[],
      state.lastSyncedAt,
    );
    collections[collection] = merged.records;
    conflicts.push(...merged.conflicts);
    summary.pulled += merged.pulled;
    summary.pushed += merged.pushed;
    summary.deletedLocally += merged.deletedLocally;
    summary.revivedByEdit += merged.revivedByEdit;
  }

  // The project record itself is one row, merged by the same rule — with one
  // guard. Every structural edit touches `project.updatedAt`, so two people
  // editing different beats would otherwise "conflict" on the project row every
  // single sync. When nothing about the project actually differs, take the
  // later timestamp and say nothing.
  const localChanged = changedSince(local.project, state.lastSyncedAt);
  const remoteChanged = changedSince(remote.project, state.lastSyncedAt);
  let project = local.project;
  let settings = local.settings;

  const projectContentMatches =
    JSON.stringify({ ...local.project, updatedAt: '' }) ===
      JSON.stringify({ ...remote.project, updatedAt: '' }) &&
    JSON.stringify(local.settings) === JSON.stringify(remote.settings);

  if (projectContentMatches) {
    project =
      remote.project.updatedAt > local.project.updatedAt ? remote.project : local.project;
    const merged = projectFileSchema.parse({
      ...local,
      project,
      settings,
      ...collections,
      snapshots: local.snapshots,
    });
    return { merged: pruneOrphans(merged), conflicts, summary };
  }

  if (remoteChanged && (!localChanged || remote.project.updatedAt > local.project.updatedAt)) {
    project = remote.project;
    settings = remote.settings;
    if (localChanged) {
      conflicts.push({
        collection: 'project',
        id: local.project.id,
        label: local.project.title,
        kept: 'remote',
        localUpdatedAt: local.project.updatedAt,
        remoteUpdatedAt: remote.project.updatedAt,
        discarded: { ...local.project, settings: local.settings } as unknown as Record<string, unknown>,
      });
    }
  } else if (localChanged && remoteChanged) {
    conflicts.push({
      collection: 'project',
      id: local.project.id,
      label: local.project.title,
      kept: 'local',
      localUpdatedAt: local.project.updatedAt,
      remoteUpdatedAt: remote.project.updatedAt,
      discarded: { ...remote.project, settings: remote.settings } as unknown as Record<string, unknown>,
    });
  }

  const merged = projectFileSchema.parse({
    ...local,
    project,
    settings,
    ...collections,
    // Snapshots are local recovery points and never travel.
    snapshots: local.snapshots,
  });

  return { merged: pruneOrphans(merged), conflicts, summary };
};

/** A one-line report of what a sync did, for the status area. */
export const describeMerge = (result: MergeResult): string => {
  const parts: string[] = [];
  if (result.summary.pulled > 0) parts.push(`${result.summary.pulled} in`);
  if (result.summary.pushed > 0) parts.push(`${result.summary.pushed} out`);
  if (result.summary.deletedLocally > 0) parts.push(`${result.summary.deletedLocally} removed`);
  if (result.conflicts.length > 0) {
    parts.push(`${result.conflicts.length} ${result.conflicts.length === 1 ? 'conflict' : 'conflicts'}`);
  }
  if (result.summary.revivedByEdit > 0) {
    parts.push(`${result.summary.revivedByEdit} kept after an edit elsewhere`);
  }
  return parts.length === 0 ? 'Already up to date' : parts.join(' · ');
};
