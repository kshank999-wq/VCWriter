'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Asking to revise integrated material, and answering (addendum 07 §32).
 * The routes check who may do what; these draw only what this person may do.
 */

const send = async (url: string, method: 'POST' | 'PATCH', body: unknown): Promise<string | null> => {
  const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (response.ok) return null;
  const said = (await response.json().catch(() => ({}))) as { error?: string };
  return said.error ?? 'That did not go through.';
};

export function RequestPermission({
  roomId,
  assignmentId,
  beatId,
  targetLabel,
}: {
  roomId: string;
  assignmentId: string | null;
  beatId: string | null;
  targetLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [proposed, setProposed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="button small secondary" onClick={() => setOpen(true)} title="It is in the master, so revising it needs the showrunner’s permission.">
        Request permission to revise
      </button>
    );
  }
  return (
    <div className="tk-return">
      <label>
        <span className="small">What do you want to change, and why?</span>
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus />
      </label>
      <label>
        <span className="small">Proposed change (optional)</span>
        <textarea rows={3} value={proposed} onChange={(event) => setProposed(event.target.value)} />
      </label>
      <span className="tk-buttons">
        <button type="button" className="button small secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="button small"
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            const failed = await send(`/api/rooms/${roomId}/permissions`, 'POST', { assignmentId, beatId, targetLabel, reason, proposed });
            setBusy(false);
            if (failed) {
              setError(failed);
              return;
            }
            setOpen(false);
            router.refresh();
          }}
        >
          Ask the showrunner
        </button>
      </span>
      <p className="small muted">The master does not change. If it is granted you get a new task for it.</p>
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AnswerRequest({ roomId, requestId, showrunner, mine }: { roomId: string; requestId: string; showrunner: boolean; mine: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = async (state: 'granted' | 'denied' | 'withdrawn') => {
    setBusy(true);
    const failed = await send(`/api/rooms/${roomId}/permissions/${requestId}`, 'PATCH', { state, note, dueOn: dueOn || null });
    setBusy(false);
    if (failed) setError(failed);
    else router.refresh();
  };
  return (
    <div className="tk-actions">
      {showrunner ? (
        <>
          <span className="tk-buttons">
            <input aria-label="Note to the writer" placeholder="Note to the writer (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
            <label className="small">
              Due <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </label>
          </span>
          <span className="tk-buttons">
            <button type="button" className="button small" disabled={busy} onClick={() => void answer('granted')} title="Makes a new task for the writer. The master is not opened.">
              Grant — make a revision task
            </button>
            <button type="button" className="button small secondary" disabled={busy} onClick={() => void answer('denied')}>
              Deny
            </button>
          </span>
        </>
      ) : mine ? (
        <span className="tk-buttons">
          <button type="button" className="button small secondary" disabled={busy} onClick={() => void answer('withdrawn')}>
            Withdraw
          </button>
        </span>
      ) : null}
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
