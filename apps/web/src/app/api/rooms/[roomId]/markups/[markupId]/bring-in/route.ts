import { NextResponse } from 'next/server';
import { bringInMarkup, markupDraftLabel, parseProjectFile, seatInitials, seatName } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { openBranch, saveBranch, versionWithDocument } from '@/lib/branches';
import { markupById } from '@/lib/markups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bring a markup into your own draft of the script (addendum 07 §27.2).
 *
 * From Ken: *if you want to bring it into the script, then you can bring it in
 * as a markup and then in the version it'll have the initials of the writer
 * plus markup in the drop-down menu.* Each marked beat in the caller's own
 * draft gains a draft named "<initials> markup" holding the marked text and
 * its marks. The caller's working text is not touched.
 */
export async function POST(
  _request: Request,
  { params }: { params: { roomId: string; markupId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const markup = await markupById(params.markupId);
  if (!markup || markup.roomId !== view.room.id) {
    return NextResponse.json({ error: 'That markup is not yours to read.' }, { status: 404 });
  }
  const found = await versionWithDocument(markup.versionId);
  if (!found) return NextResponse.json({ error: 'The marked version could not be read.' }, { status: 404 });

  const me = view.seats.find((seat) => seat.userId === user.id);
  const branch = await openBranch({
    roomId: view.room.id,
    projectId: view.room.projectId,
    userId: user.id,
    role: view.role,
    displayName: me ? seatName(me) : (user.email ?? ''),
  });
  if ('reason' in branch) return NextResponse.json({ error: 'You have no draft in this room to bring it into.' }, { status: 403 });

  const writer = view.seats.find((seat) => seat.userId === found.version.authorId);
  const marker = view.seats.find((seat) => seat.userId === markup.authorId);
  const result = bringInMarkup(parseProjectFile(branch.document), {
    source: parseProjectFile(found.document),
    marks: markup.marks,
    label: markupDraftLabel(writer ? seatInitials(writer) : 'SR'),
    markedBy: marker ? seatName(marker) : 'The showrunner',
  });
  if (result.beats === 0) {
    return NextResponse.json(
      { error: 'None of the marked beats are in your draft of the script, so there was nowhere to bring it.' },
      { status: 409 },
    );
  }
  await saveBranch({ branchId: branch.branch.id, document: result.file });
  return NextResponse.json({ beats: result.beats, missing: result.missing });
}
