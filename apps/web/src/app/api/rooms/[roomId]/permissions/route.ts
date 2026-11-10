import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mayAskPermission, noticeForPermission, permissionRefusalText } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { askPermission, requestsIn } from '@/lib/permissions';
import { assignmentsIn } from '@/lib/assignments';
import { submissionsIn } from '@/lib/submissions';
import { recordAudit } from '@/lib/audit';
import { sendRoomNotices } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Asking to revise material already in the master (addendum 07 §32; spec v1.1
 * §7, flow C). A writer asks about their own integrated work; the showrunner is
 * told. Nothing about the master changes.
 */

const schema = z.object({
  assignmentId: z.string().uuid().nullable().default(null),
  beatId: z.string().max(100).nullable().default(null),
  targetLabel: z.string().max(300).default(''),
  reason: z.string().max(4000),
  proposed: z.string().max(8000).default(''),
});

export async function GET(_request: Request, { params }: { params: { roomId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  return NextResponse.json({ requests: await requestsIn(view.room.id) });
}

export async function POST(request: Request, { params }: { params: { roomId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a request.' }, { status: 400 });
  const body = parsed.data;

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  // Only about the asker's own work, and only once it is in the master.
  if (body.assignmentId) {
    const [assignments, submissions] = await Promise.all([assignmentsIn(view.room.id), submissionsIn(view.room.id)]);
    const assignment = assignments.find((one) => one.id === body.assignmentId);
    if (!assignment || assignment.assigneeId !== user.id) {
      return NextResponse.json({ error: 'You can ask only about your own work.' }, { status: 403 });
    }
    if (!submissions.some((one) => one.assignmentId === assignment.id && one.state === 'incorporated')) {
      return NextResponse.json({ error: 'This is not in the master yet; revise it in your draft and send it again.' }, { status: 409 });
    }
  }

  const existing = await requestsIn(view.room.id);
  const may = mayAskPermission(existing, {
    requesterId: user.id,
    assignmentId: body.assignmentId,
    beatId: body.beatId,
    reason: body.reason,
  });
  if (may !== true) return NextResponse.json({ error: permissionRefusalText(may) }, { status: 409 });

  const made = await askPermission({
    roomId: view.room.id,
    requesterId: user.id,
    beatId: body.beatId,
    targetLabel: body.targetLabel.trim(),
    assignmentId: body.assignmentId,
    reason: body.reason.trim(),
    proposed: body.proposed.trim(),
  });
  if (!('id' in made)) return NextResponse.json({ error: 'You cannot ask in this room.' }, { status: 403 });

  await recordAudit({
    roomId: view.room.id,
    actorId: user.id,
    entityType: 'permission_request',
    entityId: made.id,
    action: 'asked',
    toState: 'pending',
    note: made.targetLabel,
  });
  const roomName = view.room.name || view.projectTitle || 'the room';
  const runners = view.seats.filter((seat) => seat.role === 'owner' && seat.userId);
  await sendRoomNotices(
    runners.flatMap((seat) => {
      const notice = noticeForPermission({ request: made, seats: view.seats, roomName, toUserId: seat.userId!, actorId: user.id });
      return notice ? [notice] : [];
    }),
  );

  return NextResponse.json({ request: made });
}
