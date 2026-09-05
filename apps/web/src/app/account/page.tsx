import type { Metadata } from 'next';
import Link from 'next/link';
import { adminClient, currentUser } from '@/lib/supabase';
import { DownloadButton } from './download-button';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

/**
 * My Account / Downloads (spec §3.2, §12.4): the customer can come back at any
 * time and retrieve the current authorised build for either platform.
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
  const [{ data: licenses }, { data: builds }] = await Promise.all([
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
  ]);

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
    </>
  );
}
