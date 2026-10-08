/**
 * **What a recovery point is, and which of them may be thrown away**
 * (addendum 33 §12, from Ken: *do the preview saved snapshots*).
 *
 * The desktop has kept rolling snapshots beside every project since it was
 * written — spec §15's *no manuscript data loss* — and the browser preview
 * answered `listSnapshots` with an empty list, which is how a second book
 * imported over a finished story (§10) left nothing at all to go back to.
 * So the preview grows them too, and the moment there are two hosts keeping
 * recovery points **the rule about throwing one away has to live in one
 * place**: it is the only part of this a mistake in cannot be noticed until
 * somebody needs the copy that is no longer there.
 *
 * What is **not** shared is where they are kept and how much room there is.
 * A disk shrugs at thirty copies of a book; a browser has a quota it shares
 * with every other site, so the preview also keeps a budget in bytes — a
 * limit the desktop has no use for and does not pass.
 */

/**
 * Why a recovery point exists, so a writer can find the right one.
 *
 * Named `RecoveryReason` because **`SnapshotReason` is taken** — by
 * `entities/revision.ts`, whose `snapshots` collection sits in every project
 * document and which **nothing has ever written**, a recovery point being a
 * copy beside the project rather than a row inside it. Its vocabulary is not
 * this one either (`pre_import`, `pre_sync_merge`), so merging them would
 * rename what is already on writers' disks. It is the **seventh** name this
 * project has stepped around and the third the compiler caught rather than a
 * reader.
 */
export type RecoveryReason = 'autosave' | 'manual' | 'pre_migration' | 'pre_sync';

export const RECOVERY_REASONS: readonly RecoveryReason[] = [
  'autosave',
  'manual',
  'pre_migration',
  'pre_sync',
];

/**
 * **A snapshot that is the only copy of something is never pruned away.**
 *
 * The pre-upgrade file and the local state a merge overwrote exist nowhere
 * else, so a rolling autosave must not be able to push one out — which is the
 * whole of why pruning is a rule rather than *keep the newest thirty*.
 */
export const IRREPLACEABLE: readonly RecoveryReason[] = ['pre_migration', 'pre_sync'];

export const prunable = (reason: RecoveryReason): boolean => !IRREPLACEABLE.includes(reason);

/** What pruning needs to know about one point: when, why, and how big. */
export interface SnapshotEntry {
  id: string;
  createdAt: string;
  reason: RecoveryReason;
  sizeBytes: number;
}

export interface SnapshotLimits {
  /** How many prunable points to keep. The rest go, oldest first. */
  keep: number;
  /** How many of the pre-sync points to keep, a daily conflict otherwise accumulating a year of them. */
  keepPreSync?: number;
  /**
   * A ceiling on the bytes the prunable points may take together, for a host
   * whose storage is shared and finite. Omitted where there is no such limit.
   */
  budgetBytes?: number;
}

/**
 * **Which recovery points go** — a reading over the list, so both hosts throw
 * away the same ones and neither keeps a second answer.
 *
 * Oldest first within each rule, and the newest is never dropped by the
 * budget: a point too large for the whole budget is the one thing a writer
 * has, and dropping it to satisfy an arithmetic rule would be the module
 * deleting the only copy to stay tidy.
 */
export const snapshotsToDrop = (
  entries: readonly SnapshotEntry[],
  limits: SnapshotLimits,
): string[] => {
  const oldestFirst = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const going = new Set<string>();

  const disposable = oldestFirst.filter((entry) => prunable(entry.reason));
  for (let at = 0; at < disposable.length - limits.keep; at += 1) {
    going.add(disposable[at]!.id);
  }

  if (limits.keepPreSync !== undefined) {
    const preSync = oldestFirst.filter((entry) => entry.reason === 'pre_sync');
    for (let at = 0; at < preSync.length - limits.keepPreSync; at += 1) {
      going.add(preSync[at]!.id);
    }
  }

  if (limits.budgetBytes !== undefined) {
    const kept = disposable.filter((entry) => !going.has(entry.id));
    let total = kept.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    // The newest stays whatever it weighs, so a writer always has the copy
    // they are most likely to want.
    for (const entry of kept.slice(0, -1)) {
      if (total <= limits.budgetBytes) break;
      going.add(entry.id);
      total -= entry.sizeBytes;
    }
  }

  return [...going];
};

/** A project kept in the browser preview's own storage rather than on a disk. */
export const inBrowserStorage = (path: string): boolean => path.startsWith('browser://');

/**
 * **What the recovery points are and where they are kept** — one copy of the
 * promise, read off the path, because the two hosts keep them in places that
 * differ in a way a writer has to know about (`describePhoneShelf`'s rule).
 *
 * On a disk they sit beside the project and a sync that had conflicts leaves
 * one. In a browser there is no sync to leave one, and **they are in that
 * browser**: clearing the site's data takes them with it, which is the one
 * thing somebody relying on this net needs told — the `browser://` in a saved
 * path said rather than hidden (addendum 29 §1), one screen over.
 */
export const describeRecoveryPoints = (path: string): string =>
  inBrowserStorage(path)
    ? 'Copies taken as you write, and before a format upgrade. They are kept in this browser, so clearing its data for this site takes them too — a copy saved to your own disk is the one that outlives it. Restoring keeps what you have now first, so it is never a one-way door.'
    : 'Recovery points taken as you write, before a format upgrade, and before a sync that had conflicts. Restoring takes a snapshot of what you have now first, so it is never a one-way door.';
