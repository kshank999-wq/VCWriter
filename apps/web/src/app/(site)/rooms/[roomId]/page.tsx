import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  OPENS_LABEL,
  activityIn,
  applyTray,
  assignableThings,
  assignmentsFor,
  canAskHere,
  canAssign,
  canComment,
  canCurate,
  canReview,
  curatableFrom,
  awaitingCuration,
  mergeRefusalText,
  describeBilling,
  describeSeats,
  seatsToBill,
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
  ROLE_NAMES,
  ASSIGNMENT_STATE_NAMES,
  unseenMarkups,
  describeAssignment,
  isOverdue,
  type Assignment,
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
import { Assist } from './assist';
import { Spend } from './spend';
import { NotifyMe } from './notify';
import { Billing } from './billing';
import { Compare, MarkupView, type VersionChoice } from './compare';
import { markupsIn } from '@/lib/markups';
import { loadBilling, roomPriceCents, seatPriceCents, settleCheckout } from '@/lib/room-billing';
import { standingFor } from '@/lib/room-spend';
import { assistRefusalText } from '@vcwriter/domain';
import { isAiConfigured } from '@/lib/ai-room';

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
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams?: { checkout?: string; view?: string; markup?: string };
}) {
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
  const [branches, versions, submissions, assignments, comments, since, markups] = await Promise.all([
    branchesIn(view.room.id),
    versionsFor(view.room.id),
    submissionsIn(view.room.id),
    assignmentsIn(view.room.id),
    commentsIn(view.room.id),
    lastReadAt(view.room.id, user.id),
    // Not there until the markups migration is (0079): an empty list, not a
    // broken room.
    markupsIn(view.room.id).catch(() => []),
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

  // The room's AI (§14, stages 12 and 13). Four gates, and the page asks the
  // same question the route does — so the control is absent for the same reason
  // the call would have been refused, and says which reason.
  //
  // The month is counted for everybody in the room, not only for whoever may
  // ask: a cap somebody can hit without seeing it coming is the failure stage
  // 13 exists to fix.
  const spend = await standingFor({ roomId: view.room.id, capCents: view.room.aiCapCents });

  // Back from paying: ask Stripe directly rather than wait on the webhook, so
  // the room says it is paid for the moment it is (§24).
  if (view.role === 'owner' && typeof searchParams?.checkout === 'string' && searchParams.checkout.startsWith('cs_')) {
    await settleCheckout({ sessionId: searchParams.checkout, roomId: view.room.id });
  }

  // The room's seat subscription (§14, stage 15). Read for everybody who is
  // shown the billing section, which `landingFor` makes the showrunner's.
  const [billing, roomCents, seatCents] = await Promise.all([
    loadBilling(view.room.id),
    roomPriceCents(),
    seatPriceCents(),
  ]);
  const mayAsk = canAskHere({
    role: view.role,
    roomEnabled: view.room.aiEnabled,
    configured: isAiConfigured(),
    spentCents: spend.spentCents,
    capCents: view.room.aiCapCents,
  });
  const passes = curating ? submissions.filter((one) => one.kind === 'script') : [];
  const scenesIn: Record<string, Curatable[]> = {};
  if (curating) {
    await Promise.all(
      passes.map(async (submission) => {
        const found = await versionWithDocument(submission.versionId);
        scenesIn[submission.id] = found
          ? curatableFrom(parseProjectFile(found.document)).filter((one) => one.kind === 'scene')
          : [];
      }),
    );
  }

  // ---------------------------------------------------------------- screens
  //
  // From Ken: *a right-hand menu bar that has all these things … when you click
  // on it, it opens that screen.* One screen at a time, chosen from the menu
  // on the right; the overview is the room's front page.
  const present = view.seats.filter((seat) => seat.state !== 'deactivated');
  const editorHref = `/preview?room=${view.room.id}`;
  const editorLabel =
    landing.opens === 'ownBranch' ? OPENS_LABEL.ownBranch : landing.opens === 'master' ? OPENS_LABEL.master : null;
  const nameOf = (userId: string | null): string => {
    const seat = view.seats.find((one) => one.userId === userId);
    return seat ? seatName(seat) : userId === null ? '—' : 'The showrunner';
  };
  const colourOf = (userId: string | null): string =>
    view.seats.find((one) => one.userId === userId)?.colour || '#c9a45c';

  // The assignments this visitor sees, soonest first: the showrunner sees the
  // whole room's, a writer their own. An ask with no date goes after the dated
  // ones, oldest first, rather than pretending to be due today.
  const listed = (giving ? assignments : yours).slice().sort((a: Assignment, b: Assignment) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const open = listed.filter((one) => one.state !== 'done' && one.state !== 'cancelled');

  // Every version the visitor may read, for Compare (§27): newest first, each
  // labelled with its writer so three panes of the same scene are told apart.
  const versionChoices: VersionChoice[] = versions.map((version) => {
    const writer = view.seats.find((seat) => seat.userId === version.authorId);
    const name = writer ? seatName(writer) : version.authorId === user.id ? 'You' : 'The showrunner';
    return {
      id: version.id,
      label: `${version.kind === 'master' ? 'Master' : name} · ${describeVersion(version)}`,
      writer: name,
      colour: writer?.colour || '#c9a45c',
      authorId: version.authorId,
    };
  });
  const waitingMarkups = unseenMarkups(markups, user.id);
  const versionLabel = (versionId: string) => versionChoices.find((one) => one.id === versionId)?.label ?? 'A version';

  type Screen = { key: string; label: string; count?: number };
  const screens: Screen[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'assignments', label: 'Assignments', count: open.length },
    { key: 'submissions', label: deciding ? 'Review queue' : 'What you have sent', count: deciding ? waiting : undefined },
    { key: 'ideas', label: 'Ideas', count: boxes.length },
    ...(curating ? [{ key: 'tray', label: 'Curation Tray', count: awaiting.length }] : []),
    { key: 'compare', label: 'Compare and mark up' },
    { key: 'markups', label: 'Markups', count: waitingMarkups.length || undefined },
    { key: 'drafts', label: 'Drafts' },
    { key: 'talk', label: 'Talk', count: news.length > 0 ? news.length : undefined },
    { key: 'history', label: 'History' },
    ...(isAiConfigured() ? [{ key: 'ai', label: 'Read it with AI' }] : []),
    ...(landing.sections.includes('seats') || landing.sections.includes('billing')
      ? [{ key: 'people', label: landing.sections.includes('invite') ? 'People and seats' : 'People' }]
      : []),
  ];
  const screen = screens.some((one) => one.key === searchParams?.view) ? searchParams!.view! : 'overview';
  const here = screens.find((one) => one.key === screen)!;
  const hrefFor = (key: string) => (key === 'overview' ? `/rooms/${view.room.id}` : `/rooms/${view.room.id}?view=${key}`);

  const people = (
    <ul className="room-people-strip" aria-label="Who is in the room">
      {view.role === 'owner' ? (
        <li className="room-person-chip">
          <span className="room-person-mark" style={{ background: you?.colour || '#c9a45c' }}>
            {stamp || 'SR'}
          </span>
          <span>
            <strong>{you ? seatName(you) : 'You'}</strong>
            <span className="small block muted">Showrunner</span>
          </span>
        </li>
      ) : (
        <li className="room-person-chip">
          <span className="room-person-mark" style={{ background: '#c9a45c' }}>
            SR
          </span>
          <span>
            <strong>The showrunner</strong>
            <span className="small block muted">Runs the room</span>
          </span>
        </li>
      )}
      {present
        .filter((seat) => !(view.role === 'owner' && you && seat.id === you.id))
        .map((seat) => (
          <li key={seat.id} className={`room-person-chip${seat.state === 'invited' ? ' invited' : ''}`}>
            <span className="room-person-mark" style={{ background: seat.colour || '#666666' }}>
              {seatInitials(seat)}
            </span>
            <span>
              <strong>{seatName(seat)}</strong>
              <span className="small block muted">
                {seat.title.trim() || ROLE_NAMES[seat.role]}
                {seat.state === 'invited' ? ' · invited' : ''}
                {you && seat.id === you.id ? ' · you' : ''}
              </span>
            </span>
          </li>
        ))}
      {present.length === 0 && view.role === 'owner' ? (
        <li className="room-person-chip empty">
          <a href={hrefFor('people')}>Nobody else yet. Invite your writing partner →</a>
        </li>
      ) : null}
    </ul>
  );

  const stats: { label: string; value: string | number; href?: string }[] = [
    { label: 'In the room', value: present.filter((seat) => seat.state === 'active').length + 1 },
    { label: 'Open assignments', value: open.length, href: hrefFor('assignments') },
    {
      label: deciding ? 'Waiting for review' : 'Sent for review',
      value: deciding ? waiting : queue.length,
      href: hrefFor('submissions'),
    },
    { label: 'Ideas in', value: boxes.length, href: hrefFor('ideas') },
    { label: 'Versions kept', value: versions.length, href: hrefFor('drafts') },
    { label: 'Master', value: master ? describeVersion(master) : 'Not agreed yet' },
  ];

  return (
    <div className="room-dashboard">
      <header className="room-head">
        <div className="room-head-main">
          <p className="eyebrow">Writers Room · {here.label}</p>
          <h1>{view.room.name || view.projectTitle || 'The room'}</h1>
          <p className="room-standing">{landing.standing}</p>
        </div>
        <div className="room-head-actions">
          {editorLabel ? (
            <a className="button" href={editorHref}>
              {editorLabel}
            </a>
          ) : null}
        </div>
      </header>

      <div className="room-layout">
        <main className="room-screen">
          {screen === 'overview' ? (
            <>
              <section className="room-panel">
                <h2>The project</h2>
                <p className="lede">{view.projectTitle || view.room.name}</p>
                <dl className="room-stats">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <dt>{stat.label}</dt>
                      <dd>{stat.href ? <a href={stat.href}>{stat.value}</a> : stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="room-panel">
                <h2>Who is in the room</h2>
                {people}
              </section>

              {waitingMarkups.length > 0 ? (
                <p className="notice">
                  {waitingMarkups.length === 1 ? 'A version of yours has' : `${waitingMarkups.length} of your versions have`}{' '}
                  come back marked up. <a href={hrefFor('markups')}>Read the markups →</a>
                </p>
              ) : null}

              <WhatIsNew news={news} seats={view.seats} />

              {open.length > 0 ? (
                <section className="room-panel">
                  <h2>Coming up</h2>
                  <ul className="room-due">
                    {open.slice(0, 3).map((one) => (
                      <li key={one.id} className={isOverdue(one, today) ? 'late' : undefined}>
                        <span className="room-dot" style={{ background: colourOf(one.assigneeId) }} />
                        <span>
                          <strong>{describeAssignment(one)}</strong>
                          <span className="small block muted">
                            {giving ? `${nameOf(one.assigneeId)} · ` : ''}
                            {one.dueOn ? `due ${one.dueOn}` : 'no date'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="small">
                    <a href={hrefFor('assignments')}>All assignments →</a>
                  </p>
                </section>
              ) : null}
            </>
          ) : null}

          {screen === 'assignments' ? (
            <>
              <section className="room-panel">
                <h2>{giving ? 'Every assignment, by date' : 'What you are being asked for, by date'}</h2>
                {listed.length === 0 ? (
                  <p>Nothing has been assigned yet.</p>
                ) : (
                  <div className="room-table">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Due</th>
                          <th scope="col">What</th>
                          {giving ? <th scope="col">Who</th> : null}
                          <th scope="col">Where it stands</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listed.map((one) => (
                          <tr key={one.id} className={isOverdue(one, today) ? 'late' : undefined}>
                            <td>{one.dueOn ?? '—'}</td>
                            <td>{describeAssignment(one)}</td>
                            {giving ? (
                              <td>
                                <span className="room-dot" style={{ background: colourOf(one.assigneeId) }} />{' '}
                                {nameOf(one.assigneeId)}
                              </td>
                            ) : null}
                            <td>
                              {ASSIGNMENT_STATE_NAMES[one.state]}
                              {isOverdue(one, today) ? ' · late' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {yours.length > 0 || !giving ? (
                <section className="room-panel">
                  <h2>Yours: say how it is going</h2>
                  <YourAsks roomId={view.room.id} assignments={yours} today={today} />
                </section>
              ) : null}

              {giving ? (
                <section className="room-panel">
                  <h2>Give out work</h2>
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
            </>
          ) : null}

          {screen === 'submissions' ? (
            <section className="room-panel">
              <h2>
                {deciding ? 'The review queue' : 'What you have sent'}
                {deciding && waiting > 0 ? <span className="pill">{waiting} waiting</span> : null}
              </h2>
              <Queue roomId={view.room.id} rows={queue} canDecide={deciding} />
              {deciding ? (
                <p className="small">
                  Reading a submission opens the version it came from in its own window. Nothing here deletes
                  anything, and a writer’s own line is never touched.
                </p>
              ) : null}
            </section>
          ) : null}

          {screen === 'ideas' ? (
            <section className="room-panel">
              <h2>The room’s ideas</h2>
              <Ideas roomId={view.room.id} boxes={boxes} categories={headings} canFile={deciding} />
            </section>
          ) : null}

          {screen === 'tray' && curating ? (
            <section className="room-panel">
              <h2>The Curation Tray</h2>
              <p className="small">
                Compare what has come in, take what you want of it, preview the master, and commit. Committing writes
                a new master beside the one before it and destroys nothing.
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

          {screen === 'compare' ? (
            <section className="room-panel">
              <h2>Compare and mark up</h2>
              <p className="small">
                Put one, two or three versions side by side. Select words in a version and pick a tool to highlight,
                strike, underline, note or suggest new wording, then send the markup back to that version’s writer.
                They are told by email and it waits for them under Markups.
              </p>
              <Compare roomId={view.room.id} versions={versionChoices} canMark={view.role !== 'viewer'} />
            </section>
          ) : null}

          {screen === 'markups' ? (
            (() => {
              const chosen = markups.find((one) => one.id === searchParams?.markup) ?? null;
              const received = markups.filter((one) => one.recipientId === user.id);
              const sentByYou = markups.filter((one) => one.authorId === user.id);
              const others = markups.filter((one) => one.recipientId !== user.id && one.authorId !== user.id);
              const row = (one: (typeof markups)[number]) => (
                <li key={one.id} className={one.state === 'sent' && one.recipientId === user.id ? 'unseen' : undefined}>
                  <span className="room-dot" style={{ background: colourOf(one.authorId) }} />
                  <span>
                    <a href={`${hrefFor('markups')}&markup=${one.id}`}>
                      <strong>{versionLabel(one.versionId)}</strong>
                    </a>
                    <span className="small block muted">
                      {nameOf(one.authorId)} → {nameOf(one.recipientId)} · {one.marks.length}{' '}
                      {one.marks.length === 1 ? 'mark' : 'marks'} · {one.sentAt.slice(0, 10)}
                      {one.state === 'sent' && one.recipientId === user.id ? ' · new' : one.state === 'seen' ? ' · opened' : ''}
                    </span>
                  </span>
                </li>
              );
              return (
                <>
                  {chosen ? (
                    <section className="room-panel">
                      <h2>{versionLabel(chosen.versionId)}</h2>
                      <p className="small">
                        Marked up by {nameOf(chosen.authorId)} for {nameOf(chosen.recipientId)} on {chosen.sentAt.slice(0, 10)}.
                      </p>
                      {chosen.note ? <p className="notice">{chosen.note}</p> : null}
                      <MarkupView
                        roomId={view.room.id}
                        versionId={chosen.versionId}
                        marks={chosen.marks}
                        markupId={chosen.id}
                        mine={chosen.recipientId === user.id && chosen.state === 'sent'}
                      />
                      <p className="small" style={{ marginTop: 12 }}>
                        <a href={hrefFor('markups')}>← All markups</a>
                      </p>
                    </section>
                  ) : null}
                  <section className="room-panel">
                    <h2>Sent to you</h2>
                    {received.length === 0 ? <p className="small">Nothing has been marked up for you yet.</p> : <ul className="room-due">{received.map(row)}</ul>}
                  </section>
                  <section className="room-panel">
                    <h2>Sent by you</h2>
                    {sentByYou.length === 0 ? (
                      <p className="small">
                        You have not sent a markup yet. Use <a href={hrefFor('compare')}>Compare and mark up</a>.
                      </p>
                    ) : (
                      <ul className="room-due">{sentByYou.map(row)}</ul>
                    )}
                  </section>
                  {others.length > 0 ? (
                    <section className="room-panel">
                      <h2>The rest of the room</h2>
                      <ul className="room-due">{others.map(row)}</ul>
                    </section>
                  ) : null}
                </>
              );
            })()
          ) : null}

          {screen === 'drafts' ? (
            <section className="room-panel">
              <h2>Drafts, desk by desk</h2>
              {master ? (
                <p className="small">
                  The room agreed on{' '}
                  <a href={`/preview?room=${view.room.id}&version=${master.id}`} target="_blank" rel="noreferrer">
                    {describeVersion(master)}
                  </a>
                  . Every draft here was taken from it.
                </p>
              ) : (
                <p className="small">
                  The room has not agreed on a draft yet, so every writer’s line starts from the project as it stands.
                </p>
              )}
              <Desks roomId={view.room.id} desks={desks} />
            </section>
          ) : null}

          {screen === 'talk' ? (
            <section className="room-panel">
              <h2>Talk</h2>
              <p className="small">Threads about the room itself. Nothing said here is ever deleted.</p>
              <Talk
                roomId={view.room.id}
                threads={threads}
                seats={view.seats}
                you={user.id}
                role={view.role}
                mayComment={canComment(view.role)}
              />
            </section>
          ) : null}

          {screen === 'history' ? (
            <section className="room-panel">
              <h2>What has happened</h2>
              <Trail roomId={view.room.id} events={trail} />
              {curating ? (
                <p className="small" style={{ marginTop: 16 }}>
                  <a className="button small secondary" href={`/api/rooms/${view.room.id}/export`}>
                    Take the whole room out
                  </a>
                </p>
              ) : null}
            </section>
          ) : null}

          {screen === 'ai' && isAiConfigured() ? (
            <section className="room-panel">
              <h2>Read it with AI</h2>
              <Spend
                roomId={view.room.id}
                standing={spend}
                enabled={view.room.aiEnabled}
                yours={view.role === 'owner'}
              />
              {curating ? (
                <>
                  <p className="small">
                    A reading, not a decision: what differs between two passes and where the room has had the same
                    idea twice. It never writes or merges anything.
                  </p>
                  <Assist
                    roomId={view.room.id}
                    available={mayAsk === true}
                    reason={mayAsk === true ? null : assistRefusalText(mayAsk)}
                    passes={passes}
                    scenes={scenesIn}
                    names={Object.fromEntries(view.seats.map((seat) => [seat.userId, seatName(seat)]))}
                  />
                </>
              ) : null}
            </section>
          ) : null}

          {screen === 'people' ? (
            <>
              <section className="room-panel">
                <h2>Who is in the room</h2>
                {people}
              </section>

              {landing.sections.includes('seats') ? (
                <section className="room-panel">
                  <h2>{landing.sections.includes('invite') ? 'Invite and manage seats' : 'Seats'}</h2>
                  <Seats
                    roomId={view.room.id}
                    seats={view.seats}
                    canManage={landing.sections.includes('invite')}
                    youId={you?.id ?? null}
                  />
                </section>
              ) : null}

              {landing.sections.includes('billing') ? (
                <section className="room-panel">
                  <h2>The room’s subscription</h2>
                  <p className="small">{describeSeats(view.seatsCount)}</p>
                  {/* Who is in the room above, what it costs here, because a
                      showrunner asks them separately (stage 15). */}
                  <Billing
                    roomId={view.room.id}
                    line={describeBilling({ count: view.seatsCount, billing, roomCents, seatCents })}
                    billing={billing}
                    wanted={seatsToBill(view.room, view.seats)}
                    yours={view.role === 'owner'}
                  />
                  <p className="small">
                    The showrunner pays for the room and every extra seat; nobody you invite is ever asked to pay. An
                    invitation nobody has answered is not billed, and a seat you take out of the room stops being
                    billed and keeps everything it wrote.
                  </p>
                </section>
              ) : null}

              <section className="room-panel">
                <h2>Your pages</h2>
                {you && you.colour ? (
                  <>
                    {/* What a page of this writer's draft carries in its top
                        left corner (§6.1). */}
                    <p className="room-stamp" style={{ color: you.colour }}>
                      {stamp || '—'}
                    </p>
                    <p className="lede">
                      {seatName(you)}
                      {you.title ? ` · ${you.title}` : ''}
                    </p>
                  </>
                ) : (
                  <p className="small">
                    {view.role === 'owner'
                      ? 'Your pages carry your stamp once you give yourself a colour.'
                      : 'The showrunner has not given you a colour yet. Yours appears on every page of your draft once they do.'}
                  </p>
                )}
                {/* Yours and nobody else's, including the showrunner's (stage 14). */}
                {you ? <NotifyMe roomId={view.room.id} on={you.notifyByEmail} /> : null}
              </section>
            </>
          ) : null}
        </main>

        {/* The menu, on the right (from Ken). Links rather than tabs, so each
            screen has an address: a reload or a shared link opens the same
            one, and Back goes where a person expects. */}
        <nav className="room-menu" aria-label="The room">
          {screens.map((one) => (
            <a
              key={one.key}
              href={hrefFor(one.key)}
              className={one.key === screen ? 'on' : undefined}
              aria-current={one.key === screen ? 'page' : undefined}
            >
              <span>{one.label}</span>
              {one.count ? <span className="room-menu-count">{one.count}</span> : null}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
