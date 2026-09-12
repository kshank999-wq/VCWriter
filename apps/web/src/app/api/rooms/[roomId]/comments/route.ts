import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  COMMENT_TARGETS,
  canComment,
  commentRefusalText,
  mentionsIn,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { commentsIn, markRead, sayInRoom } from '@/lib/comments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Saying something in the room (addendum 07 §14, stage 10).
 *
 * **Mentions are resolved here, on the server, against the room's own seats** —
 * so a client cannot address somebody who is not in the room, and the answer is
 * settled at the moment it is said. Renaming a person two weeks later must not
 * silently re-address what was already written, which is the same decision an
 * assignment makes about its label (§8).
 *
 * A reply carries its parent's target rather than being told one: a reply is in
 * a thread, and a thread is about one thing.
 */

const schema = z.object({
  parentId: z.string().uuid().nullable().default(null),
  targetKind: z.enum(COMMENT_TARGETS).default('room'),
  targetId: z.string().uuid().nullable().default(null),
  targetLabel: z.string().max(300).default(''),
  body: z.string().min(1).max(8000),
});

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  return NextResponse.json({ comments: await commentsIn(view.room.id) });
}

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: commentRefusalText({ reason: 'nothing_said' }) }, { status: 400 });
  }

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canComment(view.role)) {
    return NextResponse.json({ error: commentRefusalText({ reason: 'cannot_comment' }) }, { status: 403 });
  }

  let { targetKind, targetId, targetLabel } = parsed.data;

  // A reply is in a thread, and a thread is about one thing — so it takes its
  // parent's target rather than being told one it could get wrong.
  if (parsed.data.parentId) {
    const thread = (await commentsIn(view.room.id)).find((one) => one.id === parsed.data.parentId);
    if (!thread || thread.parentId !== null) {
      return NextResponse.json({ error: commentRefusalText({ reason: 'no_such_thread' }) }, { status: 404 });
    }
    targetKind = thread.targetKind;
    targetId = thread.targetId;
    targetLabel = thread.targetLabel;
  }

  // Half a target is not a target — the check constraint says so too, and this
  // says it in a sentence.
  if ((targetKind === 'room') !== (targetId === null)) {
    return NextResponse.json({ error: 'Point it at something, or at the room.' }, { status: 400 });
  }

  const said = await sayInRoom({
    roomId: view.room.id,
    parentId: parsed.data.parentId,
    authorId: user.id,
    targetKind,
    targetId,
    targetLabel,
    body: parsed.data.body.trim(),
    mentions: mentionsIn(parsed.data.body, view.seats),
  });
  if ('reason' in said) return NextResponse.json({ error: said.message }, { status: 403 });

  // Saying something is looking: nothing said before this is news to them now.
  await markRead(view.room.id, user.id);

  return NextResponse.json({ comment: said });
}
