'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase-browser';

/**
 * Setting a password on an account that has only ever used a link (addendum 09
 * §14).
 *
 * **This is what makes the phone work.** A magic link is bound to the browser
 * that asked for it, and a phone's mail app opens links in a browser of its
 * own — so the link fails there and the sign-in form comes back, which reads
 * as a loop. A password has no handoff between browsers, so it is typed
 * wherever the writer is standing.
 *
 * It lives here rather than on the sign-in screen for the plain reason that
 * **only somebody already signed in may set one**: `updateUser` writes to the
 * session's own account, so there is nothing to prove and nobody else's
 * password to reach. Setting it once on the desktop is what the phone then
 * uses.
 */

/** Supabase's own floor is six; this says so rather than letting the server refuse. */
const SHORTEST = 8;

export function SetPassword() {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Both refusals are said here rather than after a round trip, because the
    // answer to each is a keystroke away.
    if (password.length < SHORTEST) {
      setError(`Use at least ${SHORTEST} characters.`);
      return;
    }
    if (password !== again) {
      setError('Those two do not match.');
      return;
    }

    setStatus('working');
    const { error: failure } = await browserClient().auth.updateUser({ password });
    if (failure) {
      setError(failure.message);
      setStatus('idle');
      return;
    }
    setPassword('');
    setAgain('');
    setStatus('done');
  };

  return (
    <section>
      {/* **One heading for both**: nothing on the account says whether a
          password has ever been set — an `email` identity exists for a
          link-only account too — so a screen that said *Set* or *Change*
          would be wrong for somebody half the time, and *Password* is true
          for everybody. */}
      <h2>Password</h2>
      {status === 'done' ? (
        <p className="notice" role="status">
          Saved. You can sign in with it anywhere now — including{' '}
          <a href="/notes">Notes on your phone</a>, where an emailed link often cannot work.
        </p>
      ) : null}
      <p className="muted small">
        A password signs you in on any device without waiting for an email — which is what the phone needs,
        because a link only works in the browser that asked for it and a mail app opens links in its own.
        Setting one here replaces whatever you had.
      </p>
      <form onSubmit={save} style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          aria-label="New password"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          placeholder="And again"
          aria-label="Repeat the new password"
        />
        <button type="submit" className="button" disabled={status === 'working'}>
          {status === 'working' ? 'Saving…' : 'Save it'}
        </button>
      </form>
      {error ? (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
