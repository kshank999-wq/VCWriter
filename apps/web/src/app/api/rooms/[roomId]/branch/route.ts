import { NextResponse } from 'next/server';
import { z } from 'zod';
import { branchRefusalText, seatName } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { openBranch, saveBranch } from '@/lib/branches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A writer's own draft (addendum 07 §9, stage 3).
 *
 * GET opens it, making it from the room's master the first time. PUT is
 * autosave. There is no route here that reads *somebody else's* draft, and
 * that is not an omission: §7 says a private branch is private, and the
 * database enforces it whatever this file does.
 *
 * The room is loaded through the caller's own session, so who they are in it is
 * the database's answer rather than this route's.
 */

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const opened = await openBranch({
    roomId: view.room.id,
    projectId: view.room.projectId,
    userId: user.id,
    role: view.role,
    displayName: view.you ? seatName(view.you) : (user.email ?? ''),
  });

  if ('reason' in opened) {
    return NextResponse.json({ error: branchRefusalText(opened) }, { status: 403 });
  }

  return NextResponse.json({
    branch: opened.branch,
    file: opened.document,
    contentHash: opened.contentHash,
  });
}

const saveSchema = z.object({
  branchId: z.string().uuid(),
  file: z.unknown(),
  previousHash: z.string().max(200).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a project.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  try {
    // Whether this branch is the caller's is the database's question, asked of
    // `branch_heads` as they write. A stranger's save fails there, not here.
    const result = await saveBranch({
      branchId: parsed.data.branchId,
      document: parsed.data.file,
      previousHash: parsed.data.previousHash,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'That draft is not yours to save.' }, { status: 403 });
  }
}
