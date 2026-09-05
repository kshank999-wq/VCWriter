import type { Metadata } from 'next';
import Link from 'next/link';
import { currentAdmin } from '@/lib/admin';
import { SupportConsole } from './support-console';

export const metadata: Metadata = { title: 'Support' };
export const dynamic = 'force-dynamic';

/**
 * Support console (spec §3.3).
 *
 * The point of this page is that nobody has to open the database to answer a
 * ticket. It shows what a customer bought, which machines hold their seats,
 * and whether their emails actually arrived — and lets support act on all
 * three.
 */
export default async function SupportPage() {
  const admin = await currentAdmin();

  if (!admin) {
    return (
      <>
        <div className="hero">
          <h1>Support</h1>
          <p>This area is for release administrators.</p>
        </div>
        <Link href="/signin?next=/admin/support" className="button">
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <h1>Support</h1>
        <p>Look up a customer by the email address on their account.</p>
      </div>
      <SupportConsole />
    </>
  );
}
