import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser, serverClient } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Whether this room writes to you (addendum 07 §14, stage 14).
 *
 * **Yours, and nobody else's — not even the showrunner's.** §6 gives the
 * showrunner what you are called and what colour you are drawn in; it does not
 * give them the ability to make your phone ring. So this is the one thing on a
 * seat its holder changes and its owner cannot.
 *
 * Written through the **caller's own session** rather than the service role,
 * which is the opposite of every other seat change in the module and is the
 * point: the policy added in 0044 is what allows it, a trigger beside that
 * policy is what stops the same update touching the role, and a route acting as
 * the service role would step over both.
 */

const schema = z.object({ notifyByEmail: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'On or off.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.you) {
    return NextResponse.json({ error: 'You do not hold a seat in this room.' }, { status: 404 });
  }

  const { error } = await serverClient()
    .from('room_seats')
    .update({ notify_by_email: parsed.data.notifyByEmail })
    .eq('id', view.you.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  return NextResponse.json({ notifyByEmail: parsed.data.notifyByEmail });
}
