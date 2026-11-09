'use client';

import { useState } from 'react';
import { LAPSE_PROMISE, inGoodStanding, type RoomBilling } from '@vcwriter/domain';

/**
 * The room's subscription (addendum 07 §23, repriced in §24): the room's own
 * fee, for the showrunner and one other person, and a seat for each person
 * after that.
 *
 * **One button with two destinations**, because the room's own row already
 * knows which it needs: Stripe Checkout where there is no subscription, and the
 * Billing Portal where there is. A page that worked it out for itself would
 * eventually work it out wrong.
 *
 * **The promise is on the screen, not in a support article.** A showrunner
 * reading a payment failure is at the worst moment to be guessing what happens
 * to the work, and the answer — *nothing, ever* — is the whole reason this
 * product exists. It is shown whenever the subscription is not in good
 * standing, rather than only after somebody asks.
 */
export function Billing({
  roomId,
  line,
  billing,
  wanted,
  yours,
}: {
  roomId: string;
  /** What the room is being charged for, in the domain's words. */
  line: string;
  billing: RoomBilling;
  /** Extra seats beyond the room's fee. Zero means only the room's fee. */
  wanted: number;
  yours: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/billing`, { method: 'POST' });
    const said = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !said.url) {
      setBusy(false);
      setError(said.error ?? 'Billing could not be opened.');
      return;
    }
    window.location.href = said.url;
  };

  const lapsed = billing.subscriptionId !== null && !inGoodStanding(billing.state);

  return (
    <>
      <p className="lede">{line}</p>

      {lapsed ? <p className="small">{LAPSE_PROMISE}</p> : null}

      {yours ? (
        <button type="button" className="button secondary small room-act" disabled={busy} onClick={open}>
          {billing.subscriptionId
            ? 'Card, invoices and cancelling'
            : wanted > 0
              ? `Start the room’s subscription, with ${wanted === 1 ? 'an extra seat' : `${wanted} extra seats`}`
              : 'Start the room’s subscription'}
        </button>
      ) : null}

      {error ? <p className="small error">{error}</p> : null}
    </>
  );
}
