import { z } from 'zod';
import { roleCan, seatName, type RoomRole, type Seat } from './room.js';

/**
 * Comments, mentions and what is new (addendum 07 §14, stage 10).
 *
 * **A comment is speech about the work, not the work**, and that one
 * distinction settles most of the decisions here.
 *
 * It is why a comment can be *edited* — a person correcting their own typo is
 * not rewriting anybody's script — and why it still cannot be **deleted**: a
 * thread with a hole in it is a conversation nobody can follow, and §1's *no
 * state means gone* applies to the record of the room as much as to its pages.
 * Withdrawing is a state, and the thread still reads.
 *
 * And it is why a comment attaches to a record by **id with no foreign key**,
 * the same as an assignment (§8): the scene it is about lives in the document,
 * every branch carries its own copy under the same id, and that is exactly what
 * makes one thread about one scene visible on four writers' lines at once.
 */

/**
 * What a comment can be about.
 *
 * `room` is the room itself — the notes area §14 asks for, where a concept that
 * is not in the script yet has somewhere to be argued about. The rest name a
 * record, and `element` is a paragraph: it is an id in a beat's manuscript, so
 * it attaches exactly like the others and needs nothing new.
 */
export const COMMENT_TARGETS = ['room', 'scene', 'beat', 'element', 'research'] as const;
export const commentTargetSchema = z.enum(COMMENT_TARGETS);
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

export const TARGET_WORDS: Record<CommentTarget, string> = {
  room: 'The room',
  scene: 'Scene',
  beat: 'Beat',
  element: 'A line',
  research: 'Research',
};

export const COMMENT_STATES = ['open', 'resolved', 'withdrawn'] as const;
export const commentStateSchema = z.enum(COMMENT_STATES);
export type CommentState = (typeof COMMENT_STATES)[number];

export const commentSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** The thread this answers, or null where it *is* the thread. */
  parentId: z.string().nullable().default(null),
  authorId: z.string(),
  targetKind: commentTargetSchema.default('room'),
  /** Null for the room itself, which is not a record. */
  targetId: z.string().nullable().default(null),
  /** What the record was called when this was said, so the thread reads later. */
  targetLabel: z.string().default(''),
  body: z.string().default(''),
  /**
   * Who was named, settled at the time it was said.
   *
   * Stored rather than parsed on the way out, for the same reason an
   * assignment copies its label: a mention is a fact about a moment, and
   * renaming somebody two weeks later should not silently re-address what was
   * already said.
   */
  mentions: z.array(z.string()).default([]),
  state: commentStateSchema.default('open'),
  /** Whether the body has been changed since it was said. */
  editedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Comment = z.infer<typeof commentSchema>;

// -------------------------------------------------------------- who may speak

/** Whether this role may say anything at all (§7 — a viewer is here to read). */
export const canComment = (role: RoomRole | null): boolean => role !== null && roleCan(role, 'comment');

/**
 * Whether this person may mark a thread settled.
 *
 * Whoever started it, and whoever runs the room. Not everybody: a thread closed
 * by somebody who was losing the argument is worse than an open one.
 */
export const canResolve = (thread: Comment, viewer: { userId: string; role: RoomRole | null }): boolean =>
  thread.authorId === viewer.userId || (viewer.role !== null && roleCan(viewer.role, 'curate'));

/** Only the person who said it may change what it says, or take it back. */
export const canEdit = (comment: Comment, userId: string): boolean => comment.authorId === userId;

export type CommentRefusal = { reason: 'cannot_comment' } | { reason: 'nothing_said' } | { reason: 'no_such_thread' };

export const commentRefusalText = (refusal: CommentRefusal): string => {
  switch (refusal.reason) {
    case 'cannot_comment':
      return 'You are in this room to read.';
    case 'nothing_said':
      return 'Say something first.';
    case 'no_such_thread':
      return 'That thread is not in this room.';
  }
};

// ------------------------------------------------------------------ mentions

/**
 * Who a comment names.
 *
 * Matched longest name first, so *Jo Calder* wins over *Jo* where a room has
 * both — and matched against the display name, the initials and the part of an
 * email before the `@`, because people type whichever they have in their head.
 *
 * A deactivated seat can still be named, deliberately: somebody writing *this
 * was @Alex Byrne's idea* is attributing, not addressing, and refusing the
 * match would quietly rewrite what they meant.
 */
export const mentionsIn = (text: string, seats: readonly Seat[]): string[] => {
  const candidates = seats
    .filter((seat) => seat.userId)
    .flatMap((seat) => {
      const handles = [seat.displayName, seat.initials, seat.email.split('@')[0] ?? ''].filter(
        (handle) => handle.trim().length > 1,
      );
      return handles.map((handle) => ({ handle: handle.trim().toLowerCase(), userId: seat.userId as string }));
    })
    .sort((a, b) => b.handle.length - a.handle.length);

  const lowered = text.toLowerCase();
  const found = new Set<string>();

  // **One person per `@`**, walking the text rather than asking each name
  // whether it appears anywhere in it. Asking name by name looks equivalent
  // and is not: `@Jo Calder` *contains* `@Jo`, so a room with both a Jo Calder
  // and a Jo would quietly address them both from one mention. Whoever matches
  // longest at each `@` takes it, and nothing else may match inside them.
  for (let at = lowered.indexOf('@'); at !== -1; at = lowered.indexOf('@', at + 1)) {
    const winner = candidates.find((one) => lowered.startsWith(one.handle, at + 1));
    if (!winner) continue;
    found.add(winner.userId);
    at += winner.handle.length;
  }

  return [...found];
};

/** What a mention should look like once somebody has picked a person. */
export const mentionFor = (seat: Seat): string => `@${seatName(seat)}`;

