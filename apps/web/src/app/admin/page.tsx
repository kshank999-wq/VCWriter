import type { Metadata } from 'next';
import Link from 'next/link';
import { currentAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

/**
 * The front door to the administration pages.
 *
 * There is no separate administrator login. An administrator signs in the
 * same way a customer does, and what makes the difference is `is_admin` on
 * their profile, checked on every request (lib/admin.ts). This page exists
 * because without it the three consoles were only reachable by knowing their
 * URLs.
 */
const CONSOLES = [
  {
    href: '/admin/releases',
    title: 'Releases',
    body: 'Upload installers, choose which build each platform serves, retire old ones.',
  },
  {
    href: '/admin/support',
    title: 'Support',
    body: 'Look up a customer by email: their order, licence, and activated devices.',
  },
  {
    href: '/admin/errors',
    title: 'Error reports',
    body: 'Crashes reported by the application, grouped by cause, newest first.',
  },
] as const;

export default async function AdminPage() {
  const admin = await currentAdmin();

  if (!admin) {
    return (
      <>
        <div className="hero">
          <h1>Admin</h1>
          <p>This area is for administrators.</p>
        </div>
        <Link href="/signin?next=/admin" className="button">
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <h1>Admin</h1>
        <p>Signed in as {admin.email ?? 'an administrator'}.</p>
      </div>
      <div className="grid">
        {CONSOLES.map((console) => (
          <Link key={console.href} href={console.href} className="card">
            <h3>{console.title}</h3>
            <p>{console.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
