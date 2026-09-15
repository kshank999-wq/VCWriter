import { NextResponse } from 'next/server';
import { z } from 'zod';
import { oneSheetText, renderOneSheetBody, type OneSheet } from '@vcwriter/domain';
import { resolveCaller } from '@/lib/ai-caller';
import { RULES, rateLimit } from '@/lib/rate-limit';
import { sendOneSheet } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Send a project's one-sheet to somebody (master spec §4's last bullet).
 *
 * **The request carries fields, never markup.** The obvious design — let the
 * client post the rendered sheet, since it already has it on screen — would
 * make vc-writer.com send whatever HTML anybody posted to it, over its own
 * domain and its own sending reputation. So the payload is the eight plain
 * strings a one-sheet is made of, and `renderOneSheetBody` builds and escapes
 * the markup here. The shape is the permission.
 *
 * **No poster**, for the same reason the domain's renderer can leave it out: a
 * few hundred kilobytes of data URI is most of a message-size limit spent on
 * something half the clients refuse to show.
 */
const bodySchema = z.object({
  to: z.string().email(),
  /** The writer's covering line. Plain text; it is escaped on the way out. */
  message: z.string().max(2_000).default(''),
  sheet: z.object({
    title: z.string().min(1).max(300),
    author: z.string().max(200).default(''),
    standfirst: z.string().max(200).default(''),
    logline: z.string().max(2_000).default(''),
    elevatorPitch: z.string().max(5_000).default(''),
    synopsis: z.string().max(20_000).default(''),
    notes: z.string().max(5_000).default(''),
    status: z.string().max(60).default(''),
    figures: z.string().max(200).default(''),
  }),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'An address and a one-sheet are required' }, { status: 400 });
  }

  // Signed in is the whole of the gate: sending your own one-sheet is not a
  // licensed feature, and it costs nothing but a message. It is **not** open to
  // anonymous callers, because an unauthenticated send endpoint is a spam relay.
  const caller = await resolveCaller(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sign in to send a one-sheet' }, { status: 401 });
  }

  const limited = await rateLimit(request, RULES.oneSheet, undefined, caller.userId);
  if (limited) return limited;

  // `poster: null` is the decision above made structural: there is no field in
  // the request that could carry one.
  const sheet: OneSheet = { ...parsed.data.sheet, poster: null };

  const result = await sendOneSheet({
    to: parsed.data.to,
    userId: caller.userId,
    from: sheet.author.trim().length > 0 ? sheet.author : 'a writer',
    projectTitle: sheet.title,
    message: parsed.data.message,
    sheetHtml: renderOneSheetBody(sheet, false),
    sheetText: oneSheetText(sheet),
  });

  if (!result.sent) {
    return NextResponse.json({ error: result.error ?? 'The one-sheet could not be sent' }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
