'use client';

import { useState } from 'react';
import {
  PASSWORD_STANDING_WORDS,
  describePasswordStanding,
  passwordStanding,
} from '@vcwriter/domain';
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
 * **The current password is asked for and not required** (§14a): a form that
 * demanded the old one would lock a link-only writer out of ever having a
 * first. That stands even now the standing is known, because the standing is a
 * record of what this program did and not proof of what the account holds —
 * so the box is still optional and the server is still the thing that refuses.
 *
 * **What it now says is whether there is one** (§14c), from the stamp
 * migration 0065 writes. Ken asked for it by name, and the reason is the
 * Writers Room: a collaborator signs in on whatever machine the work is on,
 * and an emailed link only works in the browser that asked for it.
 */

export function SetPassword({ setAt }: { setAt: string | null }) {
  const standing = passwordStanding(setAt);
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
      {/* **The heading stays *Password*** and the standing is said under it
          rather than in it. A heading that read *Set a password* or *Change
          your password* would make the section's name depend on a record that
          began mid-life, where what a writer is looking for is the same thing
          either way; the status is a statement beside it, which is what can
          honestly change. */}
      <h2>Password</h2>
      <p className={standing === 'set' ? 'password-standing set' : 'password-standing'} role="status">
        <span aria-hidden="true">{standing === 'set' ? '●' : '○'}</span>{' '}
        <strong>{PASSWORD_STANDING_WORDS[standing]}</strong>
        {standing === 'set' && setAt ? (
          /* A class of its own rather than `.muted`, which has never had a
             rule on this site — addendum 09 §14a's finding, reintroduced by
             this panel's first draft and caught by looking at it: the date
             drew in the same gold as the words beside it. */
          <span className="password-when">
            {' '}
            · {new Date(setAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        ) : null}
      </p>
      <p className="password-standing-note">{describePasswordStanding(standing)}</p>
      {status === 'done' ? (
        <p className="notice" role="status">
          Saved. You can sign in with it anywhere now — including{' '}
          <a href="/notes/app">Notes on your phone</a>, where an emailed link often cannot work. Reload
          this page and it will say when.
        </p>
      ) : null}
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
              moment somebody starts typing in it — and **it reads the standing
              above it**: telling somebody whose account says *Password set* to
              leave the box empty if they never set one is the screen arguing
              with itself two lines apart. */}
          <span id="current-password-note" className="field-note">
            {standing === 'set'
              ? 'The one you have now.'
              : 'Leave this empty if you have never set one.'}{' '}
            Forgotten it? <a href="/signin">Ask for a reset link</a>.
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
