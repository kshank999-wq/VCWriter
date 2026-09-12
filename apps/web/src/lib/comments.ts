import {
  commentSchema,
  type Comment,
  type CommentState,
  type CommentTarget,
} from '@vcwriter/domain';
import { serverClient } from './supabase';

/**
 * Comments and read-marks: the data layer (addendum 07 §14, stage 10).
 *
 * **As the visitor**, like every room table since stage 1. Who may speak, who
 * may settle a thread, and whose read-mark is whose are all questions the
 * policies in 0035 already answer, and asking them again here would be asking
 * twice and getting them right once.
 *
 * **There is no delete.** A comment taken back is `withdrawn`, which says what
 * happened and leaves the thread readable — §1 covers the record of the room as
 * much as its pages.
 */

interface CommentRow {
  id: string;
  room_id: string;
  parent_id: string | null;
  author_id: string;
  target_kind: CommentTarget;
  target_id: string | null;
  target_label: string;
  body: string;
  mentions: string[] | null;
  state: CommentState;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, room_id, parent_id, author_id, target_kind, target_id, target_label, body, mentions, state, edited_at, created_at, updated_at';

const fromRow = (row: CommentRow): Comment =>
  commentSchema.parse({
    id: row.id,
    roomId: row.room_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    targetKind: row.target_kind,
    targetId: row.target_id,
    targetLabel: row.target_label,
    body: row.body,
    mentions: row.mentions ?? [],
    state: row.state,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

/** Everything the room has said, oldest first — threading is the domain's job. */
export const commentsIn = async (roomId: string): Promise<Comment[]> => {
  const { data } = await serverClient()
    .from('room_comments')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  return ((data ?? []) as CommentRow[]).map(fromRow);
};

export type SayFailure = { reason: 'refused'; message: string };

export const sayInRoom = async (input: {
  roomId: string;
  parentId: string | null;
  authorId: string;
  targetKind: CommentTarget;
  targetId: string | null;
  targetLabel: string;
  body: string;
  mentions: string[];
}): Promise<Comment | SayFailure> => {
  const { data, error } = await serverClient()
    .from('room_comments')
    .insert({
      room_id: input.roomId,
      parent_id: input.parentId,
      author_id: input.authorId,
      target_kind: input.targetKind,
      target_id: input.targetId,
      target_label: input.targetLabel,
      body: input.body,
      mentions: input.mentions,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) return { reason: 'refused', message: 'You are in this room to read.' };
  return fromRow(data as CommentRow);
};

/**
 * Correct it, settle it, or take it back.
 *
 * Three different acts through one door, because they are one row and the
 * policy decides between them: the author may change any of it, and whoever
 * runs the room may settle a thread. Withdrawing empties the body as well as
 * setting the state — a withdrawn comment nobody can read is the point, and
 * leaving the words in the row would make *withdrawn* a label rather than a
 * fact.
 */
export const amendComment = async (input: {
  commentId: string;
  body?: string;
  state?: CommentState;
}): Promise<Comment | SayFailure> => {
  const patch: Record<string, unknown> = {};
  if (input.state !== undefined) patch['state'] = input.state;
  if (input.state === 'withdrawn') patch['body'] = '';
  else if (input.body !== undefined) {
    patch['body'] = input.body;
    patch['edited_at'] = new Date().toISOString();
  }

  const { data, error } = await serverClient()
    .from('room_comments')
    .update(patch)
    .eq('id', input.commentId)
    .select(COLUMNS)
    .maybeSingle();

  if (error || !data) return { reason: 'refused', message: 'That is not yours to change.' };
  return fromRow(data as CommentRow);
};

// --------------------------------------------------------------- read-marks

/**
 * When this person last looked at this room.
 *
 * Null where they never have, which the domain reads as *everything is new* —
 * the right answer for somebody's first visit, and one fewer special case than
 * defaulting it to now.
 */
export const lastReadAt = async (roomId: string, userId: string): Promise<string | null> => {
  const { data } = await serverClient()
    .from('room_reads')
    .select('last_read_at')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { last_read_at: string } | null)?.last_read_at ?? null;
};

/** They have looked. */
export const markRead = async (roomId: string, userId: string): Promise<void> => {
  await serverClient()
    .from('room_reads')
    .upsert(
      { room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' },
    );
};
