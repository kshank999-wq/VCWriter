'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase-browser';
import { SHORTEST, checkNewPassword, refusalFor } from '@/lib/password-words';

/**
 * Setting a password after a reset link (addendum 09 §14b).
 *
 * Ken's rule, and it is the whole page: **the link is the proof, so nothing
 * else is asked for.** Somebody arrives here because they have forgotten their
 * password — asking them to confirm it would be asking for the one thing they
 * have not got, which is the account page's field pointed at exactly the
 * person it cannot serve. So this screen sends `updateUser({ password })` and
 * no `current_password`, ever.
 *
 * It needs no token of its own: `/auth/callback` exchanges the emailed code for
 * the session cookie and sends the reader on to here, the same road the magic
 * link takes, so by the time this renders the recovery session is simply the
 * session. That also means the page's **only** real state is whether there is
 * one — a reader who opened the link somewhere else arrives signed out, and
 * that is the failure to explain rather than a form to draw.
 */
export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await browserClient().auth.getSession();
      if (!alive) return;
      setSignedIn(Boolean(data.session));
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const said = checkNewPassword(password, again);
    if (said) {
      setError(said);
      return;
    }
    setError(null);
    setStatus('working');

    const { error: failure } = await browserClient().auth.updateUser({ password });
    if (failure) {
      setError(
        refusalFor(
          failure,
          // The one sentence that is this screen's: it sends no current
          // password and cannot, so a refusal naming one is the project
          // refusing the reset itself — which is not a thing the reader can
          // fix by typing, and saying so is better than a shrug.
          'This link could not set a password on its own. Write to support@vc-writer.com and a person will sort it out.',
        ),
      );
      setStatus('idle');
      return;
    }
    setPassword('');
    setAgain('');
    setStatus('done');
  };

  if (!ready) return null;

  if (status === 'done') {
    return (
      <>
        <div className="hero hero-compact">
          <h1>Password set</h1>
        </div>
        <section>
          <p className="notice" role="status">
            You are signed in, and that password works everywhere now — including{' '}
            <a href="/notes">Notes on your phone</a>, where an emailed link often cannot.
          </p>
          <Link href="/account" className="button">
            My account
          </Link>
        </section>
      </>
    );
  }

  /**
   * Arriving with no session is the ordinary failure rather than an odd one:
   * the emailed link is bound to the browser that asked for it, so a mail app
   * opening it in a browser of its own lands here with nothing. The sentence
   * is the sign-in page's, because it is the same fact.
   */
  if (!signedIn) {
    return (
      <>
        <div className="hero hero-compact">
          <h1>That link did not open</h1>
        </div>
        <section>
          <p className="notice">
            A reset link only works in the browser that asked for it, and it works once.{' '}
            <strong>If your mail app opened it itself, copy the link and paste it into your own browser</strong> —
            or ask for a new one.
          </p>
          <Link href="/signin" className="button">
            Ask for a new link
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="hero hero-compact">
        <h1>Set a new password</h1>
        <p>{email ?? 'Your account'}</p>
      </div>
      <section>
        <p className="muted small">
          The link you opened is what proves this is you, so there is nothing else to confirm — pick a new
          password and it takes effect at once, on every device.
        </p>
        <form onSubmit={save} style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
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
            {status === 'working' ? 'Saving…' : 'Set it'}
          </button>
        </form>
        {error ? (
          <p className="error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}
      </section>
    </>
  );
}
