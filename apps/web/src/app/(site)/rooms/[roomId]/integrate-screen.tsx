import {
  beatHash,
  parseProjectFile,
  seatInitials,
  seatName,
  type ProjectFile,
  type Seat,
  type Submission,
  type Task,
} from '@vcwriter/domain';
import { versionWithDocument } from '@/lib/branches';
import { Integrate, type IntegrateSource, type Person } from './integrate';

/**
 * Choosing what to integrate, and reading it (addendum 07 §30).
 *
 * The beat comes from the task where there is one (its beat, or the first beat
 * of its scene), and otherwise from the picker; the writers' versions are the
 * task's latest submission, or up to three chosen from what was sent.
 */
export async function IntegrateScreen({
  roomId,
  master,
  submissions,
  seats,
  tasks,
  params,
}: {
  roomId: string;
  master: ProjectFile | null;
  submissions: Submission[];
  seats: Seat[];
  tasks: Task[];
  params: { beat?: string; from?: string; task?: string };
}) {
  if (!master || master.beats.length === 0) {
    return (
      <section className="room-panel">
        <h2>Integrate into the master</h2>
        <p className="small">The master has no beats yet, so there is nothing to integrate into.</p>
      </section>
    );
  }

  const task = params.task ? (tasks.find((one) => one.key === params.task) ?? null) : null;
  const target = task?.assignment;
  const ordered = [...master.beats].sort((a, b) => {
    const ua = master.units.findIndex((unit) => unit.id === a.unitId);
    const ub = master.units.findIndex((unit) => unit.id === b.unitId);
    return ua - ub || (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0);
  });
  const fromTask =
    target?.targetKind === 'beat'
      ? target.targetId
      : target?.targetKind === 'scene'
        ? (ordered.find((beat) => (beat.unitId as string) === target.targetId)?.id as string | undefined)
        : undefined;
  const beat = ordered.find((one) => (one.id as string) === (params.beat ?? fromTask)) ?? ordered[0]!;
  const unit = master.units.find((one) => one.id === beat.unitId);
  const beatLabel = `${unit?.title || 'Scene'} › ${beat.title || 'Untitled beat'}`;

  const passes = submissions
    .filter((one) => one.kind === 'script')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const nameOf = (userId: string) => {
    const seat = seats.find((one) => one.userId === userId);
    return seat ? seatName(seat) : 'A writer';
  };
  const chosen = (params.from ? params.from.split(',') : task?.submissions[0] ? [task.submissions[0].versionId] : passes[0] ? [passes[0].versionId] : [])
    .filter(Boolean)
    .slice(0, 3);

  const sources: IntegrateSource[] = [];
  for (const versionId of chosen) {
    const submission = passes.find((one) => one.versionId === versionId) ?? null;
    const found = await versionWithDocument(versionId);
    if (!found || found.version.roomId !== roomId) continue;
    const theirs = parseProjectFile(found.document).beats.find((one) => one.id === beat.id) ?? null;
    const authorId = found.version.authorId ?? '';
    const n = submission ? passes.filter((one) => one.authorId === submission.authorId && one.createdAt <= submission.createdAt).length : 0;
    sources.push({
      versionId,
      submissionId: submission?.id ?? null,
      authorId,
      label: `${nameOf(authorId)}${n ? ` · submission v${n}` : ''}${submission?.note.trim() ? ` · ${submission.note.trim().slice(0, 40)}` : ''}`,
      segment: theirs?.manuscript ?? null,
    });
  }

  const people: Record<string, Person> = {};
  for (const seat of seats) {
    if (seat.userId) people[seat.userId] = { name: seatName(seat), initials: seatInitials(seat), colour: seat.colour || '#888888' };
  }

  return (
    <section className="room-panel ig-screen">
      <h2>Integrate into the master</h2>
      <form className="ig-choose" method="get" action={`/rooms/${roomId}`}>
        <input type="hidden" name="view" value="integrate" />
        {task ? <input type="hidden" name="task" value={task.key} /> : null}
        <label>
          <span className="small">Master beat</span>
          <select name="beat" defaultValue={beat.id as string}>
            {ordered.map((one) => {
              const scene = master.units.find((u) => u.id === one.unitId);
              return (
                <option key={one.id as string} value={one.id as string}>
                  {scene?.title || 'Scene'} › {one.title || 'Untitled beat'} ({one.revisionName})
                </option>
              );
            })}
          </select>
        </label>
        <fieldset>
          <legend className="small">Writers’ versions to compare (up to three)</legend>
          {passes.length === 0 ? <span className="small muted">Nothing has been sent yet.</span> : null}
          {passes.slice(0, 12).map((one) => (
            <label key={one.id} className="ig-pick">
              <input type="checkbox" name="pick" value={one.versionId} defaultChecked={chosen.includes(one.versionId)} />
              <span>
                {nameOf(one.authorId)} · {one.createdAt.slice(0, 10)}
                {one.note.trim() ? ` · ${one.note.trim().slice(0, 30)}` : ''}
              </span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="button small secondary">
          Open
        </button>
      </form>
      <Integrate
        key={`${beat.id as string}:${chosen.join(',')}:${beatHash(beat.manuscript)}`}
        roomId={roomId}
        beatId={beat.id as string}
        beatLabel={beatLabel}
        baseHash={beatHash(beat.manuscript)}
        master={beat.manuscript}
        revisionName={beat.revisionName}
        history={beat.revisions.map((one) => one.name)}
        sources={sources}
        people={people}
      />
    </section>
  );
}
