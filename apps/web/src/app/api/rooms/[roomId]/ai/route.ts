import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CAP_MOST, capIsSane, capStanding, describeSpend } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { adminClient } from '@/lib/supabase';
import { setRoomCap, spentThisMonth } from '@/lib/room-spend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The room's AI controls (addendum 07 §14, stages 12 and 13).
 *
 * §14: *room-level usage and cost controls are the owner's to set*. Stage 12
 * put the switch in the database and nowhere else, so it was the owner's in
 * principle and nobody's in practice; this is where both of them are actually
 * set.
 *
 * **Two controls, and they say different things.** The switch is *this room
 * does not use AI*; the cap is *not past here this month*. A showrunner who
 * wants the second does not want the first, which is why a cap of nothing is
 * allowed and is not the same as turning it off.
 *
 * The showrunner alone, checked here and enforced underneath: `rooms` is
 * written by whoever may write the project, so a writer's PATCH would be
 * refused by the database even if this let it through.
 */

const schema = z
  .object({
    enabled: z.boolean().optional(),
    /** In cents. Null clears the cap; omitted leaves it alone. */
    capCents: z.number().int().min(0).max(CAP_MOST).nullable().optional(),
  })
  .refine((body) => body.enabled !== undefined || body.capCents !== undefined, {
    message: 'Nothing to change.',
  });

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (view.role !== 'owner') {
    return NextResponse.json({ error: 'The showrunner decides what this room spends.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'That is not a setting.' }, { status: 400 });
  }
  if (parsed.data.capCents !== undefined && !capIsSane(parsed.data.capCents)) {
    return NextResponse.json({ error: 'A cap is whole cents, and not more than $1,000.' }, { status: 400 });
  }

  if (parsed.data.enabled !== undefined) {
    const { error } = await adminClient()
      .from('rooms')
      .update({ ai_enabled: parsed.data.enabled })
      .eq('id', view.room.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (parsed.data.capCents !== undefined) {
    await setRoomCap(view.room.id, parsed.data.capCents);
  }

  // The standing comes back with the change, because the one thing a
  // showrunner wants to know after setting a cap is where the month already
  // stands against it — and a cap set below what has been spent is a real and
  // deliberate act (*stop until next month*), not a mistake to refuse.
  const capCents =
    parsed.data.capCents === undefined ? view.room.aiCapCents : parsed.data.capCents;
  const standing = capStanding({ spentCents: await spentThisMonth(view.room.id), capCents });

  return NextResponse.json({
    enabled: parsed.data.enabled ?? view.room.aiEnabled,
    spend: { ...standing, line: describeSpend(standing) },
  });
}
