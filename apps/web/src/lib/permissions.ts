import { permissionRequestSchema, type PermissionRequest, type PermissionState } from '@vcwriter/domain';
import { serverClient } from './supabase';

/**
 * Permission requests (addendum 07 §32). Read and written **as the visitor**:
 * the database decides who may see one (who asked, whoever runs the room), who
 * may ask (a writer in the room, as themselves) and who may answer (the
 * showrunner; the writer may only withdraw their own while it waits).
 */

interface RequestRow {
  id: string;
  room_id: string;
  requester_id: string;
  beat_id: string | null;
  target_label: string;
  assignment_id: string | null;
  reason: string;
  proposed: string;
  state: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  granted_assignment_id: string | null;
  created_at: string;
}

const COLUMNS =
  'id, room_id, requester_id, beat_id, target_label, assignment_id, reason, proposed, state, decided_by, decided_at, decision_note, granted_assignment_id, created_at';

const fromRow = (row: RequestRow): PermissionRequest =>
  permissionRequestSchema.parse({
    id: row.id,
    roomId: row.room_id,
    requesterId: row.requester_id,
    beatId: row.beat_id,
    targetLabel: row.target_label ?? '',
    assignmentId: row.assignment_id,
    reason: row.reason,
    proposed: row.proposed ?? '',
    state: row.state,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note ?? '',
    grantedAssignmentId: row.granted_assignment_id,
    createdAt: row.created_at,
  });

/** What this visitor may see, newest first. Empty before the table exists. */
export const requestsIn = async (roomId: string): Promise<PermissionRequest[]> => {
  const { data, error } = await serverClient()
    .from('room_permission_requests')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return ((data ?? []) as RequestRow[]).map(fromRow);
};

export const askPermission = async (input: {
  roomId: string;
  requesterId: string;
  beatId: string | null;
  targetLabel: string;
  assignmentId: string | null;
  reason: string;
  proposed: string;
}): Promise<PermissionRequest | { reason: 'refused' }> => {
  const { data, error } = await serverClient()
    .from('room_permission_requests')
    .insert({
      room_id: input.roomId,
      requester_id: input.requesterId,
      beat_id: input.beatId,
      target_label: input.targetLabel,
      assignment_id: input.assignmentId,
      reason: input.reason,
      proposed: input.proposed,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) return { reason: 'refused' };
  return fromRow(data as RequestRow);
};

export const answerRequest = async (input: {
  requestId: string;
  state: Exclude<PermissionState, 'pending'>;
  decidedBy: string | null;
  note: string;
  grantedAssignmentId: string | null;
}): Promise<PermissionRequest | { reason: 'refused'; message: string }> => {
  const { data, error } = await serverClient()
    .from('room_permission_requests')
    .update({
      state: input.state,
      decided_by: input.decidedBy,
      decided_at: input.state === 'withdrawn' ? null : new Date().toISOString(),
      decision_note: input.note,
      granted_assignment_id: input.grantedAssignmentId,
    })
    .eq('id', input.requestId)
    .select(COLUMNS)
    .maybeSingle();
  if (error || !data) return { reason: 'refused', message: error?.message ?? 'That is not yours to answer.' };
  return fromRow(data as RequestRow);
};

export const requestById = async (requestId: string): Promise<PermissionRequest | null> => {
  const { data } = await serverClient().from('room_permission_requests').select(COLUMNS).eq('id', requestId).maybeSingle();
  return data ? fromRow(data as RequestRow) : null;
};
