import { seatName, type Seat } from './room.js';
import { bodyOf, whereSaid, type Comment } from './comments.js';
import { askTitle, type Assignment } from './assignment.js';
import { STATE_NAMES, describeSubmission, type Submission } from './submission.js';

/**
 * Email notification (addendum 07 §14, stage 14).
 *
 * §14 asks for *notifications in the Room, optionally by email*. The Room half
 * has been built since stage 10 — `newsFor` and `activityIn`, both readings of
 * records that already exist. This is the other half, and the whole of its
 * design is one sentence:
 *
 * > **The room notifies; email interrupts — so email carries only what was
 * > addressed to you.**
 *
 * A mention, an assignment given to you, a decision on your own submission.
 * Not a new version on somebody's branch, not a comment in a thread you are
 * not in, not a merge. Those are all in the room and worth reading when you
 * next look; none of them is worth a phone lighting up, and a digest of
 * everything is a digest nobody reads after the second week. What is left is
 * the three things that are about *you* and that you might otherwise not know
 * had happened.
 *
 * Four rules follow, and each is a refusal:
 *
 * **Your own act never mails you.** Submitting your own work, naming yourself,
 * deciding your own submission — none of them.
 *
 * **An invited seat is mailed the invitation and nothing else.** Somebody who
 * has not accepted cannot read the room, and mail about its work would be the
 * one way into it that does not go through RLS.
 *
 * **A deactivated seat is mailed nothing.** Their contributions stay (§16);
 * their inbox is not part of the room any more.
 *
 * **Speech travels; the work does not.** A comment goes out with what was said,
 * because a mention you have to click to read one sentence is a notification
 * that wastes a click. A scene, a beat and a draft never do — mail is not a
 * place anybody agreed to put the script, and §1's protection of the writing
 * ends where the writing leaves the room.
 *
 * There is **no notification table**. Stage 10's decision holds: what is new is
 * a reading, and a row per event would be a second copy of something already
 * written down. What is recorded is only that mail was sent, in `email_events`,
 * which has recorded that since spec §12.3.
 */

// -------------------------------------------------------------- who gets mail

/**
 * Whether this seat may be written to at all.
 *
 * The three refusals above, in one place, because *do not email a deactivated
 * seat* written three times is *do not email a deactivated seat* written twice
 * and forgotten once.
 */
export const mayEmail = (seat: Pick<Seat, 'state' | 'email' | 'notifyByEmail'>): boolean =>
  seat.state === 'active' && seat.notifyByEmail && seat.email.trim().length > 0;

// ------------------------------------------------------------ what goes out

export type NoticeKind = 'mention' | 'assigned' | 'decided';

export interface Notice {
  kind: NoticeKind;
  /** The seat it is going to. Its address is the only one this is ever sent to. */
  to: Seat;
  /** The subject line — short, and it says which room. */
  subject: string;
  /** The one sentence the room itself would show. */
  line: string;
  /**
   * What was said, where speech is what happened. Empty for everything else:
   * an assignment and a decision are acts, and their words are already in the
   * line.
   */
  said: string;
  /** Where in the room to go, as a path the site turns into a URL. */
  path: string;
}

/** How much of a comment goes in an email before it says *read the rest in the room*. */
export const SAID_MOST = 600;

const shortened = (text: string): string =>
  text.length <= SAID_MOST ? text : `${text.slice(0, SAID_MOST).trimEnd()}…`;

const seatOf = (seats: readonly Seat[], userId: string | null): Seat | null =>
  userId ? (seats.find((one) => one.userId === userId) ?? null) : null;

const nameOf = (seats: readonly Seat[], userId: string | null): string => {
  const seat = seatOf(seats, userId);
  return seat ? seatName(seat) : 'Somebody no longer in the room';
};

/**
 * Who to mail about a comment, and what to say.
 *
 * **Mentions only, and never replies.** `newsFor` counts a reply in your thread
 * as news, and it is — in the room. It is not an interruption: a busy thread
 * would send a writer twenty emails in an afternoon, and the second one is
 * already being ignored. Being *named* is somebody asking you directly, which
 * is the line this whole stage draws.
 *
 * Mentions were settled when the comment was said (stage 10), so this addresses
 * exactly who was addressed, whatever anybody has been renamed to since.
 */
export const noticesForComment = (input: {
  comment: Comment;
  seats: readonly Seat[];
  roomName: string;
}): Notice[] => {
  if (input.comment.state === 'withdrawn') return [];
  const from = nameOf(input.seats, input.comment.authorId);

  return input.comment.mentions
    .filter((userId) => userId !== input.comment.authorId)
    .flatMap((userId) => {
      const seat = seatOf(input.seats, userId);
      if (!seat || !mayEmail(seat)) return [];
      return [
        {
          kind: 'mention' as const,
          to: seat,
          subject: `${from} named you — ${input.roomName}`,
          line: `${from} named you ${whereSaid(input.comment)}.`,
          said: shortened(bodyOf(input.comment)),
          path: `/rooms/${input.comment.roomId}`,
        },
      ];
    });
};

/**
 * Who to mail about an assignment: the person it is being asked of.
 *
 * Being given work is the clearest case of something addressed to you, and it
 * is the one §14 names in the same breath as mentions. A due date goes in the
 * line because *when* is half of what is being asked.
 */
export const noticeForAssignment = (input: {
  assignment: Assignment;
  seats: readonly Seat[];
  roomName: string;
}): Notice | null => {
  const { assignment } = input;
  if (assignment.assigneeId === assignment.assignedBy) return null;

  const seat = seatOf(input.seats, assignment.assigneeId);
  if (!seat || !mayEmail(seat)) return null;

  const from = nameOf(input.seats, assignment.assignedBy);
  const due = assignment.dueOn ? `, for ${assignment.dueOn}` : '';
  return {
    kind: 'assigned',
    to: seat,
    subject: `${from} asked you for ${askTitle(assignment)} — ${input.roomName}`,
    line: `${from} asked you for ${askTitle(assignment)}${due}.`,
    said: assignment.note.trim(),
    path: `/rooms/${assignment.roomId}`,
  };
};

/**
 * Who to mail about a decision: the writer whose submission it was.
 *
 * The one thing in the room a writer is genuinely waiting on, and the one they
 * cannot find out by looking at their own draft. The showrunner's reply travels
 * with it, because a rejection whose reason is one click away is a rejection
 * read without its reason.
 *
 * A decision that has not been made yet is not a notice, and neither is a
 * showrunner deciding their own.
 */
export const noticeForDecision = (input: {
  submission: Submission;
  seats: readonly Seat[];
  roomName: string;
}): Notice | null => {
  const { submission } = input;
  if (!submission.decidedAt || submission.decidedBy === submission.authorId) return null;

  const seat = seatOf(input.seats, submission.authorId);
  if (!seat || !mayEmail(seat)) return null;

  const by = nameOf(input.seats, submission.decidedBy);
  const state = STATE_NAMES[submission.state].toLowerCase();
  return {
    kind: 'decided',
    to: seat,
    subject: `${describeSubmission(submission)} — ${state} — ${input.roomName}`,
    line: `${by} marked ${describeSubmission(submission)} ${state}.`,
    said: submission.reply.trim(),
    path: `/rooms/${submission.roomId}`,
  };
};

/** What the line under an email says about why it arrived, and how to stop it. */
export const WHY_THIS_ARRIVED =
  'You were sent this because somebody in the room addressed you directly. Everything else the room does is waiting for you in the room. You can turn these off on your seat.';
