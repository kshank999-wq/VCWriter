import { auditEventSchema, type AuditEntity, type AuditEvent } from '@vcwriter/domain';
import { adminClient, serverClient } from './supabase';

/**
 * The room's audit trail (addendum 07 §32; spec v1.1 §13).
 *
 * **Written only by the server, after it has checked the person may act**: the
 * table has no insert policy, so nobody can add a row of their own, and no
 * update or delete policy, so nobody can change or remove one. A failure to
 * write the trail is logged and never undoes the act it records.
 *
 * Read as the visitor: the showrunner reads the room's, a writer what they did
 * and what was done to their own tasks and submissions.
 */
export const recordAudit = async (input: {
  roomId: string;
  actorId: string | null;
  entityType: AuditEntity;
  entityId: string | null;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  note?: string;
}): Promise<void> => {
  try {
    const { error } = await adminClient()
      .from('room_audit_events')
      .insert({
        room_id: input.roomId,
        actor_id: input.actorId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        from_state: input.fromState ?? null,
        to_state: input.toState ?? null,
        note: (input.note ?? '').slice(0, 2000),
      });
    if (error) console.error('audit', error.message);
  } catch (error) {
    console.error('audit', error);
  }
};

interface AuditRow {
  id: string;
  room_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  from_state: string | null;
  to_state: string | null;
  note: string;
  created_at: string;
}

/** The trail this visitor may read, newest first. Empty before the table exists. */
export const auditIn = async (roomId: string): Promise<AuditEvent[]> => {
  const { data, error } = await serverClient()
    .from('room_audit_events')
    .select('id, room_id, actor_id, entity_type, entity_id, action, from_state, to_state, note, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return [];
  return ((data ?? []) as AuditRow[]).flatMap((row) => {
    const parsed = auditEventSchema.safeParse({
      id: row.id,
      roomId: row.room_id,
      actorId: row.actor_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      fromState: row.from_state,
      toState: row.to_state,
      note: row.note ?? '',
      createdAt: row.created_at,
    });
    return parsed.success ? [parsed.data] : [];
  });
};
