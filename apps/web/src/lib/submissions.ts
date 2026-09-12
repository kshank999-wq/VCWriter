import {
  canMove,
  submissionSchema,
  type Submission,
  type SubmissionKind,
  type SubmissionState,
} from '@vcwriter/domain';
import { serverClient } from './supabase';

/**
 * Submissions: the data layer (addendum 07 §10, stage 6).
 *
 * **Everything here reads and writes as the visitor**, like `branches.ts` and
 * for the same reason: who may send work, who may read the queue and who may
 * decide are all questions row-level security already answers, and asking them
 * again in TypeScript would be asking them twice and getting them right once.
 *
 * The rule the whole stage turns on: **a submission references the version it
 * was taken from and copies nothing**. The writer carries straight on; what the
 * showrunner reads cannot move under them, because a version cannot be changed
 * once it exists.
 */

interface SubmissionRow {
  id: string;
  room_id: string;
  branch_id: string | null;
  version_id: string;
  author_id: string;
  kind: SubmissionKind;
  state: SubmissionState;
  note: string;
  reply: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, room_id, branch_id, version_id, author_id, kind, state, note, reply, decided_by, decided_at, created_at, updated_at';

const fromRow = (row: SubmissionRow): Submission =>
  submissionSchema.parse({
    id: row.id,
    roomId: row.room_id,
    branchId: row.branch_id,
    versionId: row.version_id,
    authorId: row.author_id,
    kind: row.kind,
    state: row.state,
    note: row.note,
    reply: row.reply,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

/**
 * What this visitor may see of the room's queue.
 *
 * A writer sees their own and nothing else; whoever runs the room sees all of
 * it. That is the database's answer rather than this function's — there is no
 * filter here to get wrong.
 */
export const submissionsIn = async (roomId: string): Promise<Submission[]> => {
  const { data } = await serverClient()
    .from('submissions')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  return ((data ?? []) as SubmissionRow[]).map(fromRow);
};

export type SendRefusal = { reason: 'refused'; message: string };

/**
 * Send a version for review.
 *
 * The version must already exist and must be the caller's own — the policy
 * says so, and this does not repeat it. A refusal here is the database's, and
 * it is returned rather than thrown because "you may not" is an answer the
 * interface has to show, not an accident.
 */
export const sendSubmission = async (input: {
  roomId: string;
  branchId: string | null;
  versionId: string;
  authorId: string;
  kind: SubmissionKind;
  note: string;
}): Promise<Submission | SendRefusal> => {
  const { data, error } = await serverClient()
    .from('submissions')
    .insert({
      room_id: input.roomId,
      branch_id: input.branchId,
      version_id: input.versionId,
      author_id: input.authorId,
      kind: input.kind,
      note: input.note,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    return { reason: 'refused', message: 'That is not yours to submit.' };
  }
  return fromRow(data as SubmissionRow);
};

export type DecideRefusal = { reason: 'no_such_submission' } | { reason: 'impossible_move' } | { reason: 'refused' };

/**
 * Move a submission along, and say who did it.
 *
 * The move itself is checked in the domain (`canMove`), because *which* states
 * follow which is a rule about the product rather than about the database, and
 * it is the same rule the interface draws its buttons from. Whether this person
 * may move anything at all is the policy's question, and a refusal comes back
 * as no rows.
 */
export const decideSubmission = async (input: {
  submissionId: string;
  to: SubmissionState;
  reply: string;
  decidedBy: string;
}): Promise<Submission | DecideRefusal> => {
  const db = serverClient();
  const { data: before } = await db.from('submissions').select(COLUMNS).eq('id', input.submissionId).maybeSingle();
  if (!before) return { reason: 'no_such_submission' };

  const current = fromRow(before as SubmissionRow);
  if (!canMove(current.state, input.to)) return { reason: 'impossible_move' };

  const { data, error } = await db
    .from('submissions')
    .update({
      state: input.to,
      reply: input.reply,
      decided_by: input.decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq('id', input.submissionId)
    .select(COLUMNS)
    .maybeSingle();

  if (error || !data) return { reason: 'refused' };
  return fromRow(data as SubmissionRow);
};
