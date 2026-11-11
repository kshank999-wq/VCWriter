import {
  BOARD_COLUMNS,
  BOARD_COLUMN_NAMES,
  CONTRIBUTION_STATE_NAMES,
  STATE_NAMES,
  TASK_STATUSES,
  TASK_STATUS_HINTS,
  TASK_STATUS_NAMES,
  TASK_STATUS_TONES,
  WORKFLOW_SECTIONS,
  WORK_KIND_NAMES,
  filterTasks,
  needsActionFrom,
  nextActionOf,
  seatInitials,
  seatName,
  sortTasks,
  taskMetrics,
  taskPlace,
  taskHeadline,
  groupSiblings,
  groupSize,
  groupVersions,
  workflowSectionName,
  PERMISSION_STATE_NAMES,
  PRIORITY_NAMES,
  describeAuditEvent,
  type AuditEvent,
  type EpisodeTag,
  type PermissionRequest,
  type AssignableThing,
  type Assignment,
  type Seat,
  type Task,
  type TaskStatus,
  type WorkflowSection,
} from '@vcwriter/domain';
import { WhoOwesWhat } from './assignments';
import { PrioritySelect, TaskActions } from './task-actions';
import { AnswerRequest, RequestPermission } from './permission-actions';

/**
 * The room's work as a board (addendum 07 §29; workflow spec v1.1 §3–§4).
 *
 * A metrics strip across the top, the workflow stages down the left, and the
 * work in flight in three columns: To Do, In Progress, Awaiting Review. A card
 * opens its own page, with a short menu of what can be done with it, rather
 * than a wall of large buttons.
 */

export const TASK_TABS = ['overview', 'versions', 'markups', 'history'] as const;
export type TaskTab = (typeof TASK_TABS)[number];
const TAB_NAMES: Record<TaskTab, string> = {
  overview: 'Overview',
  versions: 'Versions sent',
  markups: 'Markup & notes',
  history: 'History',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`tk-status tk-tone-${TASK_STATUS_TONES[status]}`} title={TASK_STATUS_HINTS[status]}>
      <span className="tk-dot" aria-hidden="true" />
      {TASK_STATUS_NAMES[status]}
    </span>
  );
}

