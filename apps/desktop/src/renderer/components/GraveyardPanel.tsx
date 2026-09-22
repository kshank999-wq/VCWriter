import { useState } from 'react';
import {
  describeEmptying,
  emptyGraveyard,
  forgetOne,
  graveyard,
  restoreFromGraveyard,
  type BuriedRow,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The graveyard (addendum 24, from Ken: *anything that gets removed or
 * deleted, instead of deleting it permanently, it goes to the graveyard, just
 * in case you accidentally delete something, you can restore it*).
 *
 * Deliberately the plainest screen in the room: a list, newest first, and one
 * button per row. There is nothing to arrange here and nothing to read — a
 * writer arrives having just made a mistake, and what they want is the thing
 * they deleted a moment ago, at the top, with **Restore** beside it.
 *
 * The two destructive acts are the ones that ask. Everything else here is
 * reversible, which is the whole point of the screen.
 */

const when = (at: string): string => {
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export function GraveyardPanel({
  file,
  onUpdate,
}: {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const rows = graveyard(file);
  const [emptying, setEmptying] = useState(false);

  return (
    <div className="research-panel graveyard">
      {/* No heading of its own: the room's own bar already says Graveyard,
          and a second copy was two of them on the screen. */}
      <header className="graveyard-head">
        <p className="muted small">
          Everything deleted from Research, newest first. Nothing here is gone: <em>Restore</em> puts it back exactly where it
          was, with what it was linked to.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="muted">
          Nothing has been deleted. When something is, it waits here instead of going — so a delete by accident costs a click
          rather than the work.
        </p>
      ) : (
        <>
          <ul className="graveyard-list">
            {rows.map((row) => (
              <GraveRow
                key={`${row.kind}:${row.id}`}
                row={row}
                onRestore={() => onUpdate((current) => restoreFromGraveyard(current, { kind: row.kind, id: row.id }))}
                onForget={() => onUpdate((current) => forgetOne(current, { kind: row.kind, id: row.id }))}
              />
            ))}
          </ul>

          {/* The one act here that destroys, so it is the one that asks. */}
          <div className="graveyard-foot">
            {emptying ? (
              <span className="graveyard-ask">
                <span className="muted small">{describeEmptying(file)}</span>
                <button
                  type="button"
                  className="ghost small danger"
                  onClick={() => {
                    onUpdate((current) => emptyGraveyard(current));
                    setEmptying(false);
                  }}
                >
                  Empty it
                </button>
                <button type="button" className="ghost small" onClick={() => setEmptying(false)}>
                  Keep them
                </button>
              </span>
            ) : (
              <button type="button" className="ghost small" onClick={() => setEmptying(true)}>
                Empty the graveyard…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One thing that was deleted. **Restore** is the plain button because it is
 * what the screen is for; forgetting one asks, for the same reason emptying
 * does — it is the only thing on the row that cannot be undone.
 */
function GraveRow({ row, onRestore, onForget }: { row: BuriedRow; onRestore(): void; onForget(): void }) {
  const [asking, setAsking] = useState(false);
  return (
    <li className="graveyard-row">
      <span className="graveyard-what">
        <span className="graveyard-kind muted">{row.word}</span>
        <span className="graveyard-name">{row.name}</span>
        <span className="graveyard-when muted small">{when(row.at)}</span>
      </span>
      {asking ? (
        <span className="graveyard-ask">
          <span className="muted small">This one goes for good.</span>
          <button
            type="button"
            className="ghost small danger"
            onClick={() => {
              onForget();
              setAsking(false);
            }}
          >
            Forget it
          </button>
          <button type="button" className="ghost small" onClick={() => setAsking(false)}>
            Keep it
          </button>
        </span>
      ) : (
        <span className="graveyard-acts">
          <button type="button" className="small" onClick={onRestore}>
            Restore
          </button>
          <button type="button" className="ghost small" aria-label={`Forget ${row.name}`} onClick={() => setAsking(true)}>
            ×
          </button>
        </span>
      )}
    </li>
  );
}
