'use client';

import { useState } from 'react';
import {
  bodyOf,
  canEdit,
  canResolve,
  describeTarget,
  newsLine,
  seatInitials,
  seatName,
  type ActivityEvent,
  type Comment,
  type NewsItem,
  type RoomRole,
  type Seat,
  type Thread,
} from '@vcwriter/domain';

/**
 * What the room is saying, and what has happened in it (addendum 07 §14 and §9,
 * stage 10).
 *
 * Three readings of the same rows, which is the shape this module keeps
 * arriving at: **what is new for you**, **the threads**, and **the trail**.
 * None of them is a second copy of anything — the news and the trail are read
 * off the comments, versions, submissions and assignments that were already
 * written down, so there is nothing here that can disagree with the room.
 */

const when = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ''
    : `${at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${at.toLocaleTimeString(
        undefined,
        { hour: 'numeric', minute: '2-digit' },
      )}`;
};

const chipFor = (seat: Seat | null) => (
  <span className="room-chip" style={{ background: seat?.colour || '#666' }} aria-hidden>
    {seat ? seatInitials(seat) || '—' : '—'}
  </span>
);

const nameFor = (seat: Seat | null): string => (seat ? seatName(seat) : 'Somebody no longer in the room');

// ---------------------------------------------------------------- what is new

export function WhatIsNew({ news, seats }: { news: NewsItem[]; seats: Seat[] }) {
  if (news.length === 0) return null;
  return (
    <div className="news">
      <strong className="small">
        {news.length === 1 ? '1 thing since you last looked' : `${news.length} things since you last looked`}
      </strong>
      <ul>
        {news.slice(0, 8).map((item) => (
          <li key={item.comment.id} className="small">
            {newsLine(item, seats)} <span className="muted">{when(item.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------------------------------------------------------- threads

export function Talk({
  roomId,
  threads,
  seats,
  you,
  role,
  mayComment,
}: {
  roomId: string;
  threads: Thread[];
  seats: Seat[];
  you: string;
  role: RoomRole | null;
  /** Whether this reader may say anything, or is here to read (§7). */
  mayComment: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saying, setSaying] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});

  const after = async (response: Response, whenNot: string) => {
    setBusy(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? whenNot);
      return;
    }
    window.location.reload();
  };

  const say = async (body: string, parentId: string | null) => {
    if (body.trim().length === 0) return;
    setBusy(parentId ?? 'new');
    setError(null);
    await after(
      await fetch(`/api/rooms/${roomId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parentId, targetKind: 'room', targetId: null, body }),
      }),
      'That could not be said.',
    );
  };

  const amend = async (comment: Comment, patch: { state?: string; body?: string }) => {
    setBusy(comment.id);
    setError(null);
    await after(
      await fetch(`/api/rooms/${roomId}/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
      'That could not be changed.',
    );
  };

  return (
    <>
      {mayComment ? (
        <div className="say">
          <label className="field wide">
            <span>Say something to the room</span>
            <textarea
              rows={2}
              value={saying}
              placeholder="Name somebody with @ and they will be told."
              onChange={(event) => setSaying(event.target.value)}
            />
          </label>
          <button type="button" className="button" disabled={busy === 'new'} onClick={() => void say(saying, null)}>
            {busy === 'new' ? 'Saying…' : 'Say it'}
          </button>
        </div>
      ) : (
        <p className="small muted">You are in this room to read.</p>
      )}

      {threads.length === 0 ? (
        <p className="lede">
          Nothing said yet. A thread here is about the room itself — an idea that is not in the script
          yet, or a question nobody has an answer to.
        </p>
      ) : (
        <ul className="threads">
          {threads.map(({ comment, author, replies: said }) => (
            <li key={comment.id} className={comment.state === 'resolved' ? 'thread settled' : 'thread'}>
              <div className="thread-head">
                {chipFor(author)}
                <span className="thread-what">
                  <strong>{nameFor(author)}</strong>
                  <span className="small muted">
                    {describeTarget(comment)} · {when(comment.createdAt)}
                    {comment.editedAt ? ' · edited' : ''}
                    {comment.state === 'resolved' ? ' · settled' : ''}
                  </span>
                </span>
                <span className="thread-acts">
                  {canResolve(comment, { userId: you, role }) ? (
                    <button
                      type="button"
                      className="button small secondary"
                      disabled={busy === comment.id}
                      onClick={() => void amend(comment, { state: comment.state === 'resolved' ? 'open' : 'resolved' })}
                    >
                      {comment.state === 'resolved' ? 'Open it again' : 'Settle it'}
                    </button>
                  ) : null}
                  {canEdit(comment, you) && comment.state !== 'withdrawn' ? (
                    <button
                      type="button"
                      className="button small secondary"
                      disabled={busy === comment.id}
                      onClick={() => void amend(comment, { state: 'withdrawn' })}
                    >
                      Take it back
                    </button>
                  ) : null}
                </span>
              </div>
              <p className={comment.state === 'withdrawn' ? 'thread-body muted' : 'thread-body'}>
                {bodyOf(comment)}
              </p>

              {said.length > 0 ? (
                <ul className="thread-replies">
                  {said.map((reply) => (
                    <li key={reply.comment.id}>
                      {chipFor(reply.author)}
                      <span>
                        <strong className="small">{nameFor(reply.author)}</strong>{' '}
                        <span className="small muted">{when(reply.comment.createdAt)}</span>
                        <span className={reply.comment.state === 'withdrawn' ? 'block muted' : 'block'}>
                          {bodyOf(reply.comment)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {mayComment && comment.state !== 'resolved' ? (
                <div className="thread-say">
                  <input
                    type="text"
                    aria-label={`Answer ${nameFor(author)}`}
                    placeholder="Answer…"
                    value={replies[comment.id] ?? ''}
                    onChange={(event) =>
                      setReplies((current) => ({ ...current, [comment.id]: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="button small"
                    disabled={busy === comment.id}
                    onClick={() => void say(replies[comment.id] ?? '', comment.id)}
                  >
                    Answer
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

// --------------------------------------------------------------- the trail

export function Trail({ roomId, events }: { roomId: string; events: ActivityEvent[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? events : events.slice(0, 12);

  if (events.length === 0) {
    return <p className="lede">Nothing has happened in this room yet.</p>;
  }

  return (
    <>
      <ul className="trail">
        {shown.map((event, index) => (
          <li key={`${event.kind}-${event.at}-${index}`} className="trail-row">
            <span className="small muted trail-when">{when(event.at)}</span>
            <span className="trail-line">
              {event.line}
              {event.versionId ? (
                <>
                  {' '}
                  <a
                    className="small"
                    href={`/preview?room=${roomId}&version=${event.versionId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open it
                  </a>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {events.length > shown.length ? (
        <button type="button" className="button small secondary" onClick={() => setAll(true)}>
          The whole trail ({events.length})
        </button>
      ) : null}
      <p className="small muted">
        Read off what the room already recorded — every version, submission, decision, assignment and
        seat carries its own date and its own author, so this cannot disagree with them.
      </p>
    </>
  );
}
