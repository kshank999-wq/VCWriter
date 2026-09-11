import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ROOM_ROLES, ROLE_NAMES, seatName, seatRefusalText } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { env } from '@/lib/env';
import { loadRoomById, inviteSeat, INVITE_DAYS } from '@/lib/rooms';
import { sendRoomInvitation } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Asking somebody into a room (addendum 07 §14, stage 2).
 *
 * The room is loaded through the caller's own session, so who they are in it
 * is the database's answer rather than this route's; the domain then says
 * whether that role may invite, and whether this address already has a seat.
 */

const schema = z.object({
  email: z.string().email().max(200),
  role: z.enum(ROOM_ROLES).default('writer'),
  title: z.string().max(80).default(''),
  displayName: z.string().max(120).default(''),
});

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const result = await inviteSeat({
    room: view.room,
    seats: view.seats,
    by: view.role,
    email: parsed.data.email,
    role: parsed.data.role,
    title: parsed.data.title,
    displayName: parsed.data.displayName,
  });

  if ('reason' in result) {
    return NextResponse.json(
      { error: seatRefusalText(result) },
      { status: result.reason === 'not_allowed' ? 403 : 409 },
    );
  }

  // The invitation is sent here and the token is never returned to the browser:
  // the secret belongs in the email and nowhere else.
  await sendRoomInvitation({
    to: result.seat.email,
    roomName: view.room.name || view.projectTitle,
    from: user.email ?? 'Your showrunner',
    title: result.seat.title,
    roleName: ROLE_NAMES[result.seat.role],
    acceptUrl: `${env.siteUrl}/rooms/join/${result.token}`,
    expiresIn: `${INVITE_DAYS} days`,
  });

  return NextResponse.json({ seat: { ...result.seat, name: seatName(result.seat) } });
}
