import { z } from 'zod';
import { money } from './spending.js';
import { seatCount, type Room, type Seat, type SeatCount } from './room.js';

/**
 * What a room's seats cost, month after month (addendum 07 §14, stage 15).
 *
 * §14: *a Writers Room entitlement is separate from the desktop licence — the
 * base subscription includes the owner's seat and further collaborators are
 * billable seats.* The desktop licence is a purchase (spec §12.2); this is a
 * subscription, and it is the only recurring thing in the product.
 *
 * Four decisions carry it, and the second is the one that matters.
 *
 * **A seat is billed from acceptance, never from invitation.** Already true in
 * `seatCount` since stage 1, because §14 made invited and active different
 * states rather than one flag — charging for an invitation would be charging
 * for an email, and a showrunner who asks six people and gets two would be
 * paying for four strangers. Deactivating stops the billing and keeps every
 * contribution (§1, §16), which is that rule applied to the invoice.
 *
 * **An unpaid room never locks anybody out of what they wrote.** This is §1
 * pointed at the money, and it is the decision that shapes the enforcement:
 * the *only* thing a lapsed subscription stops is **taking another seat**.
 * Everybody already in the room keeps writing, keeps reading, keeps submitting,
 * and keeps every draft. A product that held a writer's pages hostage to a card
 * that expired would be destroying work to collect a debt, which is the one
 * thing this module exists not to do.
 *
 * **The quantity is set, never incremented.** Every seat change tells the
 * subscription what the room's billable count *is*, rather than *add one* —
 * a retried webhook or a double-clicked button can apply an increment twice,
 * and a set is the same answer however many times it arrives. It is also
 * self-healing: a room that drifted out of step is back in step at the next
 * seat change without anybody reconciling anything.
 *
 * **The price lives in Stripe**, as it does for the desktop licence and for the
 * same reason (`pricing.ts`): it is what the customer is actually charged, and
 * a second copy in a constant is a copy that will eventually disagree with the
 * till.
 */

// ------------------------------------------------------------ where it stands

/**
 * Where the subscription is, in Stripe's own words plus one of ours.
 *
 * `none` is a room that has never needed one — a showrunner working alone is
 * inside the included seat and has nothing to pay, and asking them to start a
 * subscription for nothing would be asking for a card to charge zero to.
 */
export const SUBSCRIPTION_STATES = [
  'none',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
] as const;
export const subscriptionStateSchema = z.enum(SUBSCRIPTION_STATES);
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export const SUBSCRIPTION_STATE_NAMES: Record<SubscriptionState, string> = {
  none: 'No subscription',
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Payment overdue',
  unpaid: 'Unpaid',
  canceled: 'Cancelled',
  incomplete: 'Not finished',
};

/** The room's side of the subscription, as the database keeps it. */
export const roomBillingSchema = z.object({
  /** Stripe's customer, which is the showrunner. Null before there is one. */
  customerId: z.string().nullable().default(null),
  subscriptionId: z.string().nullable().default(null),
  state: subscriptionStateSchema.default('none'),
  /** What Stripe was last told the room needs. Not what it needs now. */
  billedSeats: z.number().int().min(0).default(0),
  /** When the current month ends, so a cancelled room knows what it still has. */
  periodEnd: z.string().nullable().default(null),
});
export type RoomBilling = z.infer<typeof roomBillingSchema>;

/**
 * Whether the subscription is in good standing.
 *
 * `past_due` is **not** — Stripe has tried the card and it failed — but see
 * `mayTakeAnotherSeat`: not being in good standing costs the room its *next*
 * seat and nothing else.
 */
export const inGoodStanding = (state: SubscriptionState): boolean =>
  state === 'active' || state === 'trialing';

// ---------------------------------------------------------- what it should be

/**
 * What Stripe should be charging for, right now.
 *
 * The whole of the room's side of the bill: active seats beyond the ones the
 * plan includes. `seatCount` has computed it since stage 1 and this names it,
 * so the subscription and the dashboard cannot disagree about what a seat is.
 */
export const seatsToBill = (room: Pick<Room, 'includedSeats'>, seats: readonly Seat[]): number =>
  seatCount(room, seats).billable;

