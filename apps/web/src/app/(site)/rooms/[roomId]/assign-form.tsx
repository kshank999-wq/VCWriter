'use client';

import { useMemo, useState } from 'react';
import { seatInitials, seatName, type AssignableThing, type Seat } from '@vcwriter/domain';

/**
 * Giving out a task (addendum 07 §37).
 *
 * From Ken, 11 November: the writers are a list down the right, each with a
 * tick box, and the Assign button sits under them — not a long bar across
 * the page. And the old *About · Nothing in particular* box is now a plain
 * choice of what the task is: **a task** that is not tied to the script, a
 * **part of the script** (picked from the list, or highlighted in the
 * script itself), or a **research note**.
 *
 * Used from the board's *+ New task* and from the Script screen, where the
 * part of the script is already chosen — a highlighted passage, a beat or a
 * scene — and arrives as `fixed`.
 */

export interface FixedTarget {
  kind: 'beat' | 'scene';
  id: string;
  /** Where it is, as the panel names it: "Scene › Beat". */
  place: string;
  /** A highlighted passage, with the words it held. */
  passage?: {
    startElementId: string;
    startOffset: number;
    endElementId: string;
    endOffset: number;
    quote: string;
  };
}

type Kind = 'task' | 'script' | 'research';

const SCRIPT_KINDS = new Set(['episode', 'act', 'scene', 'beat']);

const nameOf = (thing: AssignableThing) =>
  thing.kind === 'episode'
    ? thing.label
    : thing.kind === 'act'
      ? `Act — ${thing.label}`
      : thing.kind === 'scene'
        ? `Scene — ${thing.label}`
        : thing.kind === 'beat'
          ? `Beat — ${thing.label}`
          : thing.label;

