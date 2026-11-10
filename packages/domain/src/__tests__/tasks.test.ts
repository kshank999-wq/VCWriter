import { describe, expect, it } from 'vitest';
import {
  assignmentSchema,
  filterTasks,
  markupSchema,
  seatSchema,
  sortTasks,
  submissionSchema,
  taskMetrics,
  taskReport,
  tasksFrom,
  workIn,
} from '../index.js';

/** Tasks on the board (addendum 07 §29; workflow spec v1.1). */

const T = '2026-11-10T00:00:00.000Z';
const TODAY = '2026-11-10';
const ask = (over: Record<string, unknown> = {}) =>
  assignmentSchema.parse({ id: 'a1', roomId: 'r', assigneeId: 'jo', assignedBy: 'sr', note: 'Tighten the cold open.', createdAt: T, updatedAt: T, ...over });
const sent = (over: Record<string, unknown> = {}) =>
  submissionSchema.parse({ id: 's1', roomId: 'r', versionId: 'v1', authorId: 'jo', assignmentId: 'a1', createdAt: T, updatedAt: T, ...over });
const marked = (over: Record<string, unknown> = {}) =>
  markupSchema.parse({ id: 'm1', roomId: 'r', versionId: 'v1', authorId: 'sr', recipientId: 'jo', note: 'Shorter.', sentAt: T, createdAt: T, ...over });

const one = (input: { assignments?: unknown[]; submissions?: unknown[]; markups?: unknown[] }) =>
  tasksFrom(
    workIn({
      assignments: (input.assignments ?? [ask()]) as never,
      submissions: (input.submissions ?? []) as never,
      markups: (input.markups ?? []) as never,
    }),
    TODAY,
  )[0]!;

describe('status', () => {
  it('reads one status from the facts, and puts it in one column', () => {
    expect(one({})).toMatchObject({ status: 'assigned', column: 'todo', actor: 'writer' });
    expect(one({ assignments: [ask({ state: 'in_progress' })] })).toMatchObject({ status: 'in_progress', column: 'in_progress' });
    expect(one({ submissions: [sent()] })).toMatchObject({ status: 'submitted', column: 'review', actor: 'showrunner', versions: 1 });
    expect(one({ submissions: [sent({ state: 'revision_requested' })] })).toMatchObject({ status: 'needs_revision', column: 'in_progress' });
    expect(one({ submissions: [sent()], markups: [marked()] }).status).toBe('needs_revision');
    expect(one({ submissions: [sent({ state: 'approved' })] })).toMatchObject({ status: 'approved', column: null, contribution: 'approved' });
    expect(one({ submissions: [sent({ state: 'incorporated' })] })).toMatchObject({ status: 'integrated', contribution: 'integrated' });
    expect(one({ assignments: [ask({ state: 'done' })], submissions: [sent({ state: 'approved' })] })).toMatchObject({
      status: 'completed',
      column: null,
      actor: 'none',
    });
    expect(one({ assignments: [ask({ state: 'cancelled' })] }).status).toBe('cancelled');
  });

  it('keeps closed-but-unused work distinct from integrated work', () => {
    expect(one({ assignments: [ask({ state: 'done' })], submissions: [sent({ state: 'rejected' })] }).contribution).toBe('not_used');
  });

  it('is late only while in flight and only with a date', () => {
    expect(one({ assignments: [ask({ dueOn: '2026-11-01' })] }).overdue).toBe(true);
    expect(one({ assignments: [ask({ dueOn: '2026-11-01', state: 'done' })] }).overdue).toBe(false);
    expect(one({ assignments: [ask()] }).overdue).toBe(false);
  });
});

