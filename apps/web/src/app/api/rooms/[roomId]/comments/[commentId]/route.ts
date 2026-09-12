import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canEdit, canResolve } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { amendComment, commentsIn } from '@/lib/comments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Correcting, settling or withdrawing one comment (§14, stage 10).
 *
 * **There is no DELETE here, and that is the point.** A thread with a hole in
 * it is a conversation nobody can follow, so taking something back is a state:
 * the row stays, the reply beneath it still makes sense, and the thread reads
 * *withdrawn by the person who said it*. §1 covers the record of a room as much
 * as its pages.
 *
 * Who may do which is decided in the domain and again by the policy — the first
 * so the interface can draw the right controls and say why, the second because
 * an interface is not access control (§3.2).
 */

const schema = z.object({
  body: z.string().min(1).max(8000).optional(),
  /** Settling a thread, or taking your own words back. */
  state: z.enum(['open', 'resolved', 'withdrawn']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; commentId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a change.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const comment = (await commentsIn(view.room.id)).find((one) => one.id === params.commentId);
  if (!comment) return NextResponse.json({ error: 'No such comment.' }, { status: 404 });

  // Changing the words, and taking them back, are the author's alone.
  if ((parsed.data.body !== undefined || parsed.data.state === 'withdrawn') && !canEdit(comment, user.id)) {
    return NextResponse.json({ error: 'Only the person who said it can change it.' }, { status: 403 });
  }

  // Settling a thread is whoever started it, or whoever runs the room — never
  // everybody: a thread closed by whoever was losing the argument is worse than
  // an open one.
  if (
    (parsed.data.state === 'resolved' || parsed.data.state === 'open') &&
    !canResolve(comment, { userId: user.id, role: view.role })
  ) {
    return NextResponse.json({ error: 'That thread is not yours to settle.' }, { status: 403 });
  }

  const amended = await amendComment({
    commentId: params.commentId,
    body: parsed.data.body,
    state: parsed.data.state,
  });
  if ('reason' in amended) return NextResponse.json({ error: amended.message }, { status: 403 });

  return NextResponse.json({ comment: amended });
}
