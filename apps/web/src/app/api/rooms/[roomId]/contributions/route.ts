import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canSubmit, parseProjectFile, submitRefusalText } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { hashDocument } from '@/lib/branches';
import { serverClient } from '@/lib/supabase';
import { sendSubmission } from '@/lib/submissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sending desktop work up to the room (addendum 07 §14, stage 11).
 *
 * **It creates a contribution. It never overwrites the master**, and that is
 * §14's desktop rule word for word. What arrives is a version and a submission
 * — the same pair pressing *Submit* in the browser makes (§10) — so it lands in
 * the review queue, the showrunner curates it in the tray (§12), and the master
 * changes only when somebody decides it should.
 *
 * Nothing new was needed for any of that, which is the third time the Room has
 * paid for having one vocabulary: the desktop is simply another door onto the
 * same act.
 *
 * **No branch.** A desktop upload is not a working line in the room — it is one
 * pass, handed in. `versions_own_insert` allows a version with no branch, and
 * the submission carries `branch_id: null` for the same reason: inventing a
 * branch would put a line on the dashboard that nobody is writing on.
 */

const schema = z.object({
  /** The whole project, as the desktop has it. */
  file: z.unknown(),
  note: z.string().max(2000).default(''),
});

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a project.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canSubmit(view.role)) {
    return NextResponse.json(
      { error: submitRefusalText({ reason: view.role ? 'cannot_submit' : 'no_seat' }) },
      { status: 403 },
    );
  }

  // Parsed rather than trusted: what goes into a version is read back by every
  // reader afterwards, and a version cannot be corrected once it exists.
  let document: unknown;
  try {
    document = parseProjectFile(parsed.data.file);
  } catch {
    return NextResponse.json({ error: 'That file could not be read.' }, { status: 400 });
  }

  const label = parsed.data.note.trim() || 'From the desktop';
  const { data, error } = await serverClient()
    .from('versions')
    .insert({
      room_id: view.room.id,
      branch_id: null,
      author_id: user.id,
      parent_version_id: null,
      // Not `master`, and the policy would refuse it from a writer anyway
      // (0034) — but saying it here is where a reader of this file looks.
      kind: 'submission',
      label,
      summary: 'Sent from the desktop application.',
      document,
      content_hash: hashDocument(document),
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'The room would not take it.' }, { status: 403 });
  }
  const version = data as { id: string; created_at: string };

  const sent = await sendSubmission({
    roomId: view.room.id,
    branchId: null,
    versionId: version.id,
    authorId: user.id,
    kind: 'script',
    note: label,
  });
  if ('reason' in sent) return NextResponse.json({ error: sent.message }, { status: 403 });

  return NextResponse.json({
    submission: sent,
    // What the desktop moors itself to afterwards is the *master*, not this —
    // handing this back would moor a copy to its own contribution and call it
    // current, which it is not.
    version: { id: version.id, createdAt: version.created_at, label },
  });
}
