import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient, currentUser } from '@/lib/supabase';
import { isAiConfigured, reviewScene } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A structural read takes a while; the platform default would cut it short.
export const maxDuration = 120;

const bodySchema = z.object({
  sceneText: z.string().min(1).max(40_000),
  position: z.string().max(120).optional(),
  format: z.enum(['screenplay', 'prose']).default('screenplay'),
});

/**
 * The Final Editor's AI pass (spec §8.2).
 *
 * Authenticated two ways because two clients call it: a browser session
 * cookie, or a bearer token from the desktop application. Either way the
 * caller must hold an active license — every request costs real money, so
 * entitlement is checked here rather than trusted from the client (§12.1).
 *
 * Only the scene's own text is accepted. There is no field for the rest of the
 * project, and none is read from the database: what leaves the writer's
 * machine is what they asked to have read.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI review is not configured on this deployment' }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A scene to read is required' }, { status: 400 });
  }

  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to use the Final Editor' }, { status: 401 });
  }

  const { data: licenses, error } = await adminClient()
    .from('licenses')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  if (error) {
    return NextResponse.json({ error: 'Your license could not be checked' }, { status: 500 });
  }
  if (!licenses || licenses.length === 0) {
    return NextResponse.json({ error: 'An active VC Writer license is needed for AI review' }, { status: 403 });
  }

  try {
    const verdict = await reviewScene(parsed.data);
    return NextResponse.json({ verdict });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The structural read failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Session cookie for the website, bearer token for the desktop application. */
const resolveUserId = async (request: Request): Promise<string | null> => {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    const { data } = await adminClient().auth.getUser(token);
    return data.user?.id ?? null;
  }
  const user = await currentUser();
  return user?.id ?? null;
};
