import type { Metadata } from 'next';
import Link from 'next/link';
import { ROLE_NAMES } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadMyRooms, roomlessProjects } from '@/lib/rooms';
import { StartRoom } from './start-room';

export const metadata: Metadata = { title: 'Writers Room' };
export const dynamic = 'force-dynamic';

/**
 * The front door (addendum 07 §5).
 *
 * **Signing in does not open the software. It opens the room.** This is the
 * list of rooms you are in, and each card already answers the question the
 * whole module is arranged around — *what is my part in this* — so a writer
 * knows where they stand before they have opened anything.
 */
export default async function RoomsPage() {
  const user = await currentUser();
  if (!user) {
    return (
      <>
        <div className="hero">
          <h1>Writers Room</h1>
          <p>Sign in to see the rooms you are in.</p>
        </div>
        <Link href="/signin?next=%2Frooms" className="button">
          Sign in
        </Link>
      </>
    );
  }

  const [rooms, startable] = await Promise.all([loadMyRooms(), roomlessProjects()]);

  return (
    <>
      <div className="hero">
        <h1>Writers Room</h1>
        <p>{user.email}</p>
      </div>

      <section>
        <h2>Your rooms</h2>
        {rooms.length === 0 ? (
          <p className="lede">
            You are not in a room yet. Start one over a project you own, or wait to be asked into
            somebody else’s.
          </p>
        ) : (
          <div className="grid">
            {rooms.map((card) => (
              <article key={card.room.id} className="card">
                <h3>{card.room.name || card.projectTitle || 'Untitled room'}</h3>
                <p className="lede">
                  {card.projectTitle}
                  {card.role ? ` · you are the ${ROLE_NAMES[card.role].toLowerCase()}` : ''}
                </p>
                <p style={{ marginTop: 16 }}>
                  <Link href={`/rooms/${card.room.id}`} className="button">
                    Go to the room
                  </Link>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {startable.length > 0 ? (
        <section>
          <h2>Start a room</h2>
          <p className="lede">
            A room is attached to a project you already have. The project stays yours; the room is
            who else is allowed near it.
          </p>
          <StartRoom projects={startable} />
        </section>
      ) : null}
    </>
  );
}
