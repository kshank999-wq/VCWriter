import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ASSIGNMENT_PRIORITIES, ASSIGNMENT_STATES, PRIORITY_NAMES, canCurate } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { assignmentsIn, moveAssignment, setPriority } from '@/lib/assignments';

import { recordAudit } from '@/lib/audit';

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

const schema = z.object({
  to: z.enum(ASSIGNMENT_STATES).optional(),
  /** How pressing it is (§35): the showrunner's to change. */
  priority: z.enum(ASSIGNMENT_PRIORITIES).optional(),
  /** Why, where the move closes, cancels or reopens it (§35). */
  note: z.string().max(2000).default(''),
});

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

  const current = (await assignmentsIn(view.room.id)).find((one) => one.id === params.assignmentId) ?? null;
  if (!current) return NextResponse.json({ error: 'No such assignment.' }, { status: 404 });
  const before = current.state;
  const reason = parsed.data.note.trim();

  if (parsed.data.priority && !parsed.data.to) {
    if (!canCurate(view.role)) return NextResponse.json({ error: 'Setting a priority is the showrunner’s.' }, { status: 403 });
    const set = await setPriority({ assignmentId: current.id, priority: parsed.data.priority });
    if ('reason' in set) return NextResponse.json({ error: 'That is not yours to change.' }, { status: 403 });
    await recordAudit({
      roomId: view.room.id,
      actorId: user.id,
      entityType: 'assignment',
      entityId: set.id,
      action: 'prioritised',
      fromState: PRIORITY_NAMES[current.priority],
      toState: PRIORITY_NAMES[set.priority],
      note: reason,
    });
    return NextResponse.json({ assignment: set });
  }
  if (!parsed.data.to) return NextResponse.json({ error: 'Say where it goes.' }, { status: 400 });

  // Closing, cancelling and reopening are the showrunner's, and each says why
  // (§35): the reason goes into the task's trail.
  const closing = parsed.data.to === 'done' || parsed.data.to === 'cancelled';
  const reopening = (before === 'done' || before === 'cancelled') && !closing;
  if ((closing || reopening) && canCurate(view.role) && !reason) {
    return NextResponse.json(
      { error: closing ? 'Say why it is being closed.' : 'Say why it is being reopened.' },
      { status: 400 },
    );
  }
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

  await recordAudit({ roomId: view.room.id, actorId: user.id, entityType: 'assignment', entityId: moved.id, action: reopening ? 'reopened' : closing ? (moved.state === 'done' ? 'closed' : 'cancelled') : 'moved', fromState: before, toState: moved.state, note: reason });

  return NextResponse.json({ assignment: moved });
}