/**
 * Whether what Stripe is charging for is not what the room needs.
 *
 * Named for the drift rather than `outOfStep`, which the Sculptor already uses
 * for a board that has fallen out of step with the script — two different
 * questions one word apart is exactly the collision to avoid.
 */
export const quantityDrifted = (billing: RoomBilling, wanted: number): boolean =>
  billing.subscriptionId !== null && billing.billedSeats !== wanted;

/**
 * Whether a room that needs a subscription has one.
 *
 * A room inside its included seats needs nothing, so *no subscription* is a
 * correct and common answer rather than a problem to nag about.
 */
export const needsSubscription = (wanted: number, billing: RoomBilling): boolean =>
  wanted > 0 && (billing.subscriptionId === null || !inGoodStanding(billing.state));

// ------------------------------------------------------------ what it refuses

export type BillingRefusal =
  | { reason: 'not_paid'; state: SubscriptionState }
  | { reason: 'no_subscription'; wanted: number };

/**
 * Whether the room may take another seat.
 *
 * **The only thing billing decides.** Everything else in the room — writing,
 * reading, submitting, curating, every draft anybody has made — is untouched by
 * the state of a card, on purpose and permanently.
 *
 * A room whose next seat is still inside the plan may take it whatever the
 * subscription says, because there is nothing to charge for: refusing there
 * would be refusing a seat that costs nothing over a bill for something else.
 */
export const mayTakeAnotherSeat = (input: {
  room: Pick<Room, 'includedSeats'>;
  seats: readonly Seat[];
  billing: RoomBilling;
}): true | BillingRefusal => {
  // What the room would be billed for once one more invitation is accepted.
  // An invited seat is not billed and *is* a seat about to be, so this counts
  // the room as it would stand rather than as it stands.
  const after = Math.max(
    0,
    input.seats.filter((seat) => seat.state === 'active' || seat.state === 'invited').length +
      1 -
      input.room.includedSeats,
  );
  if (after === 0) return true;

  if (input.billing.subscriptionId === null) return { reason: 'no_subscription', wanted: after };
  if (!inGoodStanding(input.billing.state)) return { reason: 'not_paid', state: input.billing.state };
  return true;
};

export const billingRefusalText = (refusal: BillingRefusal): string => {
  switch (refusal.reason) {
    case 'no_subscription':
      return `Another seat is beyond what the plan includes. The showrunner can add ${refusal.wanted === 1 ? 'a billed seat' : `${refusal.wanted} billed seats`} from the room.`;
    case 'not_paid':
      return `This room’s subscription is ${SUBSCRIPTION_STATE_NAMES[refusal.state].toLowerCase()}, so it cannot take another seat. Everybody already in it keeps writing, and nothing anybody wrote is affected.`;
  }
};

// -------------------------------------------------------------- what it reads

/**
 * The room's bill in one line, for the dashboard.
 *
 * It says what is being charged for, not only what it costs, because *3 seats*
 * and *$36* answer different questions and a showrunner reading this is usually
 * asking the first.
 */
export const describeBilling = (input: {
  count: SeatCount;
  billing: RoomBilling;
  /** Per seat per month, in cents, read from Stripe. Null where unknown. */
  seatCents: number | null;
}): string => {
  const { count, billing } = input;
  if (count.billable === 0) {
    return `${count.included === 1 ? 'One seat' : `${count.included} seats`} included, and the room is inside that. Nothing to pay.`;
  }

  const seats = `${count.billable} billed ${count.billable === 1 ? 'seat' : 'seats'}`;
  const cost = input.seatCents === null ? '' : ` — ${money(count.billable * input.seatCents)} a month`;
  if (!inGoodStanding(billing.state)) {
    return `${seats}${cost}. ${SUBSCRIPTION_STATE_NAMES[billing.state]}.`;
  }
  return `${seats}${cost}.`;
};

/** What the room is told when a subscription lapses. Never a threat about the work. */
export const LAPSE_PROMISE =
  'Nothing anybody wrote is affected by this, ever. An unpaid room cannot take another seat; everyone already in it keeps writing, reading and submitting exactly as before.';
