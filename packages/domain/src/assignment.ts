import { z } from 'zod';
import { roleCan, seatName, type RoomRole, type Seat } from './room.js';
import { researchItemsIn } from './selectors.js';
import type { ProjectFile } from './project-file.js';

/**
 * Assignments, and the menu that makes them (addendum 07 §8, stage 8).
 *
 * Ken: *if a specific person is assigned to a task, there needs to be a menu
 * for that to assign tasks*.
 *
 * **An assignment is not a lock**, and that is the sentence the whole file is
 * written around. It says who is *expected* to write something; it does not
 * stop anybody else writing it, because a room where two writers took a run at
 * the same scene is a room working properly, and §1 exists so that both runs
 * survive. Nothing in the write path consults any of this, deliberately: if a
 * later stage ever wants a lock, it will be a separate and explicit act by the
 * showrunner (§9), with its own name.
 *
 * It is one fact seen from three angles — the writer's landing page, a badge on
 * the scene itself, and the dashboard column that says who owes what — so it is
 * one row, and all three read it rather than each keeping their own.
 */

// ------------------------------------------------------------------ target

/**
 * What an assignment can point at.
 *
 * Four things §8 names, and **nothing**, which matters as much as the four: an
 * assignment with no target is a task — *write the cold open*, *find out how a
 * coroner's inquest actually runs* — and that is what Ken asked for when he
 * said *assign tasks*. A room gives out work that has not been written yet, so
 * insisting every assignment name an existing record would be insisting the
 * work exist before it is asked for.
 */
export const ASSIGNMENT_TARGETS = ['scene', 'beat', 'act', 'research'] as const;
export const assignmentTargetSchema = z.enum(ASSIGNMENT_TARGETS);
export type AssignmentTarget = (typeof ASSIGNMENT_TARGETS)[number];

export const TARGET_NAMES: Record<AssignmentTarget, string> = {
  scene: 'Scene',
  beat: 'Beat',
  act: 'Act',
  research: 'Research',
};

export const ASSIGNMENT_STATES = ['assigned', 'accepted', 'in_progress', 'done', 'cancelled'] as const;
export const assignmentStateSchema = z.enum(ASSIGNMENT_STATES);
export type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

export const ASSIGNMENT_STATE_NAMES: Record<AssignmentState, string> = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'Being written',
  done: 'Done',
  cancelled: 'Called off',
};

