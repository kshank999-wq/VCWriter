import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  OPENS_LABEL,
  activityIn,
  applyTray,
  assignableThings,
  assignmentsFor,
  canAssign,
  canComment,
  canCurate,
  canReview,
  curatableFrom,
  awaitingCuration,
  mergeRefusalText,
  describeSeats,
  filingChoices,
  ideaBoxes,
  ideasIn,
  newsFor,
  owedBySeat,
  parseProjectFile,
  sequenceOf,
  describeVersion,
  desksIn,
  masterVersion,
  queueOf,
  seatInitials,
  seatName,
  threadsIn,
  waitingCount,
  type Curatable,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { branchesIn, versionsFor } from '@/lib/branches';
import { submissionsIn } from '@/lib/submissions';
import { versionWithDocument } from '@/lib/branches';
import { projectDocument } from '@/lib/project-document';
import { assignmentsIn } from '@/lib/assignments';
import { masterNow, piecesFor, trayIn } from '@/lib/curation';
import { commentsIn, lastReadAt, markRead } from '@/lib/comments';
import { Seats } from './seats';
import { Desks } from './desks';
import { Queue } from './queue';
import { Ideas } from './ideas';
import { WhoOwesWhat, YourAsks } from './assignments';
import { Tray } from './tray';
import { Talk, Trail, WhatIsNew } from './talk';

export const metadata: Metadata = { title: 'The room' };
export const dynamic = 'force-dynamic';

/**
 * Where you land (addendum 07 §5).
 *
 * **One page answering one question — *what is my part in this* — with a
 * different answer per role**, rather than four pages that would drift apart.
 * What each role is shown is `landingFor` in the domain, so the decision is
 * testable and this draws what it is given.
 *
 * A stranger does not get a polite refusal here: `loadRoomById` reads through
 * their own session, so the room simply is not there (§16).
 */
