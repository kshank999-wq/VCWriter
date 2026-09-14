import type Stripe from 'stripe';
import {
  roomBillingSchema,
  seatsToBill,
  subscriptionStateSchema,
  type Room,
  type RoomBilling,
  type Seat,
  type SubscriptionState,
} from '@vcwriter/domain';
import { env } from './env';
import { stripe } from './stripe';
import { adminClient } from './supabase';

/**
 * A room's seat subscription (addendum 07 §14, stage 15).
 *
 * The rules are in `@vcwriter/domain/billing`; this is where they meet Stripe
 * and the `rooms` row.
 *
 * **The quantity is set, never incremented.** Every seat change asks the domain
 * what the room's billable count *is* and tells Stripe that number. A retried
 * webhook or a double-clicked button can apply an increment twice; a set is the
 * same answer however many times it arrives, and it is self-healing — a room
 * that has drifted out of step is back in step at the next seat change with
 * nobody reconciling anything.
 *
 * **Changing the quantity never fails the seat change.** Accepting an
 * invitation, deactivating a seat: those are facts about the room, and Stripe
 * being unreachable must not undo them. The drift is recorded in `billed_seats`
 * and corrected at the next change, which is what makes a set safe enough to
 * fail.
 *
 * **The price lives in Stripe** (`pricing.ts`, for the same reason): it is what
 * the customer is actually charged.
 */

interface BillingRow {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_state?: string | null;
  billed_seats?: number | null;
  current_period_end?: string | null;
}

/** Stripe's status, narrowed to the ones the domain knows, and `none` otherwise. */
const asState = (status: string | null | undefined): SubscriptionState => {
  const parsed = subscriptionStateSchema.safeParse(status);
  if (parsed.success) return parsed.data;
  // `incomplete_expired` and `paused` land here. Neither is in good standing,
  // and calling them `canceled` says the true thing about what the room may do
  // rather than inventing a state for a word Stripe may add to next year.
  return status ? 'canceled' : 'none';
};

export const billingFromRow = (row: BillingRow): RoomBilling =>
  roomBillingSchema.parse({
    customerId: row.stripe_customer_id ?? null,
    subscriptionId: row.stripe_subscription_id ?? null,
    state: asState(row.subscription_state),
    billedSeats: row.billed_seats ?? 0,
    periodEnd: row.current_period_end ?? null,
  });

export const loadBilling = async (roomId: string): Promise<RoomBilling> => {
  const { data } = await adminClient()
    .from('rooms')
    .select('stripe_customer_id, stripe_subscription_id, subscription_state, billed_seats, current_period_end')
    .eq('id', roomId)
    .maybeSingle();
  return billingFromRow((data ?? {}) as BillingRow);
};

/** What a seat costs a month, read from Stripe rather than repeated here. */
export const seatPriceCents = async (): Promise<number | null> => {
  try {
    const price = await stripe().prices.retrieve(env.stripeSeatPriceId);
    return price.unit_amount ?? null;
  } catch {
    // A deployment with no seat price configured shows the seat count without
    // a number beside it, rather than a page that will not render.
    return null;
  }
};

/**
 * Start (or resume) a room's subscription: a Stripe Checkout session.
 *
 * Checkout rather than an API-created subscription, because a card has to be
 * entered somewhere and Stripe's page is where it should be — the same choice
 * the desktop purchase makes, for the same reason.
 *
 * The room id rides in `metadata` and in `client_reference_id`, which is what
 * the webhook reads to know whose subscription this is.
 */
export const startSubscription = async (input: {
  room: Room;
  seats: readonly Seat[];
  ownerEmail: string | null;
  customerId: string | null;
}): Promise<string | null> => {
  const quantity = Math.max(1, seatsToBill(input.room, input.seats));

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: env.stripeSeatPriceId, quantity }],
    success_url: `${env.siteUrl}/rooms/${input.room.id}?seats=1`,
    cancel_url: `${env.siteUrl}/rooms/${input.room.id}`,
    ...(input.customerId
      ? { customer: input.customerId }
      : input.ownerEmail
        ? { customer_email: input.ownerEmail }
        : {}),
    client_reference_id: input.room.id,
    metadata: { room_id: input.room.id },
    subscription_data: { metadata: { room_id: input.room.id } },
    automatic_tax: { enabled: true },
    billing_address_collection: 'auto',
  });

  return session.url ?? null;
};

/**
 * Where the showrunner changes the card, reads the invoices, or cancels.
 *
 * Stripe's own portal rather than a billing screen of our own: invoices, tax
 * receipts, dunning and cancellation are a product, and the version here would
 * be a worse copy that has to be kept in step with tax law.
 */
export const billingPortal = async (customerId: string, roomId: string): Promise<string> => {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.siteUrl}/rooms/${roomId}`,
  });
  return session.url;
};

/**
 * Tell Stripe what the room needs now.
 *
 * Called after anything that changes the active seat count. Never throws: see
 * the note at the top — a seat change is a fact about the room, and Stripe
 * being unreachable must not undo it.
 */
export const setQuantity = async (input: {
  room: Room;
  seats: readonly Seat[];
  billing: RoomBilling;
}): Promise<void> => {
  const wanted = seatsToBill(input.room, input.seats);
  if (!input.billing.subscriptionId) return;
  if (input.billing.billedSeats === wanted) return;

  try {
    const subscription = await stripe().subscriptions.retrieve(input.billing.subscriptionId);
    const item = subscription.items.data[0];
    if (!item) return;

    if (wanted === 0) {
      // A room that has shrunk back inside its plan owes nothing. Cancelled at
      // the end of the period rather than immediately, because the month is
      // already paid for and taking it away would be charging for it twice.
      await stripe().subscriptions.update(input.billing.subscriptionId, { cancel_at_period_end: true });
    } else {
      await stripe().subscriptions.update(input.billing.subscriptionId, {
        items: [{ id: item.id, quantity: wanted }],
        // Stripe's default: the change is prorated against the current period,
        // so a seat added on the 20th costs a third of a month rather than one.
        proration_behavior: 'create_prorations',
        cancel_at_period_end: false,
      });
    }

    await adminClient().from('rooms').update({ billed_seats: wanted }).eq('id', input.room.id);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // Left out of step on purpose, and noticed at the next seat change.
    console.error(`Could not set seat quantity for room ${input.room.id}: ${message}`);
  }
};

/**
 * Write Stripe's answer onto the room. The only place any of this is set.
 *
 * Found by subscription id first and by the metadata second: a subscription
 * already recorded is the room's whatever the metadata says, and the metadata
 * is what finds the room the very first time.
 */
export const recordSubscription = async (subscription: Stripe.Subscription): Promise<void> => {
  const roomId = subscription.metadata?.['room_id'];
  const db = adminClient();

  const item = subscription.items.data[0];
  const patch = {
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripe_subscription_id: subscription.id,
    subscription_state: subscription.status,
    billed_seats: item?.quantity ?? 0,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  };

  const existing = await db
    .from('rooms')
    .update(patch)
    .eq('stripe_subscription_id', subscription.id)
    .select('id')
    .maybeSingle();
  if (existing.data) return;

  if (!roomId) return;
  await db.from('rooms').update(patch).eq('id', roomId);
};
