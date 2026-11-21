import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ROLE_NAMES } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadMyRooms } from '@/lib/rooms';
import { StartRoom } from './start-room';

export const metadata: Metadata = { title: 'Writers Room' };
export const dynamic = 'force-dynamic';

/**
 * The room's heading, with its mark beside it as the home page has VC
 * Writer's: VC Writer's artwork with VC WRITERS ROOM on the plaque
 * (brand/logo/VC-Writers-Room-1024x1024.png).
 */
function RoomsHero({ children }: { children: ReactNode }) {
  return (
    <div className="hero hero-split">
      <div>
        <h1>Writers Room</h1>
        {children}
      </div>
      <img src="/writers-room-logo.webp" width={640} height={640} alt="VC Writers Room" className="emblem" fetchPriority="high" />
    </div>
  );
}

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
      <RoomsHero>
        <p>Sign in to see the rooms you are in.</p>
        <Link href="/signin?next=%2Frooms" className="button">
          Sign in
        </Link>
      </RoomsHero>
    );
  }

  const rooms = await loadMyRooms();

  return (
    <>
      <RoomsHero>
        <p>{user.email}</p>
      </RoomsHero>

      <section>
        <h2>Your rooms</h2>
        {rooms.length === 0 ? (
          <p className="lede">
            You are not in a room yet. Start one below, or wait to be asked into somebody else’s.
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

      <section>
        <h2>Start a room</h2>
        <p className="lede">
          Start a new project for the room, or bring one you already have in VC Writer. The project stays yours; the room is who else is
          allowed near it.
        </p>
        <StartRoom />
      </section>
    </>
  );
}
