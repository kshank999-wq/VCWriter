'use client';

import { useState } from 'react';
import {
  HOW_NAMES,
  TRAY_HOWS,
  seatInitials,
  seatName,
  type Curatable,
  type SequenceRow,
  type Seat,
  type Submission,
  type TrayHow,
  type TrayItem,
} from '@vcwriter/domain';

/**
 * The Curation Tray and the preview of the master (addendum 07 §12, stage 9).
 *
 * **This is the point of the module**, and the page is arranged to say so: what
 * is waiting, what is in the tray, what the master would read like, and one
 * button. The source specification's reason for the tray is the right one —
 * *without it, reviewing competing ideas is copy-and-paste chaos* — so the tray
 * is a place things sit and are looked at before anybody commits.
 *
 * **Nothing on this page destroys anything.** Taking a piece out of the tray
 * leaves the contribution where it was; committing writes a *new* master beside
 * the one before it. The words say so, because a button marked *Commit* on a
 * page full of other people's work needs to.
 */

export function Tray({
  roomId,
  tray,
  offers,
  waiting,
  seats,
  sequence,
  refusal,
}: {
  roomId: string;
  tray: TrayItem[];
  /** What each waiting contribution offers, by submission. */
  offers: Record<string, Curatable[]>;
  waiting: Submission[];
  seats: Seat[];
  /** The master as it would read, from the same function that commits it. */
  sequence: SequenceRow[];
  /** What the merge would refuse, where it would. */
  refusal: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});

  const nameOf = (userId: string): string => {
    const seat = seats.find((one) => one.userId === userId);
    return seat ? seatName(seat) : 'Somebody no longer in the room';
  };
  const colourOf = (userId: string): string =>
    seats.find((one) => one.userId === userId)?.colour || '#666666';

  const after = async (response: Response, whenNot: string) => {
    setBusy(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? whenNot);
      return;
    }
    window.location.reload();
  };

  const take = async (submission: Submission, offered: Curatable) => {
    setBusy(submission.id);
    setError(null);
    await after(
      await fetch(`/api/rooms/${roomId}/curation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          versionId: submission.versionId,
          kind: offered.kind,
          recordId: offered.id,
          how: offered.kind === 'scene' ? 'replace' : 'add',
        }),
      }),
      'That could not be taken.',
    );
  };

  const setHow = async (item: TrayItem, how: TrayHow) => {
    setBusy(item.id);
    setError(null);
    await after(
      await fetch(`/api/rooms/${roomId}/curation/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ how }),
      }),
      'That could not be changed.',
    );
  };

  const drop = async (item: TrayItem) => {
    setBusy(item.id);
    setError(null);
    await after(
      await fetch(`/api/rooms/${roomId}/curation/${item.id}`, { method: 'DELETE' }),
      'That could not be taken out.',
    );
  };

  const commit = async () => {
    setBusy('commit');
    setError(null);
    await after(
      await fetch(`/api/rooms/${roomId}/curation/commit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label }),
      }),
      'The master could not be assembled.',
    );
  };

  return (
    <>
      <h3>Waiting to be curated</h3>
      {waiting.length === 0 ? (
        <p className="lede">
          Nothing is waiting. A pass a writer submits arrives here, and you take what you want of it
          into the tray.
        </p>
      ) : (
        <div className="offers">
          {waiting.map((submission) => {
            const offered = offers[submission.id] ?? [];
            const chosen = picked[submission.id] ?? offered[0]?.id ?? '';
            return (
              <article key={submission.id} className="offer">
                <header>
                  <span
                    className="room-chip"
                    style={{ background: colourOf(submission.authorId) }}
                    aria-hidden
                  >
                    {seatInitials(
                      seats.find((one) => one.userId === submission.authorId) ?? { displayName: '', initials: '', email: '' },
                    ) || '—'}
                  </span>
                  <strong>{nameOf(submission.authorId)}</strong>
                  {submission.note ? <span className="small muted">{submission.note}</span> : null}
                </header>

                {offered.length === 0 ? (
                  <p className="small muted">Nothing in it to take.</p>
                ) : (
                  <div className="offer-take">
                    <select
                      aria-label={`What to take from ${nameOf(submission.authorId)}`}
                      value={chosen}
                      onChange={(event) =>
                        setPicked((current) => ({ ...current, [submission.id]: event.target.value }))
                      }
                    >
                      {offered.map((one) => (
                        <option key={`${one.kind}:${one.id}`} value={one.id}>
                          {one.kind === 'scene' ? 'Scene' : '  Beat'} — {one.label}
                          {one.words > 0 ? ` · ${one.words} words` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="button small"
                      disabled={busy === submission.id}
                      onClick={() => {
                        const one = offered.find((candidate) => candidate.id === chosen);
                        if (one) void take(submission, one);
                      }}
                    >
                      Into the tray
                    </button>
                  </div>
                )}

                <p className="small muted">
                  <a
                    href={`/preview?room=${roomId}&version=${submission.versionId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the whole pass
                  </a>{' '}
                  — taking a piece copies nothing and changes nothing on their line.
                </p>
              </article>
            );
          })}
        </div>
      )}

      <h3>In the tray</h3>
      {tray.length === 0 ? (
        <p className="lede">
          Empty. What you put here is a decision, not a copy — the contribution stays exactly where
          it is until you commit, and stays there afterwards too.
        </p>
      ) : (
        <ul className="tray">
          {tray.map((item) => (
            <li key={item.id} className="tray-row">
              <span
                className="room-chip"
                style={{ background: colourOf(item.authorId) }}
                aria-hidden
              >
                {seatInitials(
                  seats.find((one) => one.userId === item.authorId) ?? { displayName: '', initials: '', email: '' },
                ) || '—'}
              </span>
              <span className="tray-what">
                <strong>
                  {item.kind === 'scene' ? 'Scene' : 'Beat'} — {item.label}
                </strong>
                <span className="small block muted">{nameOf(item.authorId)}</span>
              </span>
              <span className="tray-acts">
                <select
                  aria-label={`How ${item.label} goes in`}
                  value={item.how}
                  onChange={(event) => void setHow(item, event.target.value as TrayHow)}
                  disabled={busy === item.id}
                >
                  {TRAY_HOWS.map((how) => (
                    <option key={how} value={how}>
                      {HOW_NAMES[how]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button small secondary"
                  disabled={busy === item.id}
                  onClick={() => void drop(item)}
                >
                  Take it out
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>The master as it would read</h3>
      {refusal ? (
        <p className="error small" role="alert">
          {refusal}
        </p>
      ) : null}
      {sequence.length === 0 ? (
        <p className="lede">Nothing in it yet.</p>
      ) : (
        <ol className="sequence">
          {sequence.map((row) => (
            <li key={row.id} className={row.change ? `sequence-row ${row.change}` : 'sequence-row'}>
              <span className="sequence-what">
                <strong>{row.label}</strong>
                <span className="small muted">
                  {row.beats === 1 ? '1 beat' : `${row.beats} beats`}
                  {row.change === 'added' ? ' · new in this pass' : row.change === 'changed' ? ' · changed' : ''}
                </span>
              </span>
              {/* Who wrote what is in it. More than one name on a scene is the
                  thing §12 asks for, and it comes off the records themselves
                  rather than being tracked beside them. */}
              <span className="sequence-who">
                {row.authorIds.map((authorId) => (
                  <span
                    key={authorId}
                    className="room-chip"
                    style={{ background: colourOf(authorId) }}
                    title={nameOf(authorId)}
                  >
                    {seatInitials(
                      seats.find((one) => one.userId === authorId) ?? { displayName: '', initials: '', email: '' },
                    ) || '—'}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="commit">
        <label className="field">
          <span>Call this master</span>
          <input
            type="text"
            value={label}
            placeholder="Room Pass"
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={busy === 'commit' || tray.length === 0 || refusal !== null}
          onClick={() => void commit()}
        >
          {busy === 'commit' ? 'Assembling…' : 'Make this the master'}
        </button>
      </div>

      <p className="small">
        Committing writes a <em>new</em> master version beside the one before it and points the room
        at it. Nothing is overwritten and nothing is deleted: the master the room has now stays a
        version anybody can open, every writer's line is untouched, and the merge records every
        contribution it drew from.
      </p>

      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
