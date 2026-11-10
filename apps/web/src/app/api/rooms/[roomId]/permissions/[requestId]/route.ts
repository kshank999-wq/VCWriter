import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canCurate, grantedTaskNote, noticeForAssignment, noticeForPermission } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { answerRequest, requestById } from '@/lib/permissions';
import { makeAssignment } from '@/lib/assignments';
import { recordAudit } from '@/lib/audit';
import { sendRoomNotices } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Answering a permission request (addendum 07 §32).
 *
 * **A grant never opens the master.** It makes a new task for the writer on
 * the same material, saying what was asked; what they write for it is sent,
 * reviewed and integrated like anything else. A denial changes nothing. The
 * writer may withdraw their own request while it waits.
 */

const schema = z.object({
  state: z.enum(['granted', 'denied', 'withdrawn']),
  note: z.string().max(2000).default(''),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; requestId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not an answer.' }, { status: 400 });
  const { state, note, dueOn } = parsed.data;

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  const asked = await requestById(params.requestId);
  if (!asked || asked.roomId !== view.room.id) return NextResponse.json({ error: 'No such request.' }, { status: 404 });
  if (asked.state !== 'pending') return NextResponse.json({ error: 'This request has already been answered.' }, { status: 409 });

  if (state === 'withdrawn') {
    if (asked.requesterId !== user.id) return NextResponse.json({ error: 'Only who asked can withdraw it.' }, { status: 403 });
  } else if (!canCurate(view.role)) {
    return NextResponse.json({ error: 'Granting or denying a request is the showrunner’s.' }, { status: 403 });
  }

  let grantedAssignmentId: string | null = null;
  const roomName = view.room.name || view.projectTitle || 'the room';
  const notices = [];
  if (state === 'granted') {
    const task = await makeAssignment({
      roomId: view.room.id,
      assigneeId: asked.requesterId,
      assignedBy: user.id,
      targetKind: asked.beatId ? 'beat' : null,
      targetId: asked.beatId,
      targetLabel: asked.targetLabel.replace(/^Beat — /, ''),
      note: grantedTaskNote(asked),
      dueOn,
    });
    if ('reason' in task) return NextResponse.json({ error: task.message }, { status: 403 });
    grantedAssignmentId = task.id;
    await recordAudit({ roomId: view.room.id, actorId: user.id, entityType: 'assignment', entityId: task.id, action: 'assigned', toState: 'assigned', note: 'Granted permission request' });
    const assignedNotice = noticeForAssignment({ assignment: task, seats: view.seats, roomName });
    if (assignedNotice) notices.push(assignedNotice);
  }

  const answered = await answerRequest({
    requestId: asked.id,
    state,
    decidedBy: state === 'withdrawn' ? null : user.id,
    note: note.trim(),
    grantedAssignmentId,
  });
  if (!('id' in answered)) return NextResponse.json({ error: answered.message }, { status: 403 });

  await recordAudit({
    roomId: view.room.id,
    actorId: user.id,
    entityType: 'permission_request',
    entityId: asked.id,
    action: state,
    fromState: 'pending',
    toState: state,
    note: note.trim(),
  });
  if (state !== 'withdrawn') {
    const told = noticeForPermission({ request: answered, seats: view.seats, roomName, toUserId: asked.requesterId, actorId: user.id });
    if (told) notices.push(told);
  }
  await sendRoomNotices(notices);

  return NextResponse.json({ request: answered });
}
