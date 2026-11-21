'use client';

import { useState } from 'react';
import {
  EDIT_CREDIT_GUIDE,
  EDIT_CREDIT_PACKS,
  creditsLabel,
  pricePerThousand,
  type EditCreditPackId,
} from '@vcwriter/domain';

/**
 * **Edit credits** on the account page (addendum 47): the balance, and the
 * three packs. A pack is bought through Stripe Checkout; the credits land when
 * Stripe confirms the payment, so the page returns here saying they are on
 * their way rather than pretending they already arrived.
 */
export function EditCredits({ balance, justBought }: { balance: number; justBought: boolean }) {
  const [busy, setBusy] = useState<EditCreditPackId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (pack: EditCreditPackId) => {
    setBusy(pack);
    setError(null);
    const response = await fetch('/api/edit-credits/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack }),
    });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setError(payload.error ?? 'Checkout could not be started.');
      setBusy(null);
      return;
    }
    window.location.href = payload.url;
  };

  return (
    <section id="edit-credits">
      <h2>Edit credits</h2>
      <p className="lede">
        The AI check reads your pages for point-of-view slips, unclear pronouns, continuity, telling, dialogue and pacing, and
        tells you what it finds. <strong>It never rewrites a word.</strong> One credit checks 1,000 words.
      </p>
      <p>
        <strong>Balance: {creditsLabel(balance)} credits</strong> ({balance.toLocaleString('en-US')} words)
      </p>
      {justBought ? <p className="notice">Thank you. Your credits are added as soon as the payment clears, usually within a minute.</p> : null}
      <div className="grid">
        {EDIT_CREDIT_PACKS.map((pack) => (
          <article key={pack.id} className="card">
            <h3>${pack.priceCents / 100}</h3>
            <p>
              {creditsLabel(pack.words)} credits · {pack.words.toLocaleString('en-US')} words
            </p>
            <p className="muted small">${pricePerThousand(pack).toFixed(2)} per 1,000 words</p>
            <p style={{ marginTop: 12 }}>
              <button type="button" className="button" disabled={busy !== null} onClick={() => void buy(pack.id)}>
                {busy === pack.id ? 'Opening checkout…' : `Buy $${pack.priceCents / 100}`}
              </button>
            </p>
          </article>
        ))}
      </div>
      {error ? (
        <p className="error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      <p className="muted small" style={{ marginTop: 12 }}>
        About how much you need:{' '}
        {EDIT_CREDIT_GUIDE.map((one) => `${one.label}, ${creditsLabel(one.words)} credits`).join('; ')}. Each check is charged at
        least 1 credit, then in quarter credits. The passage you check is sent to Anthropic&rsquo;s Claude to be read, and is not
        used to train it.
      </p>
    </section>
  );
}
