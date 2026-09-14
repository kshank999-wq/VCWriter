import { NextResponse } from 'next/server';
import { describeBilling, seatsToBill } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { billingPortal, loadBilling, seatPriceCents, startSubscription } from '@/lib/room-billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The room's seat subscription (addendum 07 §14, stage 15).
 *
 * **One POST with two outcomes, and Stripe decides which.** A room with no
 * subscription gets Checkout; a room that has one gets the Billing Portal. Two
 * routes would make the page work out which it needed, and the page would
 * eventually get it wrong — the room's own row already knows.
 *
 * **The showrunner's.** §14 makes the subscription an entitlement of the person
 * who owns the project, and nothing here is readable or startable by anybody
 * else in the room; what they see is the seat count, which is theirs to know.
 *
 * **Nothing here grants anything.** A returned Checkout URL is an intention. The
 * subscription exists when Stripe says so, through the webhook — the same rule
 * the desktop purchase follows (spec §12.2).
 */
export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const [billing, seatCents] = await Promise.all([loadBilling(view.room.id), seatPriceCents()]);
  return NextResponse.json({
    billing,
    seatCents,
    wanted: seatsToBill(view.room, view.seats),
    line: describeBilling({ count: view.seatsCount, billing, seatCents }),
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (view.role !== 'owner') {
    return NextResponse.json({ error: 'The showrunner holds the subscription.' }, { status: 403 });
  }

  const billing = await loadBilling(view.room.id);

  try {
    if (billing.subscriptionId && billing.customerId) {
      return NextResponse.json({ url: await billingPortal(billing.customerId, view.room.id) });
    }

    const url = await startSubscription({
      room: view.room,
      seats: view.seats,
      ownerEmail: user.email ?? null,
      customerId: billing.customerId,
    });
    if (!url) return NextResponse.json({ error: 'Stripe did not return a page.' }, { status: 502 });
    return NextResponse.json({ url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Billing could not be opened.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
