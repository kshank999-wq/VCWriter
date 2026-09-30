import { z } from 'zod';

/**
 * What a Notes subscription is, and what it entitles (addendum 27 §14).
 *
 * Notes is sold as a paid companion app: **$49.99 a year or $4.99 a month, by
 * in-app purchase**, from the App Store and Google Play. The desktop licence is
 * a purchase (spec §12.2) and a Writers Room seat is a Stripe subscription
 * (addendum 07 §14); this is the third entitlement and the only one whose till
 * belongs to somebody else.
 *
 * Four decisions carry it, and the first is the one to keep.
 *
 * **The subscription adds and never takes.** What it entitles is *Notes* — the
 * app, and the syncing that is the whole point of a capture app that is not
 * where the writing happens. A desktop licence has carried cloud sync for the
 * project it owns since 0002 and goes on carrying it: nobody who has already
 * bought VC Writer loses anything on the day this ships. That is addendum 07
 * §1's rule pointed at a new product, and the reason it matters here is that a
 * subscription bolted onto something people were already using is how a
 * customer learns the software can be turned against them.
 *
 * **A lapse never reaches what somebody wrote.** `LAPSE_PROMISE` says it for a
 * room and `NOTES_PROMISE` says it here: a subscription that ends stops the
 * phone **sending** new notes. Everything already sent stays where it is,
 * readable on the phone and on the desk, and every note already filed into a
 * project is part of the project. There is deliberately no `mayReadNotes` in
 * this file, because there is no state in which reading is refused.
 *
 * **Two shops become one vocabulary, here.** Apple reports a subscription's
 * status as a number and Google as a name, and neither's list is the other's —
 * so `appleState` and `playState` map both into `NotesState` and nothing
 * downstream knows which shop sold it. They are pure and tested for the plainest
 * reason: they are the part that can be wrong in a way nobody notices until
 * somebody who has paid is refused.
 *
 * **The store is the till and the website is the advertisement.** The price
 * lives in the store, as it does in Stripe for everything else (`pricing.ts`) —
 * the app shows what StoreKit or Play Billing says it costs, localised, which is
 * both truer and what both shops require. `NOTES_PRICE_WORDS` is the *advertised*
 * price for the referral page on vc-writer.com, which cannot ask a shop what it
 * is charging in somebody's currency; it is one copy, in one place, named for
 * what it is.
 */

// -------------------------------------------------------------- what is sold

export const NOTES_STORES = ['app_store', 'play_store'] as const;
export const notesStoreSchema = z.enum(NOTES_STORES);
export type NotesStore = (typeof NOTES_STORES)[number];

export const NOTES_STORE_NAMES: Record<NotesStore, string> = {
  app_store: 'the App Store',
  play_store: 'Google Play',
};

/** The two plans, and the ids the products carry in both consoles. */
export const NOTES_PRODUCTS = {
  yearly: 'com.vcwriter.notes.yearly',
  monthly: 'com.vcwriter.notes.monthly',
} as const;
export type NotesPlanKind = keyof typeof NOTES_PRODUCTS;

/**
 * Which plan a product id names, or null for one this build has never heard of.
 *
 * Null rather than a guess: a product id nobody recognises is a receipt for
 * something else, and entitling on it would be entitling on a stranger's
 * purchase.
 */
export const planKindOf = (productId: string): NotesPlanKind | null => {
  const found = (Object.keys(NOTES_PRODUCTS) as NotesPlanKind[]).find(
    (kind) => NOTES_PRODUCTS[kind] === productId,
  );
  return found ?? null;
};

/**
 * What the website says it costs.
 *
 * **Not what the customer is charged** — the shop is, and it charges in their
 * currency after its own rounding. This is the advertised price for the page
 * that cannot ask: one copy, in one place, so a change is one edit.
 */
export const NOTES_PRICE_WORDS: Record<NotesPlanKind, string> = {
  yearly: '$49.99 a year',
  monthly: '$4.99 a month',
};

