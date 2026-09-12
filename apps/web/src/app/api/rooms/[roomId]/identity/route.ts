import { NextResponse } from 'next/server';
import { seatInitials, seatName, type Seat } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who is in this room (addendum 07 §6, stage 4).
 *
 * The renderer draws colour in four places and reads every one of them through
 * this: a record carries an author's id and nothing else, and the colour, the
 * name and the initials belong to the seat. So a showrunner who recolours a
 * writer has recoloured every page that writer wrote, rather than leaving a
 * hundred stale copies of the old colour in the document.
 *
 * The seats come back as the database gives them to the caller's own session,
 * so a stranger gets nothing here because row-level security says so.
 *
 * **Addresses are left out.** A badge needs a name and a colour; an email is
 * the one thing on a seat that is not about the page, and a script window has
 * no use for the room's address book. The caller's own is kept, because it is
 * already theirs.
 */

/** A seat as a page needs it: a name, a colour, and nothing to send mail to. */
const forDrawing = (seat: Seat, mine: boolean): Seat => ({
  ...seat,
  email: mine ? seat.email : '',
  // Resolved here so the renderer never has to decide what an empty name reads
  // as, and every window in the room agrees on the letters.
  displayName: seatName(seat),
  initials: seatInitials(seat),
});

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!view.role) return NextResponse.json({ error: 'You are not in this room.' }, { status: 403 });

  return NextResponse.json({
    roomId: view.room.id,
    roomName: view.room.name || view.projectTitle,
    role: view.role,
    you: view.you ? forDrawing(view.you, true) : null,
    seats: view.seats.map((seat) => forDrawing(seat, seat.userId === (view.you?.userId ?? null))),
    // A branch is always somebody's own line — the master is not a branch
    // (§9) — so a window opened on a room is showing a contribution. When the
    // showrunner can open the master here, this is the one word that changes.
    showing: 'contribution' as const,
  });
}
