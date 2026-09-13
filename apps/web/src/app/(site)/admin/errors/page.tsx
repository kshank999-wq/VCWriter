import type { Metadata } from 'next';
import Link from 'next/link';
import { currentAdmin } from '@/lib/admin';
import { adminClient } from '@/lib/supabase';
import { groupErrorReports, type ErrorReportRow } from './grouping';

export const metadata: Metadata = { title: 'Error reports' };
export const dynamic = 'force-dynamic';

/**
 * Error triage (spec §14).
 *
 * Grouped rather than listed, because the useful question is "what is breaking
 * for people, and how many people" — a chronological feed of a hundred copies
 * of the same crash answers neither.
 *
 * Reports carry no manuscript content, so there is nothing here to protect
 * beyond the fact of a crash; the admin check exists because build versions and
 * crash volume are still nobody else's business.
 */
export default async function ErrorReportsPage() {
  const admin = await currentAdmin();

  if (!admin) {
    return (
      <>
        <div className="hero">
          <h1>Error reports</h1>
          <p>This area is for administrators.</p>
        </div>
        <Link href="/signin?next=/admin/errors" className="button">
          Sign in
        </Link>
      </>
    );
  }

  const { data } = await adminClient()
    .from('error_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  const groups = groupErrorReports((data ?? []) as ErrorReportRow[]);

  return (
    <>
      <div className="hero">
        <h1>Error reports</h1>
        <p>
          The last {data?.length ?? 0} reports, grouped by what broke. Reporting is opt-in, so this is a sample
          of failures rather than all of them. No report contains a writer&rsquo;s work.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="lede">Nothing reported.</p>
      ) : (
        <ul className="order-list">
          {groups.map((group) => (
            <li key={group.key} className="card">
              <div className="build-row">
                <div>
                  <strong>{group.errorName}</strong>
                  <p className="lede">{group.errorMessage}</p>
                  <p className="lede">
                    {group.surface} · {group.platforms.join(', ') || 'unknown platform'} ·{' '}
                    {group.versions.join(', ') || 'unknown version'}
                  </p>
                </div>
                <div>
                  <p className="lede">
                    {group.count} {group.count === 1 ? 'report' : 'reports'}
                    {/* Signed-out reports carry no user, so this is a floor. */}
                    {group.knownUsers > 0 ? ` · ${group.knownUsers}+ people` : null}
                  </p>
                  <p className="lede">
                    Last seen {group.lastSeen ? new Date(group.lastSeen).toISOString().slice(0, 16).replace('T', ' ') : '—'}
                  </p>
                </div>
              </div>
              {group.stack ? <pre className="stack">{group.stack}</pre> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
