import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ASSIGNMENT_TARGETS,
  assignRefusalText,
  canMakeAssignment,
  labelFor,
  parseProjectFile,
  seatInitials,
  seatName,
  type AssignmentTarget,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { assignmentsIn, makeAssignment } from '@/lib/assignments';
import { projectDocument } from '@/lib/project-document';
import { noticeForAssignment } from '@vcwriter/domain';
import { sendRoomNotice } from '@/lib/email';

import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Assignments (addendum 07 §8, stage 8).
 *
 * GET is what the room owes — all of it, to anybody in the room. That is wider
 * than the review queue on purpose: who owes what is not a secret from a room,
 * and a writer who cannot see that a scene is already asked of somebody is a
 * writer about to duplicate it by accident. It is *not* a lock; it is the
 * information that makes one unnecessary.
 *
 * POST gives a piece of the story to a person, which is the showrunner's alone.
 * The label is resolved here rather than sent, so a client cannot invent what a
 * scene is called, and so the row still reads after the scene is renamed.
 */

const schema = z.object({
  assigneeId: z.string().uuid().optional(),
  /** Several writers at once: one task each, linked as a group (§34). */
  assigneeIds: z.array(z.string().uuid()).min(1).max(8).optional(),
  targetKind: z.enum(ASSIGNMENT_TARGETS).nullable().default(null),
  targetId: z.string().uuid().nullable().default(null),
  note: z.string().max(2000).default(''),
  /** A plain date. A room works in days, not minutes. */
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const assignments = await assignmentsIn(view.room.id);

  return NextResponse.json({
    assignments,
    // The seats, so a row can wear its writer's colour without a second
    // request (§6: colour is read through the seat, never copied onto a row).
    seats: view.seats.map((seat) => ({
      ...seat,
      email: '',
      displayName: seatName(seat),
      initials: seatInitials(seat),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not an assignment.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const { targetKind, targetId, note, dueOn } = parsed.data;
  const assigneeIds = [...new Set(parsed.data.assigneeIds ?? (parsed.data.assigneeId ? [parsed.data.assigneeId] : []))];
  if (assigneeIds.length === 0) return NextResponse.json({ error: 'Say who it is for.' }, { status: 400 });
  // Half a target is not a target — the check constraint says so too, and this
  // says it in a sentence rather than as a violation.
  if ((targetKind === null) !== (targetId === null)) {
    return NextResponse.json({ error: 'Point it at something, or at nothing.' }, { status: 400 });
  }

  for (const assigneeId of assigneeIds) {
    const allowed = canMakeAssignment({
      role: view.role,
      seats: view.seats,
      assigneeId,
      targetKind,
      note,
    });
    if (allowed !== true) {
      return NextResponse.json({ error: assignRefusalText(allowed) }, {
        status: allowed.reason === 'cannot_assign' ? 403 : 400,
      });
    }
  }

  // What the thing is called, read out of the project rather than taken on the
  // client's word, and copied onto the row so it still reads after a rename.
  let targetLabel = '';
  if (targetKind && targetId) {
    const project = await projectDocument(view.room.projectId);
    if (!project) return NextResponse.json({ error: 'The project could not be read.' }, { status: 404 });
    const file = parseProjectFile(project);
    targetLabel = labelFor(file, { kind: targetKind as AssignmentTarget, id: targetId });
    if (targetLabel === '') {
      return NextResponse.json({ error: 'That is not in this project.' }, { status: 404 });
    }
  }

  // Several writers: one task each, every one theirs, linked by a group so
  // their versions are compared together (§34).
  const groupId = assigneeIds.length > 1 ? crypto.randomUUID() : null;
  const roomName = view.room.name || view.projectTitle || 'the room';
  const made = [];
  for (const assigneeId of assigneeIds) {
    const one = await makeAssignment({
      roomId: view.room.id,
      assigneeId,
      assignedBy: user.id,
      targetKind,
      targetId,
      targetLabel,
      note: note.trim(),
      dueOn,
      groupId,
    });
    if ('reason' in one) return NextResponse.json({ error: one.message, made }, { status: 403 });
    made.push(one);

    // Being given work is the clearest case of something addressed to you
    // (stage 14). Nobody is mailed about work they gave themselves, and a send
    // that fails never fails the assignment.
    const notice = noticeForAssignment({ assignment: one, seats: view.seats, roomName });
    if (notice) await sendRoomNotice(notice);

    await recordAudit({
      roomId: view.room.id,
      actorId: user.id,
      entityType: 'assignment',
      entityId: one.id,
      action: 'assigned',
      toState: one.state,
      note: `${one.targetLabel || one.note.slice(0, 120)}${groupId ? ` (one of ${assigneeIds.length} writers)` : ''}`,
    });
  }

  return NextResponse.json({ assignment: made[0], assignments: made, groupId });
}
