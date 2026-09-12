import { z } from 'zod';
import { roleCan, seatName, type RoomRole, type Seat } from './room.js';
import type { Version } from './branch.js';

/**
 * Submitting, and the queue it lands in (addendum 07 §10, stage 6).
 *
 * **One button, and what you are looking at decides where it goes.** That is
 * the whole of the mechanism: you submit *from* somewhere, and the somewhere
 * says what kind of thing it is. The Script, a scene or a beat arrives as a
 * script contribution in the review queue; Research, the Sculptor, the
 * Outliner, a character or an idea arrives as a research contribution in the
 * brainstorming room (§11).
 *
 * Two rules carry the file.
 *
 * **Submitting copies nothing out of the writer's branch.** A submission
 * *references the version it was taken from*, so the writer carries straight on
 * and what the showrunner is reading does not move under them. That is also
 * what makes the whole thing safe: a version cannot be changed once it exists
 * (§9, enforced by a trigger), so what was submitted is what is read.
 *
 * **No state in the list deletes anything** (§1). Rejected is a state, not an
 * erasure: the version is still there, the submission is still there, and a
 * showrunner who rejects the wrong thing has lost nothing but a minute.
 */

export const SUBMISSION_KINDS = ['script', 'research'] as const;
export const submissionKindSchema = z.enum(SUBMISSION_KINDS);
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

/**
 * Where a submission is in its life.
 *
 * `draft` is here for completeness — §10 names it — and nothing in stage 6
 * makes one: pressing Submit submits. It exists so that a writer who wants to
 * prepare a submission before sending it has somewhere for it to sit, rather
 * than the state having to be invented later underneath rows that predate it.
 */
export const SUBMISSION_STATES = [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'revision_requested',
  'rejected',
  'incorporated',
] as const;
export const submissionStateSchema = z.enum(SUBMISSION_STATES);
export type SubmissionState = (typeof SUBMISSION_STATES)[number];

export const STATE_NAMES: Record<SubmissionState, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In review',
  approved: 'Approved',
  revision_requested: 'Revision requested',
  rejected: 'Rejected',
  incorporated: 'Incorporated',
};

export const submissionSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** The branch it came off, so a queue can say whose line it is. */
  branchId: z.string().nullable().default(null),
  /** The version it was taken from. **Never a copy of the work.** */
  versionId: z.string(),
  authorId: z.string(),
  kind: submissionKindSchema.default('script'),
  state: submissionStateSchema.default('submitted'),
  /** What the writer said it is. Empty is allowed; most submissions have one. */
  note: z.string().default(''),
  /** What the showrunner said back, where they have said anything. */
  reply: z.string().default(''),
  decidedBy: z.string().nullable().default(null),
  decidedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Submission = z.infer<typeof submissionSchema>;

// ------------------------------------------------------------ who may act

/** Whether this role may send work for review at all (§7). */
export const canSubmit = (role: RoomRole | null): boolean =>
  role !== null && (roleCan(role, 'submit') || roleCan(role, 'propose'));

/** Whether this role reads the queue and decides what is in it. */
export const canReview = (role: RoomRole | null): boolean => role !== null && roleCan(role, 'curate');

/**
 * Why this person cannot submit from here.
 *
 * A Viewer is in the room to read; an Editor *proposes*, which lands in the
 * same queue through the same door, so the only real refusal is having no
 * standing at all.
 */
export type SubmitRefusal = { reason: 'no_seat' } | { reason: 'cannot_submit' } | { reason: 'nothing_to_submit' };

export const submitRefusalText = (refusal: SubmitRefusal): string => {
  switch (refusal.reason) {
    case 'no_seat':
      return 'You are not in this room.';
    case 'cannot_submit':
      return 'You are in this room to read, not to send work for review.';
    case 'nothing_to_submit':
      return 'There is nothing on this draft to submit yet.';
  }
};

// ------------------------------------------------------- the states, moved

/**
 * Where a submission can go from where it is.
 *
 * Written out rather than derived, because the interesting cases are the ones
 * an ordering gets wrong: **revision_requested goes back to submitted** when
 * the writer sends the next pass, and **anything decided can be reopened**,
 * since a showrunner who rejected the wrong scene at midnight should not have
 * to ask a writer to send it again.
 */
