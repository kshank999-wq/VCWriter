import { seatInitials, seatName, type Seat } from './room.js';
import { TARGET_NAMES } from './assignment.js';
import type { WorkItem } from './work.js';

/**
 * The room's work as tasks on a board (addendum 07 §29; workflow spec v1.1).
 *
 * From the spec: *workflow state is the navigation backbone.* Every card the
 * room already draws (§28) gets one task status, read from the facts already
 * recorded: the assignment's state, the latest submission's state, and any open
 * markup on it. Nothing is kept as a second copy that could disagree.
 *
 * **Lifecycle and integration are separate questions.** A task's status says
 * who acts next; its contribution state says whether the writer's words reached
 * the master. A closed task can hold approved work that was never used.
 */

export const TASK_STATUSES = [
  'assigned',
  'in_progress',
  'needs_revision',
  'submitted',
  'approved',
  'integrated',
  'completed',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_NAMES: Record<TaskStatus, string> = {
  assigned: 'Not started',
  in_progress: 'In progress',
  needs_revision: 'Needs revision',
  submitted: 'Awaiting review',
  approved: 'Approved',
  integrated: 'Integrated',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** What the indicator says beside the colour, so colour is never the only signal. */
export const TASK_STATUS_HINTS: Record<TaskStatus, string> = {
  assigned: 'Given out, not started yet',
  in_progress: 'The writer is working on it',
  needs_revision: 'Returned with notes; the writer revises and resubmits',
  submitted: 'Sent in; the showrunner reads it next',
  approved: 'Approved, not yet in the master',
  integrated: 'In the master',
  completed: 'Closed by the showrunner; kept in the archive',
  cancelled: 'Called off; kept on record',
};

/**
 * The status's tone (spec §8): red not started, yellow working, a distinct
 * blue for awaiting review so a submission is never mistaken for finished,
 * green for done in its three degrees, grey for cancelled.
 */
export type TaskTone = 'red' | 'yellow' | 'blue' | 'green-outline' | 'green' | 'green-archived' | 'grey';
export const TASK_STATUS_TONES: Record<TaskStatus, TaskTone> = {
  assigned: 'red',
  in_progress: 'yellow',
  needs_revision: 'yellow',
  submitted: 'blue',
  approved: 'green-outline',
  integrated: 'green',
  completed: 'green-archived',
  cancelled: 'grey',
};

export type TaskActor = 'writer' | 'showrunner' | 'none';
export const TASK_ACTORS: Record<TaskStatus, TaskActor> = {
  assigned: 'writer',
  in_progress: 'writer',
  needs_revision: 'writer',
  submitted: 'showrunner',
  approved: 'showrunner',
  integrated: 'showrunner',
  completed: 'none',
  cancelled: 'none',
};

/** The board holds work in flight, in three columns. */
export const BOARD_COLUMNS = ['todo', 'in_progress', 'review'] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];
export const BOARD_COLUMN_NAMES: Record<BoardColumn, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Awaiting Review',
};

export const columnOf = (status: TaskStatus): BoardColumn | null => {
  switch (status) {
    case 'assigned':
      return 'todo';
    case 'in_progress':
    case 'needs_revision':
      return 'in_progress';
    case 'submitted':
      return 'review';
    default:
      return null;
  }
};

/** The left-hand workflow menu: the same stages for every role (spec §3.1). */
export const WORKFLOW_SECTIONS = [
  'board',
  'assigned',
  'in_progress',
  'review',
  'needs_revision',
  'approved',
  'archive',
  'contributions',
  'permissions',
] as const;
export type WorkflowSection = (typeof WORKFLOW_SECTIONS)[number];

export const workflowSectionName = (section: WorkflowSection, showrunner: boolean): string => {
  switch (section) {
    case 'board':
      return 'Board';
    case 'assigned':
      return 'Assignments';
    case 'in_progress':
      return 'In Progress';
    case 'review':
      return 'Awaiting Review';
    case 'needs_revision':
      return 'Needs Revision';
    case 'approved':
      return 'Approved / Integrated';
    case 'archive':
      return 'Completed / Archive';
    case 'contributions':
      return showrunner ? 'Contributions by Writer' : 'My Contributions';
    case 'permissions':
      return 'Permission Requests';
  }
};

