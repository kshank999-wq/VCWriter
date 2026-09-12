import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TRAY_HOWS, canCurate } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { dropFromTray, setTrayItem } from '@/lib/curation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One piece in the tray: how it goes in, and taking it back out (§12).
 *
 * **The DELETE here is the only one in the Room, and it is the right one**
 * (§1). Taking a piece out of the tray destroys nothing: the submission is
 * untouched, the version it came from cannot be changed by anybody including
 * the service role, and the piece is exactly where it always was. A tray that
 * could not be cleared would make a showrunner commit things to be rid of them,
 * which is a worse outcome than a delete.
 */

const schema = z.object({
  how: z.enum(TRAY_HOWS).optional(),
  intoUnitId: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; itemId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a change.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view || !canCurate(view.role)) {
    return NextResponse.json({ error: 'The tray is the showrunner’s.' }, { status: 403 });
  }

  const moved = await setTrayItem({ itemId: params.itemId, ...parsed.data });
  if ('reason' in moved) return NextResponse.json({ error: moved.message }, { status: 403 });

  return NextResponse.json({ item: moved });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { roomId: string; itemId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !canCurate(view.role)) {
    return NextResponse.json({ error: 'The tray is the showrunner’s.' }, { status: 403 });
  }

  const dropped = await dropFromTray(params.itemId);
  if (!dropped) return NextResponse.json({ error: 'That is not yours to take out.' }, { status: 403 });

  return NextResponse.json({ dropped: true });
}