describe('the board', () => {
  const tasks = tasksFrom(
    workIn({
      assignments: [
        ask({ id: 'a1' }),
        ask({ id: 'a2', assigneeId: 'mara', dueOn: '2026-11-01' }),
        ask({ id: 'a3', assigneeId: 'mara', state: 'done' }),
      ],
      submissions: [sent({ id: 's2', assignmentId: 'a2', authorId: 'mara' })],
      markups: [],
    }),
    TODAY,
  );

  it('puts what the viewer must act on first', () => {
    const forShowrunner = sortTasks(tasks, { userId: 'sr', showrunner: true });
    expect(forShowrunner[0]!.status).toBe('submitted');
    const forJo = sortTasks(tasks, { userId: 'jo', showrunner: false });
    expect(forJo[0]!.ownerId).toBe('jo');
  });

  it('counts from statuses, and a writer counts only their own', () => {
    const sr = taskMetrics(tasks, { userId: 'sr', showrunner: true });
    expect(sr.find((m) => m.key === 'review')!.count).toBe(1);
    expect(sr.find((m) => m.key === 'completed')!.count).toBe(1);
    const jo = taskMetrics(tasks, { userId: 'jo', showrunner: false });
    expect(jo.find((m) => m.key === 'assigned')!.count).toBe(1);
    expect(jo.find((m) => m.key === 'review')!.count).toBe(0);
  });

  it('filters by section and writer', () => {
    expect(filterTasks(tasks, { section: 'board' })).toHaveLength(2);
    expect(filterTasks(tasks, { section: 'archive' })).toHaveLength(1);
    expect(filterTasks(tasks, { writer: 'mara' })).toHaveLength(2);
  });

  it('reports by writer with totals matching the rows, and a writer sees only their own', () => {
    const seats = [
      seatSchema.parse({ id: 'x', roomId: 'r', userId: 'jo', role: 'writer', displayName: 'Jo Smith', email: 'jo@x', createdAt: T, updatedAt: T, invitedAt: T }),
      seatSchema.parse({ id: 'y', roomId: 'r', userId: 'mara', role: 'writer', displayName: 'Mara Lee', email: 'mara@x', createdAt: T, updatedAt: T, invitedAt: T }),
    ];
    const all = taskReport({ tasks, seats, viewer: { userId: 'sr', showrunner: true }, scope: 'all', group: 'writer' });
    expect(all.total).toBe(3);
    expect(all.sections.map((s) => s.title)).toEqual(['Jo Smith', 'Mara Lee']);
    expect(all.sections.reduce((n, s) => n + s.rows.length, 0)).toBe(all.total);
    const active = taskReport({ tasks, seats, viewer: { userId: 'sr', showrunner: true }, scope: 'active', group: 'writer' });
    expect(active.total).toBe(2);
    const jo = taskReport({ tasks, seats, viewer: { userId: 'jo', showrunner: false }, scope: 'all', group: 'writer' });
    expect(jo.total).toBe(1);
    expect(jo.sections[0]!.initials).toBe('JS');
  });
});

describe('one task for several writers (§34)', () => {
  it('links the writers’ tasks, and compares their latest versions', async () => {
    const { groupSiblings, groupSize, groupVersions } = await import('../index.js');
    const tasks = tasksFrom(
      workIn({
        assignments: [
          ask({ id: 'g1', assigneeId: 'jo', groupId: 'grp' }),
          ask({ id: 'g2', assigneeId: 'mara', groupId: 'grp' }),
          ask({ id: 'g3', assigneeId: 'ab', groupId: 'grp' }),
          ask({ id: 'solo', assigneeId: 'jo' }),
        ],
        submissions: [
          sent({ id: 's-jo', assignmentId: 'g1', versionId: 'v-jo' }),
          sent({ id: 's-mara', assignmentId: 'g2', authorId: 'mara', versionId: 'v-mara' }),
        ],
        markups: [],
      }),
      TODAY,
    );
    const jo = tasks.find((one) => one.assignment?.id === 'g1')!;
    const solo = tasks.find((one) => one.assignment?.id === 'solo')!;
    expect(groupSiblings(tasks, jo).map((one) => one.ownerId).sort()).toEqual(['ab', 'mara']);
    expect(groupSize(tasks, jo)).toBe(3);
    expect(groupVersions(tasks, jo)).toEqual(['v-jo', 'v-mara']);
    expect(groupSiblings(tasks, solo)).toEqual([]);
    expect(groupSize(tasks, solo)).toBe(1);
  });
});

