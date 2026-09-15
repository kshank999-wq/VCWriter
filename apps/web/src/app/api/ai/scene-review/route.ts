import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCaller } from '@/lib/ai-caller';
import { RULES, rateLimit } from '@/lib/rate-limit';
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
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A scene to read is required' }, { status: 400 });
  }

  const caller = await resolveCaller(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sign in to use the Final Editor' }, { status: 401 });
  }
  if (caller.unchecked) {
    return NextResponse.json({ error: 'Your license could not be checked' }, { status: 500 });
  }
  if (!caller.entitled) {
    return NextResponse.json({ error: NO_LICENSE }, { status: 403 });
  }

  // Counted against the account rather than the address: the cost belongs to
  // whoever is signed in, wherever they are sitting.
  const limited = await rateLimit(request, RULES.sceneReview, undefined, caller.userId);
  if (limited) return limited;

  try {
    const verdict = await reviewScene(parsed.data);
    return NextResponse.json({ verdict });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The structural read failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Whether a read can be asked for at all, without asking for one.
 *
 * The button that spends money should be able to say why it is greyed out —
 * not configured, not signed in, no license — instead of failing after the
 * click. Nothing here costs anything or reaches a model.
 */
export async function GET(request: Request): Promise<Response> {
  const configured = isAiConfigured();
  const caller = await resolveCaller(request);
  return NextResponse.json({
    configured,
    signedIn: caller !== null,
    entitled: caller?.entitled ?? false,
    reason: !configured
      ? NOT_CONFIGURED
      : !caller
        ? 'Sign in to use the Final Editor'
        : !caller.entitled
          ? NO_LICENSE
          : null,
  });
}

const NOT_CONFIGURED = 'AI review is not configured on this deployment';
const NO_LICENSE = 'An active VC Writer license is needed for AI review';

