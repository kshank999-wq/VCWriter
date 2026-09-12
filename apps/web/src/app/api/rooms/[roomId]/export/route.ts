import { NextResponse } from 'next/server';
import { canCurate, exportFileName, type RoomExport } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { branchesIn, versionsFor } from '@/lib/branches';
import { submissionsIn } from '@/lib/submissions';
import { assignmentsIn } from '@/lib/assignments';
import { commentsIn } from '@/lib/comments';
import { masterNow } from '@/lib/curation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Taking a whole room out (addendum 07 §14, stage 11).
 *
 * **Everything the room recorded, and the master as a readable document.** The
 * other versions are named — author, label, kind, moment — but their documents
 * are left out, deliberately: a room with twenty writers and a year of
 * snapshots would produce a file nobody could open, and what a backup is *for*
 * — proving who wrote what, and getting the script back — is answered by the
 * master plus the trail. A full archive of every draft is a larger promise, and
 * saying so is better than shipping half of it quietly.
 *
 * **Read as the visitor**, so the bundle contains exactly what this person
 * could have read a page at a time — an export is not a way round §7. Whoever
 * curates the room may ask for it; a writer's own work is already theirs, on
 * their own line, and a writer who could export the room could export everyone
 * else's drafts with it.
 */
export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canCurate(view.role)) {
    return NextResponse.json({ error: 'Taking the room out is the showrunner’s.' }, { status: 403 });
  }

  const [branches, versions, submissions, assignments, comments, master] = await Promise.all([
    branchesIn(view.room.id),
    versionsFor(view.room.id),
    submissionsIn(view.room.id),
    assignmentsIn(view.room.id),
    commentsIn(view.room.id),
    masterNow(view.room.id, view.room.projectId),
  ]);

  const exportedAt = new Date().toISOString();
  const bundle: RoomExport = {
    exportedAt,
    room: view.room,
    // Addresses left out: a backup of a room is a record of its work, and
    // nobody needs a file of everybody's email addresses to hold that.
    seats: view.seats.map(({ email: _email, ...rest }) => rest),
    branches,
    versions,
    submissions,
    assignments,
    comments,
    master: { versionId: master.versionId, document: master.file },
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${exportFileName(
        view.room.name || view.projectTitle || 'room',
        exportedAt,
      )}"`,
    },
  });
}
