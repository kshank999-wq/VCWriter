import { useEffect, useState } from 'react';
import type { AccountStatus } from '../../preload/index';
import { useModal } from '../use-modal';
import { ACTIVATED_EVENT } from '../use-writing-access';
import { SignInForm } from './SignInForm';

interface ActivationDialogProps {
  open: boolean;
  account: AccountStatus;
  onSignedIn(status: AccountStatus): void;
  onClose(): void;
}

/**
 * **Activate this computer** (addendum 41 §10, from Ken: *read-only until
 * activated*).
 *
 * It opens by itself the first time a copy that was never activated starts,
 * and again from the notice's *Activate* button. It has two steps: sign in
 * with the account the licence was bought on, then one button. No serial is
 * needed, because the server tries the account's own licences, though one can
 * still be typed for an account with several.
 *
 * Closing it is allowed. The copy stays read-only, and the notice at the top
 * says so and keeps the button.
 */
export function ActivationDialog({ open, account, onSignedIn, onClose }: ActivationDialogProps) {
  const dialog = useModal(open);
  const [serial, setSerial] = useState('');
  const [withSerial, setWithSerial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDone(false);
  }, [open]);

  const activate = async () => {
    setBusy(true);
    setError(null);
    const result = await window.vcwriter.activateLicense(serial.trim());
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Activation failed. Check your connection and try again.');
      return;
    }
    if (!result.data.activated) {
      setError(result.data.message ?? 'No seat is free on this licence.');
      return;
    }
    setDone(true);
    setSerial('');
    window.dispatchEvent(new Event(ACTIVATED_EVENT));
  };

  return (
    <dialog ref={dialog} className="track-dialog activation-dialog" aria-label="Activate VC Writer" onClose={onClose}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Activate VC Writer</span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="account">
            {done ? (
              <>
                <p className="notice">This computer is activated. You can write.</p>
                <button type="button" className="primary" onClick={onClose}>
                  Start writing
                </button>
              </>
            ) : !account.signedIn ? (
              <>
                <p>
                  Sign in with the email address you bought VC Writer with. Until this computer is activated,
                  your work opens, prints and exports, but cannot be changed.
                </p>
                <SignInForm onSignedIn={onSignedIn} />
              </>
            ) : (
              <>
                <p>
                  Signed in as {account.email}. Activating uses one of your licence’s seats, and works offline
                  from then on.
                </p>
                <form
                  className="inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void activate();
                  }}
                >
                  {withSerial ? (
                    <input
                      value={serial}
                      onChange={(event) => setSerial(event.target.value)}
                      placeholder="VCW-XXXXX-XXXXX-XXXXX-XXXXX"
                      aria-label="License serial"
                    />
                  ) : null}
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? 'Activating…' : 'Activate this computer'}
                  </button>
                </form>
                {withSerial ? null : (
                  <button type="button" className="ghost" onClick={() => setWithSerial(true)}>
                    Use a serial number instead
                  </button>
                )}
                <p className="muted">
                  No licence yet?{' '}
                  <a href="https://vc-writer.com/purchase" target="_blank" rel="noreferrer">
                    Buy VC Writer
                  </a>
                  . A computer you no longer use can be freed on{' '}
                  <a href="https://vc-writer.com/account" target="_blank" rel="noreferrer">
                    your account page
                  </a>
                  .
                </p>
              </>
            )}
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
