'use client';

import { useState } from 'react';

/**
 * Whether this room writes to you (addendum 07 §14, stage 14).
 *
 * It sits on *Your part in it* rather than in an account page, because the
 * question is about **this room**: a writer on two shows wants the one that is
 * shooting and not the one in development.
 *
 * The sentence beside it names exactly what the switch governs, which is the
 * only way somebody can decide: *the three things addressed to you*, and not
 * everything the room does. Turning it off never makes anything invisible —
 * what is new is still waiting in the room.
 */
export function NotifyMe({ roomId, on }: { roomId: string; on: boolean }) {
  const [now, setNow] = useState(on);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: boolean) => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/notifications`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notifyByEmail: next }),
    });
    setBusy(false);
    if (!response.ok) {
      const said = (await response.json().catch(() => ({}))) as { error?: string };
      setError(said.error ?? 'That could not be changed.');
      return;
    }
    setNow(next);
  };

  return (
    <>
      <p className="small">
        {now
          ? 'This room emails you when somebody names you, asks you for something, or decides on your work.'
          : 'This room does not email you. Everything it does is still waiting for you here.'}
      </p>
      <button type="button" className="button secondary small room-act" disabled={busy} onClick={() => change(!now)}>
        {now ? 'Stop emailing me about this room' : 'Email me about this room'}
      </button>
      {error ? <p className="small error">{error}</p> : null}
    </>
  );
}
