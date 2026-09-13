'use client';

import { useState } from 'react';
import type { Platform } from '@vcwriter/domain';

const OPTIONS: ReadonlyArray<{ platform: Platform; label: string; detail: string }> = [
  { platform: 'windows', label: 'Download for Windows', detail: 'Windows 10 and Windows 11, 64-bit' },
  { platform: 'macos', label: 'Download for Mac', detail: 'macOS, Apple silicon and Intel' },
];

export function PlatformChoice() {
  const [platform, setPlatform] = useState<Platform>('windows');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Checkout could not be started');
      }
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout could not be started');
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="platform-choice">
        {OPTIONS.map((option) => (
          <button
            key={option.platform}
            type="button"
            className="platform-option"
            aria-pressed={platform === option.platform}
            onClick={() => setPlatform(option.platform)}
          >
            <strong>{option.label}</strong>
            <span>{option.detail}</span>
          </button>
        ))}
      </div>

      <button type="button" className="button" onClick={startCheckout} disabled={busy}>
        {busy ? 'Opening checkout…' : 'Continue to payment'}
      </button>

      {error ? (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}

      <p className="lede" style={{ marginTop: 24 }}>
        After payment you get your download straight away, plus an email with your license and a link to
        re-download either build at any time.
      </p>
    </section>
  );
}
