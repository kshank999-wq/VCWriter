import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  OPENS_LABEL,
  describeSeats,
  describeVersion,
  desksIn,
  masterVersion,
  seatInitials,
  seatName,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { branchesIn, versionsFor } from '@/lib/branches';
import { Seats } from './seats';
import { Desks } from './desks';

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
  const [branches, versions] = await Promise.all([branchesIn(view.room.id), versionsFor(view.room.id)]);
  const desks = desksIn({ seats: view.seats, branches, versions, viewer: { userId: user.id } });
  const master = masterVersion(versions);

  return (
    <>
      <div className="hero">
        <h1>{view.room.name || view.projectTitle || 'The room'}</h1>
        <p>{landing.standing}</p>
      </div>

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
