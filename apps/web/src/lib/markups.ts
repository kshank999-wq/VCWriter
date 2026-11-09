import { markupSchema, type Mark, type Markup } from '@vcwriter/domain';
import { serverClient } from './supabase';

/**
 * Markups: a version marked up and sent back to its writer (addendum 07 §27).
 *
 * Read and written **as the visitor**, so the database decides who may see one
 * (whoever made it, whoever it went to, whoever runs the room) and who may send
 * one (anybody who writes, edits or runs the room).
 */

interface MarkupRow {
  id: string;
  room_id: string;
  version_id: string;
  author_id: string;
  recipient_id: string | null;
  marks: unknown;
  note: string;
  state: string;
  sent_at: string;
  seen_at: string | null;
  created_at: string;
}

const COLUMNS = 'id, room_id, version_id, author_id, recipient_id, marks, note, state, sent_at, seen_at, created_at';

const markupFromRow = (row: MarkupRow): Markup =>
  markupSchema.parse({
    id: row.id,
    roomId: row.room_id,
    versionId: row.version_id,
    authorId: row.author_id,
    recipientId: row.recipient_id,
    marks: Array.isArray(row.marks) ? row.marks : [],
    note: row.note ?? '',
    state: row.state === 'seen' ? 'seen' : 'sent',
    sentAt: row.sent_at,
    seenAt: row.seen_at,
    createdAt: row.created_at,
  });

/** Every markup this visitor may see in the room, newest first. */
export const markupsIn = async (roomId: string): Promise<Markup[]> => {
  const { data } = await serverClient()
    .from('room_markups')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('sent_at', { ascending: false });
  return ((data ?? []) as MarkupRow[]).map(markupFromRow);
};

export const sendMarkup = async (input: {
  roomId: string;
  versionId: string;
  authorId: string;
  recipientId: string | null;
  marks: Mark[];
  note: string;
}): Promise<Markup> => {
  const { data, error } = await serverClient()
    .from('room_markups')
    .insert({
      room_id: input.roomId,
      version_id: input.versionId,
      author_id: input.authorId,
      recipient_id: input.recipientId,
      marks: input.marks,
      note: input.note,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'The markup could not be sent.');
  return markupFromRow(data as MarkupRow);
};

/** The writer it was sent to has opened it. */
export const markMarkupSeen = async (markupId: string): Promise<void> => {
  await serverClient()
    .from('room_markups')
    .update({ state: 'seen', seen_at: new Date().toISOString() })
    .eq('id', markupId)
    .eq('state', 'sent');
};
