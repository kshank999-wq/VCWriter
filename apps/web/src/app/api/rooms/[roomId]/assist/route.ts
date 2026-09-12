import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assistRefusalText,
  canAskHere,
  curatableFrom,
  ideaBoxes,
  ideasIn,
  parseProjectFile,
  seatName,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { RULES, rateLimit } from '@/lib/rate-limit';
import { versionWithDocument } from '@/lib/branches';
import { submissionsIn } from '@/lib/submissions';
import { compareTwo, findDuplicates, isAiConfigured } from '@/lib/ai-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A reading of two whole passes takes a while; the default would cut it short.
export const maxDuration = 120;

/**
 * Asking the room's AI for a reading (addendum 07 §14, stage 12).
 *
 * **Three gates before anything costs money**, in the order they actually
 * matter: whether the deployment has AI at all, whether *this room* has it on —
 * the owner's switch, §14 — and whether this person may read all the
 * contributions. That last one is the interesting gate: the readings are
 * *about* several writers' work at once, so somebody who may not read the
 * contributions must not be able to get them summarised instead.
 *
 * Then the account rate limit, which is the spending limit the whole product
 * already uses.
 *
 * **Nothing this returns is written anywhere.** The answer goes back to the
 * page that asked, and a person decides. There is no field in any of it that
 * could carry a rewrite even if a model tried to send one (`assist.ts`).
 */

const schema = z.discriminatedUnion('reading', [
  z.object({
    reading: z.literal('compare'),
    /** Two submissions in this room, and the record in each to compare. */
    firstSubmissionId: z.string().uuid(),
    secondSubmissionId: z.string().uuid(),
    /** The scene, by id. Both passes are read at the same scene. */
    recordId: z.string().uuid(),
  }),
  z.object({ reading: z.literal('duplicates') }),
]);

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a reading.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const allowed = canAskHere({
    role: view.role,
    roomEnabled: view.room.aiEnabled,
    configured: isAiConfigured(),
  });
  if (allowed !== true) {
    return NextResponse.json(
      { error: assistRefusalText(allowed) },
      { status: allowed.reason === 'unavailable' ? 503 : 403 },
    );
  }

  // Counted against the account, like every other AI call in the product: the
  // cost belongs to whoever is signed in, wherever they are sitting.
  const limited = await rateLimit(request, RULES.sceneReview, undefined, user.id);
  if (limited) return limited;

  const nameOf = (userId: string): string => {
    const seat = view.seats.find((one) => one.userId === userId);
    return seat ? seatName(seat) : 'Somebody no longer in the room';
  };

  try {
    if (parsed.data.reading === 'duplicates') {
      const submissions = (await submissionsIn(view.room.id)).filter((one) => one.kind === 'research');
      const carried = await Promise.all(
        submissions.map(async (submission) => {
          const found = await versionWithDocument(submission.versionId);
          return [submission.id, found ? ideasIn(parseProjectFile(found.document)) : []] as const;
        }),
      );
      const bySubmission = new Map(carried);
      const boxes = ideaBoxes({
        submissions,
        seats: view.seats,
        itemsFor: (submission) => bySubmission.get(submission.id) ?? [],
      });

      const ideas = boxes.flatMap((box) =>
        box.items.map((item) => ({
          id: item.id as string,
          writer: nameOf(box.submission.authorId),
          title: item.title,
          body: item.body,
        })),
      );
      if (ideas.length < 2) {
        return NextResponse.json({ error: assistRefusalText({ reason: 'not_enough' }) }, { status: 409 });
      }

      return NextResponse.json({ duplicates: await findDuplicates({ ideas }) });
    }

    // Two passes at one scene. Bound once so the narrowing survives into the
    // closure below, where `parsed.data` would be the union again.
    const asked = parsed.data;
    const submissions = await submissionsIn(view.room.id);
    const sides = await Promise.all(
      [asked.firstSubmissionId, asked.secondSubmissionId].map(async (id) => {
        const submission = submissions.find((one) => one.id === id);
        if (!submission) return null;
        const found = await versionWithDocument(submission.versionId);
        if (!found) return null;

        const file = parseProjectFile(found.document);
        const offered = curatableFrom(file).find(
          (one) => one.kind === 'scene' && one.id === asked.recordId,
        );
        if (!offered) return null;

        // The scene's words, and only those: what leaves the room is what is
        // being compared, not the rest of anybody's draft.
        const text = file.beats
          .filter((beat) => (beat.unitId as string) === asked.recordId)
          .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
          .flatMap((beat) => beat.manuscript.elements.map((element) => element.text))
          .filter((line) => line.trim().length > 0)
          .join('\n');

        return {
          writer: nameOf(submission.authorId),
          label: submission.note.trim() || offered.label,
          text,
        };
      }),
    );

    const [first, second] = sides;
    if (!first || !second || first.text.length === 0 || second.text.length === 0) {
      return NextResponse.json({ error: assistRefusalText({ reason: 'not_enough' }) }, { status: 409 });
    }

    return NextResponse.json({ comparison: await compareTwo({ first, second }) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The reading failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Whether a reading can be asked for, without asking for one.
 *
 * The button that spends money should be able to say why it is not there —
 * not configured, turned off by the showrunner, not yours to ask — rather than
 * failing after the click. Nothing here reaches a model or costs anything.
 */
export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const allowed = canAskHere({
    role: view.role,
    roomEnabled: view.room.aiEnabled,
    configured: isAiConfigured(),
  });

  return NextResponse.json({
    available: allowed === true,
    reason: allowed === true ? null : assistRefusalText(allowed),
  });
}
