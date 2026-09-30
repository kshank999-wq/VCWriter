'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase-browser';
import { SHORTEST, checkNewPassword, refusalFor } from '@/lib/password-words';

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

export function SetPassword() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const said = checkNewPassword(password, again);
    if (said) {
      setError(said);
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
      setError(
        refusalFor(
          failure,
          'That is not your current password. If you have never set one, leave that box empty — and if you have forgotten it, ask for a reset link on the sign-in page.',
        ),
      );
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
            Leave this empty if you have never set one. Forgotten it?{' '}
            <a href="/signin">Ask for a reset link</a>.
          </span>
        </div>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`New password (${SHORTEST} characters or more)`}
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
