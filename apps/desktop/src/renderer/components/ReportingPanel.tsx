import { useEffect, useState } from 'react';

/**
 * The error-reporting choice (spec §14).
 *
 * Shown whether or not anyone is signed in, because the setting is about this
 * computer rather than an account, and stated plainly enough that turning it on
 * is an informed choice: what is sent, and what is not. The default is off.
 */
export function ReportingPanel() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const result = await window.vcwriter.reportingSettings();
      if (result.ok && result.data) setEnabled(result.data.enabled);
      setLoaded(true);
    })();
  }, []);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    const result = await window.vcwriter.setReporting(next);
    // If the write failed, show what is actually stored rather than what was
    // clicked — a privacy setting that lies about its state is worse than one
    // that fails visibly.
    if (result.ok && result.data) setEnabled(result.data.enabled);
  };

  return (
    <div className="account">
      <h2>Error reports</h2>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!loaded}
          onChange={(event) => void toggle(event.target.checked)}
        />
        Send an error report when something goes wrong
      </label>
      <p className="muted">
        A report says what broke, in which version of VC Writer, and on which operating system. It never
        includes your writing, your notes, your project titles or where your files are kept — file paths are
        removed before anything is sent. This is off until you turn it on.
      </p>
    </div>
  );
}
