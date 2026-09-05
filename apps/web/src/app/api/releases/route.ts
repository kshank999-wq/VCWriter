import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Release metadata for the desktop updater (spec §3.3).
 *
 * The client asks "is there a newer build for my platform?" and never holds a
 * hard-coded download URL: the artifact itself comes from
 * `/api/downloads/[platform]`, which checks entitlement and signs a short-lived
 * URL. This endpoint deliberately exposes version information only.
 */
export async function GET(): Promise<Response> {
  const { data, error } = await adminClient()
    .from('release_builds')
    .select('platform, version, minimum_os_version, release_notes, published_at, sha256')
    .eq('channel', 'stable')
    .eq('active', true);

  if (error) {
    return NextResponse.json({ error: 'Could not read the release catalogue' }, { status: 500 });
  }

  return NextResponse.json({
    builds: (data ?? []).map((build) => ({
      platform: build.platform,
      version: build.version,
      minimumOsVersion: build.minimum_os_version,
      releaseNotes: build.release_notes,
      publishedAt: build.published_at,
      sha256: build.sha256,
    })),
  });
}
