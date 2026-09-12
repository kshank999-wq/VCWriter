import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SUBMISSION_STATES, STATE_NAMES, canReview } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { decideSubmission } from '@/lib/submissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deciding on a submission (addendum 07 §10, stage 6).
 *
 * **No decision deletes anything** (§1). Rejected is a state: the version is
 * still there, the submission is still there, and a showrunner who rejects the
 * wrong scene at midnight can reopen it in the morning — which is why the
 * transitions in the domain let a decision be unmade.
 *
 * Whether this person may decide at all is asked twice on purpose. `canReview`
 * is what draws the buttons and gives the writer a sentence rather than a
 * silence; the policy is what actually enforces it, and a call that got past
 * the first still comes back as no rows from the second.
 */

const schema = z.object({
  state: z.enum(SUBMISSION_STATES),
  reply: z.string().max(2000).default(''),
});

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; submissionId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a decision.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canReview(view.role)) {
    return NextResponse.json({ error: 'Deciding what the room takes is the showrunner’s.' }, { status: 403 });
  }

  const decided = await decideSubmission({
    submissionId: params.submissionId,
    to: parsed.data.state,
    reply: parsed.data.reply.trim(),
    decidedBy: user.id,
  });

  if ('reason' in decided) {
    if (decided.reason === 'no_such_submission') {
      return NextResponse.json({ error: 'No such submission.' }, { status: 404 });
    }
    if (decided.reason === 'impossible_move') {
      return NextResponse.json(
        { error: `A submission cannot go straight to ${STATE_NAMES[parsed.data.state]} from where it is.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'That is not yours to decide.' }, { status: 403 });
  }

  return NextResponse.json({ submission: decided });
}