export const inSection = (task: Pick<Task, 'status' | 'kind'>, section: WorkflowSection): boolean => {
  switch (section) {
    case 'board':
      return columnOf(task.status) !== null;
    case 'assigned':
      return task.status === 'assigned';
    case 'in_progress':
      return task.status === 'in_progress' || task.status === 'needs_revision';
    case 'review':
      return task.status === 'submitted';
    case 'needs_revision':
      return task.status === 'needs_revision';
    case 'approved':
      return task.status === 'approved' || task.status === 'integrated';
    case 'archive':
      return task.status === 'completed' || task.status === 'cancelled';
    case 'contributions':
      return true;
    // Requests, not tasks: drawn from their own list.
    case 'permissions':
      return false;
  }
};

/** Whether a writer's words reached the master (spec §7). */
export const CONTRIBUTION_STATES = ['pending', 'approved', 'integrated', 'not_used'] as const;
export type ContributionState = (typeof CONTRIBUTION_STATES)[number];
export const CONTRIBUTION_STATE_NAMES: Record<ContributionState, string> = {
  pending: 'Not decided yet',
  approved: 'Approved, not yet in the master',
  integrated: 'Integrated',
  not_used: 'Not used',
};

export interface Task extends WorkItem {
  status: TaskStatus;
  column: BoardColumn | null;
  actor: TaskActor;
  /** Submissions sent for it: v1, v2 … */
  versions: number;
  /** The newest thing that happened to it. */
  updatedAt: string;
  overdue: boolean;
  contribution: ContributionState;
}

const latestOf = (item: WorkItem) => item.submissions[0] ?? null;

/** The one status a card carries. */
export const taskStatusOf = (item: WorkItem): TaskStatus => {
  const assignment = item.assignment;
  if (assignment?.state === 'cancelled') return 'cancelled';
  if (assignment?.state === 'done') return 'completed';
  const latest = latestOf(item);
  if (latest) {
    if (latest.state === 'incorporated') return 'integrated';
    if (latest.state === 'approved') return 'approved';
    const openMarkup = item.markups.some((markup) => markup.versionId === latest.versionId && !markup.archivedAt);
    if (latest.state === 'revision_requested' || openMarkup) return 'needs_revision';
    if (latest.state === 'submitted' || latest.state === 'in_review' || latest.state === 'draft') return 'submitted';
    // Not taken: an assignment goes back to its writer; own work is closed.
    if (latest.state === 'rejected') return assignment ? 'needs_revision' : 'cancelled';
  }
  if (assignment?.state === 'in_progress' || assignment?.state === 'accepted') return 'in_progress';
  return 'assigned';
};

export const contributionOf = (item: WorkItem): ContributionState => {
  if (item.submissions.some((one) => one.state === 'incorporated')) return 'integrated';
  if (item.submissions.some((one) => one.state === 'approved')) return 'approved';
  const closed = item.assignment?.state === 'done' || item.assignment?.state === 'cancelled';
  if (item.submissions.length > 0 && (closed || item.submissions.every((one) => one.state === 'rejected'))) return 'not_used';
  return 'pending';
};

const newest = (dates: (string | null | undefined)[]): string =>
  dates.filter((one): one is string => Boolean(one)).sort().pop() ?? '';

/** Every card as a task, with today's date settling what is late. */
export const tasksFrom = (work: readonly WorkItem[], today: string): Task[] =>
  work.map((item) => {
    const status = taskStatusOf(item);
    const live = columnOf(status) !== null;
    return {
      ...item,
      status,
      column: columnOf(status),
      actor: TASK_ACTORS[status],
      versions: item.submissions.length,
      updatedAt: newest([
        item.createdAt,
        item.assignment?.updatedAt,
        ...item.submissions.map((one) => one.updatedAt),
        ...item.markups.map((one) => one.sentAt),
      ]),
      overdue: live && item.dueOn !== null && item.dueOn < today.slice(0, 10),
      contribution: contributionOf(item),
    };
  });

/** Whether the person looking is the one who acts next. */
export const needsActionFrom = (task: Task, viewer: { userId: string; showrunner: boolean }): boolean =>
  (task.actor === 'writer' && task.ownerId === viewer.userId) || (task.actor === 'showrunner' && viewer.showrunner);

