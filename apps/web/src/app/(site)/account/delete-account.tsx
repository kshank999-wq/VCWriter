'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase-browser';

/**
 * Deleting the account, from the account page (addendum 27 §12).
 *
 * **What goes is said before the press and not after it.** A deletion nobody
 * can undo is the one act in this product where the sentence matters more than
 * the button, so the list below is exhaustive on both sides: what goes, and
 * the two things that do not — the receipt, which tax law wants and which
 * keeps no name, and work contributed to somebody else's room, which is
 * theirs. Finding either of those out afterwards would read as a broken
 * promise, however reasonable each is.
 *
 * The confirmation is the address typed out. It is not friction for its own
 * sake: this is the only control in the application that cannot be undone, and
 * the graveyard exists precisely because everything else can.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus('working');

    const response = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: typed }),
    }).catch(() => null);

    const said = (await response?.json().catch(() => null)) as { error?: string } | null;
    if (!response?.ok) {
      setError(said?.error ?? 'Your account could not be deleted. Try again in a moment.');
      setStatus('idle');
      return;
    }

    // The account is gone, so the session in this browser is a key to nothing;
    // signing out is what makes the screen agree with that.
    await browserClient().auth.signOut().catch(() => undefined);
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <section>
        <h2>Account deleted</h2>
        <p className="notice" role="status">
          Your account and everything under it is gone. The copies on your own computer are untouched
          — those are yours, and we cannot reach them.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>Delete this account</h2>
      <p className="muted small">
        Permanent, immediate, and not undoable. It takes your projects, manuscripts, research,
        characters, outlines, boards and phone notes, along with your licence and your sign-in.
      </p>
      <p className="muted small">
        Two things stay. The record that a purchase happened remains as a financial record with your
        name taken off it, because accounting law requires it. Anything you contributed to somebody
        else&rsquo;s Writers Room stays in that room, with your name removed — one writer&rsquo;s work
        is never destroyed by another&rsquo;s, and that rule runs both ways.
      </p>
      <p className="muted small">
        Files saved on your own computer are not touched.
      </p>

      {open ? (
        <form onSubmit={remove} style={{ display: 'grid', gap: 16, maxWidth: 340, marginTop: 16 }}>
          <label className="muted small" htmlFor="delete-confirm">
            Type <strong>{email}</strong> to confirm.
          </label>
          <input
            id="delete-confirm"
            type="email"
            required
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={email}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="button danger" disabled={status === 'working'}>
              {status === 'working' ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
            >
              Keep it
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button secondary" onClick={() => setOpen(true)} style={{ marginTop: 16 }}>
          Delete this account…
        </button>
      )}

      {error ? (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