export function Board({
  roomId,
  tasks: all,
  seats,
  viewer,
  section,
  writer,
  query,
  taskKey,
  tab,
  today,
  things,
  assignments,
  roomName,
  masterVersionId,
  requests,
  audit,
  episodes = [],
  episode = null,
  archiveBy = 'writer',
}: {
  roomId: string;
  tasks: Task[];
  seats: Seat[];
  viewer: { userId: string; showrunner: boolean };
  section: WorkflowSection;
  writer: string | null;
  query: string;
  taskKey: string | null;
  tab: TaskTab;
  today: string;
  things: AssignableThing[];
  assignments: Assignment[];
  roomName: string;
  masterVersionId: string | null;
  /** Permission requests this person may see (§32). */
  requests: PermissionRequest[];
  /** The audit trail this person may read (§32). */
  audit: AuditEvent[];
  /** A series room's episodes, in story order (§36); empty otherwise. */
  episodes?: EpisodeTag[];
  /** The episode being looked at, by marker id. */
  episode?: string | null;
  /** How the archive is grouped. */
  archiveBy?: 'writer' | 'episode';
}) {
  const base = `/rooms/${roomId}?view=tasks`;
  const seatOf = (userId: string) => seats.find((one) => one.userId === userId) ?? null;
  const nameOf = (userId: string | null) => {
    if (!userId) return '—';
    const seat = seatOf(userId);
    return seat ? seatName(seat) : userId === viewer.userId ? 'You' : 'The showrunner';
  };
  const initialsOf = (userId: string) => {
    const seat = seatOf(userId);
    return seat ? seatInitials(seat) : 'SR';
  };
  const colourOf = (userId: string) => seatOf(userId)?.colour || '#c9a45c';
  const link = (over: { section?: WorkflowSection; writer?: string | null; episode?: string | null; by?: 'writer' | 'episode'; task?: string; tab?: TaskTab; q?: string }) => {
    const params = new URLSearchParams();
    const s = over.section ?? section;
    if (s !== 'board') params.set('section', s);
    const w = over.writer === undefined ? writer : over.writer;
    if (w) params.set('writer', w);
    const e = over.episode === undefined ? episode : over.episode;
    if (e) params.set('ep', e);
    if ((over.by ?? archiveBy) === 'episode') params.set('by', 'episode');
    const q = over.q ?? query;
    if (q) params.set('q', q);
    if (over.task) params.set('task', over.task);
    if (over.tab && over.tab !== 'overview') params.set('tab', over.tab);
    const rest = params.toString();
    return rest ? `${base}&${rest}` : base;
  };

  // A writer reads their own tasks; the showrunner the room's (§2).
  const visible = viewer.showrunner ? all : all.filter((task) => task.ownerId === viewer.userId);
  const sorted = sortTasks(visible, viewer);
  const asking = viewer.showrunner ? requests.filter((one) => one.state === 'pending') : requests.filter((one) => one.requesterId === viewer.userId && one.state === 'pending');
  const metrics = [
    ...taskMetrics(visible, viewer),
    { key: 'permissions', label: 'Permission requests', count: asking.length, section: 'permissions' as WorkflowSection, attention: viewer.showrunner && asking.length > 0 },
  ];
  const writers = seats.filter((seat) => seat.state !== 'deactivated' && seat.userId);
  const listed = filterTasks(sorted, { section, writer, episode, query });
  const task = taskKey ? (visible.find((one) => one.key === taskKey) ?? null) : null;
  const attention = visible.filter((one) => needsActionFrom(one, viewer)).length;

  const card = (one: Task) => (
    <li key={one.key}>
      <a href={link({ task: one.key })} className={`tk-card tk-card-${one.kind}${needsActionFrom(one, viewer) ? ' act' : ''}`}>
        <span className="tk-card-top">
          <span className="tk-place">{taskPlace(one)}</span>
          {one.assignment?.groupId ? (
            <span className="tk-group-chip" title="The same task given to several writers">
              Group of {groupSize(all, one)}
            </span>
          ) : null}
          {one.versions > 0 ? <span className="tk-ver">v{one.versions}</span> : null}
        </span>
        <strong className="tk-title">{taskHeadline(one)}</strong>
        {one.assignment?.passage ? <span className="tk-card-quote">“{one.assignment.passage.quote}”</span> : null}
        <span className="tk-card-foot">
          <span className="tk-who" style={{ background: colourOf(one.ownerId) }} title={nameOf(one.ownerId)}>
            {initialsOf(one.ownerId)}
          </span>
          <StatusBadge status={one.status} />
          {one.assignment && (one.assignment.priority === 'high' || one.assignment.priority === 'urgent') ? (
            <span className={`tk-priority tk-priority-${one.assignment.priority}`}>{PRIORITY_NAMES[one.assignment.priority]}</span>
          ) : null}
          {one.dueOn ? <span className={one.overdue ? 'tk-due late' : 'tk-due'}>{one.overdue ? 'Overdue ' : 'Due '}{one.dueOn}</span> : null}
          {needsActionFrom(one, viewer) ? <span className="tk-attn" title="Needs your action">●</span> : null}
        </span>
        <span className="tk-updated">Updated {one.updatedAt.slice(0, 10)}</span>
      </a>
    </li>
  );

  const counts: Record<WorkflowSection, number> = Object.fromEntries(
    WORKFLOW_SECTIONS.map((one) => [one, one === 'permissions' ? asking.length : filterTasks(visible, { section: one, writer, episode }).length]),
  ) as Record<WorkflowSection, number>;

  return (
    <div className="tk">
      <div className="tk-metrics" role="list" aria-label="Where the work stands">
        {metrics.map((metric) => (
          <a
            role="listitem"
            key={metric.key}
            href={link({ section: metric.section, task: undefined })}
            className={`tk-metric${metric.attention ? ' attn' : ''}`}
          >
            <span className="tk-metric-n">{metric.count}</span>
            <span className="tk-metric-l">{metric.label}</span>
          </a>
        ))}
        <a className="tk-metric tk-export" href={`/rooms/${roomId}/report${section !== 'board' || writer ? `?scope=current${section !== 'board' ? `&section=${section}` : ''}${writer ? `&writer=${writer}` : ''}` : ''}`} title="A printable report of these tasks">
          <span className="tk-metric-n" aria-hidden="true">⎙</span>
          <span className="tk-metric-l">Export tasks</span>
        </a>
      </div>

      <div className="tk-body">
        <details className="tk-nav" open>
          <summary>Workflow</summary>
          <nav aria-label="Workflow">
            <ul>
              {WORKFLOW_SECTIONS.map((one) => (
                <li key={one}>
                  <a href={link({ section: one, task: undefined })} className={one === section && !task ? 'on' : undefined}>
                    <span>{workflowSectionName(one, viewer.showrunner)}</span>
                    {one !== 'contributions' ? <span className="tk-count">{counts[one]}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
            {viewer.showrunner && writers.length > 0 ? (
              <>
                <p className="tk-nav-head">Writer</p>
                <ul>
                  <li>
                    <a href={link({ writer: null })} className={!writer ? 'on' : undefined}>
                      Everybody
                    </a>
                  </li>
                  {writers.map((seat) => (
                    <li key={seat.id}>
                      <a href={link({ writer: seat.userId })} className={writer === seat.userId ? 'on' : undefined}>
                        <span className="tk-who sm" style={{ background: seat.colour || '#666' }}>
                          {seatInitials(seat)}
                        </span>
                        <span>{seatName(seat)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {episodes.length > 0 ? (
              <>
                <p className="tk-nav-head">Episode</p>
                <ul>
                  <li>
                    <a href={link({ episode: null })} className={!episode ? 'on' : undefined}>
                      All episodes
                    </a>
                  </li>
                  {episodes.map((one) => (
                    <li key={one.key}>
                      <a href={link({ episode: one.key })} className={episode === one.key ? 'on' : undefined} title={one.label}>
                        <span className="tk-ep">{one.short}</span>
                        <span>{one.label.replace(/^Episode \d+( — )?/, '') || one.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </nav>
        </details>

        <div className="tk-main">
          {task ? (
            <TaskPage
              task={task}
              tab={tab}
              link={link}
              back={link({ task: undefined })}
              backLabel={workflowSectionName(section, viewer.showrunner)}
              roomId={roomId}
              viewer={viewer}
              nameOf={nameOf}
              colourOf={colourOf}
              initialsOf={initialsOf}
              masterVersionId={masterVersionId}
              requests={requests}
              audit={audit}
              allTasks={all}
            />
          ) : (
            <>
              <form className="tk-toolbar" action={`/rooms/${roomId}`} method="get">
                <input type="hidden" name="view" value="tasks" />
                {section !== 'board' ? <input type="hidden" name="section" value={section} /> : null}
                {writer ? <input type="hidden" name="writer" value={writer} /> : null}
                {episode ? <input type="hidden" name="ep" value={episode} /> : null}
                <input type="search" name="q" defaultValue={query} placeholder="Search tasks, scenes, beats" aria-label="Search tasks" />
                <button type="submit" className="button small secondary">
                  Search
                </button>
                {attention > 0 ? <span className="tk-needs">{attention} need{attention === 1 ? 's' : ''} your action</span> : null}
              </form>

              {viewer.showrunner && (section === 'board' || section === 'assigned') ? (
                <details className="tk-new">
                  <summary>+ New task</summary>
                  <WhoOwesWhat
                    roomId={roomId}
                    rows={[]}
                    assignments={assignments}
                    seats={seats}
                    things={things}
                    today={today}
                    defaultAssigneeId={writer ?? undefined}
                  />
                </details>
              ) : null}

              {section === 'board' ? (
                <div className="tk-board">
                  {BOARD_COLUMNS.map((column) => {
                    const inColumn = listed.filter((one) => one.column === column);
                    return (
                      <section key={column} className={`tk-col tk-col-${column}`} aria-label={BOARD_COLUMN_NAMES[column]}>
                        <h3>
                          {BOARD_COLUMN_NAMES[column]} <span className="tk-count">{inColumn.length}</span>
                        </h3>
                        {inColumn.length === 0 ? <p className="small muted">Nothing here.</p> : <ul className="tk-cards">{inColumn.map(card)}</ul>}
                      </section>
                    );
                  })}
                </div>
              ) : section === 'permissions' ? (
                <Permissions
                  roomId={roomId}
                  requests={viewer.showrunner ? requests : requests.filter((one) => one.requesterId === viewer.userId)}
                  viewer={viewer}
                  nameOf={nameOf}
                  colourOf={colourOf}
                  initialsOf={initialsOf}
                  taskLink={(assignmentId) => link({ task: `a:${assignmentId}`, section: 'board' })}
                />
              ) : section === 'contributions' ? (
                <Contributions
                  tasks={listed}
                  link={link}
                  nameOf={nameOf}
                  colourOf={colourOf}
                  initialsOf={initialsOf}
                  showrunner={viewer.showrunner}
                  roomId={roomId}
                  viewerId={viewer.userId}
                  requests={requests}
                />
              ) : section === 'archive' ? (
                <Archive tasks={listed} card={card} nameOf={nameOf} by={episodes.length > 0 ? archiveBy : 'writer'} link={link} episodic={episodes.length > 0} />
              ) : (
                <section className="room-panel">
                  <h2>{workflowSectionName(section, viewer.showrunner)}</h2>
                  {listed.length === 0 ? <p className="small muted">Nothing here.</p> : <ul className="tk-cards tk-grid">{listed.map(card)}</ul>}
                </section>
              )}

              <details className="tk-legend">
                <summary>What the colours mean</summary>
                <ul>
                  {TASK_STATUSES.map((status) => (
                    <li key={status}>
                      <StatusBadge status={status} /> {TASK_STATUS_HINTS[status]}
                    </li>
                  ))}
                  <li>
                    <span className="tk-who" style={{ background: '#888' }}>
                      AB
                    </span>{' '}
                    A writer’s initials, in that writer’s own colour. The colour is the person, not the status.
                  </li>
                  <li>
                    <span className="tk-card-own-key">Dashed edge</span> work a writer sent without being asked
                  </li>
                </ul>
              </details>
            </>
          )}
        </div>
      </div>
      <p className="tk-room small muted">{roomName}</p>
    </div>
  );
}

function Archive({
  tasks,
  card,
  nameOf,
  by,
  link,
  episodic,
}: {
  tasks: Task[];
  card: (task: Task) => React.ReactNode;
  nameOf: (id: string) => string;
  by: 'writer' | 'episode';
  link: (over: { by?: 'writer' | 'episode' }) => string;
  episodic: boolean;
}) {
  // By writer, or in a series by episode (spec §9).
  const groups = new Map<string, { title: string; list: Task[] }>();
  for (const task of tasks) {
    const key = by === 'episode' ? (task.episode?.key ?? '') : task.ownerId;
    const title = by === 'episode' ? (task.episode?.label ?? 'No episode') : nameOf(task.ownerId);
    const group = groups.get(key) ?? { title, list: [] };
    group.list.push(task);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (by === 'episode' ? (a === '' ? 1 : b === '' ? -1 : 0) : 0));
  return (
    <section className="room-panel">
      <h2>Completed / Archive</h2>
      <p className="small muted">
        Closed tasks, by {by === 'episode' ? 'episode' : 'writer'}. Everything sent for them, every markup and every decision is kept.
        {episodic ? (
          <>
            {' '}
            <a href={link({ by: by === 'episode' ? 'writer' : 'episode' })}>{by === 'episode' ? 'Group by writer' : 'Group by episode'}</a>
          </>
        ) : null}
      </p>
      {tasks.length === 0 ? <p className="small muted">Nothing closed yet.</p> : null}
      {ordered.map(([key, group]) => (
        <div key={key || 'none'} className="tk-group">
          <h3>
            {group.title} <span className="tk-count">{group.list.length}</span>
          </h3>
          <ul className="tk-cards tk-grid">{group.list.map(card)}</ul>
        </div>
      ))}
    </section>
  );
}

function Contributions({
  tasks,
  link,
  nameOf,
  colourOf,
  initialsOf,
  showrunner,
  roomId,
  viewerId,
  requests,
}: {
  tasks: Task[];
  link: (over: { task?: string }) => string;
  nameOf: (id: string) => string;
  colourOf: (id: string) => string;
  initialsOf: (id: string) => string;
  showrunner: boolean;
  roomId: string;
  viewerId: string;
  requests: PermissionRequest[];
}) {
  const sent = tasks.filter((task) => task.versions > 0);
  return (
    <section className="room-panel">
      <h2>{showrunner ? 'Contributions by writer' : 'My contributions'}</h2>
      <p className="small muted">
        Everything sent for review and whether it reached the master. {showrunner ? '' : 'The master itself is the showrunner’s to change.'}
      </p>
      {sent.length === 0 ? (
        <p className="small muted">Nothing sent yet.</p>
      ) : (
        <table className="tk-table">
          <thead>
            <tr>
              {showrunner ? <th>Writer</th> : null}
              <th>Task</th>
              <th>Where</th>
              <th>Versions</th>
              <th>Status</th>
              <th>In the master</th>
              {showrunner ? null : <th>Revise</th>}
            </tr>
          </thead>
          <tbody>
            {sent.map((task) => (
              <tr key={task.key}>
                {showrunner ? (
                  <td>
                    <span className="tk-who sm" style={{ background: colourOf(task.ownerId) }}>
                      {initialsOf(task.ownerId)}
                    </span>{' '}
                    {nameOf(task.ownerId)}
                  </td>
                ) : null}
                <td>
                  <a href={link({ task: task.key })}>{taskHeadline(task)}</a>
                </td>
                <td>{taskPlace(task)}</td>
                <td>v{task.versions}</td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
                <td>{CONTRIBUTION_STATE_NAMES[task.contribution]}</td>
                {showrunner ? null : (
                  <td>
                    <ReviseCell task={task} roomId={roomId} viewerId={viewerId} requests={requests} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TaskPage({
  task,
  tab,
  link,
  back,
  backLabel,
  roomId,
  viewer,
  nameOf,
  colourOf,
  initialsOf,
  masterVersionId,
  requests,
  audit,
  allTasks,
}: {
  task: Task;
  tab: TaskTab;
  link: (over: { task?: string; tab?: TaskTab }) => string;
  back: string;
  backLabel: string;
  roomId: string;
  viewer: { userId: string; showrunner: boolean };
  nameOf: (id: string | null) => string;
  colourOf: (id: string) => string;
  initialsOf: (id: string) => string;
  masterVersionId: string | null;
  requests: PermissionRequest[];
  audit: AuditEvent[];
  /** Every task this person may see, for the task's group (§34). */
  allTasks: Task[];
}) {
  const siblings = groupSiblings(allTasks, task);
  const compareAll = groupVersions(allTasks, task);
  const latest = task.submissions[0] ?? null;
  const mine = task.ownerId === viewer.userId;
  // Opens on the task's beat (or its scene's first beat), and knows the task,
  // so the way back and Submit both point at it (§31).
  const target = task.assignment?.targetKind === 'beat' || task.assignment?.targetKind === 'scene' ? task.assignment : null;
  const editorHref = `/preview?room=${roomId}&task=${encodeURIComponent(task.key)}${
    target?.targetId ? `&${target.targetKind}=${encodeURIComponent(target.targetId)}` : ''
  }`;
  const numbered = [...task.submissions].reverse().map((one, index) => ({ one, n: index + 1 }));
  const history = [
    { at: task.createdAt, what: task.kind === 'assignment' ? `Assigned to ${nameOf(task.ownerId)}` : `Started by ${nameOf(task.ownerId)}` },
    ...numbered.map(({ one, n }) => ({ at: one.createdAt, what: `v${n} sent by ${nameOf(one.authorId)}` })),
    ...task.submissions
      .filter((one) => one.decidedAt)
      .map((one) => ({ at: one.decidedAt!, what: `${STATE_NAMES[one.state]} by ${nameOf(one.decidedBy)}${one.reply ? `: “${one.reply}”` : ''}` })),
    ...task.markups.map((one) => ({
      at: one.sentAt,
      what: `${one.marks.length} ${one.marks.length === 1 ? 'mark' : 'marks'} from ${nameOf(one.authorId)}${one.archivedAt ? ' (archived)' : ''}`,
    })),
    ...(task.assignment && task.assignment.updatedAt !== task.assignment.createdAt
      ? [{ at: task.assignment.updatedAt, what: `Task ${task.status === 'completed' ? 'closed' : task.status === 'cancelled' ? 'cancelled' : 'updated'}` }]
      : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="room-panel tk-page">
      <p className="small tk-crumb">
        <a href={back}>← {backLabel}</a>
      </p>
      <header className="tk-page-head">
        <p className="tk-place">
          {taskPlace(task)} · {WORK_KIND_NAMES[task.kind]}
        </p>
        <h2>{taskHeadline(task)}</h2>
        <p className="tk-card-foot">
          <span className="tk-who" style={{ background: colourOf(task.ownerId) }}>
            {initialsOf(task.ownerId)}
          </span>
          <span>{nameOf(task.ownerId)}</span>
          <StatusBadge status={task.status} />
          {task.versions > 0 ? <span className="tk-ver">v{task.versions}</span> : null}
          {task.dueOn ? <span className={task.overdue ? 'tk-due late' : 'tk-due'}>Due {task.dueOn}</span> : null}
        </p>
      </header>

      <div className="tk-page-body">
        <nav className="tk-menu" aria-label="This task">
          {TASK_TABS.map((one) => (
            <a key={one} href={link({ task: task.key, tab: one })} className={one === tab ? 'on' : undefined}>
              {TAB_NAMES[one]}
              {one === 'versions' && task.versions > 0 ? <span className="tk-count">{task.versions}</span> : null}
              {one === 'markups' && task.markups.length > 0 ? <span className="tk-count">{task.markups.length}</span> : null}
            </a>
          ))}
          <hr />
          <a href={editorHref}>Open in VC Writer</a>
          {masterVersionId ? (
            <a href={`/preview?room=${roomId}&version=${masterVersionId}`} target="_blank" rel="noreferrer">
              Read the master
            </a>
          ) : null}
          {viewer.showrunner && latest ? <a href={`/rooms/${roomId}?view=compare&version=${latest.versionId}`}>Compare & mark up</a> : null}
          {viewer.showrunner && latest ? <a href={`/rooms/${roomId}?view=integrate&task=${encodeURIComponent(task.key)}`}>Integrate into master</a> : null}
        </nav>

        <div className="tk-page-main">
          {tab === 'overview' ? (
            <>
              {task.note.trim() && task.note.trim().replace(/[.!?]+$/, '') !== taskHeadline(task) ? <p className="lede">{task.note}</p> : null}
              {task.assignment?.passage ? (
                <figure className="tk-passage">
                  <figcaption className="small muted">The passage, as it read when this was assigned</figcaption>
                  <blockquote className="af-quote">{task.assignment.passage.quote}</blockquote>
                </figure>
              ) : null}
              <dl className="tk-facts">
                <div>
                  <dt>Status</dt>
                  <dd>{TASK_STATUS_HINTS[task.status]}</dd>
                </div>
                <div>
                  <dt>Next</dt>
                  <dd>{nextActionOf(task)}</dd>
                </div>
                <div>
                  <dt>In the master</dt>
                  <dd>{CONTRIBUTION_STATE_NAMES[task.contribution]}</dd>
                </div>
                {task.assignment ? (
                  <div>
                    <dt>Priority</dt>
                    <dd>
                      {viewer.showrunner ? (
                        <PrioritySelect roomId={roomId} assignmentId={task.assignment.id} value={task.assignment.priority} />
                      ) : (
                        PRIORITY_NAMES[task.assignment.priority]
                      )}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Asked by</dt>
                  <dd>{task.assignment ? nameOf(task.assignment.assignedBy) : '—'}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{task.updatedAt.slice(0, 10)}</dd>
                </div>
              </dl>
              {(() => {
                // Why it was last closed, cancelled or reopened (§35).
                const last = audit.find(
                  (one) => one.entityId === task.assignment?.id && (one.action === 'closed' || one.action === 'cancelled' || one.action === 'reopened') && one.note,
                );
                return last ? (
                  <p className="notice small">
                    {last.action === 'reopened' ? 'Reopened' : last.action === 'closed' ? 'Closed' : 'Cancelled'} by {nameOf(last.actorId)} on{' '}
                    {last.createdAt.slice(0, 10)}: {last.note}
                  </p>
                ) : null;
              })()}
              {siblings.length > 0 ? (
                <div className="tk-group">
                  <h3>Also given to</h3>
                  <ul className="tk-siblings">
                    {siblings.map((one) => (
                      <li key={one.key}>
                        <span className="tk-who sm" style={{ background: colourOf(one.ownerId) }}>
                          {initialsOf(one.ownerId)}
                        </span>
                        {viewer.showrunner ? <a href={link({ task: one.key })}>{nameOf(one.ownerId)}</a> : <span>{nameOf(one.ownerId)}</span>}
                        <StatusBadge status={one.status} />
                        {one.versions > 0 ? <span className="tk-ver">v{one.versions}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {viewer.showrunner && compareAll.length > 1 ? (
                    <p className="small">
                      <a className="button small" href={`/rooms/${roomId}?view=integrate&task=${encodeURIComponent(task.key)}&from=${compareAll.join(',')}`}>
                        Compare all in Integrate ({compareAll.length})
                      </a>
                    </p>
                  ) : viewer.showrunner ? (
                    <p className="small muted">Compare all opens once two of them have sent something.</p>
                  ) : null}
                </div>
              ) : null}
              {latest?.reply && latest.state === 'revision_requested' ? (
                <div className="notice">
                  <strong>Notes from the showrunner on v{task.versions}:</strong> {latest.reply}
                </div>
              ) : null}
              <h3>Actions</h3>
              <TaskActions
                roomId={roomId}
                status={task.status}
                showrunner={viewer.showrunner}
                mine={mine}
                assignmentId={task.assignment?.id ?? null}
                submissionId={latest?.id ?? null}
                submissionState={latest?.state ?? null}
                hasSubmissions={task.versions > 0}
                editorHref={editorHref}
                trayHref={`/rooms/${roomId}?view=integrate&task=${encodeURIComponent(task.key)}`}
              />
              {mine && !viewer.showrunner && task.contribution === 'integrated' && task.assignment ? (
                <div>
                  <p className="small muted">This is in the master, which only the showrunner changes. To revise it, ask.</p>
                  <ReviseCell task={task} roomId={roomId} viewerId={viewer.userId} requests={requests} />
                </div>
              ) : null}
              {mine && !viewer.showrunner && (task.status === 'in_progress' || task.status === 'needs_revision' || task.status === 'assigned') ? (
                <p className="small muted">
                  Write it in VC Writer, then press <strong>Submit</strong> in the Writers Room bar and choose this task. Going back to the room
                  does not submit anything.
                </p>
              ) : null}
            </>
          ) : null}

          {tab === 'versions' ? (
            numbered.length === 0 ? (
              <p className="small muted">Nothing sent yet.</p>
            ) : (
              <ul className="room-due">
                {[...numbered].reverse().map(({ one, n }) => (
                  <li key={one.id}>
                    <span className="room-dot" style={{ background: colourOf(one.authorId) }} />
                    <span>
                      <strong>
                        v{n} · {one.note.trim() || 'A pass on the script'}
                      </strong>
                      <span className="small block muted">
                        Sent {one.createdAt.slice(0, 10)} · {STATE_NAMES[one.state]}
                        {one.reply ? ` · “${one.reply}”` : ''}
                      </span>
                      <span className="wk-acts">
                        <a className="button small secondary" href={`/preview?room=${roomId}&version=${one.versionId}`}>
                          Read it
                        </a>
                        {viewer.showrunner ? (
                          <a className="button small secondary" href={`/rooms/${roomId}?view=compare&version=${one.versionId}`}>
                            Compare & mark up
                          </a>
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'markups' ? (
            task.markups.length === 0 ? (
              <p className="small muted">No markups yet.</p>
            ) : (
              <ul className="room-due">
                {task.markups.map((one) => (
                  <li key={one.id} className={one.state === 'sent' && !one.archivedAt ? 'unseen' : undefined}>
                    <span className="room-dot" style={{ background: colourOf(one.authorId) }} />
                    <span>
                      <a href={`/rooms/${roomId}?view=markups&markup=${one.id}`}>
                        <strong>
                          {one.marks.length} {one.marks.length === 1 ? 'mark' : 'marks'} from {nameOf(one.authorId)}
                        </strong>
                      </a>
                      <span className="small block muted">
                        {one.sentAt.slice(0, 10)}
                        {one.archivedAt ? ' · archived' : one.state === 'seen' ? ' · opened' : ' · new'}
                        {one.note ? ` · “${one.note}”` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'history' ? (
            <>
            <h3>Audit trail</h3>
            {(() => {
              const ids = new Set([task.assignment?.id, ...task.submissions.map((one) => one.id), ...requests.filter((one) => one.assignmentId === task.assignment?.id).map((one) => one.id)].filter(Boolean));
              const trail = audit.filter((one) => one.entityId && ids.has(one.entityId));
              return trail.length === 0 ? (
                <p className="small muted">Nothing recorded yet. Every change from now on is recorded here, and nobody can edit or remove it.</p>
              ) : (
                <ol className="tk-history">
                  {trail.map((one) => (
                    <li key={one.id}>
                      <span className="small muted">{one.createdAt.slice(0, 16).replace('T', ' ')}</span> {describeAuditEvent(one, nameOf)}
                    </li>
                  ))}
                </ol>
              );
            })()}
            <h3>Summary</h3>
            <ol className="tk-history">
              {history.map((one, index) => (
                <li key={index}>
                  <span className="small muted">{one.at.slice(0, 16).replace('T', ' ')}</span> {one.what}
                </li>
              ))}
            </ol>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** For a writer's integrated work: ask, or say where the asking stands. */
function ReviseCell({ task, roomId, viewerId, requests }: { task: Task; roomId: string; viewerId: string; requests: PermissionRequest[] }) {
  if (task.contribution !== 'integrated' || !task.assignment || task.ownerId !== viewerId) return <span className="small muted">—</span>;
  const latest = requests
    .filter((one) => one.assignmentId === task.assignment!.id && one.requesterId === viewerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latest?.state === 'pending') return <span className="small">Asked — waiting for the showrunner</span>;
  const beatId = task.assignment.targetKind === 'beat' ? task.assignment.targetId : null;
  return (
    <>
      {latest ? <span className="small muted block">Last asked: {PERMISSION_STATE_NAMES[latest.state]}</span> : null}
      <RequestPermission roomId={roomId} assignmentId={task.assignment.id} beatId={beatId} targetLabel={taskPlace(task).replace(' · ', ' — ')} />
    </>
  );
}

function Permissions({
  roomId,
  requests,
  viewer,
  nameOf,
  colourOf,
  initialsOf,
  taskLink,
}: {
  roomId: string;
  requests: PermissionRequest[];
  viewer: { userId: string; showrunner: boolean };
  nameOf: (id: string | null) => string;
  colourOf: (id: string) => string;
  initialsOf: (id: string) => string;
  taskLink: (assignmentId: string) => string;
}) {
  const waiting = requests.filter((one) => one.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const answered = requests.filter((one) => one.state !== 'pending');
  const row = (one: PermissionRequest) => (
    <li key={one.id} className="tk-request">
      <span className="tk-who" style={{ background: colourOf(one.requesterId) }} title={nameOf(one.requesterId)}>
        {initialsOf(one.requesterId)}
      </span>
      <div>
        <strong>{one.targetLabel || 'Integrated material'}</strong>{' '}
        <span className="small muted">
          {nameOf(one.requesterId)} · {one.createdAt.slice(0, 10)} · {PERMISSION_STATE_NAMES[one.state]}
        </span>
        <p className="small">{one.reason}</p>
        {one.proposed ? <p className="small muted">Proposed: {one.proposed}</p> : null}
        {one.decisionNote ? <p className="small">Showrunner: {one.decisionNote}</p> : null}
        {one.grantedAssignmentId ? (
          <p className="small">
            <a href={taskLink(one.grantedAssignmentId)}>Open the revision task →</a>
          </p>
        ) : null}
        {one.assignmentId ? (
          <p className="small">
            <a href={taskLink(one.assignmentId)}>The original task</a>
          </p>
        ) : null}
        {one.state === 'pending' ? (
          <AnswerRequest roomId={roomId} requestId={one.id} showrunner={viewer.showrunner} mine={one.requesterId === viewer.userId} />
        ) : null}
      </div>
    </li>
  );
  return (
    <section className="room-panel">
      <h2>Permission requests</h2>
      <p className="small muted">
        Asking to revise material already in the master. A grant makes a new task for the writer; the master itself changes only when the
        showrunner integrates what comes back. A denial changes nothing.
        {viewer.showrunner ? '' : ' To ask, open My Contributions and choose Request permission beside integrated work.'}
      </p>
      <h3>Waiting {waiting.length > 0 ? <span className="tk-count">{waiting.length}</span> : null}</h3>
      {waiting.length === 0 ? <p className="small muted">Nothing waiting.</p> : <ul className="tk-requests">{waiting.map(row)}</ul>}
      {answered.length > 0 ? (
        <>
          <h3>Answered</h3>
          <ul className="tk-requests">{answered.map(row)}</ul>
        </>
      ) : null}
    </section>
  );
}
