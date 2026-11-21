import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chargeForRun, MAX_RUN_WORDS } from '@vcwriter/domain';
import { resolveCaller } from '@/lib/ai-caller';
import { isAiConfigured } from '@/lib/ai';
import { RULES, rateLimit } from '@/lib/rate-limit';
import { DeepCheckError, runDeepCheck, wordsIn, type DeepCheckRequest } from '@/lib/deep-check';
import { recordRunCost, refundRun, spendCredits } from '@/lib/edit-credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A deep check thinks before it answers; the platform default would cut it short.
export const maxDuration = 300;

/** The Edit Check's point-of-view settings, as the writer set them. */
const POV = {
  first_singular: 'first',
  first_plural: 'first',
  second: 'second',
  third_limited: 'third-limited',
  third_rotating: 'third-limited',
  third_omniscient: 'third-omniscient',
  third_objective: 'objective',
} as const;

const bodySchema = z.object({
  format: z.enum(['prose', 'screenplay']),
  pointOfView: z.string().max(40).optional(),
  tense: z.enum(['past', 'present', 'unspecified']).optional(),
  viewpoint: z.array(z.string().max(80)).max(20).optional(),
  /**
   * The passage, line by line, and nothing else from the project. An empty id
   * marks where a new scene starts in a run of short scenes.
   */
  lines: z
    .array(z.object({ id: z.string().max(80), type: z.string().max(40).optional(), text: z.string().max(20_000) }))
    .min(1)
    .max(2000),
});

/**
 * **The AI deep check** (addendum 47), paid for in edit credits.
 *
 * The run is charged before the model is asked — at least 1,000 words, then
 * in steps of 250 (`chargeForRun`) — so two runs started at once cannot spend
 * the same credits. A run that fails gives its words back. What comes back is
 * findings with no replacement wording, through the rewrite guard.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured()) return NextResponse.json({ error: 'The AI check is not configured on this deployment.' }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'A passage to check is required.' }, { status: 400 });

  const caller = await resolveCaller(request);
  if (!caller) return NextResponse.json({ error: 'Sign in to use the AI check.' }, { status: 401 });

  const limited = await rateLimit(request, RULES.deepCheck, undefined, caller.userId);
  if (limited) return limited;

  const lines = parsed.data.lines.filter((line) => line.text.trim());
  const words = wordsIn(lines.filter((line) => line.id));
  if (words === 0) return NextResponse.json({ error: 'There are no words to check.' }, { status: 400 });
  if (words > MAX_RUN_WORDS + 500) return NextResponse.json({ error: 'That passage is too long for one check.' }, { status: 413 });

  const charge = chargeForRun(words);
  const spent = await spendCredits(caller.userId, charge, `AI check, ${words.toLocaleString('en-US')} words`).catch((cause: Error) => cause);
  if (spent instanceof Error) return NextResponse.json({ error: spent.message }, { status: 500 });
  if (!spent.entryId) {
    return NextResponse.json({ error: 'Not enough edit credits for this check.', needed: charge, balance: spent.balance }, { status: 402 });
  }

  const pov = POV[parsed.data.pointOfView as keyof typeof POV];
  const check: DeepCheckRequest = {
    format: parsed.data.format,
    ...(pov ? { pointOfView: pov } : {}),
    ...(parsed.data.tense && parsed.data.tense !== 'unspecified' ? { tense: parsed.data.tense } : {}),
    ...(parsed.data.viewpoint?.length ? { viewpoint: parsed.data.viewpoint } : {}),
    lines: lines.map((line) => ({ id: line.id, text: line.text, ...(line.type ? { type: line.type } : {}) })),
    effort: 'medium',
  };

  try {
    const result = await runDeepCheck(check);
    await recordRunCost(spent.entryId, result.usage, result.costDollars);
    return NextResponse.json({
      // Findings on a scene-break marker are not on the writer's words.
      findings: result.findings.filter((one) => one.elementId),
      dropped: result.dropped.length,
      words,
      charged: charge,
      balance: spent.balance,
    });
  } catch (cause) {
    await refundRun(caller.userId, charge, 'AI check failed; words returned').catch(() => undefined);
    console.error('deep check failed', cause);
    const message = cause instanceof DeepCheckError ? cause.message : 'The AI check failed. Your credits were not used.';
    return NextResponse.json({ error: message, balance: spent.balance + charge }, { status: 502 });
  }
}
