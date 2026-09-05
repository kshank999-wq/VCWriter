import { useCallback, useEffect, useState } from 'react';
import type { UpdateStatus } from '../../preload/index';

/**
 * Licensing this computer, and updating it (spec §3.3).
 *
 * Both are deliberate acts here rather than things that happen to the writer.
 * An update in particular is never applied silently: VC Writer is where someone
 * keeps work in progress, and restarting it uninvited mid-scene is not a
 * trade worth making for a faster rollout.
 */
export function LicensePanel() {
  const [serial, setSerial] = useState('');
  const [activating, setActivating] = useState(false);
  const [activation, setActivation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState<{ path: string; version: string } | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    const result = await window.vcwriter.checkForUpdate();
    setChecking(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The update check failed');
      return;
    }
    setUpdate(result.data);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

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
  };

  const download = async () => {
    if (update?.decision.action !== 'update') return;
    setDownloading(true);
    setError(null);
    const result = await window.vcwriter.downloadUpdate({
      expectedSha256: update.decision.sha256,
      version: update.decision.version,
    });
    setDownloading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The update could not be downloaded');
      return;
    }
    setDownloaded({ path: result.data.path, version: result.data.version });
  };

  const decision = update?.decision;

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
          placeholder="VCW-XXXXX-XXXXX-XXXXX-XXXXX"
          aria-label="License serial"
        />
        <button type="submit" className="primary" disabled={activating || serial.trim().length === 0}>
          {activating ? 'Activating…' : 'Activate'}
        </button>
      </form>
      <p className="muted">
        Your serial is in your purchase email and on your account page. Freeing a seat from a computer you no
        longer use is done there too.
      </p>
      {activation ? <p className="notice">{activation}</p> : null}

      <h2>Updates</h2>
      {checking ? (
        <p className="muted">Checking…</p>
      ) : decision?.action === 'update' ? (
        <>
          <p>
            Version {decision.version} is available. You have {update?.currentVersion}.
          </p>
          {decision.releaseNotes ? <p className="muted">{decision.releaseNotes}</p> : null}
          {downloaded ? (
            <>
              <p className="notice">
                Version {downloaded.version} downloaded and its checksum verified. Installing will close VC
                Writer — your work is saved first.
              </p>
              <button type="button" className="primary" onClick={() => void window.vcwriter.installUpdate(downloaded.path)}>
                Install and restart
              </button>
            </>
          ) : (
            <button type="button" className="primary" disabled={downloading} onClick={() => void download()}>
              {downloading ? 'Downloading…' : 'Download update'}
            </button>
          )}
        </>
      ) : decision?.action === 'unsupported_os' ? (
        <p className="notice">
          Version {decision.version} needs {decision.requires} or later, so it is not offered on this computer.
          The version you have keeps working.
        </p>
      ) : decision?.action === 'no_build' ? (
        <p className="muted">No build has been published for this platform yet.</p>
      ) : (
        <p className="muted">VC Writer {update?.currentVersion} is up to date.</p>
      )}

      <button type="button" className="ghost" disabled={checking} onClick={() => void check()}>
        Check again
      </button>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
