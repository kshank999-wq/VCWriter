import { describe, expect, it } from 'vitest';
import { IRREPLACEABLE, prunable, snapshotsToDrop, type SnapshotEntry } from '../index.js';

/**
 * **Which recovery points may be thrown away** (addendum 33 §12).
 *
 * One rule for both hosts, because this is the part whose mistakes show up
 * only when somebody goes looking for the copy that is no longer there.
 */

const at = (minute: number, reason: SnapshotEntry['reason'] = 'autosave', sizeBytes = 1): SnapshotEntry => ({
  id: `${reason}-${minute}`,
  createdAt: `2026-10-08T00:${String(minute).padStart(2, '0')}:00.000Z`,
  reason,
  sizeBytes,
});

describe('pruning recovery points', () => {
  it('keeps the newest and drops the oldest, by count', () => {
    const entries = [at(1), at(2), at(3), at(4), at(5)];
    expect(snapshotsToDrop(entries, { keep: 3 }).sort()).toEqual(['autosave-1', 'autosave-2']);
    expect(snapshotsToDrop(entries, { keep: 9 })).toEqual([]);
  });

  it('never drops the point that is the only copy of a document', () => {
    // The pre-upgrade file and the state a merge overwrote exist nowhere
    // else, so a rolling autosave must not be able to push one out.
    expect(IRREPLACEABLE).toEqual(['pre_migration', 'pre_sync']);
    expect(prunable('autosave')).toBe(true);
    expect(prunable('pre_migration')).toBe(false);
    const entries = [at(1, 'pre_migration'), at(2, 'pre_sync'), at(3), at(4), at(5)];
    expect(snapshotsToDrop(entries, { keep: 1 }).sort()).toEqual(['autosave-3', 'autosave-4']);
  });

  it('caps the pre-sync points on their own, where a host asks', () => {
    // A writer who syncs a conflicted project daily should not accumulate a
    // year of them — and a host with no sync does not pass the cap at all.
    const entries = [at(1, 'pre_sync'), at(2, 'pre_sync'), at(3, 'pre_sync')];
    expect(snapshotsToDrop(entries, { keep: 30, keepPreSync: 2 })).toEqual(['pre_sync-1']);
    expect(snapshotsToDrop(entries, { keep: 30 })).toEqual([]);
  });

  it('keeps the points under a byte budget, where the storage is shared', () => {
    // The browser's half: a quota it shares with every other site, and a book
    // with pictures in it running to megabytes a copy.
    const entries = [at(1, 'autosave', 10), at(2, 'autosave', 10), at(3, 'autosave', 10)];
    expect(snapshotsToDrop(entries, { keep: 30, budgetBytes: 25 })).toEqual(['autosave-1']);
    expect(snapshotsToDrop(entries, { keep: 30, budgetBytes: 100 })).toEqual([]);
  });

  it('keeps the newest whatever it weighs', () => {
    // A copy too big for the whole budget is still the one a writer wants, and
    // dropping it to satisfy arithmetic would be the module deleting the only
    // thing it has to stay tidy.
    const entries = [at(1, 'autosave', 10), at(2, 'autosave', 500)];
    expect(snapshotsToDrop(entries, { keep: 30, budgetBytes: 25 })).toEqual(['autosave-1']);
    expect(snapshotsToDrop([at(2, 'autosave', 500)], { keep: 30, budgetBytes: 25 })).toEqual([]);
  });
});
