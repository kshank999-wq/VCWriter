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
  workflowSectionName,
  type AssignableThing,
  type Assignment,
  type Seat,
  type Task,
  type TaskStatus,
  type WorkflowSection,
} from '@vcwriter/domain';
import { WhoOwesWhat } from './assignments';
import { TaskActions } from './task-actions';

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
  const link = (over: { section?: WorkflowSection; writer?: string | null; task?: string; tab?: TaskTab; q?: string }) => {
    const params = new URLSearchParams();
    const s = over.section ?? section;
    if (s !== 'board') params.set('section', s);
    const w = over.writer === undefined ? writer : over.writer;
    if (w) params.set('writer', w);
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
  const metrics = taskMetrics(visible, viewer);
  const writers = seats.filter((seat) => seat.state !== 'deactivated' && seat.userId);
  const listed = filterTasks(sorted, { section, writer, query });
  const task = taskKey ? (visible.find((one) => one.key === taskKey) ?? null) : null;
  const attention = visible.filter((one) => needsActionFrom(one, viewer)).length;

  const card = (one: Task) => (
    <li key={one.key}>
      <a href={link({ task: one.key })} className={`tk-card tk-card-${one.kind}${needsActionFrom(one, viewer) ? ' act' : ''}`}>
        <span className="tk-card-top">
          <span className="tk-place">{taskPlace(one)}</span>
          {one.versions > 0 ? <span className="tk-ver">v{one.versions}</span> : null}
        </span>
        <strong className="tk-title">{taskHeadline(one)}</strong>
        <span className="tk-card-foot">
          <span className="tk-who" style={{ background: colourOf(one.ownerId) }} title={nameOf(one.ownerId)}>
            {initialsOf(one.ownerId)}
          </span>
          <StatusBadge status={one.status} />
          {one.dueOn ? <span className={one.overdue ? 'tk-due late' : 'tk-due'}>{one.overdue ? 'Overdue ' : 'Due '}{one.dueOn}</span> : null}
          {needsActionFrom(one, viewer) ? <span className="tk-attn" title="Needs your action">●</span> : null}
        </span>
        <span className="tk-updated">Updated {one.updatedAt.slice(0, 10)}</span>
      </a>
    </li>
  );

  const counts: Record<WorkflowSection, number> = Object.fromEntries(
    WORKFLOW_SECTIONS.map((one) => [one, filterTasks(visible, { section: one, writer }).length]),
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
            />
          ) : (
            <>
              <form className="tk-toolbar" action={`/rooms/${roomId}`} method="get">
                <input type="hidden" name="view" value="tasks" />
                {section !== 'board' ? <input type="hidden" name="section" value={section} /> : null}
                {writer ? <input type="hidden" name="writer" value={writer} /> : null}
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
              ) : section === 'contributions' ? (
                <Contributions tasks={listed} link={link} nameOf={nameOf} colourOf={colourOf} initialsOf={initialsOf} showrunner={viewer.showrunner} />
              ) : section === 'archive' ? (
                <Archive tasks={listed} card={card} nameOf={nameOf} />
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

function Archive({ tasks, card, nameOf }: { tasks: Task[]; card: (task: Task) => React.ReactNode; nameOf: (id: string) => string }) {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) groups.set(task.ownerId, [...(groups.get(task.ownerId) ?? []), task]);
  return (
    <section className="room-panel">
      <h2>Completed / Archive</h2>
      <p className="small muted">Closed tasks, by writer. Everything sent for them, every markup and every decision is kept.</p>
      {tasks.length === 0 ? <p className="small muted">Nothing closed yet.</p> : null}
      {[...groups.entries()].map(([owner, list]) => (
        <div key={owner} className="tk-group">
          <h3>
            {nameOf(owner)} <span className="tk-count">{list.length}</span>
          </h3>
          <ul className="tk-cards tk-grid">{list.map(card)}</ul>
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
}: {
  tasks: Task[];
  link: (over: { task?: string }) => string;
  nameOf: (id: string) => string;
  colourOf: (id: string) => string;
  initialsOf: (id: string) => string;
  showrunner: boolean;
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
}) {
  const latest = task.submissions[0] ?? null;
  const mine = task.ownerId === viewer.userId;
  const editorHref = `/preview?room=${roomId}`;
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
                <div>
                  <dt>Asked by</dt>
                  <dd>{task.assignment ? nameOf(task.assignment.assignedBy) : '—'}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{task.updatedAt.slice(0, 10)}</dd>
                </div>
              </dl>
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
            <ol className="tk-history">
              {history.map((one, index) => (
                <li key={index}>
                  <span className="small muted">{one.at.slice(0, 16).replace('T', ' ')}</span> {one.what}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  );
}
