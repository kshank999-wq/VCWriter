import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { adminClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  active: z.boolean().optional(),
  releaseNotes: z.string().max(20_000).optional(),
  minimumOsVersion: z.string().max(40).optional(),
  channel: z.enum(['stable', 'beta', 'internal']).optional(),
});

/**
 * Activate or retire one build (spec §17: "Admin can publish a new Windows
 * build without replacing the Mac artifact, and vice versa").
 *
 * Activating retires the build it replaces *for that platform and channel
 * only*. The database enforces the same rule with a partial unique index, so
 * the two cannot disagree; doing it here as well means the operator sees one
 * build swap rather than a constraint violation.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'This area is for release administrators.' }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nothing valid to change' }, { status: 400 });
  }

  const client = adminClient();
  const { data: build, error: readError } = await client
    .from('release_builds')
    .select('id, platform, channel')
    .eq('id', params.id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: 'That build could not be read' }, { status: 500 });
  if (!build) return NextResponse.json({ error: 'No such build' }, { status: 404 });

  if (parsed.data.active === true) {
    // Retire the outgoing build on this platform and channel — and nothing else.
    const { error: retireError } = await client
      .from('release_builds')
      .update({ active: false })
      .eq('platform', build.platform)
      .eq('channel', build.channel)
      .eq('active', true);
    if (retireError) {
      return NextResponse.json({ error: 'The previous build could not be retired' }, { status: 500 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.active !== undefined) {
    patch['active'] = parsed.data.active;
    if (parsed.data.active) patch['published_at'] = new Date().toISOString();
  }
  if (parsed.data.releaseNotes !== undefined) patch['release_notes'] = parsed.data.releaseNotes;
  if (parsed.data.minimumOsVersion !== undefined) patch['minimum_os_version'] = parsed.data.minimumOsVersion;
  if (parsed.data.channel !== undefined) patch['channel'] = parsed.data.channel;

  const { error } = await client.from('release_builds').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
