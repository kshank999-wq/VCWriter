'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { codeRefusal, normaliseCode, type Platform } from '@vcwriter/domain';

const OPTIONS: ReadonlyArray<{ platform: Platform; label: string; detail: string }> = [
  { platform: 'windows', label: 'Download for Windows', detail: 'Windows 10 and Windows 11, 64-bit' },
  { platform: 'macos', label: 'Download for Mac', detail: 'macOS, Apple silicon and Intel' },
];

/** What the shop said a code is worth. */
interface Checked {
  code: string;
  takes: string;
  was: string | null;
  now: string | null;
}

export function PlatformChoice({ advertisedCode = null }: { advertisedCode?: string | null }) {
  const [platform, setPlatform] = useState<Platform>('windows');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typed, setTyped] = useState(advertisedCode ? normaliseCode(advertisedCode) : '');
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<Checked | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  /**
   * Ask the shop what a code is worth. The shop decides, every time — this
   * never computes a discount and never remembers one, so what is drawn is
   * always what the till will charge.
   */
  const check = useCallback(async (said: string): Promise<void> => {
    const word = codeRefusal(said);
    if (word) {
      setApplied(null);
      setCodeError(word);
      return;
    }
    setChecking(true);
    setCodeError(null);
    try {
      const response = await fetch(`/api/discount?code=${encodeURIComponent(normaliseCode(said))}`);
      const payload = (await response.json()) as Partial<Checked> & { ok?: boolean; error?: string };
      if (payload.ok && payload.code && payload.takes) {
        setApplied({
          code: payload.code,
          takes: payload.takes,
          was: payload.was ?? null,
          now: payload.now ?? null,
        });
      } else {
        setApplied(null);
        setCodeError(payload.error ?? 'That code is not valid.');
      }
    } catch {
      setApplied(null);
      setCodeError('That code could not be checked.');
    } finally {
      setChecking(false);
    }
  }, []);

  /**
   * **A code carried in from an advertisement applies itself.** That is the
   * whole of what the link is for: a reader who followed one has already said
   * the code, and asking them to press a button to use it is asking them to do
   * the thing the link exists to save.
   */
  const asked = useRef(false);
  useEffect(() => {
    if (!advertisedCode || asked.current) return;
    asked.current = true;
    void check(advertisedCode);
  }, [advertisedCode, check]);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The word, never the discount: the server asks the shop again for
        // itself, so nothing here can decide what anybody is charged.
        body: JSON.stringify({ platform, ...(applied ? { code: applied.code } : {}) }),
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

      <div className="discount-box">
        {applied ? (
          // Applied: the box is gone and what is left is the fact and a way
          // out. A field still offering to take a code, beside a code that has
          // been taken, is two answers to whether it worked.
          <p className="discount-applied" role="status">
            <strong>{applied.code}</strong> — {applied.takes}
            {applied.was && applied.now ? (
              <>
                {' '}
                · <s>{applied.was}</s> <strong>{applied.now}</strong>
              </>
            ) : null}{' '}
            <button
              type="button"
              className="text-act"
              onClick={() => {
                setApplied(null);
                setTyped('');
                setCodeError(null);
              }}
            >
              Remove
            </button>
          </p>
        ) : (
          <form
            className="discount-form"
            onSubmit={(event) => {
              event.preventDefault();
              void check(typed);
            }}
          >
            <label htmlFor="discount-code">Discount code</label>
            <div className="discount-row">
              <input
                id="discount-code"
                value={typed}
                // Upper-cased as it is typed, because the program only ever
                // makes upper-case codes and a box that quietly disagrees with
                // what is printed on the advertisement reads as a refusal.
                onChange={(event) => setTyped(normaliseCode(event.target.value))}
                placeholder="If you have one"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="button secondary" disabled={checking || typed.length === 0}>
                {checking ? 'Checking…' : 'Apply'}
              </button>
            </div>
            {codeError ? (
              <p className="field-note error" role="alert">
                {codeError}
              </p>
            ) : null}
          </form>
        )}
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
