import type { Assignment } from './assignment.js';
import { askTitle } from './assignment.js';
import type { Markup } from './markup.js';
import type { Submission } from './submission.js';

/**
 * A writer's work in the room, one card each (addendum 07 §28).
 *
 * From Ken: *the assignments will be in one color and then the ones that were
 * initiated by the writer will be in a separate color. And when they send it to
 * be reviewed, that will be where the markups happen. And then when things are
 * marked up, it shows something on the assignment.*
 *
 * Two kinds of card. An **assignment** is work the showrunner gave out, and
 * everything sent for it gathers on its card. **Own work** is something a
 * writer sent without being asked: each such submission is a card of its own.
 * Every card says where it stands, read from the facts already recorded (the
 * assignment's state, what was sent for it, what came back marked up) rather
 * than kept as a second copy that could disagree.
 */

export type WorkKind = 'assignment' | 'own';

export const WORK_KIND_NAMES: Record<WorkKind, string> = {
  assignment: 'Assignment',
  own: 'Own work',
};

/** Where a card stands, in the order work moves. */
export const WORK_STAGES = ['assigned', 'in_progress', 'sent', 'marked_up', 'done', 'called_off'] as const;
export type WorkStage = (typeof WORK_STAGES)[number];

export const WORK_STAGE_NAMES: Record<WorkStage, string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  sent: 'Sent for review',
  marked_up: 'Marked up',
  done: 'Done',
  called_off: 'Called off',
};

/** What each stage asks of whom, for the legend. */
export const WORK_STAGE_MEANINGS: Record<WorkStage, string> = {
  assigned: 'Given out, not started yet',
  in_progress: 'The writer is working on it',
  sent: 'Waiting for the showrunner to read',
  marked_up: 'Back to the writer with marks to work on',
  done: 'Finished',
  called_off: 'No longer wanted; kept on record',
};

export interface WorkItem {
  /** Unique across both kinds: `a:<assignment id>` or `s:<submission id>`. */
  key: string;
  kind: WorkKind;
  /** Whose work it is. */
  ownerId: string;
  title: string;
  /** What was asked, or what the writer said about it. */
  note: string;
  dueOn: string | null;
  createdAt: string;
  stage: WorkStage;
  assignment: Assignment | null;
  /** What was sent for it, newest first. */
  submissions: Submission[];
  /** Markups on what was sent, newest first. Archived ones included, marked. */
  markups: Markup[];
  /** Markups the owner has not opened yet. */
  unseen: number;
}

const newestFirst = <T extends { createdAt: string }>(list: T[]): T[] =>
  [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const stageOf = (input: {
  assignment: Assignment | null;
  latest: Submission | null;
  latestMarkups: Markup[];
}): WorkStage => {
  const { assignment, latest, latestMarkups } = input;
  if (assignment?.state === 'cancelled') return 'called_off';
  if (assignment?.state === 'done') return 'done';
  if (latest) {
    if (latest.state === 'approved' || latest.state === 'incorporated') return 'done';
    // A markup still open on the latest thing sent is the writer's next job.
    if (latestMarkups.some((markup) => !markup.archivedAt) || latest.state === 'revision_requested') return 'marked_up';
    if (latest.state === 'submitted' || latest.state === 'in_review' || latest.state === 'draft') return 'sent';
    if (latest.state === 'rejected') return assignment ? 'in_progress' : 'done';
  }
  if (assignment?.state === 'in_progress') return 'in_progress';
  return 'assigned';
};

/** Every card in the room, assignments first by due date, then own work, newest first. */
export const workIn = (input: {
  assignments: readonly Assignment[];
  submissions: readonly Submission[];
  markups: readonly Markup[];
}): WorkItem[] => {
  const markupsOn = (submissions: Submission[]): Markup[] => {
    const versions = new Set(submissions.map((one) => one.versionId));
    return newestFirst(input.markups.filter((markup) => versions.has(markup.versionId)));
  };
  const card = (base: Omit<WorkItem, 'stage' | 'markups' | 'unseen'>): WorkItem => {
    const markups = markupsOn(base.submissions);
    const latest = base.submissions[0] ?? null;
    const latestMarkups = latest ? markups.filter((markup) => markup.versionId === latest.versionId) : [];
    return {
      ...base,
      markups,
      stage: stageOf({ assignment: base.assignment, latest, latestMarkups }),
      unseen: markups.filter((markup) => markup.recipientId === base.ownerId && markup.state === 'sent' && !markup.archivedAt).length,
    };
  };

  const assigned = input.assignments.map((assignment) =>
    card({
      key: `a:${assignment.id}`,
      kind: 'assignment',
      ownerId: assignment.assigneeId,
      title: askTitle(assignment),
      note: assignment.note,
      dueOn: assignment.dueOn,
      createdAt: assignment.createdAt,
      assignment,
      submissions: newestFirst(input.submissions.filter((one) => one.assignmentId === assignment.id)),
    }),
  );
  const own = input.submissions
    .filter((one) => !one.assignmentId || !input.assignments.some((a) => a.id === one.assignmentId))
    .map((submission) =>
      card({
        key: `s:${submission.id}`,
        kind: 'own',
        ownerId: submission.authorId,
        title: submission.note.trim() || (submission.kind === 'research' ? 'Ideas sent in' : 'A pass on the script'),
        note: submission.note,
        dueOn: null,
        createdAt: submission.createdAt,
        assignment: null,
        submissions: [submission],
      }),
    );

  const byDue = (a: WorkItem, b: WorkItem) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  };
  return [...assigned.sort(byDue), ...newestFirst(own)];
};

/** One person's cards. */
export const workOf = (items: readonly WorkItem[], userId: string): WorkItem[] =>
  items.filter((item) => item.ownerId === userId);

/** How many of a person's cards are waiting on them (assigned, in progress or marked up). */
export const workWaitingOn = (items: readonly WorkItem[], userId: string): number =>
  workOf(items, userId).filter((item) => item.stage === 'assigned' || item.stage === 'in_progress' || item.stage === 'marked_up').length;
