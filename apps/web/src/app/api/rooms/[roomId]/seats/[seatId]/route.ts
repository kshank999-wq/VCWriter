import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ROOM_ROLES, seatRefusalText } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { deactivateSeat, loadRoomById, setSeatIdentity } from '@/lib/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What somebody is called, credited as, and drawn in (addendum 07 §6) — and
 * taking them out of the room (§16).
 *
 * **Deactivating, never deleting**, which is why there is no way to remove a
 * seat from here at all: the row is what keeps a contribution's author, and a
 * route that could delete it would be a route that could rewrite history.
 */

const patchSchema = z.object({
  displayName: z.string().max(120).optional(),
  title: z.string().max(80).optional(),
  initials: z.string().max(4).optional(),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  role: z.enum(ROOM_ROLES).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; seatId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a change I can make.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const result = await setSeatIdentity({
    seats: view.seats,
    by: view.role,
    seatId: params.seatId,
    ...parsed.data,
  });
  if ('reason' in result) return NextResponse.json({ error: seatRefusalText(result) }, { status: 403 });
  return NextResponse.json({ seat: result });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { roomId: string; seatId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const result = await deactivateSeat({ seats: view.seats, by: view.role, seatId: params.seatId });
  if ('reason' in result) {
    return NextResponse.json(
      { error: seatRefusalText(result) },
      { status: result.reason === 'not_allowed' ? 403 : 409 },
    );
  }
  return NextResponse.json({ seat: result });
}
