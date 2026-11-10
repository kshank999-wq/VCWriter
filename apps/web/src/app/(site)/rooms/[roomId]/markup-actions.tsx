'use client';

import { useState } from 'react';

/**
 * What can be done with a markup (addendum 07 §27.2): open the script, bring
 * the markup in as drafts on the marked beats, or send it to the archive.
 * Nothing here erases anything.
 */
export function MarkupActions({
  roomId,
  markupId,
  archived,
  canBringIn,
}: {
  roomId: string;
  markupId: string;
  archived: boolean;
  canBringIn: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const bringIn = async () => {
    setBusy('bring');
    setSaid(null);
    const response = await fetch(`/api/rooms/${roomId}/markups/${markupId}/bring-in`, { method: 'POST' });
    const body = (await response.json().catch(() => ({}))) as { beats?: number; missing?: number; error?: string };
    setBusy(null);
    if (!response.ok) {
      setSaid(body.error ?? 'It could not be brought in.');
      return;
    }
    const beats = body.beats ?? 0;
    setSaid(
      `Brought in. ${beats === 1 ? 'One beat has' : `${beats} beats have`} a new markup draft in the Draft menu.` +
        (body.missing ? ` ${body.missing} marked ${body.missing === 1 ? 'beat is' : 'beats are'} not in your script.` : ''),
    );
  };

  const archive = async (to: boolean) => {
    setBusy('archive');
    const response = await fetch(`/api/rooms/${roomId}/markups/${markupId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archived: to }),
    });
    setBusy(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setSaid(body.error ?? 'That could not be changed.');
      return;
    }
    window.location.reload();
  };

  return (
    <div className="mk-actions">
      <a className="button small" href={`/preview?room=${roomId}`}>
        Open in VC Writer
      </a>
      {canBringIn ? (
        <button type="button" className="button small secondary" disabled={busy !== null} onClick={() => void bringIn()}>
          {busy === 'bring' ? 'Bringing it in…' : 'Bring into the script'}
        </button>
      ) : null}
      <button type="button" className="button small secondary" disabled={busy !== null} onClick={() => void archive(!archived)}>
        {archived ? 'Bring back from the archive' : 'Send to archive'}
      </button>
      {said ? (
        <p className="small" role="status">
          {said}
        </p>
      ) : null}
    </div>
  );
}
