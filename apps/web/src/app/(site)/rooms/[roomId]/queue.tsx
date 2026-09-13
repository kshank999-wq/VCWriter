'use client';

import { useState } from 'react';
import {
  STATE_NAMES,
  describeSubmission,
  isOpen,
  nextStates,
  seatInitials,
  standingOf,
  submitterName,
  type QueueRow,
  type SubmissionState,
} from '@vcwriter/domain';

/**
 * The review queue (addendum 07 §10, stage 6).
 *
 * **Oldest first**, which is the opposite of everywhere else in the product: a
 * version history is newest-first because the newest is the one you want, and a
 * queue is oldest-first because the oldest is the one somebody has been waiting
 * longest for. A queue that buried it under this morning's would quietly punish
 * whoever submitted first.
 *
 * Each row opens the version it references, read-only, in a window of its own
 * (§3.4) — the same window stage 5 built, reached the same way. Submitting is
 * what made that version readable by the showrunner at all.
 *
 * **Nothing here deletes anything** (§1). Rejected is a state; the row stays,
 * the version stays, and the decision can be unmade.
 */

const DECISIONS: Partial<Record<SubmissionState, string>> = {
  in_review: 'Reading it',
  approved: 'Approve',
  revision_requested: 'Ask for another pass',
  rejected: 'Not this one',
  incorporated: 'It is in the master',
  submitted: 'Put it back in the queue',
};

const when = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' · ' +
        at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export function Queue({
  roomId,
  rows,
  canDecide,
}: {
  roomId: string;
  rows: QueueRow[];
  /** Whether this reader decides, or is only watching their own work. */
  canDecide: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});

  const decide = async (submissionId: string, state: SubmissionState) => {
    setBusy(submissionId);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/submissions/${submissionId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, reply: reply[submissionId] ?? '' }),
    });
    setBusy(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'That could not be done.');
      return;
    }
    // The page is server-rendered from the database; a reload is the honest
    // way to show what it now says rather than guessing at it here.
    window.location.reload();
  };

  if (rows.length === 0) {
    return (
      <p className="lede">
        {canDecide
          ? 'Nothing has been submitted yet. What a writer sends for review arrives here.'
          : 'You have not submitted anything yet. What you send for review appears here with its standing.'}
      </p>
    );
  }

  return (
    <>
      <ul className="queue">
        {rows.map(({ submission, author, version }) => (
          <li key={submission.id} className={isOpen(submission) ? 'queue-row waiting' : 'queue-row'}>
            <span
              className="room-chip"
              style={{ background: author?.colour || '#666' }}
              aria-hidden
            >
              {author ? seatInitials(author) : '—'}
            </span>

            <span className="queue-what">
              <strong>{describeSubmission(submission)}</strong>
              <span className="small block muted">
                {submitterName({ submission, author, version })} · {when(submission.createdAt)} ·{' '}
                {STATE_NAMES[submission.state]}
              </span>
              {/* The writer's side of it, in their terms rather than the
                  database's. Shown to them; the showrunner has the state. */}
              {canDecide ? null : <span className="small block">{standingOf(submission)}</span>}
              {submission.reply ? <span className="small block">“{submission.reply}”</span> : null}
            </span>

            <span className="queue-acts">
              <a
                className="button small"
                href={`/preview?room=${roomId}&version=${submission.versionId}`}
                target="_blank"
                rel="noreferrer"
              >
                Read it
              </a>

              {canDecide ? (
                <>
                  <input
                    aria-label={`A word back about ${describeSubmission(submission)}`}
                    placeholder="A word back…"
                    value={reply[submission.id] ?? ''}
                    onChange={(event) =>
                      setReply((current) => ({ ...current, [submission.id]: event.target.value }))
                    }
                  />
                  {nextStates(submission.state).map((state) => (
                    <button
                      key={state}
                      type="button"
                      className="button small"
                      disabled={busy === submission.id}
                      onClick={() => void decide(submission.id, state)}
                    >
                      {DECISIONS[state] ?? STATE_NAMES[state]}
                    </button>
                  ))}
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
