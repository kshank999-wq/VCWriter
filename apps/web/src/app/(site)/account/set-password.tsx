'use client';

import { useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase-browser';

/**
 * Setting a password on an account that has only ever used a link (addendum 09
 * §14), and proving the one you have first (§14a).
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
 *
 * **The current password is asked for and not required**, which is §14's own
 * finding arriving on a second control: nothing on an account says whether a
 * password was ever set, so a form that demanded the old one would lock a
 * link-only writer out of ever having a first. The page does not know, so it
 * asks, says when to leave it empty, and lets the server be the one that
 * refuses — the same division that made the heading *Password* for everybody.
 */

/** Supabase's own floor is six; this says so rather than letting the server refuse. */
const SHORTEST = 8;

/**
 * What to say about a refusal.
 *
 * Supabase's wording is written for a developer reading a stack trace, and the
 * three failures worth naming are the three a writer can do something about.
 * Anything else is passed through rather than paraphrased: a guess at what an
 * unknown code meant would be worse than the server's own words.
 */
const refusalFor = (failure: AuthError): string => {
  const code = failure.code ?? '';
  const said = failure.message.toLowerCase();

  if (code === 'same_password') return 'That is the password you already have.';
  if (code.startsWith('reauthentication')) {
    // The project's *Secure password change* switch. Nothing here runs the
    // nonce flow, so the honest answer is the one that works: sign in again.
    return 'For safety this account needs a fresh sign-in before the password changes. Sign out, sign back in, and try again.';
  }
  if (said.includes('current password') || said.includes('invalid login credentials')) {
    return 'That is not your current password. If you have never set one, leave that box empty.';
  }
  return failure.message;
};

export function SetPassword() {
  const [current, setCurrent] = useState('');
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
    // **Sent only when it was typed.** An empty `current_password` is a
    // different request from one that was never made, and the account with no
    // password to prove is exactly the one that cannot fill the box.
    const { error: failure } = await browserClient().auth.updateUser(
      current.length > 0 ? { password, current_password: current } : { password },
    );
    if (failure) {
      setError(refusalFor(failure));
      setStatus('idle');
      return;
    }
    setCurrent('');
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
        <div style={{ display: 'grid', gap: 6 }}>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            placeholder="Current password"
            aria-label="Current password"
            aria-describedby="current-password-note"
          />
          {/* Said under the box rather than in a placeholder that vanishes the
              moment somebody starts typing in it. */}
          <span id="current-password-note" className="field-note">
            Leave this empty if you have never set one.
          </span>
        </div>
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