/** Actionable first, then overdue, then by date due, then newest activity (spec §12). */
export const sortTasks = (tasks: readonly Task[], viewer: { userId: string; showrunner: boolean }): Task[] =>
  [...tasks].sort((a, b) => {
    const act = Number(needsActionFrom(b, viewer)) - Number(needsActionFrom(a, viewer));
    if (act !== 0) return act;
    const late = Number(b.overdue) - Number(a.overdue);
    if (late !== 0) return late;
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn && !b.dueOn) return -1;
    if (b.dueOn && !a.dueOn) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

/** Where a task sits in the script, for the card: "Beat — B3". */
export const taskPlace = (task: Pick<Task, 'assignment' | 'kind'>): string => {
  const assignment = task.assignment;
  if (assignment?.targetKind && assignment.targetLabel.trim()) {
    return `${TARGET_NAMES[assignment.targetKind]} · ${assignment.targetLabel.trim()}`;
  }
  return task.kind === 'own' ? 'Own work' : 'Task';
};

/**
 * The card's headline. Where the place already names the record, the ask is
 * the more useful line ("Make her hesitate before she hides it"), not the
 * record's name a second time.
 */
export const taskHeadline = (task: Pick<Task, 'assignment' | 'title' | 'note'>): string => {
  const note = task.note.trim().split('\n')[0]!.trim();
  if (task.assignment?.targetKind && task.assignment.targetLabel.trim() && note) return note.replace(/[.!?]+$/, '');
  return task.title;
};

export interface TaskFilter {
  section?: WorkflowSection;
  writer?: string | null;
  status?: TaskStatus | null;
  query?: string;
}

export const filterTasks = (tasks: readonly Task[], filter: TaskFilter): Task[] => {
  const query = (filter.query ?? '').trim().toLowerCase();
  return tasks.filter(
    (task) =>
      (!filter.section || inSection(task, filter.section)) &&
      (!filter.writer || task.ownerId === filter.writer) &&
      (!filter.status || task.status === filter.status) &&
      (!query || `${task.title} ${task.note} ${taskPlace(task)}`.toLowerCase().includes(query)),
  );
};

export interface TaskMetric {
  key: string;
  label: string;
  count: number;
  section: WorkflowSection;
  status?: TaskStatus;
  /** The one this person should do something about. */
  attention: boolean;
}

/**
 * The strip across the top (spec §3.3), counted from statuses rather than kept.
 * A writer's counts are their own tasks; the showrunner's are the room's.
 */
export const taskMetrics = (tasks: readonly Task[], viewer: { userId: string; showrunner: boolean }): TaskMetric[] => {
  const mine = viewer.showrunner ? tasks : tasks.filter((task) => task.ownerId === viewer.userId);
  const count = (status: TaskStatus) => mine.filter((task) => task.status === status).length;
  if (viewer.showrunner) {
    return [
      { key: 'assigned', label: 'Assigned', count: count('assigned'), section: 'assigned', attention: false },
      { key: 'in_progress', label: 'In progress', count: count('in_progress') + count('needs_revision'), section: 'in_progress', attention: false },
      { key: 'review', label: 'Awaiting my review', count: count('submitted'), section: 'review', attention: count('submitted') > 0 },
      { key: 'needs_revision', label: 'Needs revision', count: count('needs_revision'), section: 'needs_revision', attention: false },
      { key: 'approved', label: 'Approved, not integrated', count: count('approved'), section: 'approved', status: 'approved', attention: count('approved') > 0 },
      { key: 'completed', label: 'Completed', count: count('completed'), section: 'archive', status: 'completed', attention: false },
    ];
  }
  return [
    { key: 'assigned', label: 'My assigned', count: count('assigned'), section: 'assigned', attention: count('assigned') > 0 },
    { key: 'in_progress', label: 'My in progress', count: count('in_progress'), section: 'in_progress', status: 'in_progress', attention: false },
    { key: 'needs_revision', label: 'Returned to me', count: count('needs_revision'), section: 'needs_revision', attention: count('needs_revision') > 0 },
    { key: 'review', label: 'Submitted', count: count('submitted'), section: 'review', attention: false },
    { key: 'integrated', label: 'Integrated', count: mine.filter((task) => task.contribution === 'integrated').length, section: 'contributions', attention: false },
  ];
};

// ------------------------------------------------------------- the report

export const REPORT_SCOPES = ['current', 'active', 'all'] as const;
export type ReportScope = (typeof REPORT_SCOPES)[number];
export const REPORT_SCOPE_NAMES: Record<ReportScope, string> = {
  current: 'Current view',
  active: 'All active tasks',
  all: 'Include completed and archive',
};

export const REPORT_GROUPS = ['writer', 'status', 'place'] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];
export const REPORT_GROUP_NAMES: Record<ReportGroup, string> = {
  writer: 'Group by writer',
  status: 'Group by status',
  place: 'Group by scene / beat',
};