// --------------------------------------------------------- where it stands

/**
 * Where the subscription is, in one vocabulary for both shops.
 *
 * `none` is an account that has never bought it, which is every account until
 * somebody does and is not a problem to nag about.
 */
export const NOTES_STATES = [
  'none',
  'trialing',
  'active',
  /** The shop is giving the customer time after a failed payment. Access continues. */
  'in_grace',
  /** The shop is retrying the card. Apple and Google both ask that access continue. */
  'billing_retry',
  /** Will not renew, and has not run out yet. */
  'canceled',
  'expired',
  /** Refunded, or taken back by the shop. Access stops at once. */
  'revoked',
  /** Google's own: the customer paused the subscription. Nothing is owed and nothing is entitled. */
  'paused',
] as const;
export const notesStateSchema = z.enum(NOTES_STATES);
export type NotesState = (typeof NOTES_STATES)[number];

/** The subscription as the database keeps it. */
export const notesSubscriptionSchema = z.object({
  store: notesStoreSchema,
  productId: z.string(),
  storeTransactionId: z.string(),
  state: notesStateSchema.default('none'),
  /** When what has been paid for runs out. Null before a purchase is verified. */
  periodEnd: z.string().nullable().default(null),
  autoRenews: z.boolean().default(true),
  environment: z.enum(['production', 'sandbox']).default('production'),
  lastVerifiedAt: z.string().nullable().default(null),
});
export type NotesSubscription = z.infer<typeof notesSubscriptionSchema>;

/**
 * Apple's `status` from the App Store Server API, in this project's words.
 *
 * 1 active, 2 expired, 3 billing retry, 4 grace, 5 revoked. Anything else is
 * read as expired rather than as active: a status this build does not know is
 * not a reason to let somebody in.
 */
export const appleState = (status: number): NotesState => {
  switch (status) {
    case 1:
      return 'active';
    case 2:
      return 'expired';
    case 3:
      return 'billing_retry';
    case 4:
      return 'in_grace';
    case 5:
      return 'revoked';
    default:
      return 'expired';
  }
};

/**
 * Google's `subscriptionState` from the Play Developer API, in the same words.
 *
 * `ON_HOLD` is a failed payment Google is still working on, so it reads as a
 * billing retry rather than as expired — the same treatment Apple's 3 gets, for
 * the same reason: the customer has not stopped paying, their bank has.
 */
export const playState = (state: string): NotesState => {
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return 'active';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return 'in_grace';
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      return 'billing_retry';
    case 'SUBSCRIPTION_STATE_PAUSED':
      return 'paused';
    case 'SUBSCRIPTION_STATE_CANCELED':
      return 'canceled';
    case 'SUBSCRIPTION_STATE_PENDING':
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
      return 'none';
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return 'expired';
    default:
      return 'expired';
  }
};

// ------------------------------------------------------------- what it reads

/**
 * The day Notes became a paid app.
 *
 * Anybody who had already sent a note before this was using something they were
 * sold for nothing, and **taking it away is exactly what §14.1 says this
 * subscription does not do**. So they keep it, and the check is a reading over
 * a table that already exists — the date their first note was captured — rather
 * than a flag somebody has to remember to set on the right accounts.
 */
export const NOTES_FREE_FROM = '2026-09-30T00:00:00.000Z';

export type NotesPlan =
  /** Never bought. */
  | { kind: 'never' }
  /** Was here before it was a paid app, and keeps it. */
  | { kind: 'included'; since: string }
  /** Paid up. `until` is when it next renews, or when it runs out if it will not. */
  | { kind: 'paid'; store: NotesStore; plan: NotesPlanKind | null; until: string | null; renews: boolean }
  /** The shop is chasing a payment. Access continues, and the writer should be told. */
  | { kind: 'grace'; store: NotesStore; until: string | null }
  /** Over: run out, cancelled and run out, paused, or refunded. */
  | { kind: 'lapsed'; store: NotesStore; state: NotesState; ended: string | null };

