import { PRIORITY_NAMES, TASK_STATUS_NAMES, taskHeadline, type ReportGroup, type ReportSection } from '@vcwriter/domain';

/** The report itself, as printed (spec v1.1 §12.1). */
export function ReportArticle({
  roomName,
  showrunner,
  stamp,
  creator,
  filters,
  report,
  group,
  notes,
}: {
  roomName: string;
  showrunner: boolean;
  stamp: string;
  creator: string;
  filters: string[];
  report: { sections: ReportSection[]; total: number };
  group: ReportGroup;
  notes: boolean;
}) {
  return (
      <article className="rp">
        <h1>{roomName} — {showrunner ? 'Task report' : 'My tasks'}</h1>
        <p className="rp-meta">
          Generated {stamp} by {creator} ·{' '}
          {filters.join(' · ')}
        </p>

        {report.sections.length === 0 ? <p>No tasks in this report.</p> : null}
        {report.sections.map((one) => (
          <section key={one.key} className="rp-group">
            <div className="rp-band">
              {one.colour ? <span className="rp-swatch" style={{ background: one.colour }} /> : null}
              <span>
                {one.title}
                {one.initials ? ` (${one.initials})` : ''}
              </span>
              <span className="rp-counts">
                {one.counts.outstanding} not started · {one.counts.inProgress} in progress · {one.counts.review} awaiting review ·{' '}
                {one.counts.revision} needs revision · {one.counts.completed} done
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  {group !== 'writer' && showrunner ? <th>Writer</th> : null}
                  <th>Where</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Versions</th>
                  <th>Updated</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {one.rows.map((row) => (
                  <tr key={row.task.key}>
                    <td>
                      <strong>{taskHeadline(row.task)}</strong>
                      {notes && row.task.note.trim() && row.task.note.trim().replace(/[.!?]+$/, '') !== taskHeadline(row.task) ? (
                        <div className="rp-note">{row.task.note.trim().slice(0, 280)}</div>
                      ) : null}
                    </td>
                    {group !== 'writer' && showrunner ? (
                      <td>
                        {row.writer} ({row.initials})
                      </td>
                    ) : null}
                    <td>{row.place}</td>
                    <td>
                      {TASK_STATUS_NAMES[row.task.status]}
                      {row.task.overdue ? ' · overdue' : ''}
                    </td>
                    <td>{row.task.assignment ? PRIORITY_NAMES[row.task.assignment.priority] : '—'}</td>
                    <td>{row.task.dueOn ?? '—'}</td>
                    <td>{row.task.versions}</td>
                    <td>{row.task.updatedAt.slice(0, 10)}</td>
                    <td>{row.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <p className="rp-total">
          {report.total} {report.total === 1 ? 'task' : 'tasks'} in this report.
        </p>
      </article>
  );
}