export interface ReportRow {
  task: Task;
  writer: string;
  initials: string;
  colour: string;
  place: string;
  nextAction: string;
}

export interface ReportSection {
  key: string;
  title: string;
  initials: string;
  colour: string;
  counts: { outstanding: number; inProgress: number; review: number; revision: number; completed: number };
  rows: ReportRow[];
}

/** What happens next, said for a printed page. */
export const nextActionOf = (task: Task): string => {
  switch (task.status) {
    case 'assigned':
      return 'Writer starts the draft';
    case 'in_progress':
      return 'Writer finishes and submits';
    case 'needs_revision':
      return 'Writer revises and resubmits';
    case 'submitted':
      return 'Showrunner reviews';
    case 'approved':
      return 'Showrunner integrates or closes';
    case 'integrated':
      return 'Showrunner closes';
    case 'completed':
    case 'cancelled':
      return 'None';
  }
};

/**
 * A printable report of tasks (spec §12.1). Rows are whatever the caller was
 * allowed to read, filtered by scope; a writer's report is their own tasks
 * only, whatever is passed. Totals are counted from the rows printed.
 */
export const taskReport = (input: {
  tasks: readonly Task[];
  seats: readonly Seat[];
  viewer: { userId: string; showrunner: boolean };
  scope: ReportScope;
  group: ReportGroup;
  /** The tasks on screen, for the Current view scope. */
  current?: readonly Task[];
}): { sections: ReportSection[]; total: number } => {
  const visible = input.viewer.showrunner ? input.tasks : input.tasks.filter((task) => task.ownerId === input.viewer.userId);
  const scoped =
    input.scope === 'current'
      ? visible.filter((task) => (input.current ?? visible).some((one) => one.key === task.key))
      : input.scope === 'active'
        ? visible.filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
        : visible;
  const rows: ReportRow[] = sortTasks(scoped, input.viewer).map((task) => {
    const seat = input.seats.find((one) => one.userId === task.ownerId) ?? null;
    return {
      task,
      writer: seat ? seatName(seat) : task.ownerId === input.viewer.userId ? 'You' : 'Unassigned',
      initials: seat ? seatInitials(seat) : '—',
      colour: seat?.colour || '#999999',
      place: taskPlace(task),
      nextAction: nextActionOf(task),
    };
  });
  const groups = new Map<string, ReportRow[]>();
  const keyOf = (row: ReportRow) =>
    input.group === 'writer' ? row.writer : input.group === 'status' ? row.task.status : row.place;
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]);
  const order =
    input.group === 'status'
      ? [...groups.keys()].sort((a, b) => TASK_STATUSES.indexOf(a as TaskStatus) - TASK_STATUSES.indexOf(b as TaskStatus))
      : [...groups.keys()].sort((a, b) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)));
  const sections = order.map((key) => {
    const list = groups.get(key)!;
    const first = list[0]!;
    const count = (statuses: TaskStatus[]) => list.filter((row) => statuses.includes(row.task.status)).length;
    return {
      key,
      title: input.group === 'status' ? TASK_STATUS_NAMES[key as TaskStatus] : key,
      initials: input.group === 'writer' ? first.initials : '',
      colour: input.group === 'writer' ? first.colour : '',
      counts: {
        outstanding: count(['assigned']),
        inProgress: count(['in_progress']),
        review: count(['submitted']),
        revision: count(['needs_revision']),
        completed: count(['approved', 'integrated', 'completed']),
      },
      rows: list,
    };
  });
  return { sections, total: rows.length };
};
