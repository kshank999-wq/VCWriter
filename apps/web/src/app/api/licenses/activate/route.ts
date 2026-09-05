import { NextResponse } from 'next/server';
import { z } from 'zod';
import { platformSchema } from '@vcwriter/domain';
import { activateDevice } from '@/lib/activation-service';
import { adminClient, currentUser } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  serial: z.string().min(1).max(60),
  deviceFingerprint: z.string().min(8).max(200),
  deviceName: z.string().max(120).default(''),
  platform: platformSchema,
  appVersion: z.string().max(40).default(''),
});

/**
 * Activate this installation against a license (spec §3.3).
 *
 * Authenticated by session cookie or a desktop bearer token — the same two
 * callers the AI route serves. A serial alone is never enough: activation is
 * scoped to licenses on the authenticated account, so a leaked serial cannot
 * consume someone else's seats.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A serial and device are required' }, { status: 400 });
  }

  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to activate VC Writer' }, { status: 401 });

  const result = await activateDevice({ userId, ...parsed.data });

  if (result.outcome.result === 'refused') {
    // 409: the request is well formed and the caller is who they say — there is
    // simply no seat, which the message explains and the customer can fix.
    return NextResponse.json({ error: result.message, outcome: result.outcome }, { status: 409 });
  }

  return NextResponse.json({ activated: true, reason: result.outcome.reason, license: result.license });
}

const resolveUserId = async (request: Request): Promise<string | null> => {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const { data } = await adminClient().auth.getUser(header.slice(7).trim());
    return data.user?.id ?? null;
  }
  const user = await currentUser();
  return user?.id ?? null;
};
