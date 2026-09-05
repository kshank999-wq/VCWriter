import { NextResponse } from 'next/server';
import { z } from 'zod';
import { platformSchema } from '@vcwriter/domain';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';
import { currentUser } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  /** Windows or Mac, chosen before payment (spec §3.2). */
  platform: platformSchema,
  email: z.string().email().optional(),
});

/**
 * Start a Stripe Checkout session.
 *
 * Price and entitlement are decided server-side; the client only names the
 * platform it wants. Nothing here grants anything — the license is issued by
 * the webhook once Stripe confirms payment (§12.2).
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A platform of "windows" or "macos" is required' }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.email ?? parsed.data.email;

  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: env.stripePriceId, quantity: 1 }],
      success_url: `${env.siteUrl}/purchase/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/download?cancelled=1`,
      ...(email ? { customer_email: email } : {}),
      // Read back by the webhook; the platform choice is recorded on the order.
      metadata: {
        platform: parsed.data.platform,
        supabase_user_id: user?.id ?? '',
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Checkout could not be started';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
