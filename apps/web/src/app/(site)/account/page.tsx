import type { Metadata } from 'next';
import Link from 'next/link';
import { describeNotesPlan, mayCaptureNotes } from '@vcwriter/domain';
import { adminClient, currentUser } from '@/lib/supabase';
import { notesPlanFor } from '@/lib/notes-subscription';
import { DownloadButton } from './download-button';
import { ResendLicense } from './resend-license';
import { Devices } from './devices';
import { SetPassword } from './set-password';
import { DeleteAccount } from './delete-account';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

const formatMoney = (cents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

/**
 * My Account / Downloads (spec §3.2, §12.4): the customer can come back at any
 * time and retrieve the current authorised build for either platform, see what
 * they bought, and have their license sent again without contacting support.
 */
export default async function AccountPage() {
  const user = await currentUser();
  if (!user) {
    return (
      <>
        <div className="hero">
          <h1>My account</h1>
          <p>Sign in to see your license and downloads.</p>
        </div>
        <Link href="/signin" className="button">
          Sign in
        </Link>
      </>
    );
  }

  const client = adminClient();
  const [{ data: licenses }, { data: builds }, { data: orders }, { data: profile }] = await Promise.all([
    client
      .from('licenses')
      .select('serial, status, entitled_platforms, max_activations, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    client
      .from('release_builds')
      .select('platform, version, minimum_os_version, published_at')
      .eq('channel', 'stable')
      .eq('active', true),
    client
      .from('orders')
      .select('id, status, amount_cents, currency, selected_platform, paid_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
  ]);

  const { plan: notes } = await notesPlanFor(user.id);

  const activeLicenses = (licenses ?? []).filter((license) => license.status === 'active');

  return (
    <>
      <div className="hero">
        <h1>My account</h1>
        <p>{user.email}</p>
      </div>

      <section>
        <h2>Licenses</h2>
        {activeLicenses.length === 0 ? (
          <p className="lede">
            No active license yet. <Link href="/download">Buy VC Writer</Link> to get one.
          </p>
        ) : (
          <>
            <div className="grid">
              {activeLicenses.map((license) => (
                <article key={license.serial} className="card">
                  <h3>License</h3>
                  <p className="serial">{license.serial}</p>
                  <p style={{ marginTop: 8 }}>
                    Covers {license.entitled_platforms.join(' and ')} · up to {license.max_activations} devices
                  </p>
                </article>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <ResendLicense />
            </div>
          </>
        )}
      </section>

      <section>
        <h2>Downloads</h2>
        {activeLicenses.length === 0 ? (
          <p className="lede">Downloads appear here once you have a license.</p>
        ) : (builds ?? []).length === 0 ? (
          <p className="lede">No build has been published yet. Your license is ready for when one is.</p>
        ) : (
          <div className="grid">
            {(builds ?? []).map((build) => (
              <article key={build.platform} className="card">
                <h3>{build.platform === 'windows' ? 'Windows 10 / 11' : 'macOS'}</h3>
                <p>
                  Version {build.version}
                  {build.minimum_os_version ? ` · requires ${build.minimum_os_version} or later` : ''}
                </p>
                <p style={{ marginTop: 16 }}>
                  <DownloadButton platform={build.platform as 'windows' | 'macos'} />
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeLicenses.length > 0 ? (
        <section>
          <h2>Devices</h2>
          <Devices />
        </section>
      ) : null}

      {(orders ?? []).length > 0 ? (
        <section>
          <h2>Purchases</h2>
          <ul className="order-list">
            {(orders ?? []).map((order) => (
              <li key={order.id} className="card">
                <div className="build-row">
                  <div>
                    <strong>{formatMoney(order.amount_cents, order.currency)}</strong>
                    <p className="lede">
                      {formatDate(order.paid_at ?? order.created_at)}
                      {order.selected_platform ? ` · chose ${order.selected_platform}` : ''}
                      {order.status !== 'paid' ? ` · ${order.status}` : ''}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Notes (addendum 27 §14). **The line is read and the managing is the
          shop's**: this says where the subscription stands and points at the
          store that sells it, because cancelling, changing the card and moving
          between the two plans all happen in an Apple or Google account and a
          button here could only pretend to. Said for everybody, including
          somebody who has never bought it, so the feature is findable from the
          account rather than only from the app that needs it. */}
      <section>
        <h2>Notes</h2>
        <p className="lede">{describeNotesPlan(notes)}</p>
        <p className="muted small">
          {mayCaptureNotes(notes)
            ? 'Managed in your App Store or Google Play account, where you bought it.'
            : 'The voice notebook for iPhone and Android, with syncing to your desktop.'}{' '}
          <Link href="/notes">What Notes does</Link>
        </p>
      </section>

      {/* **Whether they have one is not asked**, because nothing on the user
          honestly answers it: an `email` identity exists for a link-only
          account too, and there is no *has a password* flag. So the section
          reads the same either way rather than guessing and labelling it
          wrongly half the time. */}
      <SetPassword />

      {profile?.is_admin ? (
        <section>
          <h2>Administration</h2>
          <p className="lede">
            <Link href="/admin/releases">Manage release builds</Link> ·{' '}
            <Link href="/admin/support">Support console</Link> ·{' '}
            <Link href="/admin/errors">Error reports</Link>
          </p>
        </section>
      ) : null}

      {/* Last on the page on purpose: the one act here that cannot be undone,
          below everything somebody came to do. */}
      <DeleteAccount email={user.email ?? ''} />
    </>
  );
}
