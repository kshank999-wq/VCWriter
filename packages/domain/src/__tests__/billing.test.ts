import { describe, expect, it } from 'vitest';
import {
  billingRefusalText,
  describeBilling,
  inGoodStanding,
  mayTakeAnotherSeat,
  needsSubscription,
  quantityDrifted,
  roomBillingSchema,
  roomSchema,
  seatCount,
  seatSchema,
  seatsToBill,
  type Room,
  type RoomBilling,
  type Seat,
} from '../index.js';

/**
 * Recurring seat billing (addendum 07 §14, stage 15).
 *
 * Two claims are worth more than all the rest and both are here: **a seat is
 * billed from acceptance and never from invitation**, and **an unpaid room
 * never locks anybody out of what they wrote** — the only thing a lapsed
 * subscription stops is taking another seat.
 */

const room = (over: Partial<Room> = {}): Room =>
  roomSchema.parse({
    id: 'room',
    projectId: 'project',
    name: 'Blackout',
    includedSeats: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  });

let next = 0;
const seat = (over: Partial<Seat> = {}): Seat =>
  seatSchema.parse({
    id: `seat-${(next += 1)}`,
    roomId: 'room',
    userId: `person-${next}`,
    email: `person-${next}@example.com`,
    role: 'writer',
    state: 'active',
    invitedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  });

const billing = (over: Partial<RoomBilling> = {}): RoomBilling =>
  roomBillingSchema.parse({ ...over });

const PAID = billing({ customerId: 'cus_1', subscriptionId: 'sub_1', state: 'active', billedSeats: 2 });

describe('what the room is billed for', () => {
  it('charges for active seats beyond the ones the plan includes', () => {
    const seats = [seat(), seat(), seat()];
    expect(seatsToBill(room({ includedSeats: 1 }), seats)).toBe(2);
  });

  it('never charges for an invitation nobody has answered', () => {
    // Charging for one would be charging for an email: a showrunner who asks
    // six people and gets two would be paying for four strangers.
    const seats = [seat(), seat({ state: 'invited' }), seat({ state: 'invited' })];
    expect(seatsToBill(room({ includedSeats: 1 }), seats)).toBe(0);
  });

  it('stops charging for a seat taken out of the room', () => {
    // And keeps everything it wrote (§16). This is §1 applied to the invoice.
    const seats = [seat(), seat(), seat({ state: 'deactivated' })];
    expect(seatsToBill(room({ includedSeats: 1 }), seats)).toBe(1);
  });

  it('charges nothing for a showrunner working alone', () => {
    expect(seatsToBill(room(), [seat()])).toBe(0);
    expect(seatsToBill(room(), [])).toBe(0);
  });
});

describe('keeping Stripe in step', () => {
  it('notices when what Stripe is charging is not what the room needs', () => {
    expect(quantityDrifted(PAID, 3)).toBe(true);
    expect(quantityDrifted(PAID, 2)).toBe(false);
  });

  it('says nothing about a room that has no subscription to be out of step with', () => {
    expect(quantityDrifted(billing(), 4)).toBe(false);
  });

  it('does not ask a room inside its plan to start a subscription', () => {
    // Asking for a card to charge nothing to is asking for a card.
    expect(needsSubscription(0, billing())).toBe(false);
  });

  it('asks for one where there are seats to pay for and no subscription', () => {
    expect(needsSubscription(2, billing())).toBe(true);
  });

  it('asks again where the subscription has lapsed', () => {
    expect(needsSubscription(2, billing({ subscriptionId: 'sub_1', state: 'past_due' }))).toBe(true);
  });
});

describe('standing', () => {
  it('counts trialing and active as paid up, and nothing else', () => {
    expect(inGoodStanding('active')).toBe(true);
    expect(inGoodStanding('trialing')).toBe(true);
    for (const state of ['past_due', 'unpaid', 'canceled', 'incomplete', 'none'] as const) {
      expect(inGoodStanding(state)).toBe(false);
    }
  });
});

describe('what an unpaid room may still do', () => {
  const crowded = [seat(), seat(), seat()];

  it('may not take another seat', () => {
    const refusal = mayTakeAnotherSeat({
      room: room(),
      seats: crowded,
      billing: billing({ subscriptionId: 'sub_1', state: 'past_due', billedSeats: 2 }),
    });
    expect(refusal).not.toBe(true);
    if (refusal === true) throw new Error('unreachable');
    expect(refusal.reason).toBe('not_paid');
  });

  it('is told, in the refusal itself, that nobody loses anything', () => {
    // The sentence a showrunner reads at the worst moment. A product that
    // implied the work was at risk would be lying, and lying in the direction
    // that sells.
    const refusal = mayTakeAnotherSeat({
      room: room(),
      seats: crowded,
      billing: billing({ subscriptionId: 'sub_1', state: 'unpaid' }),
    });
    if (refusal === true) throw new Error('unreachable');
    const said = billingRefusalText(refusal);
    expect(said).toContain('keeps writing');
    expect(said).toContain('nothing anybody wrote is affected');
  });

  it('may still take a seat that is inside the plan', () => {
    // There is nothing to charge for, so refusing would be refusing a free seat
    // over a bill for something else.
    expect(
      mayTakeAnotherSeat({
        room: room({ includedSeats: 4 }),
        seats: [seat()],
        billing: billing({ subscriptionId: 'sub_1', state: 'past_due' }),
      }),
    ).toBe(true);
  });

  it('asks a room with no subscription to start one rather than calling it unpaid', () => {
    const refusal = mayTakeAnotherSeat({ room: room(), seats: [seat()], billing: billing() });
    expect(refusal).not.toBe(true);
    if (refusal === true) throw new Error('unreachable');
    expect(refusal.reason).toBe('no_subscription');
    expect(billingRefusalText(refusal)).toContain('a billed seat');
  });

  it('counts the seat about to be accepted, not only the ones already taken', () => {
    // An invited seat is not billed and is a seat about to be, so the question
    // is what the room would owe rather than what it owes.
    const oneShort = [seat(), seat({ state: 'invited' })];
    const refusal = mayTakeAnotherSeat({ room: room(), seats: oneShort, billing: billing() });
    expect(refusal).not.toBe(true);
  });

  it('lets a paid-up room take another', () => {
    expect(mayTakeAnotherSeat({ room: room(), seats: crowded, billing: PAID })).toBe(true);
  });
});

describe('what the dashboard says', () => {
  const line = (seats: Seat[], over: Partial<RoomBilling> = {}, seatCents: number | null = 1200) =>
    describeBilling({
      count: seatCount(room(), seats),
      billing: billing({ subscriptionId: 'sub_1', state: 'active', ...over }),
      seatCents,
    });

  it('says there is nothing to pay where there is nothing to pay', () => {
    expect(line([seat()])).toContain('Nothing to pay');
  });

  it('says what is being charged for before what it costs', () => {
    // *3 seats* and *$36* answer different questions, and a showrunner reading
    // this is usually asking the first.
    const said = line([seat(), seat(), seat()]);
    expect(said.indexOf('2 billed seats')).toBeLessThan(said.indexOf('$24'));
  });

  it('leaves out the money where Stripe has not said what a seat costs', () => {
    expect(line([seat(), seat()], {}, null)).toBe('1 billed seat.');
  });

  it('names the trouble where there is trouble', () => {
    expect(line([seat(), seat()], { state: 'past_due' })).toContain('Payment overdue');
  });
});