describe('priority (§35)', () => {
  it('puts urgent and high work ahead of normal and low, after what needs action and what is late', () => {
    const tasks = tasksFrom(
      workIn({
        assignments: [
          ask({ id: 'low', assigneeId: 'mara', priority: 'low' }),
          ask({ id: 'urgent', assigneeId: 'mara', priority: 'urgent' }),
          ask({ id: 'normal', assigneeId: 'mara' }),
          ask({ id: 'high', assigneeId: 'mara', priority: 'high' }),
        ],
        submissions: [],
        markups: [],
      }),
      TODAY,
    );
    expect(sortTasks(tasks, { userId: 'sr', showrunner: true }).map((one) => one.assignment!.id)).toEqual(['urgent', 'high', 'normal', 'low']);
  });

  it('reads an assignment saved before priorities as normal', () => {
    expect(ask().priority).toBe('normal');
  });
});

describe('episodes in a series room (§36)', () => {
  it('names each task’s episode, filters and reports by it, and offers whole episodes to assign', async () => {
    const d = await import('../index.js');
    let file = d.createProjectFile({ title: 'Harbour', format: 'series' });
    file = { ...file, units: [], beats: [], markers: [] };
    const pilot = d.addEpisode(file, { title: 'Pilot' });
    file = pilot.file;
    const wreck = d.addEpisode(file, { title: 'The Wreck' });
    file = wreck.file;
    const wreckBeat = wreck.episode.beats[0]!;

    const things = d.assignableThings(file);
    expect(things.filter((one) => one.kind === 'episode').map((one) => one.label)).toEqual(['Episode 1 — Pilot', 'Episode 2 — The Wreck']);
    expect(things.find((one) => one.kind === 'beat' && one.id === (wreckBeat.id as string))?.episode).toBe('Episode 2 — The Wreck');

    const tag = d.episodeForTarget(file, { kind: 'beat', id: wreckBeat.id as string })!;
    expect(tag).toMatchObject({ short: 'EP 2', label: 'Episode 2 — The Wreck' });
    expect(d.episodeForTarget(file, { kind: 'episode', id: pilot.episode.marker.id as string })!.short).toBe('EP 1');

    const tasks = tasksFrom(
      workIn({
        assignments: [
          ask({ id: 'w', targetKind: 'beat', targetId: wreckBeat.id, targetLabel: 'The search' }),
          ask({ id: 'p', targetKind: 'episode', targetId: pilot.episode.marker.id, targetLabel: 'Episode 1 — Pilot' }),
          ask({ id: 'n', note: 'Research tides.' }),
        ],
        submissions: [],
        markups: [],
      }),
      TODAY,
      (assignment) => d.episodeForTarget(file, { kind: assignment.targetKind, id: assignment.targetId }),
    );
    const w = tasks.find((one) => one.assignment!.id === 'w')!;
    expect(d.taskPlace(w)).toBe('EP 2 · Beat · The search');
    expect(d.taskPlace(tasks.find((one) => one.assignment!.id === 'p')!)).toBe('Episode 1 — Pilot');
    expect(filterTasks(tasks, { episode: tag.key }).map((one) => one.assignment!.id)).toEqual(['w']);

    const report = taskReport({ tasks, seats: [], viewer: { userId: 'sr', showrunner: true }, scope: 'all', group: 'episode' });
    expect(report.sections.map((one) => one.title)).toEqual(['Episode 1 — Pilot', 'Episode 2 — The Wreck', 'No episode']);
    expect(report.total).toBe(3);
  });
});
