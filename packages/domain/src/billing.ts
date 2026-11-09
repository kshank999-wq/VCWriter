import { z } from 'zod';
import { money } from './spending.js';
import { seatCount, type Room, type Seat, type SeatCount } from './room.js';

/**
 * What a room costs, month after month (addendum 07 §23, repriced in §24).
 *
 * Ken's prices, November 2026: **a room is a subscription of its own**, separate
 * from the VC Writer subscription. The room's fee covers the showrunner and one
 * other person (*a lot of times people just collaborate with a writing
 * partner*), and every person after that is a seat at a smaller monthly price.
 * So a subscription has two lines: the room, always one, and the extra seats,
 * as many as there are.
 *
 * Four decisions carry it, and the second is the one that matters.
 *
 * **A seat is billed from acceptance, never from invitation.** Charging for an
 * invitation would be charging for an email, and a showrunner who asks six
 * people and gets two would be paying for four strangers. Deactivating stops
 * the billing and keeps every contribution (§1, §16).
 *
 * **An unpaid room never locks anybody out of what they wrote.** This is §1
 * pointed at the money: the *only* thing billing decides is whether the room
 * may **take somebody else in**. A room needs its subscription before its first
 * invitation goes out, and a lapsed one cannot take another person; everybody
 * already in it keeps writing, reading, submitting and every draft.
 *
 * **The quantity is set, never incremented.** Every seat change tells the
 * subscription what the room's extra-seat count *is*, rather than *add one*, so
 * a retried webhook or a double-clicked button gives the same answer.
 *
 * **The prices live in Stripe**, as the desktop's do (`pricing.ts`): it is what
 * the customer is actually charged, and a copy here would one day disagree.
 */

/**
 * How many people the room's own fee covers **besides the showrunner**. The
 * showrunner owns the project and is never a seat; this is the writing partner.
 */
export const ROOM_INCLUDED_SEATS = 1;

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
 * Whether the room still needs its subscription started or put right.
 *
 * Every room with anybody in it needs one: the room's fee covers the
 * showrunner and one other person, so there is no free room to be inside.
 */
export const needsSubscription = (billing: RoomBilling): boolean =>
  billing.subscriptionId === null || !inGoodStanding(billing.state);

// ------------------------------------------------------------ what it refuses

export type BillingRefusal =
  | { reason: 'not_paid'; state: SubscriptionState }
  | { reason: 'no_subscription'; wanted: number };

/**
 * Whether the room may take somebody else in.
 *
 * **The only thing billing decides.** Everything else in the room — writing,
 * reading, submitting, curating, every draft anybody has made — is untouched by
 * the state of a card, on purpose and permanently.
 *
 * Even the writing partner the fee includes needs the subscription started,
 * because the fee is what pays for them: a room alone with its showrunner is
 * free, and the first invitation is where the room begins to cost something.
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
  if (input.billing.subscriptionId === null) return { reason: 'no_subscription', wanted: after };
  if (!inGoodStanding(input.billing.state)) return { reason: 'not_paid', state: input.billing.state };
  return true;
};

export const billingRefusalText = (refusal: BillingRefusal): string => {
  switch (refusal.reason) {
    case 'no_subscription':
      return 'Inviting someone starts the room’s subscription. The showrunner sets it up from the room: it covers the showrunner and one other person, and each person after that is an extra seat.';
    case 'not_paid':
      return `This room’s subscription is ${SUBSCRIPTION_STATE_NAMES[refusal.state].toLowerCase()}, so it cannot take another seat. Everybody already in it keeps writing, and nothing anybody wrote is affected.`;
  }
};

// -------------------------------------------------------------- what it reads

/**
 * The room's bill in one line, for the dashboard.
 *
 * It says what is being charged for, not only what it costs, because *3 seats*
 * and *$19.97* answer different questions and a showrunner reading this is
 * usually asking the first.
 */
export const describeBilling = (input: {
  count: SeatCount;
  billing: RoomBilling;
  /** The room's own fee a month, in cents, read from Stripe. Null where unknown. */
  roomCents: number | null;
  /** An extra seat a month, in cents, read from Stripe. Null where unknown. */
  seatCents: number | null;
}): string => {
  const { count, billing, roomCents, seatCents } = input;
  const roomPrice = roomCents === null ? '' : ` for ${money(roomCents)} a month`;
  const seatPrice = seatCents === null ? '' : ` at ${money(seatCents)} a month each`;

  if (billing.subscriptionId === null) {
    return `No subscription yet. The room covers you and one other person${roomPrice}; each person after that is an extra seat${seatPrice}. Start it to invite anyone.`;
  }

  const room = `The room: you and one other person${roomCents === null ? '' : `, ${money(roomCents)} a month`}`;
  const extra =
    count.billable === 0
      ? ''
      : `, plus ${count.billable} extra ${count.billable === 1 ? 'seat' : 'seats'}${seatCents === null ? '' : `, ${money(count.billable * seatCents)} a month`}`;
  const total =
    count.billable > 0 && roomCents !== null && seatCents !== null
      ? ` In all, ${money(roomCents + count.billable * seatCents)} a month.`
      : '';
  const standing = inGoodStanding(billing.state) ? '' : ` ${SUBSCRIPTION_STATE_NAMES[billing.state]}.`;
  return `${room}${extra}.${total}${standing}`;
};

/** What the room is told when a subscription lapses. Never a threat about the work. */
export const LAPSE_PROMISE =
  'Nothing anybody wrote is affected by this, ever. An unpaid room cannot take anyone else in; everyone already in it keeps writing, reading and submitting exactly as before.';