// ------------------------------------------------------------------ threading

/** A thread: what was said, and everything said back, oldest first. */
export interface Thread {
  comment: Comment;
  author: Seat | null;
  replies: { comment: Comment; author: Seat | null }[];
  /** When anything was last said in it — what a room sorts by. */
  lastAt: string;
}

/**
 * The room's threads, most recently spoken in first.
 *
 * **One level deep, and that is a decision rather than a limitation.** A
 * conversation about a scene that branches into a tree is a conversation nobody
 * can follow; rooms argue in threads, and a reply to a reply belongs in the
 * same thread saying who it answers.
 */
export const threadsIn = (input: {
  comments: readonly Comment[];
  seats: readonly Seat[];
  target?: { kind: CommentTarget; id: string | null };
  /** Leave settled threads out, which is what a room usually wants. */
  openOnly?: boolean;
}): Thread[] => {
  const seatFor = (userId: string): Seat | null =>
    input.seats.find((seat) => seat.userId === userId) ?? null;

  const wanted = (comment: Comment): boolean =>
    !input.target ||
    (comment.targetKind === input.target.kind && (comment.targetId ?? null) === input.target.id);

  const replies = input.comments.filter((one) => one.parentId !== null);

  return input.comments
    .filter((one) => one.parentId === null && wanted(one))
    .filter((one) => (input.openOnly ? one.state === 'open' : true))
    // A withdrawn thread **with nothing built on it** is not shown: nobody
    // answered it, so there is no conversation left to keep readable and an
    // empty *withdrawn by the person who said it* is clutter rather than
    // record. One with replies always stays, because taking it away would
    // orphan them — which is the hole in the thread §1 refuses.
    .filter(
      (one) =>
        one.state !== 'withdrawn' || replies.some((reply) => reply.parentId === one.id),
    )
    .map((comment) => {
      const mine = replies
        .filter((one) => one.parentId === comment.id)
        .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
        .map((one) => ({ comment: one, author: seatFor(one.authorId) }));
      return {
        comment,
        author: seatFor(comment.authorId),
        replies: mine,
        lastAt: mine[mine.length - 1]?.comment.createdAt ?? comment.createdAt,
      };
    })
    .sort((a, b) => (a.lastAt > b.lastAt ? -1 : 1));
};

/** How many open threads are on a record, for a badge beside it. */
export const openThreadsOn = (
  comments: readonly Comment[],
  target: { kind: CommentTarget; id: string },
): number =>
  comments.filter(
    (one) =>
      one.parentId === null &&
      one.state === 'open' &&
      one.targetKind === target.kind &&
      one.targetId === target.id,
  ).length;

/** What a thread is about, in one line. */
export const describeTarget = (comment: Comment): string =>
  comment.targetKind === 'room'
    ? TARGET_WORDS.room
    : comment.targetLabel.trim().length > 0
      ? `${TARGET_WORDS[comment.targetKind]} — ${comment.targetLabel.trim()}`
      : TARGET_WORDS[comment.targetKind];

/** What a withdrawn comment says instead of what it said. */
export const bodyOf = (comment: Comment): string =>
  comment.state === 'withdrawn' ? 'Withdrawn by the person who said it.' : comment.body;

// ------------------------------------------------------------- what is new

/** One thing that happened which this person is owed sight of. */
export interface NewsItem {
  kind: 'mention' | 'reply';
  comment: Comment;
  /** The thread it is in, which is the comment itself for a new thread. */
  threadId: string;
  at: string;
}

/**
 * What is new for one person since they last looked (§14).
 *
 * **Computed rather than recorded**, and that is the whole design: a
 * notification row per event is a second copy of what happened, and a second
 * copy drifts. A mention is a comment that names you; a reply is a comment in a
 * thread you are in. Both are already written down, so what a person is owed is
 * a *reading* of the comments rather than a table beside them.
 *
 * Your own words are never news to you.
 */
export const newsFor = (input: {
  comments: readonly Comment[];
  userId: string;
  /** When they last looked. Everything, where they never have. */
  since: string | null;
}): NewsItem[] => {
  const since = input.since;
  const mine = new Set(
    input.comments.filter((one) => one.authorId === input.userId).map((one) => one.parentId ?? one.id),
  );

  return input.comments
    .filter((one) => one.authorId !== input.userId && one.state !== 'withdrawn')
    .filter((one) => (since === null ? true : one.createdAt > since))
    .flatMap((comment): NewsItem[] => {
      const threadId = comment.parentId ?? comment.id;
      if (comment.mentions.includes(input.userId)) {
        return [{ kind: 'mention', comment, threadId, at: comment.createdAt }];
      }
      if (comment.parentId !== null && mine.has(threadId)) {
        return [{ kind: 'reply', comment, threadId, at: comment.createdAt }];
      }
      return [];
    })
    .sort((a, b) => (a.at > b.at ? -1 : 1));
};

/** What a piece of news says, in one line. */
export const newsLine = (item: NewsItem, seats: readonly Seat[]): string => {
  const seat = seats.find((one) => one.userId === item.comment.authorId);
  const who = seat ? seatName(seat) : 'Somebody no longer in the room';
  return `${who} ${item.kind === 'mention' ? 'named you' : 'answered you'} ${whereSaid(item.comment)}.`;
};

/**
 * Where something was said, as it reads in a sentence.
 *
 * *In the room* and *on the docks* — English takes different prepositions for a
 * place and a thing, and a sentence that says *on the room* announces that
 * nobody read it back.
 */
export const whereSaid = (comment: Comment): string =>
  comment.targetKind === 'room' ? 'in the room' : `on ${describeTarget(comment).toLowerCase()}`;