export default async function RoomPage({ params }: { params: { roomId: string } }) {
  const user = await currentUser();
  if (!user) {
    return (
      <>
        <div className="hero">
          <h1>The room</h1>
          <p>Sign in to see it.</p>
        </div>
        <Link href={`/signin?next=%2Frooms%2F${params.roomId}`} className="button">
          Sign in
        </Link>
      </>
    );
  }

  const view = await loadRoomById(params.roomId);
  if (!view || view.role === null) notFound();

  const { landing, you } = view;
  const stamp = you ? seatInitials(you) : '';

  // The room's lines and the points recorded on them, read as this visitor —
  // so what comes back is what they may see, and the dashboard says the rest
  // in words (§7).
  const [branches, versions, submissions, assignments, comments, since] = await Promise.all([
    branchesIn(view.room.id),
    versionsFor(view.room.id),
    submissionsIn(view.room.id),
    assignmentsIn(view.room.id),
    commentsIn(view.room.id),
    lastReadAt(view.room.id, user.id),
  ]);
  const desks = desksIn({ seats: view.seats, branches, versions, viewer: { userId: user.id } });
  const master = masterVersion(versions);

  // The queue as this visitor may see it — their own work if they are a
  // writer, all of it if they run the room. The filtering was the database's
  // (§10); this only decides whether the decision buttons are drawn.
  const deciding = canReview(view.role);
  const queue = queueOf({ submissions, seats: view.seats, versions, kind: 'script' });
  const waiting = waitingCount(submissions, 'script');

  // The room's ideas (§11). Each box's contents are read out of the version it
  // was taken from — a submission references a version and copies nothing, so
  // this is where the reading happens rather than at submission time.
  const research = submissions.filter((one) => one.kind === 'research');
  const carried = await Promise.all(
    research.map(async (submission) => {
      const found = await versionWithDocument(submission.versionId);
      return [submission.id, found ? ideasIn(parseProjectFile(found.document)) : []] as const;
    }),
  );
  const bySubmission = new Map(carried);
  const boxes = ideaBoxes({
    submissions,
    seats: view.seats,
    itemsFor: (submission) => bySubmission.get(submission.id) ?? [],
  });
  // The headings a box can be filed under: the project's own, in its own
  // order. A project that cannot be read offers none rather than an error —
  // the ideas are still worth looking at.
  const project = await projectDocument(view.room.projectId).catch(() => null);
  const headings = project ? filingChoices(project) : [];

  // Assignments (§8), which are one fact seen from two angles on this page and
  // a third in the writing program. `today` is settled here, on the server, so
  // every row on the page agrees about what *late* means.
  const today = new Date().toISOString().slice(0, 10);
  const giving = canAssign(view.role);
  const yours = assignmentsFor(assignments, user.id);
  const owed = giving ? owedBySeat({ assignments, seats: view.seats, today }) : [];
  // What there is to point the Assign menu at, read out of the project itself
  // — the room holds people, and the story is the project's.
  const things = giving && project ? assignableThings(project) : [];

  // The Curation Tray, and the master it would make (§12, stage 9).
  //
  // **The preview is the merge**, run here and run again by the route that
  // commits it — the same pure function over the same rows, so the picture the
  // showrunner looks at and the master they get cannot disagree.
  const curating = canCurate(view.role);
  const tray = curating ? await trayIn(view.room.id) : [];
  const awaiting = curating ? awaitingCuration(submissions, tray) : [];
  // `standing` rather than `master`: `masterVersion` above is the *version*
  // the room agreed on, and this is the document it holds. Two things one
  // letter apart is exactly the confusion to avoid.
  const [pieces, standing] = curating
    ? await Promise.all([piecesFor(tray), masterNow(view.room.id, view.room.projectId)])
    : [[], { file: null, versionId: null }];

  const merged = curating && standing.file && tray.length > 0 ? applyTray(standing.file, pieces) : null;
  const sequence =
    merged && !('reason' in merged)
      ? sequenceOf(merged.file, merged.record)
      : standing.file
        ? sequenceOf(standing.file)
        : [];
  const mergeRefusal = merged && 'reason' in merged ? mergeRefusalText(merged) : null;

  // What each waiting contribution offers, read out of the version it
  // references — a submission copies nothing (§10), so this is where the
  // reading happens.
  const offers: Record<string, Curatable[]> = {};
  if (curating) {
    await Promise.all(
      awaiting.map(async (submission) => {
        const found = await versionWithDocument(submission.versionId);
        offers[submission.id] = found ? curatableFrom(parseProjectFile(found.document)) : [];
      }),
    );
  }

  // What the room is saying, and what has happened in it (§14, §9, stage 10).
  //
  // **All three are readings of rows that already exist.** What is new comes
  // off the comments, and the trail comes off the versions, submissions,
  // assignments and seats — nothing here is a second copy of an event, because
  // a second copy is the one thing an audit trail must never be.
  const news = newsFor({ comments, userId: user.id, since });
  const threads = threadsIn({ comments, seats: view.seats, target: { kind: 'room', id: null } });
  const trail = activityIn({
    seats: view.seats,
    versions,
    submissions,
    assignments,
    comments,
  });

  // They are looking at it now, so nothing already here is new next time. Done
  // after the reading rather than before it, or the page would open with the
  // news it was about to show already marked read.
  await markRead(view.room.id, user.id);

  return (
    <>
      <div className="hero">
        <h1>{view.room.name || view.projectTitle || 'The room'}</h1>
        <p>{landing.standing}</p>
      </div>

      <WhatIsNew news={news} seats={view.seats} />

      <section>
        <h2>Your part in it</h2>
        <div className="grid">
          <article className="card">
            <h3>Your pages</h3>
            {you && you.colour ? (
              <>
                {/* What a page of this writer's draft carries in its top left
                    corner (§6.1), shown here so it is a fact rather than a
                    promise. */}
                <p className="room-stamp" style={{ color: you.colour }}>
                  {stamp || '—'}
                </p>
                <p className="lede">
                  {seatName(you)}
                  {you.title ? ` · ${you.title}` : ''}
                </p>
              </>
            ) : (
              <p className="lede">
                The showrunner has not given you a colour yet. Yours appears on every page of your
                draft once they do.
              </p>
            )}
          </article>

          <article className="card">
            <h3>The editor</h3>
            {landing.opens === 'ownBranch' ? (
              <>
                <p className="lede">Your own working line, taken from what the room has agreed.</p>
                {/* The whole application, over the third bridge (§3.1). `?room=`
                    is what tells the renderer its project lives in the cloud;
                    nothing else about it changes. */}
                <p style={{ marginTop: 16 }}>
                  <a className="button" href={`/preview?room=${view.room.id}`}>
                    {OPENS_LABEL.ownBranch}
                  </a>
                </p>
                <p className="small">
                  Nobody else in the room sees it until you submit — not even the showrunner.
                </p>
              </>
            ) : landing.opens === 'master' ? (
              <>
                <p className="lede">{OPENS_LABEL.master}.</p>
                <p style={{ marginTop: 16 }}>
                  <a className="button" href={`/preview?room=${view.room.id}`}>
                    {OPENS_LABEL.master}
                  </a>
                </p>
                <p className="small">
                  {view.role === 'owner'
                    ? 'The room’s draft, and your own working line on it.'
                    : 'Read-only until the room asks you to write.'}
                </p>
              </>
            ) : (
              <p className="lede">Nothing to open yet.</p>
            )}
          </article>

          {landing.sections.includes('billing') ? (
            <article className="card">
              <h3>Seats</h3>
              <p className="lede">{describeSeats(view.seatsCount)}</p>
              <p className="small">
                An invitation nobody has answered is not a seat and is not billed. A seat you take
                out of the room stops being billed and keeps everything it wrote.
              </p>
            </article>
          ) : null}
        </div>
      </section>

      <section>
        <h2>What you are being asked for</h2>
        <YourAsks roomId={view.room.id} assignments={yours} today={today} />
      </section>

      {giving ? (
        <section>
          <h2>Who owes what</h2>
          <WhoOwesWhat
            roomId={view.room.id}
            rows={owed}
            assignments={assignments}
            seats={view.seats}
            things={things}
            today={today}
          />
        </section>
      ) : null}

      <section>
        <h2>
          {deciding ? 'The review queue' : 'What you have sent'}
          {deciding && waiting > 0 ? <span className="pill">{waiting} waiting</span> : null}
        </h2>
        <Queue roomId={view.room.id} rows={queue} canDecide={deciding} />
        {deciding ? (
          <p className="small">
            Reading a submission opens the version it was taken from, in a window of its own. Nothing here
            deletes anything — a decision can be unmade, and the writer’s own line is never touched.
          </p>
        ) : null}
      </section>

      {curating ? (
        <section>
          <h2>The Curation Tray</h2>
          <p className="lede">
            Where the room’s work becomes the script. Compare what has come in, take what you want of
            it, look at what the master would read like, and commit — which writes a new master
            beside the one before it and destroys nothing.
          </p>
          <Tray
            roomId={view.room.id}
            tray={tray}
            offers={offers}
            waiting={awaiting}
            seats={view.seats}
            sequence={sequence}
            refusal={mergeRefusal}
          />
        </section>
      ) : null}

      <section>
        <h2>The room’s ideas</h2>
        <Ideas roomId={view.room.id} boxes={boxes} categories={headings} canFile={deciding} />
      </section>

      <section>
        <h2>The room, desk by desk</h2>
        {master ? (
          <p className="lede">
            The room agreed on{' '}
            <a href={`/preview?room=${view.room.id}&version=${master.id}`} target="_blank" rel="noreferrer">
              {describeVersion(master)}
            </a>
            . Every draft here was taken from it.
          </p>
        ) : (
          <p className="lede">
            The room has not agreed on a draft yet. Until it does, every writer's line starts from
            the project as it stands.
          </p>
        )}
        <Desks roomId={view.room.id} desks={desks} />
        <p className="small">
          A point opens in a window of its own, so two of them sit side by side. Each one wears its
          writer's colour and name — three windows showing the same scene are otherwise the same
          window three times.
        </p>
      </section>

      <section>
        <h2>The room</h2>
        <p className="lede">
          Threads about the room itself — an idea that is not in the script yet, a question nobody has
          an answer to. Nothing said here is ever deleted: taking something back leaves the thread
          readable and says who took it back.
        </p>
        <Talk
          roomId={view.room.id}
          threads={threads}
          seats={view.seats}
          you={user.id}
          role={view.role}
          mayComment={canComment(view.role)}
        />
      </section>

      <section>
        <h2>What has happened</h2>
        <Trail roomId={view.room.id} events={trail} />
      </section>

      {landing.sections.includes('seats') ? (
        <section>
          <h2>Who is in the room</h2>
          <Seats
            roomId={view.room.id}
            seats={view.seats}
            canManage={landing.sections.includes('invite')}
            youId={you?.id ?? null}
          />
        </section>
      ) : null}
    </>
  );
}
