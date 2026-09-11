import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase';
import { acceptInvitation } from '@/lib/rooms';

export const metadata: Metadata = { title: 'Join the room' };
export const dynamic = 'force-dynamic';

/**
 * Taking up an invitation (addendum 07 §14).
 *
 * **The link needs a signed-in person, not an anonymous one.** An invitation
 * says which *address* was asked; who turns up has to be an account, because
 * a seat is what a person holds and billing counts people. So an unsigned
 * visitor is sent to sign in and brought straight back here.
 *
 * Accepting is what turns an invitation into a seat the room bills for, and it
 * spends the link: it is not a way back in afterwards.
 */
export default async function JoinPage({ params }: { params: { token: string } }) {
  const user = await currentUser();
  if (!user) {
    const back = encodeURIComponent(`/rooms/join/${params.token}`);
    return (
      <>
        <div className="hero">
          <h1>You have been asked into a room</h1>
          <p>Sign in, and the invitation is taken up for you.</p>
        </div>
        <Link href={`/signin?next=${back}`} className="button">
          Sign in to accept
        </Link>
      </>
    );
  }

  const result = await acceptInvitation({ token: params.token, userId: user.id });
  if ('reason' in result) {
    return (
      <>
        <div className="hero">
          <h1>That invitation has gone</h1>
          <p>
            {result.reason === 'expired'
              ? 'The link has expired. Ask the showrunner to send another.'
              : 'This link has already been used, or it was never one of ours.'}
          </p>
        </div>
        <Link href="/rooms" className="button">
          Go to your rooms
        </Link>
      </>
    );
  }

  redirect(`/rooms/${result.roomId}`);
}
