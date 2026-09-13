'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ROLE_NAMES,
  ROOM_COLOURS,
  ROOM_ROLES,
  seatInitials,
  seatName,
  type RoomRole,
  type Seat,
} from '@vcwriter/domain';

/**
 * Who is in the room (addendum 07 §6, §10).
 *
 * Everyone sees this; only the showrunner can change it. The colour and the
 * initials are shown as **the stamp itself** rather than as form fields with
 * values in them, because what they are for is being recognised at a glance on
 * the corner of a page (§6.1) — and a swatch is the only honest preview of
 * that.
 *
 * Nothing here can delete a seat. Taking somebody out of the room is
 * deactivating (§16): the row is what keeps their authorship, and a control
 * that could remove it would be a control that could rewrite history.
 */
export function Seats({
  roomId,
  seats,
  canManage,
  youId,
}: {
  roomId: string;
  seats: Seat[];
  canManage: boolean;
  youId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoomRole>('writer');
  const [title, setTitle] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const ask = async (path: string, init: RequestInit, key: string) => {
    setBusy(key);
    setError(null);
    const response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(body.error ?? 'That did not work.');
      return false;
    }
    router.refresh();
    return true;
  };

  const invite = async () => {
    const ok = await ask(
      `/api/rooms/${roomId}/seats`,
      { method: 'POST', body: JSON.stringify({ email, role, title }) },
      'invite',
    );
    if (ok) {
      setSent(email);
      setEmail('');
      setTitle('');
    }
  };

  const standing = seats.filter((seat) => seat.state !== 'deactivated');
  const gone = seats.filter((seat) => seat.state === 'deactivated');

  return (
    <div className="stack">
      <div className="room-table">
        <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Stamp</th>
            <th scope="col">Name</th>
            <th scope="col">Title</th>
            <th scope="col">Role</th>
            <th scope="col">Standing</th>
            {canManage ? <th scope="col" /> : null}
          </tr>
        </thead>
        <tbody>
          {standing.map((seat) => (
            <tr key={seat.id}>
              <td>
                <span className="room-chip" style={{ background: seat.colour || '#666' }}>
                  {seatInitials(seat) || '—'}
                </span>
              </td>
              <td>
                {seatName(seat)}
                {seat.id === youId ? <span className="pill">you</span> : null}
              </td>
              <td>{seat.title || <span className="small">—</span>}</td>
              <td>{ROLE_NAMES[seat.role]}</td>
              <td>
                {seat.state === 'invited' ? (
                  <span className="small">invited, not yet answered</span>
                ) : (
                  <span className="small">in the room</span>
                )}
              </td>
              {canManage ? (
                <td>
                  <div className="room-controls">
                    <select
                      aria-label={`The colour ${seatName(seat)} is drawn in`}
                      value={ROOM_COLOURS.includes(seat.colour as (typeof ROOM_COLOURS)[number])
                        ? seat.colour
                        : ''}
                      onChange={(event) =>
                        void ask(
                          `/api/rooms/${roomId}/seats/${seat.id}`,
                          { method: 'PATCH', body: JSON.stringify({ colour: event.target.value }) },
                          seat.id,
                        )
                      }
                    >
                      <option value="">Colour…</option>
                      {ROOM_COLOURS.map((colour) => (
                        <option key={colour} value={colour}>
                          {colour}
                        </option>
                      ))}
                    </select>
                    {/* Short, so a room of eight fits the page; the whole
                        sentence is still there on the control itself. */}
                    <button
                      type="button"
                      className="button small"
                      title={`Take ${seatName(seat)} out of the room. Everything they wrote stays theirs.`}
                      disabled={busy === seat.id}
                      onClick={() =>
                        void ask(
                          `/api/rooms/${roomId}/seats/${seat.id}`,
                          { method: 'DELETE' },
                          seat.id,
                        )
                      }
                    >
                      Take out
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {gone.length > 0 ? (
        <p className="small">
          {gone.length} {gone.length === 1 ? 'seat has' : 'seats have'} been taken out of the room.
          Everything they wrote is still theirs.
        </p>
      ) : null}

      {canManage ? (
        <>
          <h3>Ask somebody in</h3>
          <div className="room-invite">
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                placeholder="them@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={role} onChange={(event) => setRole(event.target.value as RoomRole)}>
                {ROOM_ROLES.map((one) => (
                  <option key={one} value={one}>
                    {ROLE_NAMES[one]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                placeholder="Staff Writer"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={busy === 'invite' || email.trim().length === 0}
              onClick={() => void invite()}
            >
              {busy === 'invite' ? 'Sending…' : 'Send the invitation'}
            </button>
          </div>
          <p className="small">
            The role is what they may do; the title is what they are called. They are not the same
            field, and changing one never changes the other.
          </p>
          {sent ? <p className="notice">An invitation is on its way to {sent}.</p> : null}
        </>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
