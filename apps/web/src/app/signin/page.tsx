'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase-browser';

/**
 * Email sign-in. A magic link keeps passwords out of the product entirely and
 * doubles as the verification step the account flow needs (spec §12.3).
 */
export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    setError(null);
    const { error: signInError } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` },
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
        {status === 'sent' ? (
          <p className="notice">Check {email} for your sign-in link.</p>
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