export function AssignForm({
  roomId,
  seats,
  things,
  defaultAssigneeId,
  fixed,
  onClearFixed,
  scriptHref,
}: {
  roomId: string;
  seats: Seat[];
  things: AssignableThing[];
  defaultAssigneeId?: string;
  fixed?: FixedTarget | null;
  onClearFixed?(): void;
  /** Where the script can be read and highlighted, when it is not already open. */
  scriptHref?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<string[]>(() => (defaultAssigneeId ? [defaultAssigneeId] : []));
  const [kind, setKind] = useState<Kind>('task');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [priority, setPriority] = useState('normal');

  const askable = useMemo(() => seats.filter((seat) => seat.state !== 'deactivated' && seat.userId), [seats]);
  const waitingOn = useMemo(() => seats.filter((seat) => seat.state === 'invited'), [seats]);
  const scriptThings = useMemo(() => things.filter((thing) => SCRIPT_KINDS.has(thing.kind)), [things]);
  const researchThings = useMemo(() => things.filter((thing) => thing.kind === 'research'), [things]);

  const everyone = askable.length > 0 && askable.every((seat) => assignees.includes(seat.userId ?? ''));

  const chosen = fixed
    ? { kind: fixed.kind, id: fixed.id }
    : kind === 'task'
      ? null
      : (things.find((thing) => `${thing.kind}:${thing.id}` === target) ?? null);
  const needsPick = !fixed && kind !== 'task' && !chosen;

  const give = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/assignments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        assigneeIds: assignees,
        targetKind: chosen?.kind ?? null,
        targetId: chosen?.id ?? null,
        passage: fixed?.passage
          ? {
              startElementId: fixed.passage.startElementId,
              startOffset: fixed.passage.startOffset,
              endElementId: fixed.passage.endElementId,
              endOffset: fixed.passage.endOffset,
            }
          : null,
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

  const scriptOptions = () => {
    const option = (thing: AssignableThing) => (
      <option key={`${thing.kind}:${thing.id}`} value={`${thing.kind}:${thing.id}`}>
        {nameOf(thing)}
      </option>
    );
    // In a series, whole episodes first, then each episode's own acts,
    // scenes and beats under it (§36).
    const episodes = scriptThings.filter((thing) => thing.kind === 'episode');
    if (episodes.length === 0) return scriptThings.map(option);
    const loose = scriptThings.filter((thing) => thing.kind !== 'episode' && !thing.episode);
    return (
      <>
        <optgroup label="Whole episodes">{episodes.map(option)}</optgroup>
        {episodes.map((one) => (
          <optgroup key={one.id} label={one.label}>
            {scriptThings.filter((thing) => thing.episode === one.label).map(option)}
          </optgroup>
        ))}
        {loose.length > 0 ? <optgroup label="Not in an episode">{loose.map(option)}</optgroup> : null}
      </>
    );
  };

  return (
    <div className="af">
      <div className="af-main">
        {fixed ? (
          <div className="af-fixed">
            <p className="small af-fixed-head">
              <strong>{fixed.passage ? 'Highlighted in' : fixed.kind === 'scene' ? 'The whole scene' : 'The whole beat'}</strong>{' '}
              {fixed.place}
              {onClearFixed ? (
                <button type="button" className="linkish small" onClick={onClearFixed}>
                  Clear
                </button>
              ) : null}
            </p>
            {fixed.passage ? <blockquote className="af-quote">{fixed.passage.quote}</blockquote> : null}
          </div>
        ) : (
          <fieldset className="af-kind">
            <legend>What is it?</legend>
            <label className={`af-kind-one${kind === 'task' ? ' on' : ''}`}>
              <input type="radio" name="af-kind" checked={kind === 'task'} onChange={() => setKind('task')} />
              <span>
                <strong>A task</strong>
                <span className="small muted">Work that is not tied to a place in the script — a pitch, notes, a list of ideas.</span>
              </span>
            </label>
            <label className={`af-kind-one${kind === 'script' ? ' on' : ''}`}>
              <input
                type="radio"
                name="af-kind"
                checked={kind === 'script'}
                disabled={scriptThings.length === 0}
                onChange={() => {
                  setKind('script');
                  setTarget('');
                }}
              />
              <span>
                <strong>Part of the script</strong>
                <span className="small muted">
                  {scriptThings.length === 0 ? 'The script has no scenes yet.' : 'An episode, act, scene or beat.'}
                  {scriptHref ? (
                    <>
                      {' '}
                      Or <a href={scriptHref}>highlight it in the script</a>.
                    </>
                  ) : null}
                </span>
              </span>
            </label>
            {researchThings.length > 0 ? (
              <label className={`af-kind-one${kind === 'research' ? ' on' : ''}`}>
                <input
                  type="radio"
                  name="af-kind"
                  checked={kind === 'research'}
                  onChange={() => {
                    setKind('research');
                    setTarget('');
                  }}
                />
                <span>
                  <strong>A research note</strong>
                  <span className="small muted">Something on the research shelf to look into or write up.</span>
                </span>
              </label>
            ) : null}
            {kind === 'script' ? (
              <select aria-label="Which part of the script" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Choose…</option>
                {scriptOptions()}
              </select>
            ) : null}
            {kind === 'research' ? (
              <select aria-label="Which research note" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Choose…</option>
                {researchThings.map((thing) => (
                  <option key={thing.id} value={`${thing.kind}:${thing.id}`}>
                    {thing.label}
                  </option>
                ))}
              </select>
            ) : null}
          </fieldset>
        )}

        <label className="field">
          <span>What is being asked</span>
          <textarea rows={3} value={note} placeholder="Shorter, and colder." onChange={(event) => setNote(event.target.value)} />
        </label>

        <div className="af-row">
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
        </div>
      </div>

      <aside className="af-writers" aria-label="Writers">
        <p className="af-writers-head">Writers</p>
        {askable.length === 0 ? (
          <p className="small muted">
            {waitingOn.length > 0
              ? `${waitingOn.map((seat) => seatName(seat)).join(', ')} ${waitingOn.length === 1 ? 'has' : 'have'} been invited and can be given work once they join.`
              : 'Nobody has joined the room yet.'}
          </p>
        ) : (
          <>
            {askable.length > 1 ? (
              <label className="af-writer af-everyone">
                <input
                  type="checkbox"
                  checked={everyone}
                  onChange={(event) => setAssignees(event.target.checked ? askable.map((seat) => seat.userId ?? '') : [])}
                />
                <span>Everyone</span>
              </label>
            ) : null}
            {askable.map((seat) => (
              <label key={seat.id} className="af-writer">
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
                <span className="af-writer-name">
                  {seatName(seat)}
                  {seat.title ? <span className="small muted">{seat.title}</span> : null}
                </span>
              </label>
            ))}
            {waitingOn.length > 0 ? (
              <p className="small muted">Invited, not joined yet: {waitingOn.map((seat) => seatName(seat)).join(', ')}.</p>
            ) : null}
          </>
        )}
        <button type="button" className="button af-go" disabled={busy || assignees.length === 0 || needsPick} onClick={() => void give()}>
          {busy ? 'Giving it out…' : assignees.length > 1 ? `Assign to ${assignees.length} writers` : 'Assign'}
        </button>
        {assignees.length > 1 ? (
          <p className="small muted">Each writer gets their own task, linked so their versions can be compared together.</p>
        ) : null}
        {needsPick && assignees.length > 0 ? <p className="small muted">Choose which part first.</p> : null}
        {error ? (
          <p className="error small" role="alert">
            {error}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
