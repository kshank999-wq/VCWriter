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

const priceCents = async (id: () => string): Promise<number | null> => {
  try {
    const price = await stripe().prices.retrieve(id());
    return price.unit_amount ?? null;
  } catch {
    // A deployment with no price configured shows the room without a number
    // beside it, rather than a page that will not render.
    return null;
  }
};

/** What an extra seat costs a month, read from Stripe rather than repeated here. */
export const seatPriceCents = (): Promise<number | null> => priceCents(() => env.stripeSeatPriceId);

/** What the room itself costs a month (the showrunner and one other person). */
export const roomPriceCents = (): Promise<number | null> => priceCents(() => env.stripeRoomPriceId);

/**
 * The subscription's extra-seat line, found by its price rather than by its
 * position: the room's own fee is a line of the same subscription, and which
 * one Stripe lists first is not a promise.
 */
const seatItem = (subscription: Stripe.Subscription): Stripe.SubscriptionItem | undefined =>
  subscription.items.data.find((item) => item.price.id === env.stripeSeatPriceId);

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
  const extra = seatsToBill(input.room, input.seats);

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    // The room, always one; the extra seats only where there are any, because
    // Checkout will not take a line of nothing.
    line_items: [
      { price: env.stripeRoomPriceId, quantity: 1 },
      ...(extra > 0 ? [{ price: env.stripeSeatPriceId, quantity: extra }] : []),
    ],
    success_url: `${env.siteUrl}/rooms/${input.room.id}?seats=1`,
    cancel_url: `${env.siteUrl}/rooms/${input.room.id}`,
    // **`customer_update` goes with `customer` and only with it** — Stripe
    // refuses a session carrying one without the other, which is why it is
    // inside this branch rather than beside `automatic_tax` below.
    //
    // Without it, a session that names an existing Customer computes tax from
    // **the address already on that Customer** and throws away the one the
    // showrunner types at the checkout. A Customer made by an earlier purchase
    // very often has none, and the failure is the quiet kind: the subscription
    // goes on being active while every renewal invoice **sticks in draft** for
    // want of a tax location, so nothing is charged, nothing errors, and the
    // first person to find out is whoever eventually reconciles the account.
    ...(input.customerId
      ? { customer: input.customerId, customer_update: { address: 'auto' as const } }
      : input.ownerEmail
        ? { customer_email: input.ownerEmail }
        : {}),
    client_reference_id: input.room.id,
    metadata: { room_id: input.room.id },
    subscription_data: { metadata: { room_id: input.room.id } },
    automatic_tax: { enabled: true },
    // **Required rather than `auto`, because this is a subscription.** `auto`
    // lets Checkout decide an address is unnecessary, which is survivable for
    // a single charge priced off an IP address and is not for one that has to
    // be re-rated every month from what was saved.
    billing_address_collection: 'required',
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
    const item = seatItem(subscription);

    // The room's own fee is never touched here: a room that shrinks back to its
    // showrunner and partner still has its room. Only the extra-seat line
    // moves, and it is added the first time the room grows past the fee.
    if (item) {
      await stripe().subscriptionItems.update(item.id, {
        quantity: wanted,
        // Prorated against the current period, so a seat added on the 20th
        // costs a third of a month rather than one.
        proration_behavior: 'create_prorations',
      });
    } else if (wanted > 0) {
      await stripe().subscriptionItems.create({
        subscription: input.billing.subscriptionId,
        price: env.stripeSeatPriceId,
        quantity: wanted,
        proration_behavior: 'create_prorations',
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
/**
 * Which product a subscription is for (addendum 32).
 *
 * Desktop plans and Writers Room seats both arrive at one webhook as
 * `customer.subscription.*`, and **the handler must never guess**: each
 * checkout stamps its own `subscription_data.metadata`, so a seat says
 * `room_id`, a desktop plan says `kind: 'desktop'`, and anything that says
 * neither is left alone rather than written somewhere it does not belong. A
 * subscription made by hand in the Stripe dashboard is exactly that case, and
 * silently turning one into somebody's licence is the fault this prevents.
 */
export const subscriptionKind = (
  subscription: Stripe.Subscription,
): 'room' | 'desktop' | 'unknown' => {
  if (subscription.metadata?.['room_id']) return 'room';
  if (subscription.metadata?.['kind'] === 'desktop') return 'desktop';
  return 'unknown';
};

export const recordSubscription = async (subscription: Stripe.Subscription): Promise<void> => {
  const roomId = subscription.metadata?.['room_id'];
  const db = adminClient();

  const item = seatItem(subscription);
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
