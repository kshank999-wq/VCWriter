import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ASSIGNMENT_STATES } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { moveAssignment } from '@/lib/assignments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Moving an assignment along (addendum 07 §8, stage 8).
 *
 * **Two people may touch this row and they may say different things about it**,
 * which is the difference from a submission (stage 6, where deciding is the
 * showrunner's alone). The writer says how their own work is going; the
 * showrunner says what is being asked for and whether it still is. Row-level
 * security decides whether the row is theirs at all, and the trigger beside it
 * decides which of those two this is — so a writer reaching for *called off*
 * comes back as the database's own sentence rather than a silent no-op, and
 * this route does not have to keep a second copy of the rule.
 */

const schema = z.object({ to: z.enum(ASSIGNMENT_STATES) });

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; assignmentId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a state.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const moved = await moveAssignment({ assignmentId: params.assignmentId, to: parsed.data.to });
  if ('reason' in moved) {
    if (moved.reason === 'no_such_assignment') {
      return NextResponse.json({ error: 'No such assignment.' }, { status: 404 });
    }
    if (moved.reason === 'impossible_move') {
      return NextResponse.json({ error: 'It cannot go there from where it is.' }, { status: 409 });
    }
    return NextResponse.json({ error: moved.message }, { status: 403 });
  }

  return NextResponse.json({ assignment: moved });
}
