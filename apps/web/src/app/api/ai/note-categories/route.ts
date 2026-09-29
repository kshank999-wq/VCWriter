import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCaller } from '@/lib/ai-caller';
import { RULES, rateLimit } from '@/lib/rate-limit';
import { isConfigured, suggestNames } from '@/lib/ai-note-categories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Reading a page of notes and naming what is in it takes a while; the platform
// default would cut it short.
export const maxDuration = 120;

/**
 * Naming groupings in a sitting's unsorted notes (addendum 26 §14a).
 *
 * **The shape is the permission on both sides.** What may be sent is a list of
 * passages and a list of category names — there is no field for a card id, a
 * source id, a range or a session, so a client cannot ask for anything to be
 * filed and the reading cannot answer about anything but words. What comes back
 * is names and sentences, which is the only thing this feature is for.
 *
 * **Only the unsorted passages are accepted**, and none are read from the
 * database: what leaves the writer's machine is what they pressed a button to
 * have read, and the screen says so beside the press.
 */
const bodySchema = z.object({
  passages: z.array(z.string().min(1).max(4_000)).min(1).max(120),
  categories: z.array(z.string().max(120)).max(60).default([]),
});

export async function POST(request: Request): Promise<Response> {
  if (!isConfigured()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Some unsorted notes to read are required' }, { status: 400 });
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

  // Counted against the account rather than the address, as every other AI
  // endpoint here is: the cost belongs to whoever is signed in.
  const limited = await rateLimit(request, RULES.noteCategories, undefined, caller.userId);
  if (limited) return limited;

  try {
    const named = await suggestNames(parsed.data);
    return NextResponse.json({ ideas: named.suggested.ideas });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The groupings could not be named';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Whether names can be asked for at all, without asking for any.
 *
 * The button that spends money should be able to say why it is not there
 * instead of failing after the press — and here it is **absent rather than
 * greyed**, because the panel is complete without it: the read ideas are the
 * feature and this is more of them.
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

const NOT_CONFIGURED = 'Naming groupings is not configured on this deployment';
const SIGN_IN = 'Sign in to have groupings named';
const NO_LICENSE = 'An active VC Writer license is needed to have groupings named';
