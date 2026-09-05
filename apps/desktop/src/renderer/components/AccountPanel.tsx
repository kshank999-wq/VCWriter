import { useState } from 'react';
import { LicensePanel } from './LicensePanel';
import type { AccountStatus } from '../../preload/index';

interface AccountPanelProps {
  status: AccountStatus;
  onSignedIn(status: AccountStatus): void;
  onSignOut(): void;
}

/**
 * Sign-in for sync (spec §11, §12.1).
 *
 * A six-digit code typed into the app: no browser round trip, no protocol
 * handler to register per platform, and no password for VC Writer to be
 * responsible for. Sync is optional — the panel says so, because a writer who
 * never signs in still has a complete application.
 */
export function AccountPanel({ status, onSignedIn, onSignOut }: AccountPanelProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status.configured) {
    return (
      <div className="account">
        <h2>Sync is not set up in this build</h2>
        <p className="muted">
          VC Writer works fully without it — your projects are files on this computer. Sync and VC Writer Notes
          need the Supabase keys to be present when the app is built.
        </p>
      </div>
    );
  }

  if (status.signedIn) {
    return (
      <>
        <div className="account">
          <h2>Signed in</h2>
          <p className="muted">{status.email}</p>
          <p className="muted">
            Notes captured on your phone appear here for review. Nothing is added to a project until you approve
            it.
          </p>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <LicensePanel />
      </>
    );
  }

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    const result = await window.vcwriter.requestSignInCode(email.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'That code could not be sent');
      return;
    }
    setStage('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const result = await window.vcwriter.verifySignInCode({ email: email.trim(), code: code.trim() });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'That code was not accepted');
      return;
    }
    onSignedIn(result.data);
  };

  return (
    <div className="account">
      <h2>Sign in to sync</h2>
      <p className="muted">
        Optional. Signing in syncs this project and brings in notes captured on your phone. Your projects stay
        files on this computer either way.
      </p>

      {stage === 'email' ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void requestCode();
          }}
        >
          <input
            type="email"
            required
            value={email}
            placeholder="you@example.com"
            aria-label="Email address"
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="primary" disabled={busy || email.trim().length === 0}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            placeholder="6-digit code"
            aria-label="Sign-in code"
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" className="primary" disabled={busy || code.trim().length === 0}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="ghost" onClick={() => setStage('email')}>
            Use a different address
          </button>
        </form>
      )}

      {stage === 'code' ? <p className="muted">We sent a code to {email}. It expires shortly.</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
