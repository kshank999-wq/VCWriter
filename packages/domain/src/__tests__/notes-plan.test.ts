import { describe, expect, it } from 'vitest';
import {
  NOTES_PRODUCTS,
  appleState,
  describeNotesPlan,
  mayCaptureNotes,
  mayOfferNotes,
  notesPlan,
  notesRefusal,
  notesSubscriptionSchema,
  planKindOf,
  playState,
  worthReVerifying,
  type NotesState,
  type NotesSubscription,
} from '../notes-plan.js';

const NOW = '2026-10-01T12:00:00.000Z';
const LATER = '2026-11-01T00:00:00.000Z';
const EARLIER = '2026-09-01T00:00:00.000Z';

const subscription = (over: Partial<NotesSubscription> = {}): NotesSubscription =>
  notesSubscriptionSchema.parse({
    store: 'app_store',
    productId: NOTES_PRODUCTS.yearly,
    storeTransactionId: '2000000123456789',
    state: 'active',
    periodEnd: LATER,
    ...over,
  });

describe('what a plan is', () => {
  it('is never for an account that has not bought it', () => {
    expect(notesPlan({ subscription: null, now: NOW })).toEqual({ kind: 'never' });
    expect(notesPlan({ subscription: subscription({ state: 'none' }), now: NOW }).kind).toBe('never');
  });

  it('is paid while the period has not ended', () => {
    const plan = notesPlan({ subscription: subscription(), now: NOW });
    expect(plan).toMatchObject({ kind: 'paid', plan: 'yearly', renews: true, until: LATER });
    expect(mayCaptureNotes(plan)).toBe(true);
    expect(notesRefusal(plan)).toBeNull();
  });

  it('is lapsed once the period has ended', () => {
    const plan = notesPlan({ subscription: subscription({ periodEnd: EARLIER }), now: NOW });
    expect(plan).toMatchObject({ kind: 'lapsed', ended: EARLIER });
    expect(mayCaptureNotes(plan)).toBe(false);
  });

  /**
   * A cancelled subscription is paid up until it runs out — that is the month
   * the customer paid for. What changes is that the line says so.
   */
  it('keeps a cancelled subscription until it ends, and says it will not renew', () => {
    const plan = notesPlan({ subscription: subscription({ state: 'canceled', autoRenews: false }), now: NOW });
    expect(plan).toMatchObject({ kind: 'paid', renews: false });
    expect(mayCaptureNotes(plan)).toBe(true);
    expect(describeNotesPlan(plan)).toContain('Will not renew');
  });

  /**
   * Read before the period end on purpose: somebody who has had their money
   * back does not keep the month they did not pay for.
   */
  it('stops a refund at once, whatever the period end says', () => {
    const plan = notesPlan({ subscription: subscription({ state: 'revoked', periodEnd: LATER }), now: NOW });
    expect(plan).toMatchObject({ kind: 'lapsed', state: 'revoked' });
    expect(mayCaptureNotes(plan)).toBe(false);
    expect(notesRefusal(plan)).toContain('refunded');
  });

  /** Both shops ask that access continue while they chase a payment. */
  it.each<NotesState>(['in_grace', 'billing_retry'])('keeps working in %s', (state) => {
    const plan = notesPlan({ subscription: subscription({ state, periodEnd: EARLIER }), now: NOW });
    expect(plan.kind).toBe('grace');
    expect(mayCaptureNotes(plan)).toBe(true);
    expect(notesRefusal(plan)).toBeNull();
  });

  it('refuses a paused subscription without calling it a refund', () => {
    const plan = notesPlan({ subscription: subscription({ state: 'paused' }), now: NOW });
    expect(mayCaptureNotes(plan)).toBe(false);
    expect(describeNotesPlan(plan)).toContain('Paused');
  });

  it('never refuses in a sentence that threatens the notes', () => {
    for (const state of ['none', 'expired', 'revoked'] as NotesState[]) {
      const plan = notesPlan({ subscription: subscription({ state, periodEnd: EARLIER }), now: NOW });
      expect(notesRefusal(plan)).toContain('Every note you have sent stays readable');
    }
  });
});

describe('what is offered', () => {
  it('offers the purchase to somebody who has never bought or has lapsed', () => {
    expect(mayOfferNotes({ kind: 'never' })).toBe(true);
    expect(
      mayOfferNotes(notesPlan({ subscription: subscription({ periodEnd: EARLIER }), now: NOW })),
    ).toBe(true);
  });

  /**
   * Absent rather than greyed, and for grace the reason is stronger than
   * tidiness: buying a second subscription is not how a declined card is fixed.
   */
  it('offers it to nobody who is paid up or in grace', () => {
    expect(mayOfferNotes(notesPlan({ subscription: subscription(), now: NOW }))).toBe(false);
    expect(
      mayOfferNotes(notesPlan({ subscription: subscription({ state: 'in_grace' }), now: NOW })),
    ).toBe(false);
  });
});