/**
 * What an account's subscription means, read every time it is asked.
 *
 * **A reading rather than a column**, which is this project's sixth or seventh
 * of these and the most load-bearing: there is nowhere in the database that says
 * *entitled*, so a period that has quietly ended takes the entitlement with it
 * with nothing run, and a renewal the shop has confirmed restores it the same
 * way.
 *
 * Two rules the order of the branches carries. **A refund stops access at
 * once** — `revoked` is read before the period end, or somebody who has had
 * their money back keeps what they bought until the month they did not pay for
 * runs out. And **a cancelled subscription is paid up until it ends**, because
 * that is what the customer paid for; what changes is that it says so.
 */
export const notesPlan = (input: {
  subscription: NotesSubscription | null;
  /**
   * When this account first sent a note, if it ever has. Anything before
   * `NOTES_FREE_FROM` is somebody who was here first, and they keep it.
   */
  firstCapturedAt?: string | null;
  /** ISO. Taken rather than read off the clock so a reading is testable. */
  now: string;
}): NotesPlan => {
  /**
   * Read wherever there is no live subscription, and **after** one, because a
   * subscriber's line should say what they are paying for rather than that they
   * were here early — and a subscription that lapses falls back to this, which
   * is the generous answer and the right one.
   */
  const early = (): NotesPlan | null =>
    input.firstCapturedAt && input.firstCapturedAt < NOTES_FREE_FROM
      ? { kind: 'included', since: input.firstCapturedAt }
      : null;

  const found = input.subscription;
  if (!found || found.state === 'none') return early() ?? { kind: 'never' };

  const { store, state } = found;

  // Before the period end, because a refund is not a month somebody may finish.
  if (state === 'revoked' || state === 'paused' || state === 'expired') {
    return early() ?? { kind: 'lapsed', store, state, ended: found.periodEnd };
  }

  const ran_out = found.periodEnd !== null && found.periodEnd <= input.now;

  if (state === 'in_grace' || state === 'billing_retry') {
    // The shop is asking the bank again and asks that access continue while it
    // does. Both shops do; refusing here would refuse a paying customer over a
    // card their bank declined once.
    return { kind: 'grace', store, until: found.periodEnd };
  }

  if (ran_out) {
    return early() ?? { kind: 'lapsed', store, state: 'expired', ended: found.periodEnd };
  }

  return {
    kind: 'paid',
    store,
    plan: planKindOf(found.productId),
    until: found.periodEnd,
    renews: found.autoRenews && state !== 'canceled',
  };
};

// ---------------------------------------------------------- what it entitles

/**
 * Whether the phone may send a note, and the desk may take one.
 *
 * **The one thing this decides.** Reading a note, correcting one that is still
 * waiting, deleting one, and everything the desktop does with notes it already
 * has are untouched by the state of a card, on purpose and permanently — which
 * is why there is no second predicate here to be reached for by mistake.
 */
export const mayCaptureNotes = (plan: NotesPlan): boolean =>
  plan.kind === 'paid' || plan.kind === 'grace' || plan.kind === 'included';

/** The bit of the promise that is about the work, said wherever a refusal is. */
export const NOTES_PROMISE =
  'Nothing you have already captured is affected by this. Every note you have sent stays readable here and on your desk, and anything already filed into a project is part of the project.';

/**
 * Why a note cannot be sent, in a sentence the writer can act on. Null where it
 * can.
 *
 * The three cases are three different acts — buy it, fix the card, resubscribe —
 * so they are three sentences rather than one about subscriptions.
 */
export const notesRefusal = (plan: NotesPlan): string | null => {
  switch (plan.kind) {
    case 'paid':
    case 'grace':
    case 'included':
      return null;
    case 'never':
      return `Notes needs a subscription — ${NOTES_PRICE_WORDS.yearly} or ${NOTES_PRICE_WORDS.monthly}, from the app. ${NOTES_PROMISE}`;
    case 'lapsed':
      return plan.state === 'revoked'
        ? `This subscription was refunded, so Notes is not sending. ${NOTES_PROMISE}`
        : `The Notes subscription has run out, so new notes are not being sent. Subscribing again in the app starts them straight away. ${NOTES_PROMISE}`;
  }
};

