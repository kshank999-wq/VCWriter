import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  REPORT_GROUPS,
  REPORT_GROUP_NAMES,
  REPORT_SCOPES,
  REPORT_SCOPE_NAMES,
  WORKFLOW_SECTIONS,
  canCurate,
  filterTasks,
  seatName,
  taskReport,
  tasksFrom,
  workIn,
  workflowSectionName,
  type ReportGroup,
  type ReportScope,
  type WorkflowSection,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { assignmentsIn } from '@/lib/assignments';
import { submissionsIn } from '@/lib/submissions';
import { markupsIn } from '@/lib/markups';
import { PrintButton } from '../task-actions';
import { ReportArticle } from './report-view';

export const metadata: Metadata = { title: 'Task report' };
export const dynamic = 'force-dynamic';

/**
 * A printable report of the room's tasks (addendum 07 §29.6; spec v1.1 §12.1).
 *
 * A report of assignments and progress, not of the script: no submitted text
 * appears on it. It is drawn on the server from what this person may read —
 * a writer's own tasks, the showrunner's whole room — and printed or saved as a
 * PDF through the browser's own print dialog.
 */
export default async function TaskReportPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams?: { scope?: string; group?: string; notes?: string; paper?: string; orientation?: string; section?: string; writer?: string };
}) {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=%2Frooms%2F${params.roomId}%2Freport`);
  const view = await loadRoomById(params.roomId);
  if (!view || view.role === null) notFound();

  const showrunner = canCurate(view.role);
  const [assignments, submissions, markups] = await Promise.all([
    assignmentsIn(view.room.id),
    submissionsIn(view.room.id),
    markupsIn(view.room.id).catch(() => []),
  ]);
  const generatedAt = new Date();
  const today = generatedAt.toISOString().slice(0, 10);
  const tasks = tasksFrom(workIn({ assignments, submissions, markups }), today);
  const viewer = { userId: user.id, showrunner };

  const scope: ReportScope = (REPORT_SCOPES as readonly string[]).includes(searchParams?.scope ?? '')
    ? (searchParams!.scope as ReportScope)
    : 'active';
  const groups = showrunner ? REPORT_GROUPS : REPORT_GROUPS.filter((one) => one !== 'writer');
  const group: ReportGroup = (groups as readonly string[]).includes(searchParams?.group ?? '')
    ? (searchParams!.group as ReportGroup)
    : showrunner
      ? 'writer'
      : 'status';
  const notes = searchParams?.notes !== 'no';
  const paper = searchParams?.paper === 'a4' ? 'A4' : 'letter';
  const orientation = searchParams?.orientation === 'landscape' ? 'landscape' : 'portrait';
  const section: WorkflowSection | undefined = (WORKFLOW_SECTIONS as readonly string[]).includes(searchParams?.section ?? '')
    ? (searchParams!.section as WorkflowSection)
    : undefined;
  const writer = showrunner ? (searchParams?.writer ?? null) : null;
  const current = filterTasks(tasks, { section, writer });

  const report = taskReport({ tasks, seats: view.seats, viewer, scope, group, current });
  const you = view.seats.find((one) => one.userId === user.id);
  const creator = you ? seatName(you) : showrunner ? 'The showrunner' : 'You';
  const roomName = view.room.name || view.projectTitle || 'The room';
  const filters = [
    REPORT_SCOPE_NAMES[scope],
    REPORT_GROUP_NAMES[group],
    ...(scope === 'current' && section ? [workflowSectionName(section, showrunner)] : []),
    ...(scope === 'current' && writer ? [`Writer: ${view.seats.find((one) => one.userId === writer)?.displayName || 'one writer'}`] : []),
    showrunner ? 'All writers' : 'My tasks',
  ];

  return (
    <div className="rp-wrap">
      <style
        // Inline so the paper and orientation chosen above set the printed page.
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${paper} ${orientation}; margin: 0.5in; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; } @bottom-left { content: "${roomName.replace(/["\\<>]/g, '')} · task report"; font-size: 9pt; } }`,
        }}
      />

      <form className="rp-options" method="get">
        <label>
          Tasks
          <select name="scope" defaultValue={scope}>
            {REPORT_SCOPES.map((one) => (
              <option key={one} value={one}>
                {REPORT_SCOPE_NAMES[one]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grouping
          <select name="group" defaultValue={group}>
            {groups.map((one) => (
              <option key={one} value={one}>
                {REPORT_GROUP_NAMES[one]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes and instructions
          <select name="notes" defaultValue={notes ? 'yes' : 'no'}>
            <option value="yes">Include</option>
            <option value="no">Leave out</option>
          </select>
        </label>
        <label>
          Paper
          <select name="paper" defaultValue={paper === 'A4' ? 'a4' : 'letter'}>
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label>
          Orientation
          <select name="orientation" defaultValue={orientation}>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        {section ? <input type="hidden" name="section" value={section} /> : null}
        {writer ? <input type="hidden" name="writer" value={writer} /> : null}
        <button type="submit" className="button small secondary">
          Preview
        </button>
        <PrintButton />
        <a className="small" href={`/rooms/${view.room.id}?view=tasks`}>
          ← Back to the board
        </a>
      </form>

      <ReportArticle
        roomName={roomName}
        showrunner={showrunner}
        stamp={`${generatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`}
        creator={creator}
        filters={filters}
        report={report}
        group={group}
        notes={notes}
      />
    </div>
  );
}