export const assignmentSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** Who it is being asked of. A person, never a role. */
  assigneeId: z.string(),
  /** Who asked. Kept even after they leave the room — §16, authorship stays. */
  assignedBy: z.string().nullable().default(null),
  /**
   * What it is about, where it is about something that exists.
   *
   * **No foreign key behind this, on purpose.** The record it names lives in
   * the project *document*, and every branch carries its own copy of the
   * master's scenes under the same ids — which is exactly what makes an
   * assignment mean the same thing on four writers' lines at once. A foreign
   * key would tie it to the master's row and quietly stop being true the
   * moment somebody worked on a branch.
   */
  targetKind: assignmentTargetSchema.nullable().default(null),
  targetId: z.string().nullable().default(null),
  /** What the record was called when it was assigned, so a row still reads
   *  after the scene is renamed or the writer cannot see it. */
  targetLabel: z.string().default(''),
  /** What is being asked for. The whole assignment where there is no target. */
  note: z.string().default(''),
  /** When it is wanted, as a plain date — a room works in days, not minutes. */
  dueOn: z.string().nullable().default(null),
  state: assignmentStateSchema.default('assigned'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

// ------------------------------------------------------------- who may act

/** Whether this role gives out work (§7 — the showrunner's, and only theirs). */
export const canAssign = (role: RoomRole | null): boolean => role !== null && roleCan(role, 'assign');

/**
 * The states a person may put their *own* assignment into.
 *
 * They say how their own work is going; they do not call it off, because
 * calling it off is the showrunner unasking for it. The same split stage 6
 * made for submissions, and for the same reason: row-level security is
 * row-level, so *which fields* is a question the database answers with a
 * trigger and this list is what that trigger enforces.
 */
export const ASSIGNEE_STATES: readonly AssignmentState[] = ['accepted', 'in_progress', 'done'];

export const assigneeMaySet = (state: AssignmentState): boolean => ASSIGNEE_STATES.includes(state);

export type AssignRefusal =
  | { reason: 'cannot_assign' }
  | { reason: 'no_such_seat' }
  | { reason: 'seat_gone' }
  | { reason: 'nothing_asked' };

export const assignRefusalText = (refusal: AssignRefusal): string => {
  switch (refusal.reason) {
    case 'cannot_assign':
      return 'Giving out work is the showrunner’s.';
    case 'no_such_seat':
      return 'That person is not in this room.';
    case 'seat_gone':
      return 'That seat has been taken out of the room.';
    case 'nothing_asked':
      return 'Say what is being asked for, or point it at something.';
  }
};

/**
 * Whether this assignment can be made, and why not where it cannot.
 *
 * An invited seat *can* be assigned to, deliberately: giving somebody work
 * before they have answered the invitation is how a room actually runs, and the
 * assignment is waiting for them when they arrive.
 */
export const canMakeAssignment = (input: {
  role: RoomRole | null;
  seats: readonly Seat[];
  assigneeId: string;
  targetKind: AssignmentTarget | null;
  note: string;
}): true | AssignRefusal => {
  if (!canAssign(input.role)) return { reason: 'cannot_assign' };
  const seat = input.seats.find((one) => one.userId === input.assigneeId);
  if (!seat) return { reason: 'no_such_seat' };
  if (seat.state === 'deactivated') return { reason: 'seat_gone' };
  if (!input.targetKind && input.note.trim().length === 0) return { reason: 'nothing_asked' };
  return true;
};

// ------------------------------------------------------- the states, moved

/**
 * Where an assignment can go from where it is.
 *
 * **Nothing here is one-way**, which is the difference from a submission's
 * states: `incorporated` is a fact about the master and cannot be unsaid, but
 * *done* is somebody's opinion of their own morning and *called off* is the
 * showrunner changing their mind, and a room changes its mind constantly. So
 * every state reaches every other, and the list is written out rather than
 * derived to say that on purpose rather than by accident.
 */
const AFTER: Record<AssignmentState, readonly AssignmentState[]> = {
  assigned: ['accepted', 'in_progress', 'done', 'cancelled'],
  accepted: ['in_progress', 'done', 'assigned', 'cancelled'],
  in_progress: ['done', 'accepted', 'assigned', 'cancelled'],
  done: ['in_progress', 'accepted', 'assigned', 'cancelled'],
  cancelled: ['assigned', 'accepted', 'in_progress'],
};

export const nextAssignmentStates = (state: AssignmentState): AssignmentState[] => [...AFTER[state]];

export const canMoveAssignment = (from: AssignmentState, to: AssignmentState): boolean =>
  AFTER[from].includes(to);

/** Whether somebody still owes this. The number a dashboard counts. */
export const isOwed = (assignment: Pick<Assignment, 'state'>): boolean =>
  assignment.state === 'assigned' || assignment.state === 'accepted' || assignment.state === 'in_progress';

/** Whether it is late, given the day the room is looking at it on. */
export const isOverdue = (assignment: Pick<Assignment, 'state' | 'dueOn'>, today: string): boolean =>
  isOwed(assignment) && assignment.dueOn !== null && assignment.dueOn < today.slice(0, 10);

// --------------------------------------------------------------- reading it

/**
 * What a writer is told about what they have been asked for.
 *
 * Said from their side, the way `standingOf` says a submission from the
 * writer's: *you have not started this* is a truer thing to show somebody than
 * *assigned*, which describes a row.
 */
export const askedOf = (assignment: Assignment): string => {
  switch (assignment.state) {
    case 'assigned':
      return 'Waiting on you. Nothing is locked — anybody can write it, and both passes survive.';
    case 'accepted':
      return 'You have taken it.';
    case 'in_progress':
      return 'You are writing it.';
    case 'done':
      return 'You have called it done. Submit it when you want it read.';
    case 'cancelled':
      return 'Called off. Anything you wrote for it is still yours and still here.';
  }
};

/** What the assignment is about, in one line: the record, or the ask itself. */
export const describeAssignment = (assignment: Assignment): string => {
  const label = assignment.targetLabel.trim();
  const note = assignment.note.trim();
  if (label.length > 0 && assignment.targetKind) {
    return note.length > 0 ? `${TARGET_NAMES[assignment.targetKind]} — ${label}: ${note}` : `${TARGET_NAMES[assignment.targetKind]} — ${label}`;
  }
  return note.length > 0 ? note : 'A task with nothing said about it.';
};

/**
 * The short name of an ask: the record, or the task itself.
 *
 * `describeAssignment` carries the note as well, which is right on a card and
 * wrong in a running sentence — *asked Mara for Act Two: find where it turns..*
 * ends with two full stops because the note brought its own.
 */
export const askTitle = (assignment: Assignment): string => {
  const label = assignment.targetLabel.trim();
  if (label.length > 0 && assignment.targetKind) return `${TARGET_NAMES[assignment.targetKind]} — ${label}`;
  const note = assignment.note.trim();
  return note.length > 0 ? note.replace(/[.!?]+$/, '') : 'a task';
};

/** Who it is being asked of, for a row on the dashboard. */
export const assigneeName = (assignment: Assignment, seats: readonly Seat[]): string => {
  const seat = seats.find((one) => one.userId === assignment.assigneeId);
  return seat ? seatName(seat) : 'Somebody no longer in the room';
};

/**
 * What one person has been asked for, newest ask first.
 *
 * Newest first here and oldest first in the review queue, and the difference is
 * real rather than an inconsistency: a queue is other people waiting on you, so
 * the oldest is the one you owe most; a list of what you have been asked for is
 * your own, and the newest is the one you have not seen yet.
 */
export const assignmentsFor = (assignments: readonly Assignment[], userId: string): Assignment[] =>
  assignments
    .filter((one) => one.assigneeId === userId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

/** What is still owed on a record, so a scene can wear a badge. */
export const assignmentsOn = (
  assignments: readonly Assignment[],
  target: { kind: AssignmentTarget; id: string },
): Assignment[] =>
  assignments.filter(
    (one) => one.targetKind === target.kind && one.targetId === target.id && one.state !== 'cancelled',
  );

/** One row of the dashboard column that says who owes what. */
export interface OwedRow {
  seat: Seat;
  owed: Assignment[];
  overdue: number;
}

/**
 * Who owes what, by seat.
 *
 * Every active seat, including the ones who owe nothing: a dashboard that only
 * lists people with work is a dashboard that cannot answer *who is free*, which
 * is the question a showrunner is usually asking when they look at it.
 */
export const owedBySeat = (input: {
  assignments: readonly Assignment[];
  seats: readonly Seat[];
  today: string;
}): OwedRow[] =>
  input.seats
    .filter((seat) => seat.state !== 'deactivated')
    .map((seat) => {
      const owed = input.assignments.filter(
        (one) => one.assigneeId === seat.userId && isOwed(one),
      );
      return {
        seat,
        owed,
        overdue: owed.filter((one) => isOverdue(one, input.today)).length,
      };
    });

/** The one line under a seat's name on the dashboard. */
export const owedNote = (row: OwedRow): string => {
  if (row.owed.length === 0) return 'Nothing outstanding.';
  const many = row.owed.length === 1 ? '1 thing' : `${row.owed.length} things`;
  return row.overdue > 0 ? `${many} outstanding, ${row.overdue} past its date.` : `${many} outstanding.`;
};

// --------------------------------------------------- what a menu can point at

/** Something the Assign menu can offer, read out of the project itself. */
export interface AssignableThing {
  kind: AssignmentTarget;
  id: string;
  label: string;
}

/**
 * What there is to assign, in the order the story is in.
 *
 * Read out of the document rather than kept in the room, because the room does
 * not hold a story — it holds people, and the story is the project. Acts come
 * from the markers, scenes and beats from the structure, and research from the
 * items, which is the four things §8 names and nothing else.
 */
export const assignableThings = (file: ProjectFile): AssignableThing[] => {
  const acts: AssignableThing[] = file.markers
    .filter((marker) => marker.kind === 'act')
    .map((marker) => ({ kind: 'act' as const, id: marker.id as string, label: marker.title || 'Act' }));

  const scenes: AssignableThing[] = file.units.map((unit) => ({
    kind: 'scene' as const,
    id: unit.id as string,
    label: unit.title || 'Untitled scene',
  }));

  const beats: AssignableThing[] = file.beats.map((beat) => ({
    kind: 'beat' as const,
    id: beat.id as string,
    label: beat.title || 'Untitled beat',
  }));

  const research: AssignableThing[] = file.researchCategories.flatMap((category) =>
    researchItemsIn(file, { categoryId: category.id }).map((item) => ({
      kind: 'research' as const,
      id: item.id as string,
      label: item.title || 'Untitled',
    })),
  );

  return [...acts, ...scenes, ...beats, ...research];
};

/** What a target is called now, for putting on a fresh assignment. */
export const labelFor = (
  file: ProjectFile,
  target: { kind: AssignmentTarget; id: string },
): string =>
  assignableThings(file).find((one) => one.kind === target.kind && one.id === target.id)?.label ?? '';
