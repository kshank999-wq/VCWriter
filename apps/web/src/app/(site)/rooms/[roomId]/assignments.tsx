'use client';

import { useMemo, useState } from 'react';
import {
  ASSIGNMENT_STATE_NAMES,
  ASSIGNEE_STATES,
  askedOf,
  assigneeName,
  describeAssignment,
  isOverdue,
  nextAssignmentStates,
  owedNote,
  seatInitials,
  seatName,
  type Assignment,
  type AssignmentState,
  type AssignableThing,
  type OwedRow,
  type Seat,
} from '@vcwriter/domain';

/**
 * Assignments, from two of the three angles §8 names (stage 8).
 *
 * The writer's — *what am I being asked for* — and the showrunner's — *who owes
 * what*. The third is the badge on the scene itself, which lives in the writing
 * program rather than here, and all three read the same row.
 *
 * **An assignment is not a lock**, and the words say so where a writer will
 * read them: nothing here stops anybody writing anything, because a room where
 * two writers took a run at the same scene is a room working properly and §1 is
 * why both runs survive.
 */

const MOVES: Partial<Record<AssignmentState, string>> = {
  accepted: 'I have it',
  in_progress: 'Writing it',
  done: 'Done',
  assigned: 'Put it back',
  cancelled: 'Call it off',
};

