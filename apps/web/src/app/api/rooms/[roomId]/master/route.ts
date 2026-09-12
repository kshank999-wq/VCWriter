import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { masterNow } from '@/lib/curation';
import { hashDocument, versionsFor } from '@/lib/branches';
import { describeVersion, masterVersion } from '@vcwriter/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the room has agreed on (addendum 07 §14, stage 11).
 *
 * **Two facts and no opinion**: which version is the master, and what it hashes
 * to. Whether a local project is current, ahead, behind or diverged is decided
 * by `standingOfProject` in the domain, on whichever machine is asking — one
 * comparison, in one place, giving the same answer to the desktop and to the
 * browser. A server that returned the *verdict* would be a second copy of that
 * rule, and it would drift.
 *
 * `?with=document` returns the master itself, which is what *fetch what the
 * room agreed* needs. Left out by default: asking where you stand should not
 * cost a whole script down the wire.
 */
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const standing = await masterNow(view.room.id, view.room.projectId);
  const version = masterVersion(await versionsFor(view.room.id));
  const wants = new URL(request.url).searchParams.get('with') === 'document';

  return NextResponse.json({
    roomId: view.room.id,
    versionId: standing.versionId,
    // Hashed the same way `branches.ts` hashes everything else, which is what
    // makes *byte for byte the master* a comparison and not an estimate.
    contentHash: hashDocument(standing.file),
    label: version ? describeVersion(version) : '',
    ...(wants ? { document: standing.file } : {}),
  });
}
