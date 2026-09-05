import { useCallback, useEffect, useState } from 'react';
import {
  canRestore,
  discardedText,
  restoreDiscardedVersion,
  type ProjectFile,
  type SyncConflict,
} from '@vcwriter/domain';
import type { SnapshotSummary } from '../../preload/index';

const REASON_LABEL: Record<string, string> = {
  autosave: 'Autosave',
  manual: 'Manual',
  pre_migration: 'Before a format upgrade',
  pre_sync: 'Before a sync that had conflicts',
};

const when = (iso: string): string => new Date(iso).toLocaleString();

const size = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

interface Props {
  file: ProjectFile;
  path: string;
  conflicts: SyncConflict[];
  onRestoreVersion(next: ProjectFile): void;
  onRestoreSnapshot(loaded: { path: string; file: ProjectFile; contentHash: string }): void;
  onConflictResolved(id: string): void;
}

/**
 * Recovery (spec §15: no manuscript data loss on crash, update, connectivity
 * interruption or sync conflict).
 *
 * Two ways back, in the order a writer needs them. A sync that overwrote
 * something shows what it overwrote and offers to put it back — which is the
 * only thing that makes the conflict rule honest, because a merge that names
 * the loser and then discards it has still lost the writing. Below that, the
 * snapshots that were being taken all along but which nothing until now could
 * open.
 */
export function RecoveryPanel({
  file,
  path,
  conflicts,
  onRestoreVersion,
  onRestoreSnapshot,
  onConflictResolved,
}: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await window.vcwriter.listSnapshots(path);
    if (result.ok && result.data) setSnapshots(result.data);
  }, [path]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restoreVersion = (conflict: SyncConflict) => {
    if (!canRestore(file, conflict)) {
      setError(
        `“${conflict.label}” cannot be put back on its own — the scene it belonged to is gone. Restore a snapshot from before the sync instead.`,
      );
      return;
    }
    onRestoreVersion(restoreDiscardedVersion(file, conflict));
    onConflictResolved(conflict.id);
    setMessage(`Put back the other version of “${conflict.label}”. It will go out on the next sync.`);
    setError(null);
  };

  const restore = async (snapshot: SnapshotSummary) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await window.vcwriter.restoreSnapshot({ path, snapshotId: snapshot.id });
    setBusy(false);

    if (!result.ok || !result.data) {
      setError(result.error ?? 'That snapshot could not be restored');
      return;
    }
    onRestoreSnapshot(result.data);
    setMessage(`Restored the copy from ${when(snapshot.createdAt)}. The version you had was snapshotted first.`);
    void refresh();
  };

  return (
    <div className="recovery">
      <section>
        <h2>Overwritten by a sync</h2>
        {conflicts.length === 0 ? (
          <p className="muted">Nothing has been overwritten. Conflicts from a sync are listed here.</p>
        ) : (
          <ul className="recovery-list">
            {conflicts.map((conflict) => {
              const text = discardedText(conflict);
              const open = expanded === conflict.id;
              return (
                <li key={conflict.id}>
                  <div className="recovery-row">
                    <div>
                      <strong>{conflict.label}</strong>
                      <p className="muted">
                        Kept the version from {conflict.kept === 'local' ? 'this computer' : 'elsewhere'} (
                        {when(conflict.kept === 'local' ? conflict.localUpdatedAt : conflict.remoteUpdatedAt)}).
                        The other was written{' '}
                        {when(conflict.kept === 'local' ? conflict.remoteUpdatedAt : conflict.localUpdatedAt)}.
                      </p>
                    </div>
                    <div className="recovery-actions">
                      {text ? (
                        <button type="button" onClick={() => setExpanded(open ? null : conflict.id)}>
                          {open ? 'Hide' : 'Show what was overwritten'}
                        </button>
                      ) : null}
                      <button type="button" className="primary" onClick={() => restoreVersion(conflict)}>
                        Put that version back
                      </button>
                    </div>
                  </div>
                  {open && text ? <pre className="recovery-text">{text}</pre> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>Snapshots</h2>
        <p className="muted">
          Recovery points taken as you write, before a format upgrade, and before a sync that had conflicts.
          Restoring takes a snapshot of what you have now first, so it is never a one-way door.
        </p>
        {snapshots.length === 0 ? (
          <p className="muted">No snapshots yet for this project.</p>
        ) : (
          <ul className="recovery-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <div className="recovery-row">
                  <div>
                    <strong>{when(snapshot.createdAt)}</strong>
                    <p className="muted">
                      {REASON_LABEL[snapshot.reason] ?? snapshot.reason} · {size(snapshot.sizeBytes)}
                    </p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void restore(snapshot)}>
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message ? <p className="notice">{message}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