const AFTER: Record<SubmissionState, readonly SubmissionState[]> = {
  draft: ['submitted'],
  submitted: ['in_review', 'approved', 'revision_requested', 'rejected'],
  in_review: ['approved', 'revision_requested', 'rejected', 'submitted'],
  approved: ['incorporated', 'in_review', 'revision_requested', 'rejected'],
  revision_requested: ['submitted', 'in_review', 'rejected'],
  rejected: ['in_review', 'submitted'],
  // The end of the line, and the only one-way door: incorporated means the
  // master carries it (§12), and unsaying that is a change to the master
  // rather than a change to this row.
  incorporated: [],
};

export const nextStates = (state: SubmissionState): SubmissionState[] => [...AFTER[state]];

export const canMove = (from: SubmissionState, to: SubmissionState): boolean => AFTER[from].includes(to);

/** Whether the room is still waiting on somebody to look at this. */
export const isOpen = (submission: Pick<Submission, 'state'>): boolean =>
  submission.state === 'submitted' || submission.state === 'in_review' || submission.state === 'draft';

/** Whether a decision has been made and the writer is owed the news. */
export const isDecided = (submission: Pick<Submission, 'state'>): boolean =>
  submission.state === 'approved' ||
  submission.state === 'revision_requested' ||
  submission.state === 'rejected' ||
  submission.state === 'incorporated';

// ----------------------------------------------------------------- the queue

export interface QueueRow {
  submission: Submission;
  /** Who sent it, where the room knows them. The colour is read through here. */
  author: Seat | null;
  /** The version it references, where the reader may see it. */
  version: Version | null;
}

/**
 * The queue, oldest first.
 *
 * **Oldest first, which is the opposite of everywhere else in the product.**
 * A version history is newest-first because the newest is the one you want; a
 * queue is oldest-first because the oldest is the one somebody has been
 * waiting longest for, and a queue that buried it under this morning's would
 * be a queue that quietly punishes whoever submitted first.
 */
export const queueOf = (input: {
  submissions: readonly Submission[];
  seats: readonly Seat[];
  versions: readonly Version[];
  kind?: SubmissionKind;
  /** Only what is still waiting, which is what a queue usually means. */
  openOnly?: boolean;
}): QueueRow[] =>
  input.submissions
    .filter((submission) => (input.kind ? submission.kind === input.kind : true))
    .filter((submission) => (input.openOnly ? isOpen(submission) : true))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    .map((submission) => ({
      submission,
      author: input.seats.find((seat) => seat.userId === submission.authorId) ?? null,
      version: input.versions.find((version) => version.id === submission.versionId) ?? null,
    }));

/** How many are still waiting, which is the number a dashboard shows. */
export const waitingCount = (submissions: readonly Submission[], kind?: SubmissionKind): number =>
  submissions.filter((one) => (kind ? one.kind === kind : true) && isOpen(one)).length;

/**
 * What a row says about itself, in one line.
 *
 * The note where there is one, because that is what the writer wanted read;
 * otherwise what kind of thing it is, which is the only other true thing to
 * say about it.
 */
export const describeSubmission = (submission: Submission): string =>
  submission.note.trim().length > 0
    ? submission.note.trim()
    : submission.kind === 'research'
      ? 'Research and ideas'
      : 'A pass on the script';

/** Who sent it, for the row. */
export const submitterName = (row: QueueRow): string =>
  row.author ? seatName(row.author) : 'Somebody no longer in the room';

/**
 * What the writer is told about their own submission.
 *
 * Said from the writer's side rather than the reviewer's: *waiting to be read*
 * is a truer thing to show somebody than *submitted*, which is a fact about a
 * database row and tells them nothing they did not already know.
 */
export const standingOf = (submission: Submission): string => {
  switch (submission.state) {
    case 'draft':
      return 'Not sent yet.';
    case 'submitted':
      return 'Waiting to be read.';
    case 'in_review':
      return 'Being read now.';
    case 'approved':
      return 'Approved. It goes into the master when the room assembles the next one.';
    case 'revision_requested':
      return 'Sent back for another pass. Your draft is untouched; carry on from where you are.';
    case 'rejected':
      return 'Not taken. Nothing has been deleted — it is still on your line and still here.';
    case 'incorporated':
      return 'In the master.';
  }
};
