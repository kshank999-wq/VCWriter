import { describeVersion, type Version } from './branch.js';
import { seatName, type Seat } from './room.js';
import { STATE_NAMES, describeSubmission, type Submission } from './submission.js';
import { ASSIGNMENT_STATE_NAMES, askTitle, type Assignment } from './assignment.js';
import { whereSaid, type Comment } from './comments.js';

/**
 * The activity history (addendum 07 §9, stage 10).
 *
 * §9 asks for a record of *who created, submitted, accepted, rejected, moved or
 * modified collaborative material* — the trail §1 is enforced by.
 *
 * **It is a reading, not a second recording.** Every one of those facts is
 * already written down: a version carries its author and the moment it was
 * made, a submission carries its state and who decided it, an assignment
 * carries both, a seat carries when it was invited and when it was accepted,
 * and a comment is its own evidence. A log table beside them would be a second
 * copy of the same events — and a second copy drifts, which is the one thing an
 * audit trail must never do. So this reads the records and orders them.
 *
 * What that costs is honest and worth saying: the trail shows a submission's
 * *current* standing and when it was last decided, not every state it passed
 * through on the way. Keeping every step would need rows of its own, and that
 * is a real feature to build deliberately rather than a side effect to leave
 * half-done here.
 */

export type ActivityKind =
  | 'joined'
  | 'invited'
  | 'left'
  | 'recorded'
  | 'master'
  | 'submitted'
  | 'decided'
  | 'assigned'
  | 'assignment_moved'
  | 'said';

export interface ActivityEvent {
  kind: ActivityKind;
  at: string;
  /** Whose act it was, where the record names somebody. */
  authorId: string | null;
  /** What happened, in the room's own words. */
  line: string;
  /** Where to go to look at it, where there is somewhere. */
  versionId: string | null;
}

const nameOf = (seats: readonly Seat[], userId: string | null): string => {
  if (!userId) return 'Somebody';
  const seat = seats.find((one) => one.userId === userId);
  return seat ? seatName(seat) : 'Somebody no longer in the room';
};

/**
 * Everything that has happened in the room, newest first.
 *
 * Newest first, unlike the review queue: a history is read to find out what has
 * changed since you last looked, and the queue is read to find out who has been
 * waiting longest. Two orders, two questions, and §10 already made the same
 * distinction out loud.
 */
export const activityIn = (input: {
  seats: readonly Seat[];
  versions: readonly Version[];
  submissions: readonly Submission[];
  assignments: readonly Assignment[];
  comments: readonly Comment[];
  /** Only what happened after this, where a reader wants the recent past. */
  since?: string | null;
}): ActivityEvent[] => {
  const who = (userId: string | null) => nameOf(input.seats, userId);
  const events: ActivityEvent[] = [];

  for (const seat of input.seats) {
    if (seat.acceptedAt) {
      events.push({
        kind: 'joined',
        at: seat.acceptedAt,
        authorId: seat.userId,
        line: `${seatName(seat)} joined the room.`,
        versionId: null,
      });
    } else if (seat.state === 'invited') {
      events.push({
        kind: 'invited',
        at: seat.invitedAt,
        authorId: null,
        line: `${seat.email || 'Somebody'} was invited.`,
        versionId: null,
      });
    }
    if (seat.deactivatedAt) {
      // Said carefully: a seat taken out of a room keeps everything it wrote
      // (§16), and the trail is the wrong place to imply otherwise.
      events.push({
        kind: 'left',
        at: seat.deactivatedAt,
        authorId: seat.userId,
        line: `${seatName(seat)} was taken out of the room. Everything they wrote is still theirs.`,
        versionId: null,
      });
    }
  }

  for (const version of input.versions) {
    events.push({
      kind: version.kind === 'master' ? 'master' : 'recorded',
      at: version.createdAt,
      authorId: version.authorId,
      line:
        version.kind === 'master'
          ? `${who(version.authorId)} made a new master — ${describeVersion(version)}.`
          : `${who(version.authorId)} recorded ${describeVersion(version)}.`,
      versionId: version.id,
    });
  }

  for (const submission of input.submissions) {
    events.push({
      kind: 'submitted',
      at: submission.createdAt,
      authorId: submission.authorId,
      line: `${who(submission.authorId)} submitted ${describeSubmission(submission)}.`,
      versionId: submission.versionId,
    });
    if (submission.decidedAt) {
      events.push({
        kind: 'decided',
        at: submission.decidedAt,
        authorId: submission.decidedBy,
        line: `${who(submission.decidedBy)} marked ${describeSubmission(submission)} ${STATE_NAMES[
          submission.state
        ].toLowerCase()}.`,
        versionId: submission.versionId,
      });
    }
  }

  for (const assignment of input.assignments) {
    events.push({
      kind: 'assigned',
      at: assignment.createdAt,
      authorId: assignment.assignedBy,
      line: `${who(assignment.assignedBy)} asked ${who(assignment.assigneeId)} for ${askTitle(assignment)}.`,
      versionId: null,
    });
    // Only where it has actually moved since — an assignment nobody has touched
    // would otherwise appear twice saying the same thing.
    if (assignment.updatedAt > assignment.createdAt) {
      events.push({
        kind: 'assignment_moved',
        at: assignment.updatedAt,
        authorId: assignment.assigneeId,
        line: `${askTitle(assignment)} — ${ASSIGNMENT_STATE_NAMES[assignment.state].toLowerCase()} by ${who(
          assignment.assigneeId,
        )}.`,
        versionId: null,
      });
    }
  }

  for (const comment of input.comments) {
    if (comment.state === 'withdrawn') continue;
    events.push({
      kind: 'said',
      at: comment.createdAt,
      authorId: comment.authorId,
      line: `${who(comment.authorId)} said something ${whereSaid(comment)}.`,
      versionId: null,
    });
  }

  const since = input.since ?? null;
  return events
    .filter((event) => (since === null ? true : event.at > since))
    .sort((a, b) => (a.at > b.at ? -1 : 1));
};

/** How many things have happened since somebody last looked. */
export const activityCount = (events: readonly ActivityEvent[]): number => events.length;
