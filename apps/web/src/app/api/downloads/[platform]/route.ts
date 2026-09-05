import { NextResponse } from 'next/server';
import { canDownloadPlatform, licenseSchema, platformSchema } from '@vcwriter/domain';
import { env } from '@/lib/env';
import { adminClient, currentUser } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issue a download for the current build of one platform (spec §12.4, §19).
 *
 * The installer is never a permanent public URL. Every request re-checks the
 * caller's license and mints a short-lived signed URL, so a link that leaks is
 * useless within minutes and a revoked license stops working immediately.
 */
export async function GET(
  _request: Request,
  { params }: { params: { platform: string } },
): Promise<Response> {
  const platform = platformSchema.safeParse(params.platform);
  if (!platform.success) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to download VC Writer' }, { status: 401 });
  }

  const client = adminClient();

  const { data: licenseRows, error: licenseError } = await client
    .from('licenses')
    .select('id, user_id, order_id, serial, status, entitled_platforms, max_activations, expires_at, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (licenseError) {
    return NextResponse.json({ error: 'Could not read your licenses' }, { status: 500 });
  }

  const entitled = (licenseRows ?? []).some((row) => {
    const parsed = licenseSchema.safeParse({
      id: row.id,
      userId: row.user_id,
      orderId: row.order_id,
      serial: row.serial,
      status: row.status,
      entitledPlatforms: row.entitled_platforms,
      maxActivations: row.max_activations,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    return parsed.success && canDownloadPlatform(parsed.data, platform.data);
  });

  if (!entitled) {
    return NextResponse.json(
      { error: `Your account does not have a ${platform.data === 'windows' ? 'Windows' : 'macOS'} download` },
      { status: 403 },
    );
  }

  const { data: build, error: buildError } = await client
    .from('release_builds')
    .select('version, artifact_key, sha256, minimum_os_version')
    .eq('platform', platform.data)
    .eq('channel', 'stable')
    .eq('active', true)
    .maybeSingle();
  if (buildError) {
    return NextResponse.json({ error: 'Could not read the release catalogue' }, { status: 500 });
  }
  if (!build) {
    return NextResponse.json({ error: 'No published build for this platform yet' }, { status: 404 });
  }

  const { data: signed, error: signError } = await client.storage
    .from(env.releaseBucket)
    .createSignedUrl(build.artifact_key, env.releaseDownloadTtlSeconds);
  if (signError || !signed) {
    return NextResponse.json({ error: 'Could not prepare the download' }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    version: build.version,
    sha256: build.sha256,
    minimumOsVersion: build.minimum_os_version,
    expiresInSeconds: env.releaseDownloadTtlSeconds,
  });
}
