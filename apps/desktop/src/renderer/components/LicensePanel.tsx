import { useEffect, useState } from 'react';
import { ACTIVATED_EVENT } from '../use-writing-access';
import { UpdatePanel, updates } from '../updates';

/**
 * Licensing this computer, and updating it (spec §3.3).
 *
 * Both are deliberate acts here rather than things that happen to the writer.
 * Updates are Help → Check for Updates' panel (addendum 48): an update never
 * restarts VC Writer under the writer's hands — unasked, only when everything
 * is saved and they are away from the keys, else at the next start.
 */
export function LicensePanel() {
  const [serial, setSerial] = useState('');
  const [activating, setActivating] = useState(false);
  const [activation, setActivation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Asked afresh whenever the page opens, as Help → Check for Updates does.
  useEffect(() => {
    void updates.check();
  }, []);

  const activate = async () => {
    setActivating(true);
    setError(null);
    setActivation(null);
    const result = await window.vcwriter.activateLicense(serial.trim());
    setActivating(false);

    if (!result.ok || !result.data) {
      setError(result.error ?? 'Activation failed');
      return;
    }
    if (!result.data.activated) {
      // A refusal is an answer the writer can act on, not an error.
      setError(result.data.message ?? 'No seat is free on this license.');
      return;
    }
    setActivation(
      result.data.reason === 'already_active'
        ? 'This computer was already activated.'
        : result.data.reason === 'reactivated'
          ? 'This computer has taken its seat back.'
          : 'This computer is now activated.',
    );
    setSerial('');
    window.dispatchEvent(new Event(ACTIVATED_EVENT));
  };

  return (
    <div className="account">
      <h2>This computer</h2>

      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void activate();
        }}
      >
        <input
          value={serial}
          onChange={(event) => setSerial(event.target.value)}
          placeholder="Serial (optional)"
          aria-label="License serial"
        />
        <button type="submit" className="primary" disabled={activating}>
          {activating ? 'Activating…' : 'Activate'}
        </button>
      </form>
      <p className="muted">
        Without a serial, VC Writer activates on this account’s own licence. Your serial is in your purchase
        email and on your account page, which is also where you free a seat on a computer you no longer use.
      </p>
      {activation ? <p className="notice">{activation}</p> : null}

      <h2>Updates</h2>
      <UpdatePanel />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