/** A date as this project writes one: 3 October 2026. */
const day = (iso: string | null): string | null => {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * The subscription in one line, for the account page and the app.
 *
 * It says **what happens next** rather than only where things stand, because a
 * reader of this line is usually asking whether they are about to be charged or
 * about to be cut off — and a renewal date is the answer to both.
 */
export const describeNotesPlan = (plan: NotesPlan): string => {
  switch (plan.kind) {
    case 'never':
      return `Not subscribed. Notes is ${NOTES_PRICE_WORDS.yearly} or ${NOTES_PRICE_WORDS.monthly}, bought in the app.`;
    case 'included':
      return 'Included. You were using Notes before it became a paid app, so it stays yours — there is nothing to buy.';
    case 'paid': {
      const when = day(plan.until);
      const named = plan.plan ? NOTES_PRICE_WORDS[plan.plan] : 'Subscribed';
      if (!when) return `${named}, through ${NOTES_STORE_NAMES[plan.store]}.`;
      return plan.renews
        ? `${named}, through ${NOTES_STORE_NAMES[plan.store]}. Renews ${when}.`
        : `${named}, through ${NOTES_STORE_NAMES[plan.store]}. Will not renew — it runs until ${when}.`;
    }
    case 'grace': {
      const when = day(plan.until);
      return `${NOTES_STORE_NAMES[plan.store]} is having trouble taking the payment. Notes keeps working while it tries${
        when ? `, up to ${when}` : ''
      } — the card can be changed in your ${plan.store === 'app_store' ? 'Apple' : 'Google'} account.`;
    }
    case 'lapsed': {
      const when = day(plan.ended);
      if (plan.state === 'revoked') return 'Refunded. Notes is not sending new notes.';
      if (plan.state === 'paused') return 'Paused in Google Play. Notes is not sending new notes.';
      return when ? `Ended ${when}. Notes is not sending new notes.` : 'Ended. Notes is not sending new notes.';
    }
  }
};

/**
 * Whether the shop is worth asking again before answering.
 *
 * There are no store-to-server notifications yet (§14.4 names them), so a
 * renewal that happened last night is not in this row until something asks. The
 * rule that makes that safe rather than a reason to poll: **ask only where the
 * row says it has run out and has not been checked since it did.** A paid-up
 * subscription is never re-verified, so the ordinary case costs no network at
 * all, and a renewal costs exactly one question the first time anybody looks.
 *
 * A row with no period end is one no purchase has been verified into, and there
 * is nothing to re-ask about.
 */
export const worthReVerifying = (subscription: NotesSubscription | null, now: string): boolean => {
  if (!subscription || subscription.state === 'none') return false;
  // A refund is final. Asking again would be asking to be told the same thing.
  if (subscription.state === 'revoked') return false;
  const { periodEnd, lastVerifiedAt } = subscription;
  if (periodEnd === null || periodEnd > now) return false;
  return lastVerifiedAt === null || lastVerifiedAt < periodEnd;
};

/**
 * Whether to offer the purchase.
 *
 * Offered where there is nothing to lose by subscribing, and **absent while
 * somebody is paid up or in grace** — a *Subscribe* button in front of a
 * subscriber is a screen that does not know who it is talking to, and in front
 * of somebody whose bank has just declined a payment it is worse, because
 * buying a second subscription is not the fix.
 */
export const mayOfferNotes = (plan: NotesPlan): boolean =>
  plan.kind === 'never' || plan.kind === 'lapsed';
// `included` is absent from that list on purpose: somebody who already has what
// a subscription buys has nothing to be sold, and offering it anyway is a
// screen that does not know who it is talking to.