const dayOf = (date: string | null): string => {
  if (!date) return '';
  const at = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(at.getTime())
    ? date
    : at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const move = async (roomId: string, assignmentId: string, to: AssignmentState): Promise<string | null> => {
  const response = await fetch(`/api/rooms/${roomId}/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return body.error ?? 'That could not be done.';
  }
  return null;
};

// -------------------------------------------------------------- the writer's

export function YourAsks({
  roomId,
  assignments,
  today,
}: {
  roomId: string;
  /** This visitor's own, newest ask first. */
  assignments: Assignment[];
  today: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const say = async (assignment: Assignment, to: AssignmentState) => {
    setBusy(assignment.id);
    setError(null);
    const failed = await move(roomId, assignment.id, to);
    setBusy(null);
    if (failed) {
      setError(failed);
      return;
    }
    window.location.reload();
  };

  if (assignments.length === 0) {
    return <p className="lede">Nothing is being asked of you right now.</p>;
  }

  return (
    <>
      <ul className="asks">
        {assignments.map((assignment) => (
          <li
            key={assignment.id}
            className={isOverdue(assignment, today) ? 'ask-row late' : 'ask-row'}
          >
            <span className="ask-what">
              <strong>{describeAssignment(assignment)}</strong>
              <span className="small block muted">
                {ASSIGNMENT_STATE_NAMES[assignment.state]}
                {assignment.dueOn ? ` · wanted ${dayOf(assignment.dueOn)}` : ''}
                {isOverdue(assignment, today) ? ' · past its date' : ''}
              </span>
              <span className="small block">{askedOf(assignment)}</span>
            </span>

            <span className="ask-acts">
              {/* Only what a writer may say about their own: how it is going.
                  Calling it off is the showrunner unasking for it, and the
                  database refuses it from here whatever this draws. */}
              {ASSIGNEE_STATES.filter((state) => state !== assignment.state).map((state) => (
                <button
                  key={state}
                  type="button"
                  className="button small"
                  disabled={busy === assignment.id || assignment.state === 'cancelled'}
                  onClick={() => void say(assignment, state)}
                >
                  {MOVES[state] ?? ASSIGNMENT_STATE_NAMES[state]}
                </button>
              ))}
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

// --------------------------------------------------------- the showrunner's

export function WhoOwesWhat({
  roomId,
  rows,
  assignments,
  seats,
  things,
  today,
  defaultAssigneeId,
}: {
  roomId: string;
  /** Every active seat, including whoever is free — that is the other question. */
  rows: OwedRow[];
  assignments: Assignment[];
  seats: Seat[];
  /** What there is to point at, read out of the project itself. */
  things: AssignableThing[];
  today: string;
  /** Who the form starts on: the person picked in the people menu (§28). */
  defaultAssigneeId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One writer, or several at once (§34): several make one task each, linked.
  const [assignees, setAssignees] = useState<string[]>(() => {
    const first = defaultAssigneeId ?? seats.find((seat) => seat.state !== 'deactivated' && seat.userId)?.userId;
    return first ? [first] : [];
  });
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [priority, setPriority] = useState('normal');

  const askable = useMemo(
    () => seats.filter((seat) => seat.state !== 'deactivated' && seat.userId),
    [seats],
  );
  // Asked in and not yet answered: they cannot be given work until they have
  // an account in the room, and the menu says so rather than going quiet.
  const waitingOn = useMemo(() => seats.filter((seat) => seat.state === 'invited'), [seats]);

  const callOff = async (assignment: Assignment) => {
    setBusy(true);
    setError(null);
    const failed = await move(roomId, assignment.id, 'cancelled');
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    window.location.reload();
  };

  const give = async () => {
    setBusy(true);
    setError(null);
    const chosen = things.find((thing) => `${thing.kind}:${thing.id}` === target) ?? null;
    const response = await fetch(`/api/rooms/${roomId}/assignments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        assigneeIds: assignees,
        targetKind: chosen?.kind ?? null,
        targetId: chosen?.id ?? null,
        note,
        dueOn: dueOn || null,
        priority,
      }),
    });
    setBusy(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'That could not be given out.');
      return;
    }
    window.location.reload();
  };

  return (
    <>
      <div className="owed">
        {rows.map((row) => (
          <article key={row.seat.id} className="owed-seat">
            <header>
              <span className="room-chip" style={{ background: row.seat.colour || '#666' }} aria-hidden>
                {seatInitials(row.seat) || '—'}
              </span>
              <strong>{seatName(row.seat)}</strong>
              {row.seat.title ? <span className="small muted">{row.seat.title}</span> : null}
            </header>
            <p className="small muted">{owedNote(row)}</p>
            {row.owed.length > 0 ? (
              <ul className="owed-list">
                {row.owed.map((assignment) => (
                  <li key={assignment.id} className={isOverdue(assignment, today) ? 'late' : undefined}>
                    <span>{describeAssignment(assignment)}</span>
                    <span className="small muted">
                      {ASSIGNMENT_STATE_NAMES[assignment.state]}
                      {assignment.dueOn ? ` · ${dayOf(assignment.dueOn)}` : ''}
                    </span>
                    {/* Unasking for it, which is the showrunner's alone — the
                        writer says how it is going and nothing more. It is not
                        a delete: anything written for it is still theirs. */}
                    <button
                      type="button"
                      className="button small secondary"
                      disabled={busy}
                      onClick={() => void callOff(assignment)}
                    >
                      Call it off
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      {/* The Assign menu Ken asked for: the room's seats by name, title and
          colour, and what there is to point at — or nothing, which makes it a
          plain task. */}
      <h3>Assign</h3>
      {askable.length === 0 ? (
        <p className="notice small">
          {waitingOn.length > 0
            ? `Nobody can be given work until they join the room. ${waitingOn
                .map((seat) => seatName(seat))
                .join(', ')} ${waitingOn.length === 1 ? 'has' : 'have'} been invited and ${
                waitingOn.length === 1 ? 'needs' : 'need'
              } to accept the invitation in their email first.`
            : 'Nobody is in the room to give work to yet. Invite someone from People and seats below.'}
        </p>
      ) : null}
      <div className="assign">
        <fieldset className="field assign-to">
          <legend>To</legend>
          {askable.length === 0 ? <span className="small muted">Nobody has joined yet</span> : null}
          {askable.map((seat) => (
            <label key={seat.id} className="assign-person">
              <input
                type="checkbox"
                checked={assignees.includes(seat.userId ?? '')}
                onChange={(event) => {
                  const id = seat.userId ?? '';
                  setAssignees((now) => (event.target.checked ? [...new Set([...now, id])] : now.filter((one) => one !== id)));
                }}
              />
              <span className="room-chip" style={{ background: seat.colour || '#666' }} aria-hidden>
                {seatInitials(seat) || '—'}
              </span>
              {seatName(seat)}
            </label>
          ))}
          {assignees.length > 1 ? (
            <span className="small muted block">
              {assignees.length} writers: each gets their own task, linked as a group so their versions can be compared together.
            </span>
          ) : null}
        </fieldset>

        <label className="field">
          <span>About</span>
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Nothing in particular — a task</option>
            {(() => {
              const name = (thing: AssignableThing) =>
                thing.kind === 'episode'
                  ? thing.label
                  : thing.kind === 'act'
                    ? `Act — ${thing.label}`
                    : thing.kind === 'scene'
                      ? `Scene — ${thing.label}`
                      : thing.kind === 'beat'
                        ? `Beat — ${thing.label}`
                        : `Research — ${thing.label}`;
              const option = (thing: AssignableThing) => (
                <option key={`${thing.kind}:${thing.id}`} value={`${thing.kind}:${thing.id}`}>
                  {name(thing)}
                </option>
              );
              // In a series, whole episodes first, then each episode's own
              // acts, scenes and beats under it (§36).
              const episodes = things.filter((thing) => thing.kind === 'episode');
              if (episodes.length === 0) return things.map(option);
              const loose = things.filter((thing) => thing.kind !== 'episode' && !thing.episode);
              return (
                <>
                  <optgroup label="Whole episodes">{episodes.map(option)}</optgroup>
                  {episodes.map((one) => (
                    <optgroup key={one.id} label={one.label}>
                      {things.filter((thing) => thing.episode === one.label).map(option)}
                    </optgroup>
                  ))}
                  {loose.length > 0 ? <optgroup label="Not in an episode">{loose.map(option)}</optgroup> : null}
                </>
              );
            })()}
          </select>
        </label>

        <label className="field wide">
          <span>What is being asked</span>
          <input
            type="text"
            value={note}
            placeholder="Shorter, and colder."
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="field">
          <span>Wanted by</span>
          <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </label>

        <button type="button" className="button" disabled={busy || assignees.length === 0} onClick={() => void give()}>
          {busy ? 'Giving it out…' : assignees.length > 1 ? `Assign it to ${assignees.length} writers` : 'Assign it'}
        </button>
      </div>

      <p className="small">
        An assignment says who is expected to write something. It does not stop anybody else writing
        it — if two writers take a run at the same scene, both runs survive, which is the point of
        the whole module. Calling one off never deletes what was written for it.
      </p>

      {assignments.length > 0 ? (
        <p className="small muted">
          {assignments.length === 1 ? '1 assignment' : `${assignments.length} assignments`} in this room,
          including the ones already done and called off.
        </p>
      ) : null}

      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
