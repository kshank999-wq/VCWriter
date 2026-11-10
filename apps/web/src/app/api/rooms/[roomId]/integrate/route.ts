import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  INTEGRATION_KINDS,
  applyIntegrations,
  beatHash,
  canCurate,
  commitBeatVersion,
  integrationRefusalText,
  parseProjectFile,
  seatName,
  type IntegrationOp,
  type ManuscriptSegment,
  type MergeRecord,
  type SubmissionState,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { commitMerge, masterNow } from '@/lib/curation';
import { versionWithDocument } from '@/lib/branches';
import { decideSubmission, submissionsIn } from '@/lib/submissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Commit a selection-to-selection integration (addendum 07 §30; spec v1.1 §6.3).
 *
 * **Nothing the page says is taken on trust.** The master is re-read and its
 * beat compared with the one the integration was opened on; if it has moved,
 * the commit is refused, not merged. Every writer's passage is re-read from the
 * version it came from, and who wrote it is taken from that version, not from
 * the request. Every step is replayed, checking the exact words at both ends.
 *
 * What is written is the beat's next version, the one before it kept whole,
 * inside a new master version beside the old one (§12): nothing is overwritten.
 */

const anchor = z.object({
  startElementId: z.string(),
  startOffset: z.number().int().min(0),
  endElementId: z.string(),
  endOffset: z.number().int().min(0),
});

const schema = z.object({
  beatId: z.string(),
  baseHash: z.string(),
  label: z.string().max(200).default(''),
  ops: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(INTEGRATION_KINDS),
        source: z
          .object({
            submissionId: z.string().nullable(),
            versionId: z.string(),
            beatId: z.string(),
            anchor,
            quote: z.string().max(100_000),
          })
          .nullable(),
        dest: z.object({ beatId: z.string(), anchor, quote: z.string().max(100_000) }),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(request: Request, { params }: { params: { roomId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not an integration.' }, { status: 400 });
  const body = parsed.data;

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canCurate(view.role)) {
    return NextResponse.json({ error: 'Only the showrunner changes the master.' }, { status: 403 });
  }

  const master = await masterNow(view.room.id, view.room.projectId);
  const beat = master.file.beats.find((one) => (one.id as string) === body.beatId);
  if (!beat) return NextResponse.json({ error: integrationRefusalText({ reason: 'no_such_beat' }) }, { status: 404 });
  if (beatHash(beat.manuscript) !== body.baseHash) {
    return NextResponse.json({ error: integrationRefusalText({ reason: 'stale_master' }), stale: true }, { status: 409 });
  }

  // The writers' passages, re-read from where they came from. A submission is
  // checked to be this room's and to reference that version.
  const submissions = await submissionsIn(view.room.id);
  const sources = new Map<string, ManuscriptSegment>();
  const authors = new Map<string, string>();
  for (const versionId of [...new Set(body.ops.flatMap((op) => (op.source ? [op.source.versionId] : [])))]) {
    const found = await versionWithDocument(versionId);
    if (!found || found.version.roomId !== view.room.id) {
      return NextResponse.json({ error: 'A version this draws from cannot be read.' }, { status: 409 });
    }
    const sourceBeat = parseProjectFile(found.document).beats.find((one) => (one.id as string) === body.beatId);
    if (!sourceBeat) {
      return NextResponse.json({ error: 'A version this draws from has no such beat.' }, { status: 409 });
    }
    sources.set(versionId, sourceBeat.manuscript);
    if (!found.version.authorId) {
      return NextResponse.json({ error: 'A version this draws from has no writer on record.' }, { status: 409 });
    }
    authors.set(versionId, found.version.authorId);
  }
  for (const op of body.ops) {
    if (op.source?.submissionId) {
      const submission = submissions.find((one) => one.id === op.source!.submissionId);
      if (!submission || submission.versionId !== op.source.versionId) {
        return NextResponse.json({ error: 'A submission this draws from does not match its version.' }, { status: 409 });
      }
    }
  }

  const at = new Date().toISOString();
  const ops: IntegrationOp[] = body.ops.map((op) => ({
    id: op.id,
    kind: op.kind,
    source: op.source ? { ...op.source, authorId: authors.get(op.source.versionId) ?? '' } : null,
    dest: op.dest,
    actorId: user.id,
    at,
  }));

  const result = applyIntegrations(beat.manuscript, ops, sources);
  if ('reason' in result) {
    return NextResponse.json({ error: `Step ${result.step + 1}: ${integrationRefusalText(result)}` }, { status: 409 });
  }

  const committed = commitBeatVersion(master.file, body.beatId, result);
  if ('reason' in committed) return NextResponse.json({ error: integrationRefusalText(committed) }, { status: 409 });

  const used = [...new Set(ops.flatMap((op) => (op.source ? [op.source.versionId] : [])))];
  const record: MergeRecord = {
    at,
    sources: used.map((versionId) => {
      const op = ops.find((one) => one.source?.versionId === versionId)!;
      return {
        submissionId: op.source!.submissionId,
        versionId,
        authorId: authors.get(versionId) ?? '',
        kind: 'beat',
        recordId: body.beatId,
        label: beat.title || 'A beat',
        how: 'replace',
        becameId: body.beatId,
      };
    }),
    integration: { beatId: body.beatId, from: committed.from, to: committed.to, baseHash: body.baseHash, steps: ops },
  };
  const who = [...new Set(record.sources.map((one) => one.authorId))]
    .map((id) => view.seats.find((seat) => seat.userId === id))
    .map((seat) => (seat ? seatName(seat) : 'a writer no longer in the room'));
  const summary = `${beat.title || 'A beat'}: ${committed.from} → ${committed.to}${who.length > 0 ? ` with ${who.join(', ')}` : ''}`;

  const made = await commitMerge({
    roomId: view.room.id,
    userId: user.id,
    label: body.label.trim() || summary,
    summary,
    document: committed.file,
    record,
    parentVersionId: master.versionId,
  });
  if ('reason' in made) return NextResponse.json({ error: made.message }, { status: 403 });

  // The submissions it drew from are now in the master. Integrating one still
  // waiting to be read approves it on the way, as the Curation Tray does.
  const behind = new Set(record.sources.map((one) => one.submissionId).filter((id): id is string => Boolean(id)));
  for (const one of submissions.filter((s) => behind.has(s.id))) {
    const road: SubmissionState[] =
      one.state === 'approved'
        ? ['incorporated']
        : one.state === 'submitted' || one.state === 'in_review'
          ? ['approved', 'incorporated']
          : [];
    for (const to of road) await decideSubmission({ submissionId: one.id, to, reply: one.reply, decidedBy: user.id });
  }

  return NextResponse.json({ version: made, from: committed.from, to: committed.to });
}