describe('when the shop is worth asking again', () => {
  /** The ordinary case costs no network: a paid-up row is never re-verified. */
  it('does not ask about a subscription that has not run out', () => {
    expect(worthReVerifying(subscription(), NOW)).toBe(false);
  });

  it('asks once where the period has ended and nobody has looked since', () => {
    expect(worthReVerifying(subscription({ periodEnd: EARLIER, lastVerifiedAt: null }), NOW)).toBe(true);
    expect(
      worthReVerifying(subscription({ periodEnd: EARLIER, lastVerifiedAt: '2026-08-01T00:00:00.000Z' }), NOW),
    ).toBe(true);
  });

  it('stops asking once it has been checked since it ran out', () => {
    expect(
      worthReVerifying(subscription({ periodEnd: EARLIER, lastVerifiedAt: '2026-09-20T00:00:00.000Z' }), NOW),
    ).toBe(false);
  });

  /** A refund is final; asking again is asking to be told the same thing. */
  it('never asks again about a refund', () => {
    expect(worthReVerifying(subscription({ state: 'revoked', periodEnd: EARLIER }), NOW)).toBe(false);
  });

  it('has nothing to ask about an account with no subscription', () => {
    expect(worthReVerifying(null, NOW)).toBe(false);
    expect(worthReVerifying(subscription({ state: 'none' }), NOW)).toBe(false);
  });
});

describe('the two shops become one vocabulary', () => {
  it('reads Apple’s numbers', () => {
    expect(appleState(1)).toBe('active');
    expect(appleState(2)).toBe('expired');
    expect(appleState(3)).toBe('billing_retry');
    expect(appleState(4)).toBe('in_grace');
    expect(appleState(5)).toBe('revoked');
  });

  it('reads Google’s names', () => {
    expect(playState('SUBSCRIPTION_STATE_ACTIVE')).toBe('active');
    expect(playState('SUBSCRIPTION_STATE_IN_GRACE_PERIOD')).toBe('in_grace');
    expect(playState('SUBSCRIPTION_STATE_ON_HOLD')).toBe('billing_retry');
    expect(playState('SUBSCRIPTION_STATE_PAUSED')).toBe('paused');
    expect(playState('SUBSCRIPTION_STATE_CANCELED')).toBe('canceled');
    expect(playState('SUBSCRIPTION_STATE_EXPIRED')).toBe('expired');
  });

  /** A status this build has never heard of is not a reason to let somebody in. */
  it('reads an unknown status as expired rather than as active', () => {
    expect(appleState(99)).toBe('expired');
    expect(playState('SUBSCRIPTION_STATE_SOMETHING_NEW')).toBe('expired');
  });
});

describe('which product it is', () => {
  it('names the two plans', () => {
    expect(planKindOf(NOTES_PRODUCTS.yearly)).toBe('yearly');
    expect(planKindOf(NOTES_PRODUCTS.monthly)).toBe('monthly');
  });

  /** A receipt for something else is not a Notes subscription. */
  it('refuses a product id it does not know', () => {
    expect(planKindOf('com.someone.else.pro')).toBeNull();
  });
});

describe('somebody who was here before it was paid', () => {
  const EARLY = '2026-06-01T00:00:00.000Z';
  const AFTER = '2026-10-05T00:00:00.000Z';

  /**
   * The whole of §14.1 in one assertion: nobody who was already using Notes
   * loses it on the day it becomes a paid app.
   */
  it('keeps it, with nothing to buy', () => {
    const plan = notesPlan({ subscription: null, firstCapturedAt: EARLY, now: NOW });
    expect(plan).toEqual({ kind: 'included', since: EARLY });
    expect(mayCaptureNotes(plan)).toBe(true);
    expect(notesRefusal(plan)).toBeNull();
    expect(mayOfferNotes(plan)).toBe(false);
  });

  it('does not keep it for somebody whose first note came after', () => {
    expect(notesPlan({ subscription: null, firstCapturedAt: AFTER, now: NOW }).kind).toBe('never');
    expect(notesPlan({ subscription: null, firstCapturedAt: null, now: NOW }).kind).toBe('never');
  });

  /** A subscriber's line says what they pay for, not that they were early. */
  it('is read after a live subscription rather than in front of it', () => {
    const plan = notesPlan({ subscription: subscription(), firstCapturedAt: EARLY, now: NOW });
    expect(plan.kind).toBe('paid');
  });

  /** And a lapse falls back to it, which is the generous answer and the right one. */
  it('catches somebody whose subscription then lapses', () => {
    const plan = notesPlan({
      subscription: subscription({ periodEnd: EARLIER }),
      firstCapturedAt: EARLY,
      now: NOW,
    });
    expect(plan.kind).toBe('included');
    expect(mayCaptureNotes(plan)).toBe(true);
  });

  it('catches a refund too, rather than punishing an early writer for one', () => {
    const plan = notesPlan({
      subscription: subscription({ state: 'revoked' }),
      firstCapturedAt: EARLY,
      now: NOW,
    });
    expect(plan.kind).toBe('included');
  });
});
