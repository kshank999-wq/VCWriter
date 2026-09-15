import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LEARNING_AID_KINDS } from '@vcwriter/domain';
import { resolveCaller } from '@/lib/ai-caller';
import { RULES, rateLimit } from '@/lib/rate-limit';
import { generateAid, isConfigured } from '@/lib/ai-learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Reading a section and writing an aid takes a while; the platform default
// would cut it short.
export const maxDuration = 120;

/**
 * **The shape is the permission**, and this is the second gate on it
 * (addendum 16 §10).
 *
 * What the client may send is a kind, a section's words and what the section is
 * called. There is no field here for the author's own text, none for which aid
 * row this is, and none for `approved` — so nothing a client sends can reach
 * the fields a suggestion must never touch, and what comes back is a
 * `LearningSuggestion` with nowhere to put anything more.
 *
 * **Only the section's own words are accepted**, and none are read from the
 * database: what leaves the writer's machine is what they asked to have read.
 * A summary that quietly drew on the next section is a summary promising the
 * reader something they have not been told yet.
 */
const bodySchema = z.object({
  kind: z.enum(LEARNING_AID_KINDS),
  sectionText: z.string().min(1).max(40_000),
  sectionTitle: z.string().max(200).default(''),
});

export async function POST(request: Request): Promise<Response> {
  if (!isConfigured()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A section to read is required' }, { status: 400 });
  }

  const caller = await resolveCaller(request);
  if (!caller) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  }
  if (caller.unchecked) {
    return NextResponse.json({ error: 'Your license could not be checked' }, { status: 500 });
  }
  if (!caller.entitled) {
    return NextResponse.json({ error: NO_LICENSE }, { status: 403 });
  }

  // Counted against the account rather than the address: the cost belongs to
  // whoever is signed in, wherever they are sitting.
  const limited = await rateLimit(request, RULES.learningAid, undefined, caller.userId);
  if (limited) return limited;

  try {
    const made = await generateAid(parsed.data);
    // The token counts come back so the desktop could meter later if it ever
    // needs to; nothing on the screen reads them yet.
    return NextResponse.json({ suggestion: made.suggestion });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The suggestion could not be written';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Whether a suggestion can be asked for at all, without asking for one.
 *
 * The button that spends money should be able to say why it is not there —
 * not configured, not signed in, no license — instead of failing after the
 * click. Nothing here costs anything or reaches a model.
 */
export async function GET(request: Request): Promise<Response> {
  const configured = isConfigured();
  const caller = await resolveCaller(request);
  return NextResponse.json({
    configured,
    signedIn: caller !== null,
    entitled: caller?.entitled ?? false,
    reason: !configured ? NOT_CONFIGURED : !caller ? SIGN_IN : !caller.entitled ? NO_LICENSE : null,
  });
}

const NOT_CONFIGURED = 'Suggestions are not configured on this deployment';
const SIGN_IN = 'Sign in to have a suggestion written';
const NO_LICENSE = 'An active VC Writer license is needed for suggestions';
