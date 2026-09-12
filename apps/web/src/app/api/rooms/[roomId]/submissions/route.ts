import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SUBMISSION_KINDS,
  branchFor,
  canSubmit,
  seatInitials,
  seatName,
  submitRefusalText,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { branchesIn, takeSnapshot, versionsFor } from '@/lib/branches';
import { sendSubmission, submissionsIn } from '@/lib/submissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Submitting, and the queue (addendum 07 §10, stage 6).
 *
 * GET is the queue as this visitor may see it: their own submissions if they
 * are a writer, all of them if they run the room. The filtering is row-level
 * security's, not this file's.
 *
 * POST is the one button. **It takes a snapshot first and submits that**, which
 * is the whole reason the mechanism is safe: the contribution references a
 * version, a version cannot be changed once it exists, and the writer carries
 * straight on with their desk untouched.
 */

const schema = z.object({
  kind: z.enum(SUBMISSION_KINDS).default('script'),
  note: z.string().max(2000).default(''),
});

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const [submissions, versions] = await Promise.all([submissionsIn(view.room.id), versionsFor(view.room.id)]);

  return NextResponse.json({
    submissions,
    versions,
    // The seats, so the queue can wear each writer's colour without a second
    // request (§6: colour is read through the seat, never copied).
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
  if (!parsed.success) return NextResponse.json({ error: 'That is not a submission.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canSubmit(view.role)) {
    return NextResponse.json(
      { error: submitRefusalText({ reason: view.role ? 'cannot_submit' : 'no_seat' }) },
      { status: 403 },
    );
  }

  const branch = branchFor(await branchesIn(view.room.id), user.id);
  if (!branch) {
    return NextResponse.json({ error: submitRefusalText({ reason: 'nothing_to_submit' }) }, { status: 409 });
  }

  // The point on the line that is being sent. Made here rather than asked for,
  // because a writer submitting should not first have to know what a version is.
  const version = await takeSnapshot({
    roomId: view.room.id,
    branchId: branch.id,
    userId: user.id,
    label: parsed.data.note.trim() || 'Submitted',
    summary: '',
  });
  if ('reason' in version) {
    return NextResponse.json({ error: submitRefusalText({ reason: 'nothing_to_submit' }) }, { status: 409 });
  }

  const sent = await sendSubmission({
    roomId: view.room.id,
    branchId: branch.id,
    versionId: version.id,
    authorId: user.id,
    kind: parsed.data.kind,
    note: parsed.data.note.trim(),
  });
  if ('reason' in sent) return NextResponse.json({ error: sent.message }, { status: 403 });

  return NextResponse.json({ submission: sent, version });
}
