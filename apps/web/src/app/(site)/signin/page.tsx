'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { browserClient } from '@/lib/supabase-browser';
import { safeNextPath } from '@/lib/auth-redirect';

/**
 * Email sign-in. A magic link keeps passwords out of the product entirely and
 * doubles as the verification step the account flow needs (spec §12.3).
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  // Where to land after the link: the page that sent the customer here (the
  // admin console, the browser preview), or the account page.
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  /**
   * Why the last link did not work, where the callback said so. A link is
   * single-use and is tied to the browser that asked for it, so the two ways
   * it fails are being opened twice and being opened somewhere else — a
   * phone's mail app opening it in its own browser is the common one. Said
   * here, because a form that silently reappears reads as a loop.
   */
  const failed = params.get('error') === 'link_expired';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    setError(null);
    const { error: signInError } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (signInError) {
      setError(signInError.message);
      setStatus('idle');
      return;
    }
    setStatus('sent');
  };

  return (
    <>
      <div className="hero">
        <h1>Sign in</h1>
        <p>We will email you a link. Use the address you bought VC Writer with.</p>
      </div>
      <section>
        {failed && status !== 'sent' ? (
          <p className="notice" role="status">
            That link could not sign you in: it had already been used, or it was opened in a different browser
            from the one that asked for it. Ask for a new one here, and open it in this same browser — if your
            mail app opens links in a browser of its own, copy the link and paste it here instead.
          </p>
        ) : null}
        {status === 'sent' ? (
          <p className="notice">
            Check {email} for your sign-in link, and open it in this browser — the link only works where it was
            asked for.
          </p>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <button type="submit" className="button" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        )}
        {error ? (
          <p className="error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}
      </section>
    </>
  );
}
