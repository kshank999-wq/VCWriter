import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  applyTray,
  canCurate,
  describeMasterMerge,
  mergeRefusalText,
  submissionsBehind,
  type SubmissionState,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { clearTray, commitMerge, masterNow, piecesFor, trayIn } from '@/lib/curation';
import { decideSubmission, submissionsIn } from '@/lib/submissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Committing the merge (addendum 07 §12, stage 9).
 *
 * **This is the point of the whole module**: the room's work becomes the
 * script. And it does so by *adding*. A new master version is written beside
 * the one before it, and the room is pointed at the new one — nothing is
 * overwritten, nothing is deleted, and the master the room had five minutes ago
 * is still a version anybody can open.
 *
 * **The tray is re-read and the merge re-run here** rather than trusting what
 * the page drew. The preview the showrunner looked at came from `applyTray`,
 * and so does this — the same pure function over the same rows — so the picture
 * and the commit cannot disagree, and a stale page cannot commit something
 * nobody saw.
 */

const schema = z.object({ label: z.string().max(200).default('') });

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a label.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canCurate(view.role)) {
    return NextResponse.json({ error: 'Assembling a master is the showrunner’s.' }, { status: 403 });
  }

  const tray = await trayIn(view.room.id);
  const [pieces, master] = await Promise.all([
    piecesFor(tray),
    masterNow(view.room.id, view.room.projectId),
  ]);

  const merged = applyTray(master.file, pieces);
  if ('reason' in merged) return NextResponse.json({ error: mergeRefusalText(merged) }, { status: 409 });

  const made = await commitMerge({
    roomId: view.room.id,
    userId: user.id,
    label: parsed.data.label.trim() || describeMasterMerge(merged.record, view.seats),
    summary: describeMasterMerge(merged.record, view.seats),
    document: merged.file,
    record: merged.record,
    parentVersionId: master.versionId,
  });
  if ('reason' in made) return NextResponse.json({ error: made.message }, { status: 403 });

  // The contributions that went in are now in the master, which is what
  // `incorporated` means — the one one-way door in a submission's life (§10),
  // because unsaying it is a change to the master rather than to a row.
  //
  // **Merging something still waiting to be read *is* approving it**, so a
  // submission that had not been decided on is walked through `approved` on the
  // way rather than jumping the state machine. Two facts happened and the row
  // records both.
  //
  // A submission the showrunner had already **turned down** is deliberately
  // left where it is. Taking one beat out of a pass that was rejected is a
  // real thing to do and does not un-reject the pass; the merge record names
  // the version it drew from, permanently, and that is the truthful account of
  // what went in.
  const behind = new Set(submissionsBehind(merged.record));
  if (behind.size > 0) {
    const submissions = await submissionsIn(view.room.id);
    for (const one of submissions.filter((s) => behind.has(s.id))) {
      const road: SubmissionState[] =
        one.state === 'approved'
          ? ['incorporated']
          : one.state === 'submitted' || one.state === 'in_review'
            ? ['approved', 'incorporated']
            : [];
      for (const to of road) {
        await decideSubmission({ submissionId: one.id, to, reply: one.reply, decidedBy: user.id });
      }
    }
  }

  // And the workbench is cleared, because what was on it is now in the script.
  await clearTray(view.room.id);

  return NextResponse.json({ version: made, sources: merged.record.sources.length });
}
