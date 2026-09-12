import {
  assignmentSchema,
  canMoveAssignment,
  type Assignment,
  type AssignmentState,
  type AssignmentTarget,
} from '@vcwriter/domain';
import { serverClient } from './supabase';

/**
 * Assignments: the data layer (addendum 07 §8, stage 8).
 *
 * **As the visitor**, like `submissions.ts` and for the same reason: who may
 * give out work, who may say how their own is going, and what they may change
 * while saying it are questions the database already answers — the policies in
 * 0033 and the trigger beside them — and asking them again here would be asking
 * twice and getting them right once.
 *
 * Nothing in this file refuses anybody a write on the strength of an
 * assignment, and nothing ever should: **an assignment is not a lock** (§8).
 */

interface AssignmentRow {
  id: string;
  room_id: string;
  assignee_id: string;
  assigned_by: string | null;
  target_kind: AssignmentTarget | null;
  target_id: string | null;
  target_label: string;
  note: string;
  due_on: string | null;
  state: AssignmentState;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, room_id, assignee_id, assigned_by, target_kind, target_id, target_label, note, due_on, state, created_at, updated_at';

const fromRow = (row: AssignmentRow): Assignment =>
  assignmentSchema.parse({
    id: row.id,
    roomId: row.room_id,
    assigneeId: row.assignee_id,
    assignedBy: row.assigned_by,
    targetKind: row.target_kind,
    targetId: row.target_id,
    targetLabel: row.target_label,
    note: row.note,
    dueOn: row.due_on,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

/**
 * What the room owes, newest ask first.
 *
 * Everybody in the room sees all of it, deliberately (§8, and the policy says
 * so): who owes what is not a secret from the room, and a writer who cannot see
 * that a scene is already asked of somebody is a writer about to duplicate it
 * by accident.
 */
export const assignmentsIn = async (roomId: string): Promise<Assignment[]> => {
  const { data } = await serverClient()
    .from('assignments')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as AssignmentRow[]).map(fromRow);
};

export type AssignFailure = { reason: 'refused'; message: string };

/**
 * Give a piece of the story to a person.
 *
 * Whether this caller may, and whether that person is in the room, are both the
 * insert policy's questions; a refusal arrives as an error and is returned
 * rather than thrown, because *you may not* is an answer the interface shows.
 */
export const makeAssignment = async (input: {
  roomId: string;
  assigneeId: string;
  assignedBy: string;
  targetKind: AssignmentTarget | null;
  targetId: string | null;
  targetLabel: string;
  note: string;
  dueOn: string | null;
}): Promise<Assignment | AssignFailure> => {
  const { data, error } = await serverClient()
    .from('assignments')
    .insert({
      room_id: input.roomId,
      assignee_id: input.assigneeId,
      assigned_by: input.assignedBy,
      target_kind: input.targetKind,
      target_id: input.targetId,
      target_label: input.targetLabel,
      note: input.note,
      due_on: input.dueOn,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    return { reason: 'refused', message: 'That is not yours to give out.' };
  }
  return fromRow(data as AssignmentRow);
};

export type MoveFailure =
  | { reason: 'no_such_assignment' }
  | { reason: 'impossible_move' }
  | { reason: 'refused'; message: string };

/**
 * Move an assignment along.
 *
 * *Which* states follow which is checked in the domain, because it is a rule
 * about the product and the same one the interface draws its buttons from.
 * *Who* may make this particular move is the database's: the policy decides
 * whether the row is theirs to touch at all, and the trigger decides whether
 * this is a thing they may say about it — so a writer reaching for *called off*
 * comes back here as the trigger's own sentence rather than a silent no-op.
 */
export const moveAssignment = async (input: {
  assignmentId: string;
  to: AssignmentState;
}): Promise<Assignment | MoveFailure> => {
  const db = serverClient();
  const { data: before } = await db.from('assignments').select(COLUMNS).eq('id', input.assignmentId).maybeSingle();
  if (!before) return { reason: 'no_such_assignment' };

  const current = fromRow(before as AssignmentRow);
  if (!canMoveAssignment(current.state, input.to)) return { reason: 'impossible_move' };

  const { data, error } = await db
    .from('assignments')
    .update({ state: input.to })
    .eq('id', input.assignmentId)
    .select(COLUMNS)
    .maybeSingle();

  if (error) return { reason: 'refused', message: error.message };
  if (!data) return { reason: 'refused', message: 'That is not yours to change.' };
  return fromRow(data as AssignmentRow);
};
