'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserClient } from '@/lib/supabase-browser';
import { safeNextPath } from '@/lib/auth-redirect';

/**
 * Signing in, two ways (addendum 09 §14).
 *
 * It was a magic link and nothing else, and the phone is what proved that is
 * not enough. **A magic link is bound to the browser that asked for it** — the
 * PKCE verifier is in that browser's storage — and a phone opens mail in the
 * mail app's own in-app browser, which has none, so the exchange fails and the
 * form comes back. From the writer's chair that is a **loop**: ask for a link,
 * open it, arrive at the same screen, ask again.
 *
 * So a password is not a convenience here, it is the **fix**: it has no
 * handoff between browsers at all, so it works wherever it is typed. The link
 * stays, because it is the only way in for somebody who has never set one, and
 * because it is what a person who has forgotten theirs needs.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

/** Which way in is showing. The password is first, being the one that always works. */
type Way = 'password' | 'link';

function SignInForm() {
  // Where to land after: the page that sent the customer here (the admin
  // console, the browser preview, the phone), or the account page.
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNextPath(params.get('next'));
  /**
   * Why the last link did not work, where the callback said so. Said here,
   * because a form that silently reappears reads as a loop — and now the
   * notice can offer the thing that would stop it happening again.
   */
  const failed = params.get('error') === 'link_expired';

  const [way, setWay] = useState<Way>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('working');
    setError(null);
    const { error: failure } = await browserClient().auth.signInWithPassword({ email, password });
    if (failure) {
      // Supabase says *Invalid login credentials* for a wrong password and for
      // an account that has never set one, which are different problems with
      // different answers — so the sentence names both and points at the link.
      setError(
        failure.message === 'Invalid login credentials'
          ? 'That email and password do not match. If you have never set a password, ask for a link instead and set one on your account page.'
          : failure.message,
      );
      setStatus('idle');
      return;
    }
    // A full navigation rather than a push: the session is a cookie the server
    // components read, and only a real request hands it to them.
    window.location.assign(next);
  };

  const sendLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('working');
    setError(null);
    const { error: failure } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (failure) {
      setError(failure.message);
      setStatus('idle');
      return;
    }
    setStatus('sent');
  };

  if (status === 'sent') {
    return (
      <>
        <div className="hero hero-compact">
          <h1>Check your email</h1>
        </div>
        <section>
          <p className="notice">
            A sign-in link is on its way to {email}. <strong>Open it in this browser</strong> — the link only
            works where it was asked for. If your mail app opens links in a browser of its own, copy the link
            and paste it here instead.
          </p>
          <p className="muted small">
            Once you are in, set a password on your account page and you will not need a link again.
          </p>
          <button type="button" className="button secondary" onClick={() => setStatus('idle')}>
            Back
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="hero hero-compact">
        <h1>Sign in</h1>
        <p>Use the address you bought VC Writer with.</p>
      </div>
      <section>
        {/* Two ways in, one at a time: a form showing an email, a password and
            a *send me a link instead* button is three things to decide
            between where there are two. */}
        <div className="signin-ways" role="tablist" aria-label="How to sign in">
          <button
            type="button"
            role="tab"
            aria-selected={way === 'password'}
            className={way === 'password' ? 'button' : 'button secondary'}
            onClick={() => {
              setWay('password');
              setError(null);
            }}
          >
            With a password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={way === 'link'}
            className={way === 'link' ? 'button' : 'button secondary'}
            onClick={() => {
              setWay('link');
              setError(null);
            }}
          >
            Email me a link
          </button>
        </div>

        {way === 'password' ? (
          <form onSubmit={signIn} style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
            />
            <button type="submit" className="button" disabled={status === 'working'}>
              {status === 'working' ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="muted small">
              No password yet? Ask for a link, then set one on your account page — after that this is all you
              need, on any device.
            </p>
          </form>
        ) : (
          <form onSubmit={sendLink} style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <button type="submit" className="button" disabled={status === 'working'}>
              {status === 'working' ? 'Sending…' : 'Email me a link'}
            </button>
            <p className="muted small">
              Open the link in this same browser. On a phone that often means copying it out of your mail app.
            </p>
          </form>
        )}

        {error ? (
          <p className="error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}

        {/* **Under the form, not over it.** Measured at 390×780 this notice
            pushed the tabs to 786 and the email box to 896 — so the writer it
            is written for, who has just been bounced back here, saw the
            explanation and none of the form that would fix it. What they came
            to do goes first; why the last try failed goes after. */}
        {failed ? (
          <p className="notice" role="status">
            That link could not sign you in: it had already been used, or it was opened in a different browser
            from the one that asked for it — which is what happens when a phone&rsquo;s mail app opens links
            itself. <strong>A password works in any browser</strong>, so setting one on your account page is
            the way to stop this happening again.
          </p>
        ) : null}


      </section>
    </>
  );
}
